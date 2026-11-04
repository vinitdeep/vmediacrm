import type { Module } from '../core/app.js';
import { HttpError, bad, str } from '../core/http.js';
import { now } from '../core/util.js';
import type { Effort } from '../services/ai-effort.js';
import { AiError } from '../services/anthropic.js';
import type { Usage } from '../services/anthropic.js';
import { DEFAULT_MODEL, KEY_RE, MODELS, MODEL_RE, callOpenAi, checkKey, costMicros, type OpenAiRequest } from '../services/openai.js';
import { completeText } from '../services/ai-compat.js';
import { presetById, textCost } from '../services/ai-presets.js';
import { openSecret, sealSecret } from './mail-sync.js';

/**
 * AI provider for the KI-Assistent: Anthropic (Claude, built into ai-assistant.ts) or OpenAI (Responses API),
 * per sub-account with an agency default. The OpenAI key is sealed per sub-account, else the agency's key,
 * else PGHL_OPENAI_API_KEY. ai-assistant's `aiRun` asks `app.services.aiProvider(locationId)`: null means
 * Claude, otherwise it calls the returned provider – so every consumer (replies, summaries, chat bot,
 * workflow "KI-Text", voice agent, video recycling, mobile capture) works with either, with the same
 * monthly limit and log per sub-account. Test hook: `app.services.openaiFetch`.
 */

export type ProviderId = 'anthropic' | 'openai' | 'gemini' | 'groq';
const PROVIDERS: ProviderId[] = ['anthropic', 'openai', 'gemini', 'groq'];
const AGENCY_KEY = 'ai_provider';

/**
 * OpenAI-compatible providers (Chat Completions) picked straight in the KI-Assistent: Google Gemini (free tier via
 * Google AI Studio) and Groq (free tier). Calls go through services/ai-compat.ts with the preset's base URL
 * (services/ai-presets.ts) - no BYOK connection needed. Key per sub-account, else the agency's, else the env var.
 */
type CompatId = 'gemini' | 'groq';
const COMPAT: Record<CompatId, { label: string; defaultModel: string; keyRe: RegExp; keyHint: string; env: string; keyUrl: string }> = {
  gemini: { label: 'Google Gemini', defaultModel: 'gemini-2.5-flash', keyRe: /^AIza[0-9A-Za-z_-]{20,}$/, keyHint: 'AIza…', env: 'PGHL_GEMINI_API_KEY', keyUrl: 'https://aistudio.google.com/app/apikey' },
  groq: { label: 'Groq', defaultModel: 'llama-3.3-70b-versatile', keyRe: /^gsk_[0-9A-Za-z]{20,}$/, keyHint: 'gsk_…', env: 'PGHL_GROQ_API_KEY', keyUrl: 'https://console.groq.com/keys' },
};
const isCompat = (p: string): p is CompatId => p === 'gemini' || p === 'groq';
const COMPAT_MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9._:\/-]{0,99}$/;
type CompatStore = Partial<Record<CompatId, { model?: string; key?: string | null }>>;
const compatEnv = (id: CompatId) => (process.env[COMPAT[id].env] ?? '').trim();

interface AgencyDefault {
  provider: ProviderId;
  openai_model: string;
  openai_key: string | null;
  compat: CompatStore;
}

export interface AiProviderCall {
  system: OpenAiRequest['system'];
  messages: OpenAiRequest['messages'];
  maxTokens: number;
  schema?: Record<string, unknown>;
  timeoutMs?: number;
  /** Denkstufe and whether it is strict (Werkstatt): services/ai-effort.ts. */
  effort?: Effort;
  strictEffort?: boolean;
}

/** What `app.services.aiProvider(locationId)` returns for a non-Claude provider. */
export interface AiProvider {
  /** 'openai' – or the preset of a BYOK connection (modules/ai-connections.ts) the text routing points to. */
  provider: string;
  label: string;
  model: string;
  apiKey: string | null;
  keySource: 'account' | 'agency' | 'server' | 'registry' | null;
  /** Set when a BYOK connection serves the call. */
  connectionId?: string;
  call: (input: AiProviderCall) => ReturnType<typeof callOpenAi>;
  cost: (model: string, usage: Usage) => number;
}

const envKey = () => (process.env.PGHL_OPENAI_API_KEY ?? '').trim();

