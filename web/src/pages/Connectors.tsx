import { useEffect, useState } from 'react';
import { api, dt } from '../api';
import { ICONS, Icon, type IconName } from '../icons';
import { Badge, Check, CodeBox, Empty, Field, Input, MergeHint, Select, Spinner, Textarea, act, confirmAsk, toast, toastError, useLoad } from '../ui';
import { SignupLink } from '../referrals';
import { useT } from '../i18n';

/**
 * Apps → Direkt-Verbindungen: native connectors without Composio (Slack/Discord webhooks, Notion
 * token, Google Sheets via the agency's Google OAuth app) and their workflow step editors.
 */

type Json = Record<string, any>;
const MASK = '••••••';
const iconOf = (name: string): IconName => (name in ICONS ? (name as IconName) : 'channels');

export function DirectConnectors() {
  const t = useT('b5conn');
  const list = useLoad(() => api.get<Json[]>('/api/connectors'), []);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const st = q.get('sheets');
    if (!st) return;
    if (st === 'ok') toast(t('Google Sheets verbunden'));
    else toastError(q.get('msg') || t('Verbinden fehlgeschlagen'));
    history.replaceState(null, '', location.pathname);
  }, []);
  if (list.error) return <Empty>{list.error}</Empty>;
  if (!list.data) return <Spinner />;
  return (
    <div className="cx" data-tour="apps-direct">
      <p className="muted">{t('Kleine Verbindungen ohne Composio: Benachrichtigungen nach Slack und Discord, Notizen nach Notion und Kontakte mit Google Sheets – die Zugangsdaten werden verschlüsselt gespeichert und nie wieder angezeigt.')}</p>
      <div className="cx-direct">
        {list.data.map((c) => (c.custom ? c.key === 'google_sheets' ? <SheetsPanel key={c.key} def={c} /> : null : <ConnectorCard key={c.key} def={c} onChange={list.reload} />))}
      </div>
    </div>
  );
}

function ConnectorCard({ def, onChange }: { def: Json; onChange: () => void }) {
  const t = useT('b5conn');
  const [values, setValues] = useState<Json>(def.values);
  const [busy, setBusy] = useState(false);
  useEffect(() => setValues(def.values), [def]);
  const dirty = JSON.stringify(values) !== JSON.stringify(def.values);
  const tone = !def.configured ? 'gray' : def.last_ok === false ? 'red' : def.last_ok ? 'green' : 'blue';
  const label = !def.configured ? t('nicht eingerichtet') : def.last_ok === false ? t('Test fehlgeschlagen') : def.last_ok ? t('verbunden') : t('gespeichert');
  return (
    <div className="card cx-conn-card" data-tour={`connector-${def.key}`}>
      <div className="cx-tk-head">
        <span className="integ-ico">
          <Icon name={iconOf(def.icon)} size={18} />
        </span>
        <div className="cx-tk-title">
          <strong>{def.name}</strong>
          <span className="muted small">{def.category} <SignupLink id={def.key} /></span>
        </div>
        <Badge tone={tone as any}>{label}</Badge>
      </div>
      <p className="small">{def.description}</p>
      {def.fields.map((f: Json) => (
        <Field key={f.key} label={`${f.label}${f.required ? ' *' : ''}`} hint={f.help || undefined}>
          <Input
            type={f.secret ? 'password' : 'text'}
            value={values[f.key] === MASK ? '' : values[f.key]}
            placeholder={values[f.key] === MASK ? t('•••••••• (gespeichert)') : f.placeholder}
            onChange={(v) => setValues({ ...values, [f.key]: v || (def.values[f.key] === MASK ? MASK : '') })}
            autoComplete="off"
          />
        </Field>
      ))}
      <div className="row" style={{ gap: 6 }}>
        <button className="btn small" disabled={!dirty || busy} onClick={async () => (await act(() => api.put(`/api/connectors/${def.key}`, { values }), t('Gespeichert'))) && onChange()}>{t('Speichern')}</button>
        {def.configured && def.can_test && (
          <button
            className="btn small secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await act(() => api.post(`/api/connectors/${def.key}/test`), t('Test erfolgreich'));
              setBusy(false);
              onChange();
            }}
          >{t('Verbindung testen')}</button>
        )}
        {def.configured && (
          <button className="btn small ghost" onClick={async () => confirmAsk(t('{name} entfernen? Workflow-Schritte damit schlagen dann fehl.', { name: def.name })) && (await act(() => api.del(`/api/connectors/${def.key}`), t('Entfernt'))) && onChange()}>{t('Entfernen')}</button>
        )}
      </div>
      {def.last_test_at && (
        <p className="muted small">{t('Letzter Test {v}: {last_result}', { v: dt(def.last_test_at), last_result: def.last_result })}</p>
      )}
      {def.steps.length > 0 && <p className="muted small">{t('Im Workflow: {v}', { v: def.steps.map((a: string) => `„${a}“`).join(', ') })}</p>}
    </div>
  );
}

