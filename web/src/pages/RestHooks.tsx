import { useEffect, useState } from 'react';
import { api, dt } from '../api';
import { Icon } from '../icons';
import { act, Badge, CodeBox, confirmAsk, Empty, Field, Input, Modal, pressable, Select, Spinner, useLoad } from '../ui';
import { MoreFields } from '../areas/fields';
import { useT } from '../i18n';

/** Einstellungen → API & Webhooks: REST-hook subscriptions (Zapier/Make/n8n) and the delivery log. */

const SOURCE: Record<string, string> = { zapier: 'Zapier', make: 'Make', n8n: 'n8n', api: 'API' };
const HOOK_STATUS: Record<string, [string, 'green' | 'gray' | 'red']> = { active: ['aktiv', 'green'], paused: ['pausiert', 'gray'], disabled: ['deaktiviert', 'red'] };
const DELIVERY: Record<string, [string, 'green' | 'yellow' | 'red' | 'gray' | 'blue']> = {
  success: ['zugestellt', 'green'],
  retrying: ['wird wiederholt', 'yellow'],
  pending: ['läuft', 'blue'],
  failed: ['fehlgeschlagen', 'red'],
  gone: ['410 Gone', 'red'],
  cancelled: ['abgebrochen', 'gray'],
};

function NewHook({ triggers, onClose, onDone }: { triggers: any[]; onClose: () => void; onDone: () => void }) {
  const tx = useT('b6integ');
  const [f, setF] = useState<any>({ event: 'contact.created', target_url: '', label: '', filters: {} });
  const t = triggers.find((x) => x.key === f.event);
  const save = async () => {
    const r = await act(() => api.post('/api/hooks', { ...f, source: 'api' }), tx('Abo angelegt'));
    if (r) onDone();
  };
  return (
    <Modal
      title={tx('Neues Abo')}
      onClose={onClose}
      footer={
        <button className="btn" disabled={!f.target_url} onClick={save}>
          {tx('Abonnieren')}
        </button>
      }
    >
      <p className="muted small" style={{ marginTop: 0 }}>
        {tx('Zapier, Make und n8n legen ihre Abos selbst an. Hier kannst du eine eigene URL von Hand eintragen.')}
      </p>
      <Field label={tx('Auslöser')}>
        <Select value={f.event} onChange={(v) => setF({ ...f, event: v, filters: {} })} options={triggers.map((x) => [x.key, x.label])} />
      </Field>
      {t && <p className="muted small">{t.description}</p>}
      <Field label={tx('Ziel-URL')}>
        <Input value={f.target_url} onChange={(v) => setF({ ...f, target_url: v })} placeholder="https://…" autoFocus />
      </Field>
      <MoreFields id="resthook-new" label={tx('Filter und Bezeichnung')}>
        {(t?.filters ?? []).map((flt: any) => (
          <Field key={flt.key} label={flt.label}>
            <Input value={f.filters[flt.key] ?? ''} onChange={(v) => setF({ ...f, filters: { ...f.filters, [flt.key]: v } })} />
          </Field>
        ))}
        <Field label={tx('Bezeichnung (optional)')}>
          <Input value={f.label} onChange={(v) => setF({ ...f, label: v })} />
        </Field>
      </MoreFields>
    </Modal>
  );
}

function DeliveryDetail({ id, onClose, onChange }: { id: string; onClose: () => void; onChange: () => void }) {
  const tx = useT('b6integ');
  const d = useLoad(() => api.get(`/api/hooks/deliveries/${id}`), [id]);
  const [busy, setBusy] = useState(false);
  const retry = async () => {
    setBusy(true);
    const r = await act(() => api.post(`/api/hooks/deliveries/${id}/retry`, {}), tx('Erneut gesendet'));
    setBusy(false);
    if (r) (d.setData(r), onChange());
  };
  const x = d.data;
  return (
    <Modal
      title={tx('Zustellung')}
      wide
      onClose={onClose}
      footer={
        x && x.status !== 'pending' ? (
          <button className="btn" disabled={busy} onClick={retry}>
            <Icon name="refresh" /> {tx('Erneut senden')}
          </button>
        ) : undefined
      }
    >
      {!x ? (
        <Spinner />
      ) : (
        <>
          <div className="hook-facts">
            <div>
              <span className="muted small">Status</span>
              <Badge tone={DELIVERY[x.status]?.[1] ?? 'gray'}>{tx(DELIVERY[x.status]?.[0] ?? x.status)}</Badge>
            </div>
            <div>
              <span className="muted small">{tx('Auslöser')}</span>
              <code>{x.event}</code>
            </div>
            <div>
              <span className="muted small">{tx('Versuche')}</span>
              {x.attempts}
            </div>
            <div>
              <span className="muted small">{tx('HTTP')}</span>
              {x.response_status ?? '–'}
            </div>
            <div>
              <span className="muted small">{tx('Dauer')}</span>
              {x.duration_ms != null ? tx('{duration_ms} ms', { duration_ms: x.duration_ms }) : '–'}
            </div>
            <div>
              <span className="muted small">{tx('Nächster Versuch')}</span>
              {x.next_attempt_at ? dt(x.next_attempt_at) : '–'}
            </div>
          </div>
          <p className="small mono hook-url">{x.target_url}</p>
          {x.error && <p className="hook-error">{x.error}</p>}
          <h3 className="integ-h">{tx('Payload')}</h3>
          <pre className="hook-pre">{JSON.stringify(x.payload, null, 2)}</pre>
          {x.response_body ? (
            <>
              <h3 className="integ-h">{tx('Antwort')}</h3>
              <pre className="hook-pre">{x.response_body}</pre>
            </>
          ) : null}
        </>
      )}
    </Modal>
  );
}

