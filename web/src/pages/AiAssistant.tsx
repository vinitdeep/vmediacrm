import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../icons';
import { api, currentLocation, dt } from '../api';
import { Badge, Check, Empty, Field, Input, Link, MergeHint, Select, Spinner, Stat, TagInput, Tabs, Textarea, act, confirmAsk, toast, useLoad } from '../ui';
import { AiProviderCard } from './AiProvider';
import { SignupLink } from '../referrals';
import { MoreFields } from '../areas/fields';
import { lazyPages } from '../lazy';
import { SortableGrid } from '../sortable/Sortable';
import { useT } from '../i18n';
// "Termin buchen" of the chat bot – a part of the calendar view's chunk (docs/booking.md#ai-books-appointments).
const { AiBookingSettings } = lazyPages(() => import('./AiBookingSettings'), 'AiBookingSettings');

/** KI-Assistent: settings tab, inbox helpers (suggest button, side panel) and the workflow step. */

const DAYS: [string, string][] = [
  ['mon', 'Montag'],
  ['tue', 'Dienstag'],
  ['wed', 'Mittwoch'],
  ['thu', 'Donnerstag'],
  ['fri', 'Freitag'],
  ['sat', 'Samstag'],
  ['sun', 'Sonntag'],
];
const MODES: [string, string][] = [
  ['off', 'Aus – nur Vorschläge für das Team'],
  ['after_hours', 'Außerhalb der Geschäftszeiten antworten'],
  ['always', 'Immer antworten'],
];
const STATUS: Record<string, [string, 'green' | 'red' | 'yellow']> = { ok: ['ok', 'green'], error: ['Fehler', 'red'], blocked: ['Limit', 'yellow'] };

const usd = (v: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: v > 0 && v < 0.1 ? 4 : 2 }).format(v || 0);
const n = (v: number) => new Intl.NumberFormat('de-DE').format(v || 0);

export const isBotMessage = (m: any) => typeof m?.source === 'string' && m.source.startsWith('KI-');

/** Shared, briefly cached: is the assistant on for this sub-account? */
let statusCache: { at: number; loc: string; p: Promise<any> } | null = null;
function useAiStatus() {
  const loc = currentLocation();
  return useLoad(() => {
    if (!statusCache || statusCache.loc !== loc || Date.now() - statusCache.at > 60_000) statusCache = { at: Date.now(), loc, p: api.get('/api/ai/status').catch(() => ({ enabled: false })) };
    return statusCache.p;
  }, [loc]);
}

// --- settings ------------------------------------------------------------------------------