function SheetsPanel({ def }: { def: Json }) {
  const t = useT('b5conn');
  const s = useLoad(() => api.get<Json>('/api/sheets'), []);
  const [tag, setTag] = useState('');
  const [target, setTarget] = useState('');
  const [src, setSrc] = useState('');
  const [sheet, setSheet] = useState('');
  const [importTag, setImportTag] = useState('');
  const [runWf, setRunWf] = useState(false);
  const [dry, setDry] = useState<Json | null>(null);
  const [busy, setBusy] = useState('');
  if (!s.data) return <Spinner />;
  const v = s.data;
  const run = async (key: string, fn: () => Promise<any>, ok?: string) => {
    setBusy(key);
    const r = await act(fn, ok);
    setBusy('');
    return r;
  };
  return (
    <div className="card cx-conn-card" data-tour="connector-google_sheets">
      <div className="cx-tk-head">
        <span className="integ-ico">
          <Icon name="csv" size={18} />
        </span>
        <div className="cx-tk-title">
          <strong>{def.name}</strong>
          <span className="muted small">{def.category} <SignupLink id="google_workspace" /></span>
        </div>
        {v.connected ? <Badge tone="green">{t('verbunden')}</Badge> : v.oauth_ready ? <Badge tone="blue">{t('bereit')}</Badge> : <Badge>{t('OAuth-App fehlt')}</Badge>}
      </div>
      <p className="small">{def.description}</p>
      {!v.oauth_ready ? (
        <>
          <p className="muted small">{t('Die Agentur trägt unter Agentur → Integrationen → Einrichtung ihre Google-OAuth-App ein, aktiviert die Google Sheets API und ergänzt diese Weiterleitungs-URI:')}</p>
          <CodeBox text={v.redirect_uri} />
        </>
      ) : !v.connected ? (
        <>
          <p className="muted small">{t('Einmalig: bei der Google-OAuth-App der Agentur die Weiterleitungs-URI')}{' '}<code>{v.redirect_uri}</code>{' '}{t('ergänzen und die Google Sheets API aktivieren.')}</p>
          <button
            className="btn"
            onClick={async () => {
              const r = await act(() => api.post<{ url: string }>('/api/sheets/connect'));
              if (r?.url) location.href = r.url;
            }}
          >{t('Mit Google verbinden')}</button>
        </>
      ) : (
        <>
          <p className="small">{t('Konto:')}{' '}<strong>{v.account_email || 'Google'}</strong>{' '}
            <button className="btn small ghost" onClick={async () => confirmAsk(t('Google Sheets trennen?')) && (await act(() => api.del('/api/sheets'), t('Getrennt'))) && s.reload()}>{t('Trennen')}</button>
          </p>
          <h4 className="integ-h">{t('Exportieren')}</h4>
          <div className="grid2">
            <Field label={t('Nur Kontakte mit Tag (optional)')}>
              <Input value={tag} onChange={setTag} />
            </Field>
            <Field label={t('In vorhandene Tabelle (optional)')} hint={t('Link – es kommt ein neuer Reiter dazu.')}>
              <Input value={target} onChange={setTarget} placeholder="https://docs.google.com/spreadsheets/d/…" />
            </Field>
          </div>
          <button className="btn small" disabled={!!busy} onClick={async () => (await run('export', () => api.post('/api/sheets/export', { tag, spreadsheet: target }), t('Exportiert'))) && s.reload()}>
            {busy === 'export' ? t('Exportiert …') : t('Kontakte exportieren')}
          </button>
          {v.last_export?.url && (
            <p className="muted small">{t('Zuletzt {v}: {rows} Kontakte →', { v: dt(v.last_export.at), rows: v.last_export.rows })}<a href={v.last_export.url} target="_blank" rel="noopener">{t('Tabelle öffnen')}{' '}<Icon name="external" size={12} />
              </a>
            </p>
          )}
          <h4 className="integ-h">{t('Importieren')}</h4>
          <Field label={t('Tabelle (Link oder ID)')} hint={t('Erste Zeile = Spaltennamen: E-Mail, Vorname, Nachname, Telefon, Firma, Tags oder Namen eigener Felder.')}>
            <Input value={src} onChange={(x) => (setSrc(x), setDry(null))} placeholder="https://docs.google.com/spreadsheets/d/…" />
          </Field>
          <div className="grid2">
            <Field label={t('Reiter (optional)')}>
              <Input value={sheet} onChange={setSheet} placeholder={t('erster Reiter')} />
            </Field>
            <Field label={t('Tag für importierte Kontakte (optional)')}>
              <Input value={importTag} onChange={setImportTag} />
            </Field>
          </div>
          <Check checked={runWf} onChange={setRunWf} label={t('Workflows für neue/geänderte Kontakte starten')} />
          <div className="row" style={{ gap: 6, marginTop: 6 }}>
            <button className="btn small secondary" disabled={!src || !!busy} onClick={async () => setDry((await run('dry', () => api.post('/api/sheets/import', { spreadsheet: src, sheet, dry_run: true }))) ?? null)}>{t('Probelauf')}</button>
            <button className="btn small" disabled={!src || !!busy} onClick={async () => (await run('import', () => api.post('/api/sheets/import', { spreadsheet: src, sheet, tag: importTag, trigger_workflows: runWf }), t('Importiert'))) && (setDry(null), s.reload())}>{t('Importieren')}</button>
          </div>
          {dry && (
            <p className="small">{t('{rows} Kontakte erkannt{v}. Spalten: {v2}', { rows: dry.rows, v: dry.skipped ? t(', {skipped} Zeilen ohne E-Mail/Telefon', { skipped: dry.skipped }) : '', v2: dry.columns.map((c: Json) => `${c.header} → ${c.field ?? '–'}`).join(', ') })}</p>
          )}
          {v.last_import?.at && (
            <p className="muted small">{t('Zuletzt importiert {v}: {created} neu, {updated} aktualisiert{v2}.', { v: dt(v.last_import.at), created: v.last_import.created, updated: v.last_import.updated, v2: v.last_import.skipped ? t(', {skipped} übersprungen', { skipped: v.last_import.skipped }) : '' })}</p>
          )}
        </>
      )}
    </div>
  );
}

