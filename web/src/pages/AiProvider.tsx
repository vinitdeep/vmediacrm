import { useEffect, useState } from 'react';
import { api } from '../api';
import { Icon } from '../icons';
import { Badge, Field, Input, Select, Spinner, act, confirmAsk, toast, useLoad } from '../ui';
import { SignupLink } from '../referrals';
import { useT } from '../i18n';

/**
 * KI-Anbieter for the KI-Assistent: Anthropic (Claude) or OpenAI (GPT), per sub-account with an agency
 * default. The OpenAI key is stored sealed and never shown again; the model can be picked or typed in.
 */

const CUSTOM = '__custom';

function ModelPicker({ value, onChange, models, fallback }: { value: string; onChange: (v: string) => void; models: { id: string; label: string }[]; fallback: string }) {
  const t = useT('b4ai');
  const known = !value || models.some((m) => m.id === value);
  const [forced, setForced] = useState(false);
  const custom = forced || !known;
  return (
    <>
      <Select
        value={custom ? CUSTOM : value}
        onChange={(v) => {
          setForced(v === CUSTOM);
          if (v !== CUSTOM) onChange(v);
        }}
        options={[['', `Standard (${fallback})`], ...models.map((m) => [m.id, m.label] as [string, string]), [CUSTOM, 'Anderes Modell (Freitext) …']]}
      />
      {custom && <Input value={value} onChange={onChange} placeholder={t('Modell-ID, z. B. gpt-5')} style={{ marginTop: 6 }} />}
    </>
  );
}

function OpenAiKeyField({ info, keyValue, setKey, onClear }: { info: any; keyValue: string; setKey: (v: string) => void; onClear: () => void }) {
  const t = useT('b4ai');
  const [edit, setEdit] = useState(false);
  const source: Record<string, string> = { agency: t('Schlüssel der Agentur'), server: t('Schlüssel des Servers (PGHL_OPENAI_API_KEY)') };
  return (
    <Field
      label={t('OpenAI-API-Schlüssel')}
      tour="ai-openai-key"
      hint={
        <>
          {t('Bekommst du unter')} <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">{t('platform.openai.com → API keys')}</a>{t('. Er wird verschlüsselt gespeichert und nie wieder angezeigt; die Kosten laufen über dein OpenAI-Konto.')} <SignupLink id="openai" />
        </>
      }
    >
      {info.key_set && !edit ? (
        <div className="row" style={{ alignItems: 'center' }}>
          <Badge tone="green">{t('hinterlegt')} {info.key_hint}</Badge>
          <button className="btn small secondary" onClick={() => setEdit(true)}>
            {t('Ersetzen')}
          </button>
          <button className="btn small secondary" onClick={() => confirmAsk(t('OpenAI-Schlüssel entfernen?')) && onClear()}>
            {t('Entfernen')}
          </button>
        </div>
      ) : (
        <>
          <Input type="password" autoComplete="off" value={keyValue} onChange={setKey} placeholder={info.key_source && info.key_source !== 'account' ? t('leer = {key_source}', { key_source: source[info.key_source] }) : 'sk-…'} />
          {!info.key_set && info.key_source && info.key_source !== 'account' && <small className="muted">{t('Ohne eigenen Schlüssel wird der')} {source[info.key_source]} genutzt.</small>}
        </>
      )}
    </Field>
  );
}

const COMPAT_IDS = ['gemini', 'groq'] as const;
type CompatId = (typeof COMPAT_IDS)[number];
const isCompat = (p: string | null | undefined): p is CompatId => p === 'gemini' || p === 'groq';
const COMPAT_HINT: Record<CompatId, string> = {
  gemini: 'Kostenloser Schlüssel aus Google AI Studio (ohne Karte; Gratis-Kontingent mit Ratenlimits).',
  groq: 'Kostenloser Schlüssel aus der Groq-Konsole (ohne Karte; Gratis-Kontingent mit Ratenlimits).',
};
const COMPAT_MODEL_HINT: Record<CompatId, string> = {
  gemini: 'Gemini 2.5 Flash ist schnell und passt zum Gratis-Kontingent; Pro für schwierigere Aufgaben.',
  groq: 'Llama 3.3 70B ist ein guter Allrounder; jede Groq-Modell-ID geht als Freitext.',
};