export function AiSettings() {
  const t = useT('b4ai');
  const info = useLoad(() => api.get<any>('/api/ai/settings'), []);
  const [s, setS] = useState<any>();
  const [key, setKey] = useState('');
  const [editKey, setEditKey] = useState(false);
  const [tab, setTab] = useState('setup');
  const [picked, setPicked] = useState<string | null>(null);
  const providerDraft = useRef<Record<string, string> | null>(null);
  const [providerVersion, setProviderVersion] = useState(0);
  useEffect(() => setS(info.data?.settings), [info.data]);
  if (!s || !info.data) return info.error ? <Empty>{info.error}</Empty> : <Spinner />;
  const d = info.data;
  // OpenAI chosen (modules/ai-providers.ts): the Anthropic key and model fields step aside.
  // Any non-Claude provider (OpenAI, Gemini, Groq) replaces the Anthropic key and model fields.
  const notClaude = (id: string | null | undefined) => !!id && id !== 'anthropic';
  const savedOpenai = notClaude(d.provider?.id);
  const openai = notClaude(picked ?? d.provider?.id);
  const set = (p: any) => setS({ ...s, ...p });
  const save = async (extra: any = {}) => {
    // An unsaved provider choice (and OpenAI key/model) is saved first, so „einschalten“ checks the right key.
    if (providerDraft.current) {
      const ok = await act(() => api.put('/api/ai/provider', providerDraft.current));
      if (!ok) return;
      providerDraft.current = null;
      setProviderVersion((v) => v + 1);
    }
    const r = await act(() => api.put('/api/ai/settings', { ...s, ...(key.trim() ? { api_key: key.trim() } : {}), ...extra }), t('Gespeichert'));
    if (r) {
      info.setData(r);
      setKey('');
      setEditKey(false);
      statusCache = null;
    }
  };
  const saveBtn = (
    <p>
      <button className="btn" onClick={() => save()}>
        {t('Speichern')}
      </button>
    </p>
  );
  return (
    <div style={{ maxWidth: 860 }}>
      <div className="card ai-status" data-tour="ai-status">
        <Icon name="ai" size={20} />
        <div className="grow">
          <strong>{t('KI-Assistent')} {d.settings.enabled ? <Badge tone="green">{t('an')}</Badge> : <Badge>{t('aus')}</Badge>}</strong>
          <div className="muted small">
            {d.settings.enabled
              ? t('{model} · Live-Chat-Bot: {v2}{gerade}', { model: savedOpenai ? `${d.provider.label} · ${d.provider.model}` : (d.models.find((m: any) => m.id === d.settings.model)?.label ?? d.settings.model), v2: MODES.find(([k]) => k === d.settings.bot_mode)?.[1] ?? '', gerade: d.settings.bot_mode !== 'off' ? (d.bot_active_now ? t(' (antwortet gerade)') : t(' (schweigt gerade)')) : '' })
              : t('Vorschläge, Zusammenfassungen und Chat-Bot mit {Claude} – mit deinem eigenen {Anthropic}-Schlüssel.', { Claude: savedOpenai ? d.provider.label : 'Claude', Anthropic: savedOpenai ? d.provider.label : 'Anthropic' })}
          </div>
        </div>
        <div className="ai-usage-mini">
          <div className="small muted">
            {t('Diesen Monat')} {usd(d.usage.cost_usd)} {t('von')} {usd(d.usage.limit_usd)}
          </div>
          <div className="bar">
            <div style={{ width: `${Math.min(100, (d.usage.cost_usd / d.usage.limit_usd) * 100)}%` }} />
          </div>
        </div>
      </div>
      <Tabs
        tabs={[
          ['setup', t('Einrichtung')],
          ['knowledge', t('Wissen')],
          ['bot', t('Live-Chat-Bot')],
          ['usage', 'Nutzung & Limit'],
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'setup' && (
        <div className="card">
          <AiProviderCard onChange={() => info.reload()} onPick={setPicked} onDraft={(b) => (providerDraft.current = b)} version={providerVersion} />
          {!openai && (
          <>
          <Field
            tour="ai-key"
            label={t('Anthropic-API-Schlüssel')}
            hint={
              <>
                {t('Bekommst du in der')} <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">{t('Anthropic Console')}</a> {t('unter „API Keys“. Er wird verschlüsselt gespeichert und nie wieder angezeigt; die Kosten laufen über dein Anthropic-Konto.')} <SignupLink id="anthropic" />
              </>
            }
          >
            {d.key_set && !editKey ? (
              <div className="row" style={{ alignItems: 'center' }}>
                <Badge tone="green">{t('hinterlegt')} {d.key_hint}</Badge>
                <button className="btn small secondary" onClick={() => setEditKey(true)}>
                  {t('Ersetzen')}
                </button>
                <button className="btn small secondary" onClick={() => confirmAsk(t('Schlüssel entfernen? Der Assistent wird dann ausgeschaltet.')) && save({ api_key: null, enabled: false })}>
                  {t('Entfernen')}
                </button>
              </div>
            ) : (
              <Input type="password" autoComplete="off" value={key} onChange={setKey} placeholder={d.key_source === 'server' ? t('leer = Schlüssel des Servers nutzen') : 'sk-ant-…'} />
            )}
          </Field>
          {d.key_source === 'server' && !d.key_set && <p className="muted small">{t('Es wird der Schlüssel aus der Server-Umgebung genutzt (PGHL_ANTHROPIC_API_KEY).')}</p>}
          <p>
            <button
              className="btn secondary"
              disabled={!key.trim() && !d.key_set && d.key_source !== 'server'}
              onClick={async () => {
                const r = await act(() => api.post('/api/ai/test', { api_key: key.trim() || undefined, model: s.model }));
                if (r) toast(t('Verbindung ok – {name} erreichbar', { name: r.name }));
              }}
            >
              {t('Verbindung testen')}
            </button>
          </p>
          </>
          )}
          <Check checked={s.enabled} onChange={(v) => set({ enabled: v })} label={t('KI-Assistent einschalten')} />
          <div className="grid2">
            {!openai && (
              <Field tour="ai-model" label={t('Modell')} hint={t('Sonnet reicht für fast alles; Opus für knifflige Fälle, Haiku für viel Chat zu kleinem Preis.')}>
                <Select value={s.model} onChange={(v) => set({ model: v })} options={d.models.map((m: any) => [m.id, m.label])} />
              </Field>
            )}
          </div>
          <Field tour="ai-facts" label={t('Fakten zum Unternehmen')} hint={t('Leistungen, Preise, Region, Öffnungszeiten, Ansprechpartner, Links (Termin buchen, Preisliste) …')}>
            <Textarea value={s.facts} onChange={(v) => set({ facts: v })} rows={6} />
          </Field>
          <MoreFields id="ai-persona" values={[s.assistant_name, s.persona]}>
            <Field label={t('Name im Chat')}>
              <Input value={s.assistant_name} onChange={(v) => set({ assistant_name: v })} placeholder={t('z. B. Paula')} />
            </Field>
            <Field tour="ai-persona" label={t('Tonfall & Persona')} hint={t('Wie soll der Assistent klingen? Du oder Sie, locker oder förmlich, was ist tabu?')}>
              <Textarea value={s.persona} onChange={(v) => set({ persona: v })} rows={3} />
            </Field>
          </MoreFields>
          {key.trim() && !s.enabled && <p className="muted small">{t('Tipp: Haken bei „einschalten“ setzen, damit der Assistent nach dem Speichern loslegt.')}</p>}
          {saveBtn}
        </div>
      )}
      {tab === 'knowledge' && (
        <div className="card" data-tour="ai-knowledge">
          <h2>{t('Fragen & Antworten')}</h2>
          <p className="muted small">{t('Der Assistent nutzt nur dieses Wissen als Fakten – was hier nicht steht, gibt er ans Team weiter.')}</p>
          {s.knowledge.map((k: any, i: number) => (
            <div key={i} className="ai-qa">
              <Input value={k.q} onChange={(v) => set({ knowledge: s.knowledge.map((x: any, j: number) => (j === i ? { ...x, q: v } : x)) })} placeholder={t('Frage, z. B. Was kostet eine Website?')} />
              <Textarea value={k.a} onChange={(v) => set({ knowledge: s.knowledge.map((x: any, j: number) => (j === i ? { ...x, a: v } : x)) })} rows={2} placeholder={t('Antwort')} />
              <button className="icon-btn" aria-label={t('Frage entfernen')} onClick={() => set({ knowledge: s.knowledge.filter((_: any, j: number) => j !== i) })}>
                ✕
              </button>
            </div>
          ))}
          <p>
            <button className="btn small secondary" onClick={() => set({ knowledge: [...s.knowledge, { q: '', a: '' }] })}>
              {t('+ Frage hinzufügen')}
            </button>
          </p>
          <Field label={t('Weiteres Wissen (Freitext)')} hint={t('Abläufe, Bedingungen, Lieferzeiten, Garantie, Datenschutz-Hinweise … Keine Passwörter oder Zugangsdaten eintragen.')}>
            <Textarea value={s.knowledge_text} onChange={(v) => set({ knowledge_text: v })} rows={8} />
          </Field>
          <Check checked={s.use_project_profile} onChange={(v) => set({ use_project_profile: v })} label={<>{t('Projekt-Steckbrief mitschicken')} {d.sources.profile ? <Badge tone="green">{t('vorhanden')}</Badge> : <Badge>{t('leer')}</Badge>}</>} />
          <Check checked={s.use_faq_blocks} onChange={(v) => set({ use_faq_blocks: v })} label={<>{t('FAQ-Blöcke aus Funnels & Websites mitschicken')} <Badge tone={d.sources.faq_count ? 'green' : 'gray'}>{d.sources.faq_count} {t('Fragen')}</Badge></>} />
          <p className="muted small">{t('Kontaktdaten, die letzten 20 Nachrichten und dieses Wissen gehen bei jeder Anfrage an Claude; Schlüssel, Passwörter, Kartennummern und IBANs werden vorher entfernt. Das Wissen wird zwischengespeichert (Prompt-Caching), wiederholte Anfragen kosten dafür nur einen Bruchteil.')}</p>
          {saveBtn}
        </div>
      )}
      {tab === 'bot' && <BotSettings s={s} set={set} d={d} saveBtn={saveBtn} />}
      {tab === 'bot' && <AiBookingSettings />}
      {tab === 'usage' && <Usage s={s} set={set} saveBtn={saveBtn} />}
    </div>
  );
}

function BotSettings({ s, set, d, saveBtn }: { s: any; set: (p: any) => void; d: any; saveBtn: ReactNode }) {
  const t = useT('b4ai');
  const pipelines = useLoad(() => api.get<any[]>('/api/pipelines'), []);
  const pipe = (pipelines.data ?? []).find((p) => p.id === s.pipeline_id);
  const hours = s.business_hours;
  const setDay = (day: string, p: any) => set({ business_hours: { ...hours, [day]: { ...hours[day], ...p } } });
  return (
    <div className="card">
      <Field label={t('Website-Chat')} hint={<>{t('Der Bot antwortet im Live-Chat (Einstellungen → Live-Chat). Seine Nachrichten sind im Posteingang lila markiert und beginnen mit 🤖.')}</>}>
        <Select value={s.bot_mode} onChange={(v) => set({ bot_mode: v })} options={MODES.map(([k, l]) => [k, t(l)] as [string, string])} />
      </Field>
      {s.bot_mode !== 'off' && (
        <p className="small">
          {d.open_now ? t('Gerade ist Geschäftszeit') : t('Gerade ist außerhalb der Geschäftszeiten')} ({d.timezone}) – {d.bot_active_now ? <Badge tone="green">{t('Bot antwortet')}</Badge> : <Badge>{t('Bot schweigt')}</Badge>}
          <span className="muted"> {t('(Stand nach dem letzten Speichern)')}</span>
        </p>
      )}
      <h2 style={{ marginTop: 16 }}>{t('Geschäftszeiten')}</h2>
      <p className="muted small">{t('Gleiche Uhrzeit bei „von“ und „bis“ (z. B. 00:00–00:00) = rund um die Uhr.')}</p>
      <div className="ai-hours">
        {DAYS.map(([k, l]) => (
          <div key={k} className="ai-hours-row">
            <Check checked={hours[k]?.open} onChange={(v) => setDay(k, { open: v })} label={t(l)} />
            <input type="time" value={hours[k]?.from ?? '09:00'} disabled={!hours[k]?.open} onChange={(e) => setDay(k, { from: e.target.value })} aria-label={t('{l} von', { l: t(l) })} />
            <span className="muted">{t('bis')}</span>
            <input type="time" value={hours[k]?.to ?? '17:00'} disabled={!hours[k]?.open} onChange={(e) => setDay(k, { to: e.target.value })} aria-label={t('{l} bis', { l: t(l) })} />
          </div>
        ))}
      </div>
      <h2 style={{ marginTop: 16 }}>{t('Übergabe an das Team')}</h2>
      <p className="muted small">{t('Der Bot übergibt, wenn jemand einen Menschen verlangt, ein Stichwort fällt, er unsicher ist oder die Höchstzahl an Antworten erreicht ist. Das Team bekommt eine E-Mail (Firmen-E-Mail), der Bot schweigt danach in diesem Gespräch.')}</p>
      <Field label={t('Stichwörter für sofortige Übergabe')}>
        <TagInput value={s.handoff_keywords} onChange={(v) => set({ handoff_keywords: v })} placeholder={t('Wort + Enter')} />
      </Field>
      <Field label={t('Text bei Übergabe')}>
        <Input value={s.handoff_message} onChange={(v) => set({ handoff_message: v })} />
      </Field>
      <MoreFields id="ai-bot-handoff">
      <div className="grid2">
        <Field label={t('Mindest-Sicherheit: {v1} %', { v1: Math.round(s.min_confidence * 100) })} hint={t('Darunter übergibt der Bot statt zu raten.')}>
          <input type="range" min={0} max={100} step={5} value={Math.round(s.min_confidence * 100)} onChange={(e) => set({ min_confidence: Number(e.target.value) / 100 })} />
        </Field>
        <Field label={t('Höchstens Bot-Antworten pro Gespräch')}>
          <Input type="number" min={1} max={50} value={s.max_bot_replies} onChange={(v) => set({ max_bot_replies: Number(v) })} />
        </Field>
      </div>
      </MoreFields>
      <h2 style={{ marginTop: 16 }}>{t('Leads')}</h2>
      <Check checked={s.lead_capture} onChange={(v) => set({ lead_capture: v })} label={t('Nach Name und E-Mail fragen, wenn sie fehlen, und den Kontakt ergänzen')} />
      <Check checked={s.create_opportunity} onChange={(v) => set({ create_opportunity: v })} label={t('Bei Kaufinteresse eine Opportunity anlegen')} />
      {s.create_opportunity && (
        <div className="grid2">
          <Field label="Pipeline">
            <Select value={s.pipeline_id} onChange={(v) => set({ pipeline_id: v, stage_id: '' })} placeholder={t('wählen…')} options={(pipelines.data ?? []).map((p) => [p.id, p.name])} />
          </Field>
          {pipe && (
            <Field label={t('Stufe')}>
              <Select value={s.stage_id} onChange={(v) => set({ stage_id: v })} placeholder={t('erste Stufe')} options={pipe.stages.map((x: any) => [x.id, x.name])} />
            </Field>
          )}
        </div>
      )}
      <Check checked={s.create_task} onChange={(v) => set({ create_task: v })} label={t('Bei Kaufinteresse eine Aufgabe „Chat-Lead nachfassen“ anlegen')} />
      <h2 style={{ marginTop: 16 }}>E-Mail</h2>
      <Check checked={s.email_drafts} onChange={(v) => set({ email_drafts: v })} label={t('Für eingehende E-Mails einen Antwort-Entwurf anlegen')} />
      <p className="muted small">{t('E-Mails verschickt der Assistent nie selbst – Entwürfe erscheinen in der Konversation zum Prüfen, Senden oder Verwerfen (höchstens 30 pro Stunde).')}</p>
      {saveBtn}
    </div>
  );
}

function Usage({ s, set, saveBtn }: { s: any; set: (p: any) => void; saveBtn: ReactNode }) {
  const t = useT('b4ai');
  const u = useLoad(() => api.get<any>('/api/ai/usage?limit=200'), []);
  if (!u.data) return u.error ? <Empty>{u.error}</Empty> : <Spinner />;
  const m = u.data.month;
  const pct = Math.min(100, (m.cost_usd / m.limit_usd) * 100);
  const label = (p: string) => u.data.purposes[p] ?? p;
  return (
    <>
      <SortableGrid id="ai-assistant.stats" className="stats">
        <Stat label={t('Kosten diesen Monat')} value={usd(m.cost_usd)} sub={<>{t('von')} {usd(m.limit_usd)} {t('Limit')}</>} />
        <Stat label={t('Tokens')} value={n(m.tokens)} sub={m.token_limit ? t('von {token_limit}', { token_limit: n(m.token_limit) }) : t('kein Token-Limit')} />
        <Stat label={t('KI-Aufrufe')} value={n(m.calls)} sub={t('seit {DE}', { DE: new Date(m.since).toLocaleDateString('de-DE') })} />
      </SortableGrid>
      <div className="card">
        <div className="bar" style={{ marginBottom: 12 }}>
          <div style={{ width: `${pct}%`, background: pct >= 100 ? 'var(--red)' : pct > 80 ? 'var(--yellow)' : undefined }} />
        </div>
        <div className="grid2">
          <Field label={t('Monatslimit (US-Dollar)')} hint={t('Ist es erreicht, macht der Assistent bis Monatsende nichts mehr; der Chat-Bot übergibt dann ans Team.')}>
            <Input type="number" min={0.01} step={1} value={s.monthly_limit_usd} onChange={(v) => set({ monthly_limit_usd: Number(v) })} />
          </Field>
          <Field label={t('Token-Limit pro Monat (0 = keins)')}>
            <Input type="number" min={0} step={10000} value={s.monthly_token_limit} onChange={(v) => set({ monthly_token_limit: Number(v) })} />
          </Field>
        </div>
        {saveBtn}
        <p className="muted small">{t('Kosten sind nach Anthropic-Listenpreisen geschätzt (inkl. Prompt-Cache); maßgeblich ist die Abrechnung in der Anthropic Console.')}</p>
      </div>
      {u.data.by_purpose.length > 0 && (
        <div className="table-wrap" style={{ marginTop: 14 }}>
          <table className="t">
            <thead>
              <tr>
                <th>{t('Zweck')}</th>
                <th>{t('Aufrufe')}</th>
                <th>{t('Tokens')}</th>
                <th>{t('davon aus Cache')}</th>
                <th>{t('Kosten')}</th>
              </tr>
            </thead>
            <tbody>
              {u.data.by_purpose.map((p: any) => (
                <tr key={p.purpose}>
                  <td>{label(p.purpose)}</td>
                  <td>{n(p.calls)}</td>
                  <td>{n(p.tokens)}</td>
                  <td>{n(p.cached_tokens)}</td>
                  <td>{usd(p.cost_usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <h2 style={{ marginTop: 18 }}>{t('Letzte Aufrufe')}</h2>
      {u.data.recent.length ? (
        <div className="table-wrap">
          <table className="t">
            <thead>
              <tr>
                <th>{t('Zeit')}</th>
                <th>{t('Zweck')}</th>
                <th>{t('Modell')}</th>
                <th>Status</th>
                <th>{t('Ein / Aus / Cache')}</th>
                <th>{t('Kosten')}</th>
                <th>{t('Hinweis')}</th>
              </tr>
            </thead>
            <tbody>
              {u.data.recent.map((r: any) => (
                <tr key={r.id}>
                  <td className="small">{dt(r.created_at)}</td>
                  <td>
                    {label(r.purpose)}
                    {r.conversation_id && (
                      <>
                        {' '}
                        <Link to={`conversations/${r.conversation_id}`}>
                          <Icon name="chat" size={12} />
                        </Link>
                      </>
                    )}
                  </td>
                  <td className="small mono">{r.model}</td>
                  <td>
                    <Badge tone={STATUS[r.status]?.[1] ?? 'gray'}>{t(STATUS[r.status]?.[0] ?? r.status)}</Badge>
                  </td>
                  <td className="small">
                    {n(r.input_tokens)} / {n(r.output_tokens)} / {n(r.cache_read_tokens + r.cache_write_tokens)}
                  </td>
                  <td>{usd(r.cost_usd)}</td>
                  <td className="small muted" style={{ maxWidth: 260 }}>
                    {r.error}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>{t('Noch keine KI-Aufrufe.')}</Empty>
      )}
    </>
  );
}

// --- inbox ---------------------------------------------------------------------------------

/** "Antwort vorschlagen" next to the composer: the draft lands in the text box, nothing is sent. */
export function AiComposerAddon({ contactId, conversationId, channel, setDraft }: { contactId: string; conversationId?: string; channel: string; setDraft: (body: string, subject?: string) => void }) {
  const t = useT('b4ai');
  const status = useAiStatus();
  const [hint, setHint] = useState('');
  const [busy, setBusy] = useState(false);
  if (!status.data?.enabled) return null;
  const go = async () => {
    setBusy(true);
    const r = await act(() => api.post('/api/ai/suggest', { conversation_id: conversationId, contact_id: conversationId ? undefined : contactId, channel, instruction: hint }));
    setBusy(false);
    if (r) {
      setDraft(r.text, r.subject);
      toast(t('Vorschlag eingefügt – bitte prüfen, dann senden'));
    }
  };
  return (
    <div className="ai-addon">
      <button type="button" className="btn small secondary" disabled={busy} onClick={go} title={t('Schreibt einen Entwurf mit dem KI-Assistenten')}>
        <Icon name="ai" size={14} /> {busy ? t('Schreibt…') : t('Antwort vorschlagen')}
      </button>
      <input value={hint} onChange={(e) => setHint(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !busy && go()} placeholder={t('Hinweis an die KI (optional)')} aria-label={t('Hinweis an die KI')} />
    </div>
  );
}

/** Side panel in Konversationen: bot status, handoff, summary + next step. */
export function AiPanel({ conversationId, refreshKey }: { conversationId: string; refreshKey?: unknown }) {
  const t = useT('b4ai');
  const st = useLoad(() => api.get<any>(`/api/ai/conversations/${conversationId}`).catch(() => null), [conversationId, refreshKey]);
  const [busy, setBusy] = useState(false);
  const d = st.data;
  if (!d?.enabled) return null;
  const setBot = async (bot_status: string) => {
    const r = await act(() => api.patch(`/api/ai/conversations/${conversationId}`, { bot_status }), bot_status === 'active' ? t('Bot wieder aktiv') : t('Bot pausiert'));
    if (r) st.setData(r);
  };
  return (
    <aside className="ai-panel" data-tour="ai-panel">
      <h3>
        <Icon name="ai" /> {t('KI-Assistent')}
      </h3>
      {d.bot_mode !== 'off' && (
        <section>
          <div className="muted small">{t('Live-Chat-Bot')}</div>
          {d.bot_status === 'active' && (
            <p>
              <Badge tone="green">{t('aktiv')}</Badge> <span className="small muted">{d.bot_replies} {t('Antworten')}</span>
            </p>
          )}
          {d.bot_status === 'handoff' && (
            <p>
              <Badge tone="yellow">{t('an Team übergeben')}</Badge>
              <br />
              <span className="small">{d.handoff_reason}</span>
              <br />
              <span className="small muted">{dt(d.handoff_at)}</span>
            </p>
          )}
          {d.bot_status === 'paused' && (
            <p>
              <Badge>{t('pausiert')}</Badge>
            </p>
          )}
          {d.bot_status === 'active' ? (
            <button className="btn small secondary" onClick={() => setBot('paused')}>
              {t('Bot pausieren')}
            </button>
          ) : (
            <button className="btn small secondary" onClick={() => setBot('active')}>
              {t('Bot wieder übernehmen lassen')}
            </button>
          )}
        </section>
      )}
      <section>
        <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="muted small">{t('Zusammenfassung')}</span>
          <button
            className="btn small"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const r = await act(() => api.post('/api/ai/summarize', { conversation_id: conversationId }));
              setBusy(false);
              if (r) st.setData({ ...d, ...r });
            }}
          >
            {busy ? t('Fasst zusammen…') : d.summary ? t('Neu zusammenfassen') : t('Zusammenfassen')}
          </button>
        </div>
        {d.summary ? (
          <>
            <p className="ai-summary">{d.summary}</p>
            {d.next_step && (
              <p className="ai-next">
                <strong>{t('Nächster Schritt:')}</strong> {d.next_step}
              </p>
            )}
            <div className="muted small">{dt(d.summary_at)}</div>
          </>
        ) : (
          <p className="muted small">{t('Kurz das Wichtigste und der nächste Schritt – auf Knopfdruck.')}</p>
        )}
      </section>
      {(d.opportunity_id || d.task_id) && (
        <section>
          <div className="muted small">{t('Vom Bot angelegt')}</div>
          {d.opportunity_id && (
            <p>
              <Link to="opportunities">
                <Icon name="deal" size={14} /> {t('Opportunity')}
              </Link>
            </p>
          )}
          {d.task_id && (
            <p>
              <Link to="tasks">
                <Icon name="todo" size={14} /> {t('Aufgabe')}
              </Link>
            </p>
          )}
        </section>
      )}
    </aside>
  );
}

// --- workflow step -------------------------------------------------------------------------

const TEXT_FIELDS: [string, string][] = [
  ['company', 'Firma'],
  ['city', 'Ort'],
  ['country', 'Land'],
  ['website', 'Website'],
  ['source', 'Quelle'],
];

export function AiTextStep({ step, set, customFields }: { step: any; set: (p: any) => void; customFields: any[] }) {
  const t = useT('b4ai');
  const target = step.target ?? 'field';
  return (
    <>
      <Field label={t('Auftrag an die KI')} hint={t('Kontaktdaten und die letzten Nachrichten bekommt die KI automatisch dazu.')}>
        <Textarea value={step.prompt} onChange={(v) => set({ prompt: v })} rows={6} placeholder={t('z. B. Schreibe eine persönliche Einleitung für {{contact.first_name}} passend zu den Tags.')} />
      </Field>
      <MergeHint />
      <Field label={t('Ergebnis')}>
        <Select
          value={target}
          onChange={(v) => set({ target: v })}
          options={[
            ['field', t('In ein Feld schreiben')],
            ['email_draft', t('Als E-Mail-Entwurf ablegen (wird nicht gesendet)')],
            ['note', t('Als Notiz speichern')],
          ]}
        />
      </Field>
      {target === 'field' && (
        <Field label={t('Feld')} hint={t('Danach z. B. in E-Mails mit {{contact.custom.<feld>}} nutzen.')}>
          <Select value={step.field} onChange={(v) => set({ field: v })} placeholder={t('wählen…')} options={[...customFields.map((f: any) => [`custom.${f.key}`, t('Feld: {label}', { label: f.label })] as [string, string]), ...TEXT_FIELDS.map(([k, l]) => [k, t(l)] as [string, string])]} />
        </Field>
      )}
      {target === 'email_draft' && (
        <Field label={t('Betreff (Platzhalter erlaubt)')}>
          <Input value={step.subject} onChange={(v) => set({ subject: v })} />
        </Field>
      )}
      <p className="muted small">{t('Nutzt den KI-Assistenten (Einstellungen → KI-Assistent) und zählt aufs Monatslimit. Fehler (z. B. Limit erreicht) stehen im Protokoll des Workflows.')}</p>
    </>
  );
}