// --- workflow step editors ------------------------------------------------------------------------------

function useConnectors() {
  return useLoad(() => api.get<Json[]>('/api/connectors').catch(() => [] as Json[]), []).data;
}

/** Step "Benachrichtigung an Slack/Discord". */
export function ChatNotifyStep({ step, set }: { step: Json; set: (p: Json) => void }) {
  const t = useT('b5conn');
  const list = useConnectors();
  const service = step.service === 'discord' ? 'discord' : 'slack';
  const ready = list?.find((c) => c.key === service)?.configured;
  return (
    <>
      <Field label={t('Dienst')}>
        <Select value={service} onChange={(v) => set({ service: v })} options={[['slack', 'Slack'], ['discord', 'Discord']]} />
      </Field>
      {list && !ready && !step.webhook_url && <p className="small" style={{ color: 'var(--yellow)' }}>{t('{v} ist noch nicht eingerichtet: Apps → Direkt-Verbindungen.', { v: service === 'slack' ? t('Slack') : t('Discord') })}</p>}
      <Field label={t('Überschrift (optional)')}>
        <Input value={step.title} onChange={(v) => set({ title: v })} placeholder={t('Neuer Lead')} />
      </Field>
      <Field label={t('Text')}>
        <Textarea value={step.text} onChange={(v) => set({ text: v })} rows={4} placeholder="{{contact.name}} ({{contact.email}}) filled in the form." />
      </Field>
      <MergeHint />
      <Field label={t('Anderer Kanal (optional)')} hint={t('Eine weitere Webhook-URL desselben Dienstes – sie steht dann im Workflow.')}>
        <Input value={step.webhook_url} onChange={(v) => set({ webhook_url: v })} placeholder={service === 'slack' ? 'https://hooks.slack.com/services/…' : 'https://discord.com/api/webhooks/…'} />
      </Field>
    </>
  );
}

/** Step "Notion-Seite ergänzen". */
export function NotionStep({ step, set }: { step: Json; set: (p: Json) => void }) {
  const t = useT('b5conn');
  const list = useConnectors();
  const ready = list?.find((c) => c.key === 'notion')?.configured;
  return (
    <>
      {list && !ready && <p className="small" style={{ color: 'var(--yellow)' }}>{t('Notion ist noch nicht eingerichtet: Apps → Direkt-Verbindungen.')}</p>}
      <Field label={t('Überschrift (optional)')}>
        <Input value={step.heading} onChange={(v) => set({ heading: v })} placeholder={t('Lead {{contact.name}}')} />
      </Field>
      <Field label={t('Text')} hint={t('Absätze mit Leerzeile trennen; Zeilen mit „- “ werden Aufzählungen.')}>
        <Textarea value={step.text} onChange={(v) => set({ text: v })} rows={5} />
      </Field>
      <MergeHint />
      <Field label={t('Andere Seite (optional)')} hint={t('Link oder ID; sonst die Standard-Seite. Die Seite muss mit der Integration geteilt sein.')}>
        <Input value={step.page_id} onChange={(v) => set({ page_id: v })} placeholder="https://www.notion.so/…" />
      </Field>
    </>
  );
}