/** Key + model + test for Google Gemini or Groq (OpenAI-compatible, modules/ai-providers.ts). */
function CompatFields({ id, info, keyValue, setKey, model, setModel, onClear, testPath }: { id: CompatId; info: any; keyValue: string; setKey: (v: string) => void; model: string; setModel: (v: string) => void; onClear: () => void; testPath: string }) {
  const t = useT('b4ai');
  const [edit, setEdit] = useState(false);
  const source: Record<string, string> = { agency: t('Schlüssel der Agentur'), server: t('Schlüssel des Servers ({env})', { env: id === 'gemini' ? 'PGHL_GEMINI_API_KEY' : 'PGHL_GROQ_API_KEY' }) };
  return (
    <>
      <div className="grid2">
        <Field
          label={t('{label}-API-Schlüssel', { label: info.label })}
          hint={
            <>
              {t(COMPAT_HINT[id])}{' '}
              <a href={info.key_url} target="_blank" rel="noreferrer">
                {t('Kostenlosen Schlüssel holen')} ↗
              </a>
              {t('. Er wird verschlüsselt gespeichert und nie wieder angezeigt.')}
            </>
          }
        >
          {info.key_set && !edit ? (
            <div className="row" style={{ alignItems: 'center' }}>
              <Badge tone="green">{t('hinterlegt')} {info.key_hint}</Badge>
              <button className="btn small secondary" onClick={() => setEdit(true)}>
                {t('Ersetzen')}
              </button>
              <button className="btn small secondary" onClick={() => confirmAsk(t('{label}-Schlüssel entfernen?', { label: info.label })) && onClear()}>
                {t('Entfernen')}
              </button>
            </div>
          ) : (
            <>
              <Input type="password" autoComplete="off" value={keyValue} onChange={setKey} placeholder={info.key_source && info.key_source !== 'account' ? t('leer = {key_source}', { key_source: source[info.key_source] }) : info.key_placeholder} />
              {!info.key_set && info.key_source && info.key_source !== 'account' && <small className="muted">{t('Ohne eigenen Schlüssel wird der')} {source[info.key_source]} genutzt.</small>}
            </>
          )}
        </Field>
        <Field label={t('{label}-Modell', { label: info.label })} hint={t(COMPAT_MODEL_HINT[id])}>
          <ModelPicker value={model} onChange={setModel} models={info.models} fallback={info.default_model} />
        </Field>
      </div>
      <div className="row">
        <button
          className="btn secondary"
          disabled={!keyValue.trim() && !info.key_source}
          onClick={async () => {
            const r = await act(() => api.post(testPath, { provider: id, key: keyValue.trim() || undefined, model: model || undefined }));
            if (r) toast(t('Verbindung ok – {model} erreichbar', { model: r.model }));
          }}
        >
          {t('{label} testen', { label: info.label })}
        </button>
      </div>
    </>
  );
}