export const aiProvidersModule: Module = {
  name: 'ai-providers',
  migrations: [
    [
      '001-init',
      `CREATE TABLE ai_provider_settings (
        location_id TEXT PRIMARY KEY REFERENCES locations(id) ON DELETE CASCADE,
        provider TEXT NOT NULL DEFAULT '', openai_model TEXT NOT NULL DEFAULT '', openai_key TEXT, updated_at TEXT NOT NULL
      );`,
    ],
    ['002-compat', `ALTER TABLE ai_provider_settings ADD COLUMN compat TEXT NOT NULL DEFAULT '{}';`],
  ],
  register(app) {
    const { db, router } = app;
    const fetchAi = (url: string, init: RequestInit) => ((app.services.openaiFetch as typeof fetch | undefined) ?? fetch)(url, init);

    const open = (sealed: string | null | undefined): string | null => {
      if (!sealed) return null;
      try {
        return openSecret(app, sealed);
      } catch {
        return null;
      }
    };
    const hint = (sealed: string | null | undefined) => {
      if (!sealed) return '';
      const k = open(sealed);
      return k ? `…${k.slice(-4)}` : '(nicht lesbar – bitte neu eintragen)';
    };
    const agency = (): AgencyDefault => {
      const row = db.get('SELECT value FROM agency_settings WHERE key = ?', AGENCY_KEY);
      const v = row ? JSON.parse(row.value) : {};
      return { provider: PROVIDERS.includes(v.provider) ? v.provider : 'anthropic', openai_model: String(v.openai_model ?? ''), openai_key: v.openai_key ?? null, compat: v.compat && typeof v.compat === 'object' ? v.compat : {} };
    };
    const saveAgency = (v: AgencyDefault) => db.run('INSERT INTO agency_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', AGENCY_KEY, JSON.stringify(v));
    const local = (locId: string) => {
      const row = db.get<{ provider: string; openai_model: string; openai_key: string | null; compat: string }>('SELECT provider, openai_model, openai_key, compat FROM ai_provider_settings WHERE location_id = ?', locId);
      if (!row) return { provider: '', openai_model: '', openai_key: null as string | null, compat: {} as CompatStore };
      let compat: CompatStore = {};
      try {
        compat = JSON.parse(row.compat || '{}') ?? {};
      } catch {
        compat = {};
      }
      return { provider: row.provider, openai_model: row.openai_model, openai_key: row.openai_key, compat };
    };
    /** Effective key and model of Gemini/Groq for a sub-account (own -> agency -> env). */
    const compatResolve = (locId: string, id: CompatId) => {
      const l = local(locId).compat[id] ?? {};
      const a = agency().compat[id] ?? {};
      const own = open(l.key);
      const ag = open(a.key);
      const env = compatEnv(id);
      return {
        model: l.model || a.model || COMPAT[id].defaultModel,
        apiKey: own ?? ag ?? (env || null),
        keySource: (own ? 'account' : ag ? 'agency' : env ? 'server' : null) as AiProvider['keySource'],
      };
    };
    const compatTarget = (id: CompatId, model: string, apiKey: string) => {
      const preset = presetById(id)!;
      return { provider: id, baseUrl: preset.baseUrl, model, headers: { authorization: `Bearer ${apiKey}` }, options: {}, wire: 'openai' as const, label: COMPAT[id].label, capabilities: preset.capabilities };
    };
    const compatProvider = (id: CompatId, model: string, apiKey: string | null, keySource: AiProvider['keySource']): AiProvider => ({
      provider: id,
      label: COMPAT[id].label,
      model,
      apiKey,
      keySource,
      call: (input) => {
        if (!apiKey) throw new AiError(`Kein ${COMPAT[id].label}-API-Schlüssel hinterlegt (Einstellungen → KI-Assistent).`, 409, 'no_key');
        return completeText(compatTarget(id, model, apiKey), input, fetchAi, { baseUrl: app.baseUrl(), name: 'V Media CRM' });
      },
      cost: (m, usage) => textCost({ provider: id, model: m, options: {} } as any, usage),
    });

    /** Effective provider, model and key for a sub-account. */
    const resolve = (locId: string) => {
      const l = local(locId);
      const a = agency();
      const provider: ProviderId = (PROVIDERS as string[]).includes(l.provider) ? (l.provider as ProviderId) : a.provider;
      const own = open(l.openai_key);
      const ag = open(a.openai_key);
      const apiKey = own ?? ag ?? (envKey() || null);
      const keySource = own ? 'account' : ag ? 'agency' : envKey() ? 'server' : null;
      return { provider, source: l.provider ? 'account' : 'agency', model: l.openai_model || a.openai_model || DEFAULT_MODEL, apiKey, keySource } as const;
    };

    const provider = (model: string, apiKey: string | null, keySource: AiProvider['keySource']): AiProvider => ({
      provider: 'openai',
      label: 'OpenAI',
      model,
      apiKey,
      keySource,
      call: (input) => {
        if (!apiKey) throw new AiError('Kein OpenAI-API-Schlüssel hinterlegt (Einstellungen → KI-Assistent).', 409, 'no_key');
        return callOpenAi({ apiKey, model, system: input.system, messages: input.messages, maxTokens: input.maxTokens, schema: input.schema, timeoutMs: input.timeoutMs, effort: input.effort, strictEffort: input.strictEffort }, fetchAi);
      },
      cost: (m, usage) => costMicros(m, usage),
    });
    /** null = Claude (built into ai-assistant), else the OpenAI provider with model and key. */
    app.services.aiProvider = (locId: string, purpose?: string, userId?: string | null): AiProvider | null => {
      // A person's own ChatGPT sign-in (modules/ai-subscriptions.ts) serves only their own interactive actions.
      const own: AiProvider | null = userId ? (app.services.aiSubscriptions?.providerFor?.({ locationId: locId, purpose, userId }) ?? null) : null;
      if (own) return own;
      // KI-Anbieter (BYOK): a routing for quick texts/summaries to any connection wins over the choice here.
      const routed: AiProvider | null = app.services.aiConnections?.textProvider?.(locId, purpose) ?? null;
      if (routed) return routed;
      const r = resolve(locId);
      if (isCompat(r.provider)) {
        const c = compatResolve(locId, r.provider);
        return compatProvider(r.provider, c.model, c.apiKey, c.keySource);
      }
      return r.provider === 'openai' ? provider(r.model, r.apiKey, r.keySource) : null;
    };

    // Integrations catalogue: OpenAI as provider of the KI-Assistent.
    app.services.catalogExtra = [
      ...(app.services.catalogExtra ?? []),
      {
        entry: {
          key: 'openai',
          name: 'OpenAI (GPT)',
          category: 'KI',
          icon: 'ai',
          scope: 'location',
          setup: { location: 'settings/ai', agency: 'agency/ai-tools' },
          description: 'KI-Assistent mit GPT statt Claude: Antwortvorschläge, Chat-Bot, KI-Texte in Workflows, Telefonagent, Video-Recycling.',
          credentials: 'OpenAI-API-Schlüssel (sk-…) unter Einstellungen → KI-Assistent → KI-Anbieter – oder einer für alle unter Agentur → KI-Werkzeuge.',
          docs: 'docs/ai-assistant.md#ai-provider-anthropic-or-openai',
          guide: ['Schlüssel unter platform.openai.com → API keys erzeugen.', 'Einstellungen → KI-Assistent → KI-Anbieter „OpenAI“ wählen, Schlüssel eintragen, Modell wählen, „OpenAI testen“.', 'Assistent einschalten – Limit und Protokoll gelten wie bei Claude.'],
        },
        location: (_ctx: unknown, loc: string) => {
          const r = resolve(loc);
          if (r.provider !== 'openai') return { status: 'info', detail: 'Nicht gewählt (Claude aktiv)' };
          return r.apiKey ? { status: 'ok', detail: `${r.model} · ${r.keySource === 'account' ? 'eigener Schlüssel' : r.keySource === 'agency' ? 'Agentur-Schlüssel' : 'Server-Schlüssel'}` } : { status: 'missing', detail: 'Kein OpenAI-Schlüssel' };
        },
        agency: () => {
          const a = agency();
          return a.provider === 'openai' ? { status: a.openai_key || envKey() ? 'ok' : 'missing', detail: `Standard: OpenAI ${a.openai_model || DEFAULT_MODEL}` } : { status: 'info', detail: 'Standard: Claude' };
        },
      },
    ];

    // --- validation ---------------------------------------------------------------------
    const cleanModel = (v: unknown) => {
      const s = str(v, 'Modell', { max: 100 });
      if (s && !MODEL_RE.test(s)) throw bad('Modell: bitte die Modell-ID von OpenAI eintragen, z. B. gpt-5-mini');
      return s;
    };
    const cleanKey = (v: unknown) => {
      const k = str(v, 'API-Schlüssel', { max: 400 });
      if (!KEY_RE.test(k)) throw bad('Das sieht nicht nach einem OpenAI-API-Schlüssel aus (beginnt mit sk-).');
      return k;
    };
    const cleanCompatModel = (v: unknown) => {
      const s = str(v, 'Modell', { max: 100 });
      if (s && !COMPAT_MODEL_RE.test(s)) throw bad('Modell: bitte eine gültige Modell-ID eintragen');
      return s;
    };
    const cleanCompatKey = (id: CompatId, v: unknown) => {
      const k = str(v, 'API-Schlüssel', { max: 400 });
      if (!COMPAT[id].keyRe.test(k)) throw bad(`Das sieht nicht nach einem ${COMPAT[id].label}-API-Schlüssel aus (beginnt mit ${COMPAT[id].keyHint.replace('…', '')}).`);
      return k;
    };
    /** Applies gemini_key/gemini_model/groq_key/groq_model (key null = remove) to a stored compat object. */
    const compatPatch = (b: any, cur: CompatStore): CompatStore => {
      const next: CompatStore = { ...cur };
      for (const id of ['gemini', 'groq'] as CompatId[]) {
        const e = { ...(next[id] ?? {}) };
        if (b[`${id}_model`] !== undefined) e.model = cleanCompatModel(b[`${id}_model`]);
        if (b[`${id}_key`] === null) e.key = null;
        else if (b[`${id}_key`]) e.key = sealSecret(app, cleanCompatKey(id, b[`${id}_key`]));
        next[id] = e;
      }
      return next;
    };
    /** Checks a Gemini/Groq key against the provider's /models endpoint - costs no tokens. */
    const testCompat = async (id: CompatId, key: string, model: string) => {
      const preset = presetById(id)!;
      let r: Response;
      try {
        r = await fetchAi(`${preset.baseUrl}/models`, { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15_000) });
      } catch (e) {
        throw new HttpError(502, `${COMPAT[id].label} nicht erreichbar: ${(e as Error).message}`);
      }
      if (r.status === 401 || r.status === 403 || r.status === 400) throw new HttpError(400, `${COMPAT[id].label} hat den Schlüssel abgelehnt (${r.status}).`);
      if (!r.ok) throw new HttpError(502, `${COMPAT[id].label} antwortet mit ${r.status}.`);
      return { ok: true, model };
    };
    const compatOut = (id: CompatId, mine: { model?: string; key?: string | null } | undefined, eff: { model: string; keySource: AiProvider['keySource'] }, defaultModel: string) => ({
      label: COMPAT[id].label,
      model: mine?.model ?? '',
      effective_model: eff.model,
      default_model: defaultModel,
      models: (presetById(id)?.models.text ?? []).map((m) => ({ id: m, label: m })),
      key_set: !!mine?.key,
      key_hint: hint(mine?.key),
      key_source: eff.keySource,
      key_placeholder: COMPAT[id].keyHint,
      key_url: COMPAT[id].keyUrl,
    });
    const keyPatch = (b: any, cur: string | null) => {
      if (b.openai_key === null || b.clear_key === true) return null;
      if (b.openai_key) return sealSecret(app, cleanKey(b.openai_key));
      return cur;
    };
    const test = async (key: string, model: string) => {
      try {
        const r = await checkKey(key, model, fetchAi);
        return { ok: true, model: r.model };
      } catch (e) {
        const err = e instanceof AiError ? e : new AiError((e as Error).message);
        throw new HttpError(err.status, err.message);
      }
    };

    // --- sub-account --------------------------------------------------------------------
    const out = (locId: string) => {
      const l = local(locId);
      const a = agency();
      const r = resolve(locId);
      return {
        provider: l.provider,
        effective: r.provider,
        source: r.source,
        agency_default: a.provider,
        providers: [
          { id: 'anthropic', label: 'Anthropic (Claude)' },
          { id: 'openai', label: 'OpenAI (GPT)' },
          { id: 'gemini', label: 'Google Gemini' },
          { id: 'groq', label: 'Groq' },
        ],
        openai: { model: l.openai_model, effective_model: r.model, default_model: a.openai_model || DEFAULT_MODEL, models: MODELS, key_set: !!l.openai_key, key_hint: hint(l.openai_key), key_source: r.keySource },
        compat: Object.fromEntries((['gemini', 'groq'] as CompatId[]).map((id) => [id, compatOut(id, l.compat[id], compatResolve(locId, id), a.compat[id]?.model || COMPAT[id].defaultModel)])),
        // Quick texts routed to a BYOK connection (KI-Anbieter) – shown as a hint above the choice here.
        routed: (() => {
          const p: AiProvider | null = app.services.aiConnections?.textProvider?.(locId) ?? null;
          return p ? { label: p.label, model: p.model, connection_id: p.connectionId } : null;
        })(),
      };
    };
    router.get('/api/ai/provider', 'location', (ctx) => out(ctx.locationId));
    router.put('/api/ai/provider', 'location', (ctx) => {
      const b = ctx.body ?? {};
      const cur = local(ctx.locationId);
      const next = { ...cur };
      if (b.provider !== undefined) {
        if (b.provider !== '' && !PROVIDERS.includes(b.provider)) throw bad('Anbieter: anthropic, openai, gemini oder groq');
        next.provider = b.provider;
      }
      if (b.openai_model !== undefined) next.openai_model = cleanModel(b.openai_model);
      next.openai_key = keyPatch(b, cur.openai_key);
      next.compat = compatPatch(b, cur.compat);
      db.run(
        `INSERT INTO ai_provider_settings (location_id, provider, openai_model, openai_key, compat, updated_at) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(location_id) DO UPDATE SET provider = excluded.provider, openai_model = excluded.openai_model, openai_key = excluded.openai_key, compat = excluded.compat, updated_at = excluded.updated_at`,
        ctx.locationId,
        next.provider,
        next.openai_model,
        next.openai_key,
        JSON.stringify(next.compat),
        now(),
      );
      return out(ctx.locationId);
    });
    /** Checks the OpenAI key (typed or effective) against the Models API – costs no tokens. */
    router.post('/api/ai/provider/test', 'location', async (ctx) => {
      const which = String(ctx.body?.provider ?? '');
      if (isCompat(which)) {
        const typedC = ctx.body?.key ? cleanCompatKey(which, ctx.body.key) : '';
        const c = compatResolve(ctx.locationId, which);
        const k = typedC || c.apiKey;
        if (!k) throw bad(`Bitte zuerst einen ${COMPAT[which].label}-API-Schlüssel eintragen.`);
        return testCompat(which, k, cleanCompatModel(ctx.body?.model) || c.model);
      }
      const typed = ctx.body?.openai_key ? cleanKey(ctx.body.openai_key) : '';
      const r = resolve(ctx.locationId);
      const key = typed || r.apiKey;
      if (!key) throw bad('Bitte zuerst einen OpenAI-API-Schlüssel eintragen.');
      return test(key, cleanModel(ctx.body?.model) || r.model);
    });

    // --- agency default -----------------------------------------------------------------
    const agencyOut = () => {
      const a = agency();
      return {
        provider: a.provider,
        openai: { model: a.openai_model, effective_model: a.openai_model || DEFAULT_MODEL, models: MODELS, key_set: !!a.openai_key, key_hint: hint(a.openai_key), key_source: a.openai_key ? 'agency' : envKey() ? 'server' : null },
        compat: Object.fromEntries(
          (['gemini', 'groq'] as CompatId[]).map((id) => {
            const e = a.compat[id] ?? {};
            return [id, compatOut(id, e, { model: e.model || COMPAT[id].defaultModel, keySource: e.key ? 'agency' : compatEnv(id) ? 'server' : null }, COMPAT[id].defaultModel)];
          }),
        ),
      };
    };
    router.get('/api/agency/ai-provider', 'admin', () => agencyOut());
    router.put('/api/agency/ai-provider', 'admin', (ctx) => {
      const b = ctx.body ?? {};
      const a = agency();
      if (b.provider !== undefined) {
        if (!PROVIDERS.includes(b.provider)) throw bad('Anbieter: anthropic, openai, gemini oder groq');
        a.provider = b.provider;
      }
      if (b.openai_model !== undefined) a.openai_model = cleanModel(b.openai_model);
      a.openai_key = keyPatch(b, a.openai_key);
      a.compat = compatPatch(b, a.compat);
      saveAgency(a);
      return agencyOut();
    });
    router.post('/api/agency/ai-provider/test', 'admin', async (ctx) => {
      const which = String(ctx.body?.provider ?? '');
      if (isCompat(which)) {
        const e = agency().compat[which] ?? {};
        const k = (ctx.body?.key ? cleanCompatKey(which, ctx.body.key) : '') || open(e.key) || compatEnv(which);
        if (!k) throw bad(`Bitte zuerst einen ${COMPAT[which].label}-API-Schlüssel eintragen.`);
        return testCompat(which, k, cleanCompatModel(ctx.body?.model) || e.model || COMPAT[which].defaultModel);
      }
      const typed = ctx.body?.openai_key ? cleanKey(ctx.body.openai_key) : '';
      const a = agency();
      const key = typed || open(a.openai_key) || envKey();
      if (!key) throw bad('Bitte zuerst einen OpenAI-API-Schlüssel eintragen.');
      return test(key, cleanModel(ctx.body?.model) || a.openai_model || DEFAULT_MODEL);
    });
  },
};