export function RestHooksPanel() {
  const tx = useT('b6integ');
  const triggers = useLoad(() => api.get<any[]>('/api/hooks/triggers'), []);
  const hooks = useLoad(() => api.get<any[]>('/api/hooks'), []);
  const [status, setStatus] = useState('');
  const [limit, setLimit] = useState(25);
  const log = useLoad(() => api.get<any>(`/api/hooks/deliveries?limit=${limit}${status ? `&status=${status}` : ''}`), [status, limit]);
  const [adding, setAdding] = useState(false);
  const [detail, setDetail] = useState('');
  useEffect(() => {
    // Keep the log fresh while retries are pending.
    if (!log.data?.deliveries?.some((d: any) => d.status === 'retrying' || d.status === 'pending')) return;
    const timer = setInterval(() => void log.reload(), 15_000);
    return () => clearInterval(timer);
  }, [log.data]);
  const reloadAll = () => (hooks.reload(), log.reload());
  const counts = log.data?.counts_7d ?? {};
  return (
    <div className="rest-hooks">
      <div className="card" data-tour="rest-hooks">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>{tx('REST-Hooks: Zapier, Make & n8n')}</h2>
          <div className="row" style={{ gap: 6 }}>
            <a className="btn small secondary" data-tour="rest-hooks-docs" href="/api/docs.html" target="_blank" rel="noopener">
              {tx('API-Referenz')} <Icon name="external" size={13} />
            </a>
            <button className="btn small" onClick={() => setAdding(true)} disabled={!triggers.data}>
              {tx('+ Abo')}
            </button>
          </div>
        </div>
        <p className="muted small">
          {tx('Sofort-Auslöser für Automatisierungs-Tools:')} <code>{tx('POST /api/hooks')}</code> {tx('abonniert,')} <code>{tx('DELETE /api/hooks/:id')}</code> {tx('bestellt ab. Jede Zustellung trägt')} <code>{tx('x-pghl-signature = sha256(secret + body)')}</code>{tx(', Fehler werden bis zu 6× wiederholt, nach drei Antworten mit 410 wird das Abo deaktiviert.')}
        </p>
        {!hooks.data ? (
          <Spinner />
        ) : hooks.data.length ? (
          <div className="table-wrap">
            <table className="t hook-table">
              <thead>
                <tr>
                  <th>{tx('Auslöser')}</th>
                  <th>{tx('Ziel')}</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {hooks.data.map((h) => (
                  <tr key={h.id}>
                    <td>
                      <strong>{h.trigger_label}</strong>
                      {h.label && <div className="small">{h.label}</div>}
                      {Object.keys(h.filters ?? {}).length > 0 && (
                        <div className="muted small">
                          {Object.entries(h.filters)
                            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
                            .join(' · ')}
                        </div>
                      )}
                    </td>
                    <td>
                      <Badge tone="purple">{SOURCE[h.source] ?? h.source}</Badge> <span className="mono small hook-url">{h.target_url}</span>
                    </td>
                    <td>
                      <Badge tone={HOOK_STATUS[h.status]?.[1] ?? 'gray'}>{tx(HOOK_STATUS[h.status]?.[0] ?? h.status)}</Badge>
                      <div className="muted small">{h.disabled_reason || h.last_status || tx('noch nichts gesendet')}</div>
                    </td>
                    <td className="hook-btns">
                      <button className="btn small secondary" onClick={() => act(() => api.post(`/api/hooks/${h.id}/test`, {}), tx('Beispiel gesendet')).then(reloadAll)}>
                        {tx('Testen')}
                      </button>
                      {h.status === 'active' ? (
                        <button className="btn small ghost" onClick={() => act(() => api.patch(`/api/hooks/${h.id}`, { status: 'paused' })).then(reloadAll)}>
                          {tx('Pausieren')}
                        </button>
                      ) : (
                        <button className="btn small ghost" onClick={() => act(() => api.patch(`/api/hooks/${h.id}`, { status: 'active' }), tx('Wieder aktiv')).then(reloadAll)}>
                          {tx('Aktivieren')}
                        </button>
                      )}
                      <button className="btn small ghost" aria-label={tx('Abo löschen')} onClick={() => confirmAsk(tx('Abo löschen? Das Tool bekommt dann keine Ereignisse mehr.')) && act(() => api.del(`/api/hooks/${h.id}`)).then(reloadAll)}>
                        <Icon name="trash" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>{tx('Noch keine Abos. Verbinde Zapier, Make oder n8n mit einem API-Schlüssel – die Abos erscheinen dann hier.')}</Empty>
        )}
      </div>

      <div className="card" data-tour="rest-hooks-log">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>{tx('Zustell-Protokoll')}</h2>
          <div className="row" style={{ gap: 6, alignItems: 'center' }}>
            <span className="muted small hook-counts">
              {tx('7 Tage:')} {counts.success ?? 0} {tx('zugestellt ·')} {counts.retrying ?? 0} {tx('in Wiederholung · {n} fehlgeschlagen', { n: (counts.failed ?? 0) + (counts.gone ?? 0) })}
            </span>
            <div style={{ width: 180 }}>
              <Select value={status} onChange={setStatus} placeholder={tx('Alle Status')} options={Object.entries(DELIVERY).map(([k, [l]]) => [k, tx(l)])} />
            </div>
            <button className="btn small secondary" onClick={() => log.reload()} aria-label={tx('Aktualisieren')}>
              <Icon name="refresh" />
            </button>
          </div>
        </div>
        {!log.data ? (
          <Spinner />
        ) : log.data.deliveries.length ? (
          <>
            <div className="table-wrap">
              <table className="t hook-table">
                <thead>
                  <tr>
                    <th>{tx('Zeit')}</th>
                    <th>{tx('Auslöser')}</th>
                    <th>{tx('Ziel')}</th>
                    <th>Status</th>
                    <th className="num">{tx('Versuche')}</th>
                    <th className="num">{tx('HTTP')}</th>
                  </tr>
                </thead>
                <tbody>
                  {log.data.deliveries.map((d: any) => (
                    <tr key={d.id} className="click" {...pressable(() => setDetail(d.id))}>
                      <td className="nowrap">{dt(d.created_at)}</td>
                      <td>
                        <code>{d.event}</code>
                      </td>
                      <td className="mono small hook-url">{d.target_url}</td>
                      <td>
                        <Badge tone={DELIVERY[d.status]?.[1] ?? 'gray'}>{tx(DELIVERY[d.status]?.[0] ?? d.status)}</Badge>
                        {d.error && <div className="muted small">{d.error}</div>}
                      </td>
                      <td className="num">{d.attempts}</td>
                      <td className="num">{d.response_status ?? '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {log.data.total > log.data.deliveries.length && (
              <p style={{ textAlign: 'center' }}>
                <button className="btn small secondary" onClick={() => setLimit(Math.min(200, limit + 50))}>
                  {tx('Mehr laden ({length} von {total})', { length: log.data.deliveries.length, total: log.data.total })}
                </button>
              </p>
            )}
          </>
        ) : (
          <Empty>{tx('Noch keine Zustellungen')}{status ? tx(' mit diesem Status') : ''}.</Empty>
        )}
      </div>
      {adding && triggers.data && <NewHook triggers={triggers.data} onClose={() => setAdding(false)} onDone={() => (setAdding(false), reloadAll())} />}
      {detail && <DeliveryDetail id={detail} onClose={() => setDetail('')} onChange={reloadAll} />}
      <ApiQuickRef />
    </div>
  );
}

function ApiQuickRef() {
  const tx = useT('b6integ');
  const origin = location.origin;
  return (
    <div className="card" data-tour="api-quickref">
      <h2>{tx('Schnellstart')}</h2>
      <p className="muted small" style={{ marginTop: 0 }}>
        {tx('Fertige Verbindungen liegen im Repo unter')} <code>integrations/zapier</code>, <code>integrations/make</code> {tx('und')} <code>integrations/n8n</code>{tx('. OpenAPI für Postman, Insomnia oder n8n:')}
      </p>
      <CodeBox text={`${origin}/api/openapi.json`} />
      <pre className="hook-pre" style={{ marginTop: 10 }}>{tx('curl -X POST {origin}/api/hooks \\\n  -H "Authorization: Bearer pghl_…" -H \'content-type: application/json\' \\\n  -d \'{"target_url":"https://example.com/hook","event":"opportunity.won"}\'', { origin })}</pre>
    </div>
  );
}