/** Card at the top of Einstellungen → KI-Assistent → Einrichtung. */
export function AiProviderCard({ onChange, onPick, onDraft, version = 0 }: { onChange: () => void; onPick?: (provider: string) => void; onDraft?: (body: Record<string, string> | null) => void; version?: number }) {
  const t = useT('b4ai');
  const p = useLoad(() => api.get<any>('/api/ai/provider'), [version]);
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
  const [key, setKey] = useState('');
  const [cModel, setCModel] = useState<Record<CompatId, string>>({ gemini: '', groq: '' });
  const [cKey, setCKey] = useState<Record<CompatId, string>>({ gemini: '', groq: '' });
  useEffect(() => {
    if (p.data) (setProvider(p.data.provider), setModel(p.data.openai.model), setKey(''), setCModel({ gemini: p.data.compat?.gemini?.model ?? '', groq: p.data.compat?.groq?.model ?? '' }), setCKey({ gemini: '', groq: '' }));
  }, [p.data]);
  const compatBody = () => {
    const b: Record<string, string> = {};
    for (const id of COMPAT_IDS) {
      b[`${id}_model`] = cModel[id];
      if (cKey[id].trim()) b[`${id}_key`] = cKey[id].trim();
    }
    return b;
  };
  // Unsaved changes go along with the page's main „Speichern“ too.
  const dirty = !!p.data && (provider !== p.data.provider || model !== p.data.openai.model || !!key.trim() || COMPAT_IDS.some((id) => cModel[id] !== (p.data.compat?.[id]?.model ?? '') || !!cKey[id].trim()));
  useEffect(() => {
    onDraft?.(dirty ? { provider, openai_model: model, ...(key.trim() ? { openai_key: key.trim() } : {}), ...compatBody() } : null);
  }, [dirty, provider, model, key, cModel, cKey]);
  // The settings below follow the provider picked here, saved or not.
  const effective = p.data ? provider || p.data.agency_default : null;
  useEffect(() => {
    if (effective) onPick?.(effective);
  }, [effective]);
  if (!p.data) return <Spinner />;
  const d = p.data;
  const label = (id: string) => d.providers.find((x: any) => x.id === id)?.label ?? id;
  const save = async (extra: any = {}) => {
    const r = await act(() => api.put('/api/ai/provider', { provider, openai_model: model, ...(key.trim() ? { openai_key: key.trim() } : {}), ...compatBody(), ...extra }), t('Gespeichert'));
    if (r) (p.setData(r), setKey(''), onChange());
  };
  return (
    <div className="ai-provider" data-tour="ai-provider">
      {d.routed && (
        <p className="card small" style={{ background: 'var(--brand-soft)' }}>
          {t('Schnelle KI-Texte laufen gerade über')} <strong>{d.routed.label}{d.routed.model ? ` · ${d.routed.model}` : ''}</strong> {t('(Einstellungen → KI-Anbieter → „Wofür welches Modell?“). Die Wahl hier gilt wieder, sobald die Zuordnung dort entfernt wird.')}
        </p>
      )}
      <Field label={t('KI-Anbieter')} hint={t('„Wie die Agentur“ folgt dem Standard der Agentur (gerade: {agency_default}). Vorschläge, Chat-Bot, Workflows, Telefonagent, Video-Recycling und App-Diktat nutzen alle diesen Anbieter.', { agency_default: label(d.agency_default) })}>
        <Select value={provider} onChange={setProvider} options={[['', t('Wie die Agentur ({agency_default})', { agency_default: label(d.agency_default) })], ['anthropic', 'Anthropic (Claude)'], ['openai', 'OpenAI (GPT)'], ['gemini', 'Google Gemini (free tier)'], ['groq', 'Groq (free tier)']]} />
      </Field>
      {isCompat(effective) && d.compat?.[effective] && (
        <CompatFields
          id={effective}
          info={d.compat[effective]}
          keyValue={cKey[effective]}
          setKey={(v) => setCKey({ ...cKey, [effective]: v })}
          model={cModel[effective]}
          setModel={(v) => setCModel({ ...cModel, [effective]: v })}
          onClear={() => save({ [`${effective}_key`]: null })}
          testPath="/api/ai/provider/test"
        />
      )}
      {effective === 'openai' && (
        <div className="grid2">
          <OpenAiKeyField info={d.openai} keyValue={key} setKey={setKey} onClear={() => save({ openai_key: null })} />
          <Field label={t('OpenAI-Modell')} tour="ai-openai-model" hint={t('GPT-5 mini reicht für fast alles; eigene Modell-IDs (auch feinjustierte) gehen als Freitext.')}>
            <ModelPicker value={model} onChange={setModel} models={d.openai.models} fallback={d.openai.default_model} />
          </Field>
        </div>
      )}
      <div className="row">
        <button className="btn secondary" onClick={() => save()}>
          {t('Anbieter speichern')}
        </button>
        {effective === 'openai' && (
          <button
            className="btn secondary"
            disabled={!key.trim() && !d.openai.key_source}
            onClick={async () => {
              const r = await act(() => api.post('/api/ai/provider/test', { openai_key: key.trim() || undefined, model: model || undefined }));
              if (r) toast(t('Verbindung ok – {model} erreichbar', { model: r.model }));
            }}
          >
            {t('OpenAI testen')}
          </button>
        )}
      </div>
      <hr />
    </div>
  );
}

