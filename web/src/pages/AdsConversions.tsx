import { useEffect, useState } from 'react';
import { api, dt } from '../api';
import { Badge, Check, Field, Input, Link, Modal, Spinner, act, useLoad } from '../ui';
import { useT } from '../i18n';

/**
 * Attribution → Tracking & Werbekonten: Google Ads offline conversions – the Google counterpart of the Meta Conversions API card.
 * Which CRM events go to which conversion action, enhanced conversions for leads (hashed e-mail/phone), a dry run with
 * validate_only, and the upload log. Only contacts with marketing consent are uploaded. Server: modules/ads-conversions.ts.
 */

type Json = Record<string, any>;

const STATUS: Record<string, [string, 'gray' | 'green' | 'red' | 'blue' | 'yellow']> = {
  pending: ['wartet', 'blue'],
  retry: ['neuer Versuch geplant', 'yellow'],
  sent: ['hochgeladen', 'green'],
  duplicate: ['war schon da', 'green'],
  failed: ['Fehler', 'red'],
  blocked: ['ohne Einwilligung', 'gray'],
  skipped: ['übersprungen', 'gray'],
};
const HINT: Record<string, string> = {
  deal_won: 'Wert und Währung kommen aus dem Deal.',
  form_submitted: 'Fester Wert je Formular (optional); nur bestimmte Formulare: IDs mit Komma.',
  booking: 'Fester Wert je Termin (optional).',
  invoice_paid: 'Wert und Währung kommen aus der Rechnung.',
};

export function GoogleConversions() {
  const t = useT('b4ads');
  const st = useLoad(() => api.get<Json>('/api/ads/conversions'), []);
  const log = useLoad(() => api.get<Json[]>('/api/ads/conversions/log?limit=50'), []);
  const [f, setF] = useState<Json | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState('');
  const [check, setCheck] = useState<Json | null>(null);
  useEffect(() => {
    if (!st.data) return;
    setF(structuredClone(st.data.config));
    setEnabled(!!st.data.enabled);
  }, [st.data]);
  if (!st.data || !f) return <Spinner />;
  const s = st.data;
  const setEvent = (k: string, patch: Json) => setF({ ...f, events: { ...f.events, [k]: { ...f.events[k], ...patch } } });
  const run = async (key: string, fn: () => Promise<any>, ok?: string) => {
    setBusy(key);
    const r = await act(fn, ok);
    setBusy('');
    return r;
  };
  const counts: Json = s.counts ?? {};
  return (
    <div className="card gconv" data-tour="ads-gconv">
      <div className="gconv-head">
        <h2 style={{ margin: 0 }}>{t('Google Ads: Offline-Conversions')}</h2>
        {!s.google.connected ? <Badge>{t('Google Ads nicht verbunden')}</Badge> : s.enabled ? <Badge tone={s.last_error ? 'red' : 'green'}>{s.last_error ? t('Fehler') : t('aktiv')}</Badge> : <Badge>{t('aus')}</Badge>}
      </div>
      <p className="muted small">
        {t('Gewonnene Deals, Formulare, Termine und bezahlte Rechnungen gehen als Conversion an Google zurück – mit der Klick-ID (gclid, gbraid, wbraid) des Kontakts und auf Wunsch als erweiterte Conversions für Leads (E-Mail und Telefon nur als SHA-256-Hash).')} <strong>{t('Nur Kontakte mit Einwilligung für Marketing')}</strong> {t('(Einwilligungen → Tracking & Cookies) werden hochgeladen.')}
      </p>
      {!s.google.connected && (
        <p className="small">
          {t('Zuerst Google Ads verbinden:')} <Link to="ads/connections">{t('Anzeigen → Verbindungen')}</Link> {t('(oder oben unter „Google Ads“ die Zugangsdaten eintragen).')}
        </p>
      )}
      {s.last_error && <p className="small" style={{ color: 'var(--red)' }}>{s.last_error}</p>}
      <Check checked={enabled} onChange={setEnabled} label={t('Conversions automatisch hochladen')} />
      <div className="gconv-events">
        {(s.events as Json[]).map((e) => {
          const ev = f.events[e.key];
          return (
            <div key={e.key} className="gconv-event">
              <Check checked={!!ev.enabled} onChange={(v) => setEvent(e.key, { enabled: v })} label={e.label} />
              <div className="grid2">
                <Field label={t('Conversion-Aktion')} hint={t('customers/{v1}/conversionActions/… oder nur die ID', { v1: s.google.customer_id || '1234567890' })}>
                  <Input value={ev.action} onChange={(v) => setEvent(e.key, { action: v })} placeholder={t('z. B. 987654321')} />
                </Field>
                {(e.key === 'form_submitted' || e.key === 'booking') && (
                  <Field label={t('Wert (optional)')} hint={t(HINT[e.key])}>
                    <Input value={ev.value || ''} onChange={(v) => setEvent(e.key, { value: v })} inputMode="decimal" placeholder="0" />
                  </Field>
                )}
                {e.key === 'form_submitted' && (
                  <Field label={t('Nur diese Formulare (optional)')}>
                    <Input value={(ev.form_ids ?? []).join(', ')} onChange={(v) => setEvent(e.key, { form_ids: v })} placeholder={t('alle Formulare')} />
                  </Field>
                )}
              </div>
              {(e.key === 'deal_won' || e.key === 'invoice_paid') && <p className="muted small">{t(HINT[e.key])}</p>}
            </div>
          );
        })}
      </div>
      <Check checked={!!f.enhanced_leads} onChange={(v) => setF({ ...f, enhanced_leads: v })} label={t('Erweiterte Conversions für Leads: gehashte E-Mail/Telefon mitsenden (auch Leads ohne Klick-ID)')} />
      <div className="grid2">
        <Field label={t('Währung, wenn nichts angegeben ist')}>
          <Input value={f.currency} onChange={(v) => setF({ ...f, currency: v })} maxLength={3} />
        </Field>
      </div>
      <div className="actions gconv-actions">
        <button className="btn" disabled={!!busy} onClick={async () => (await run('save', () => api.put('/api/ads/conversions', { enabled, config: f }), 'Gespeichert')) && (st.reload(), log.reload())}>
          {t('Speichern')}
        </button>
        <button className="btn secondary" disabled={!!busy || !s.google.connected} onClick={async () => {
          const r = await run('check', () => api.post<Json>('/api/ads/conversions/validate'));
          if (r) setCheck(r);
        }}>
          {t('Prüflauf (validate_only)')}
        </button>
        {s.enabled && (
          <button className="btn secondary" disabled={!!busy} onClick={async () => (await run('run', () => api.post('/api/ads/conversions/run'), 'Warteschlange abgearbeitet')) && (st.reload(), log.reload())}>
            {t('Jetzt hochladen')}
          </button>
        )}
      </div>
      <p className="muted small">
        {counts.sent ?? 0} {t('hochgeladen ·')} {(counts.pending ?? 0) + (counts.retry ?? 0)} {t('wartend ·')} {counts.failed ?? 0} {t('Fehler ·')} {counts.blocked ?? 0} {t('ohne Einwilligung')}{s.last_run_at ? t(' · zuletzt {last_run_at}', { last_run_at: dt(s.last_run_at) }) : ''}
      </p>
      {(log.data ?? []).length > 0 && (
        <details className="gconv-log">
          <summary>{t('Protokoll (')}{log.data!.length})</summary>
          <div className="table-wrap">
            <table className="t">
              <thead>
                <tr>
                  <th>{t('Zeit')}</th>
                  <th>{t('Ereignis')}</th>
                  <th>{t('Kontakt')}</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {log.data!.map((l) => (
                  <tr key={l.id}>
                    <td className="muted">{dt(l.created_at)}</td>
                    <td>
                      {(s.events as Json[]).find((e) => e.key === l.event)?.label ?? l.event}
                      {l.value ? <span className="muted small"> · {Number(l.value).toLocaleString('de-DE')} {l.currency}</span> : null}
                      {l.click_kind ? <span className="muted small"> · {l.click_kind}</span> : null}
                    </td>
                    <td>{l.contact_name || '–'}</td>
                    <td>
                      <Badge tone={STATUS[l.status]?.[1] ?? 'gray'}>{t(STATUS[l.status]?.[0] ?? l.status)}</Badge> <span className="muted small">{l.error}</span>
                    </td>
                    <td>
                      {['failed', 'retry', 'blocked', 'skipped'].includes(l.status) && (
                        <button className="btn secondary" disabled={!!busy} onClick={async () => (await run(`r${l.id}`, () => api.post(`/api/ads/conversions/${l.id}/retry`), t('Neuer Versuch'))) && log.reload()}>
                          {t('Erneut')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      {check && (
        <Modal title={t('Prüflauf bei Google')} onClose={() => setCheck(null)}>
          <p>{check.ok ? t('Google hat alles akzeptiert – im Prüflauf wird nichts gespeichert.') : t('Google meldet Probleme (im Prüflauf wird nichts gespeichert):')}</p>
          {check.sample && <p className="muted small">{t('Keine wartenden Conversions – geprüft wurde ein Beispiel mit einer Test-E-Mail.')}</p>}
          <ul className="gconv-check">
            {(check.results as Json[]).map((r, i) => (
              <li key={i}>
                <Badge tone={r.ok ? 'green' : 'red'}>{r.ok ? 'ok' : r.code || t('Fehler')}</Badge> {r.order_id} {r.message && <span className="muted small">– {r.message}</span>}
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </div>
  );
}