/** Agency default (agency → KI-Werkzeuge). */
export function AgencyAiProvider() {
  const t = useT('b4ai');
  const p = useLoad(() => api.get<any>('/api/agency/ai-provider'), []);
  const [provider, setProvider] = useState('anthropic');
  const [model, setModel] = useState('');
  const [key, setKey] = useState('');
  const [cModel, setCModel] = useState<Record<CompatId, string>>({ gemini: '', groq: '' });
  const [cKey, setCKey] = useState<Record<CompatId, string>>({ gemini: '', groq: '' });
  useEffect(() => {
    if (p.data) (setProvider(p.data.provider), setModel(p.data.openai.model), setCModel({ gemini: p.data.compat?.gemini?.model ?? '', groq: p.data.compat?.groq?.model ?? '' }), setCKey({ gemini: '', groq: '' }));
  }, [p.data]);
  if (!p.data) return <Spinner />;
  const save = async (extra: any = {}) => {
    const cb: Record<string, string> = {};
    for (const id of COMPAT_IDS) {
      cb[`${id}_model`] = cModel[id];
      if (cKey[id].trim()) cb[`${id}_key`] = cKey[id].trim();
    }
    const r = await act(() => api.put('/api/agency/ai-provider', { provider, openai_model: model, ...(key.trim() ? { openai_key: key.trim() } : {}), ...cb, ...extra }), t('Gespeichert'));
    if (r) (p.setData(r), setKey(''));
  };
  return (
    <div className="card" data-tour="ai-provider-agency">
      <h2>
        <Icon name="ai" size={18} /> {t('KI-Anbieter (Standard für alle Sub-Accounts)')}
      </h2>
      <p className="muted small">{t('Gilt für den KI-Assistenten jedes Sub-Accounts, der unter Einstellungen → KI-Assistent nichts Eigenes gewählt hat. Ein Agentur-Schlüssel für OpenAI wird dann von allen genutzt – Limits und Protokoll bleiben je Sub-Account.')}</p>
      <Field label={t('Anbieter')}>
        <Select value={provider} onChange={setProvider} options={[['anthropic', 'Anthropic (Claude)'], ['openai', 'OpenAI (GPT)'], ['gemini', 'Google Gemini (free tier)'], ['groq', 'Groq (free tier)']]} />
      </Field>
      {isCompat(provider) && p.data.compat?.[provider] && (
        <CompatFields
          id={provider}
          info={p.data.compat[provider]}
          keyValue={cKey[provider]}
          setKey={(v) => setCKey({ ...cKey, [provider]: v })}
          model={cModel[provider]}
          setModel={(v) => setCModel({ ...cModel, [provider]: v })}
          onClear={() => save({ [`${provider}_key`]: null })}
          testPath="/api/agency/ai-provider/test"
        />
      )}
      {provider === 'openai' && (
        <>
          <OpenAiKeyField info={p.data.openai} keyValue={key} setKey={setKey} onClear={() => save({ openai_key: null })} />
          <Field label={t('OpenAI-Modell')}>
            <ModelPicker value={model} onChange={setModel} models={p.data.openai.models} fallback="gpt-5-mini" />
          </Field>
        </>
      )}
      <div className="row">
        <button className="btn" onClick={() => save()}>
          {t('Speichern')}
        </button>
        {provider === 'openai' && (
        <button
          className="btn secondary"
          disabled={!key.trim() && !p.data.openai.key_source}
          onClick={async () => {
            const r = await act(() => api.post('/api/agency/ai-provider/test', { openai_key: key.trim() || undefined, model: model || undefined }));
            if (r) toast(t('Verbindung ok – {model} erreichbar', { model: r.model }));
          }}
        >
          {t('OpenAI testen')}
        </button>
        )}
      </div>
    </div>
  );
}
