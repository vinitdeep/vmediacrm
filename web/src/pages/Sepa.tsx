import { useEffect, useState } from 'react';
import { api, dt, money } from '../api';
import { Badge, Check, Copy, Empty, Field, Input, Link, Modal, PageHead, Select, Spinner, Stat, Tabs, Textarea, act, useLoad } from '../ui';
import { Callout, Facts, Fold, Item, Panel, euroText, parseEuro } from './CreatorKit';
import { CollectTab, RunsTab, SeqBadge, TransfersTab, ymdDe } from './SepaRuns';
import './sepa.css';
import { SortableGrid } from '../sortable/Sortable';
import { useT } from '../i18n';

/**
 * SEPA without a payment provider (docs/sepa.md): mandates per contact (paper or online with proof), collection runs with
 * pre-notification and pain.008 file, returns, transfer files (pain.001) for supplier invoices and payout lists, settings.
 */

const TONE: Record<string, 'gray' | 'green' | 'red' | 'blue' | 'yellow' | 'purple'> = { pending: 'yellow', active: 'green', suspended: 'red', revoked: 'gray', expired: 'gray', used: 'gray', final: 'gray' };
const MandateBadge = ({ m }: { m: { status: string; status_label: string } }) => <Badge tone={TONE[m.status] ?? 'gray'}>{m.status_label}</Badge>;

// --- contact picker ---------------------------------------------------------------------------------------------------------

function ContactPicker({ value, onChange }: { value: { id: string; name: string } | null; onChange: (c: { id: string; name: string } | null) => void }) {
  const tx = useT('b6invoices');
  const [q, setQ] = useState('');
  const [found, setFound] = useState<any[]>([]);
  useEffect(() => {
    if (q.trim().length < 2) return setFound([]);
    const t = setTimeout(() => api.get(`/api/contacts?q=${encodeURIComponent(q.trim())}&limit=6`).then((r) => setFound(r.contacts ?? r ?? [])).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [q]);
  const label = (c: any) => [c.first_name, c.last_name].filter(Boolean).join(' ') || c.company || c.email || tx('Kontakt');
  if (value)
    return (
      <div className="sepa-picked">
        <strong>{value.name}</strong>
        <button type="button" className="btn secondary small" onClick={() => onChange(null)}>
          {tx('Ändern')}
        </button>
      </div>
    );
  return (
    <>
      <Field label={tx('Kontakt suchen')}>
        <Input value={q} onChange={setQ} placeholder={tx('Name, Firma oder E-Mail')} autoFocus />
      </Field>
      <div className="cr-list">
        {found.map((c) => (
          <Item key={c.id} onClick={() => onChange({ id: c.id, name: label(c) })}>
            <strong>{label(c)}</strong> {c.email && <span className="muted small">{c.email}</span>}
          </Item>
        ))}
      </div>
    </>
  );
}

// --- dialogs ------------------------------------------------------------------------------------------------------------------

function PaperDialog({ onClose, onSaved }: { onClose: () => void; onSaved: (id: string) => void }) {
  const tx = useT('b6invoices');
  const [c, setC] = useState<{ id: string; name: string } | null>(null);
  const [f, setF] = useState<Record<string, string>>({ scheme: 'CORE', kind: 'RCUR', signed_at: new Date().toISOString().slice(0, 10), country: '' });
  const set = (k: string) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    const r = await act(() => api.post('/api/sepa/mandates', { ...f, contact_id: c?.id }), tx('Mandat gespeichert'));
    if (r) onSaved(r.id);
  };
  return (
    <Modal
      title={tx('Papier-Mandat erfassen')}
      onClose={onClose}
      footer={
        <button className="btn" onClick={save} disabled={!c} data-tour="sepa-paper-save">
          {tx('Mandat speichern')}
        </button>
      }
    >
      <p className="cr-hint">{tx('Für Mandate, die unterschrieben auf Papier (oder als PDF) vorliegen. Bewahre das Original auf – bis 14 Monate nach dem letzten Einzug.')}</p>
      <ContactPicker value={c} onChange={(v) => (setC(v), v && !f.holder && set('holder')(v.name))} />
      {c && (
        <>
          <Field label={tx('Kontoinhaber')}>
            <Input value={f.holder} onChange={set('holder')} maxLength={70} />
          </Field>
          <div className="row">
            <Field label="IBAN">
              <Input value={f.iban} onChange={set('iban')} placeholder={tx('DE89 3704 0044 0532 0130 00')} spellCheck={false} />
            </Field>
            <Field label={tx('BIC (optional)')} hint={tx('Pflicht außerhalb des EWR (z. B. CH, GB)')}>
              <Input value={f.bic} onChange={set('bic')} maxLength={11} spellCheck={false} />
            </Field>
          </div>
          <div className="row">
            <Field label={tx('Unterschrieben am')}>
              <Input type="date" value={f.signed_at} onChange={set('signed_at')} />
            </Field>
            <Field label={tx('Ort der Unterschrift')}>
              <Input value={f.signed_place} onChange={set('signed_place')} maxLength={60} />
            </Field>
          </div>
          <div className="row">
            <Field label={tx('Lastschriftart')}>
              <Select value={f.scheme} onChange={set('scheme')} options={[['CORE', tx('Basislastschrift (CORE)')], ['B2B', tx('Firmenlastschrift (B2B)')]]} />
            </Field>
            <Field label={tx('Mandat für')}>
              <Select value={f.kind} onChange={set('kind')} options={[['RCUR', tx('Wiederkehrende Zahlungen')], ['OOFF', tx('Eine einmalige Zahlung')]]} />
            </Field>
          </div>
          <Field label={tx('Mandatsreferenz (optional)')} hint={tx('Leer lassen: V Media CRM vergibt die nächste Nummer. Die Referenz auf dem Papier-Mandat muss genau so lauten.')}>
            <Input value={f.reference} onChange={set('reference')} maxLength={35} spellCheck={false} />
          </Field>
          <Fold title={tx('Anschrift des Kontoinhabers (außerhalb des EWR Pflicht)')}>
            <Field label={tx('Straße und Hausnummer')}>
              <Input value={f.street} onChange={set('street')} />
            </Field>
            <div className="row">
              <Field label={tx('PLZ')}>
                <Input value={f.postal_code} onChange={set('postal_code')} />
              </Field>
              <Field label={tx('Ort')}>
                <Input value={f.city} onChange={set('city')} />
              </Field>
              <Field label={tx('Land (Kürzel)')}>
                <Input value={f.country} onChange={set('country')} maxLength={2} placeholder={tx('DE')} />
              </Field>
            </div>
          </Fold>
        </>
      )}
    </Modal>
  );
}

function RequestDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const tx = useT('b6invoices');
  const [c, setC] = useState<{ id: string; name: string } | null>(null);
  const [scheme, setScheme] = useState('CORE');
  const [kind, setKind] = useState('RCUR');
  const [send, setSend] = useState(true);
  const [done, setDone] = useState<any>(null);
  const go = async () => {
    const r = await act(() => api.post('/api/sepa/mandates/request', { contact_id: c?.id, scheme, kind, send }), tx('Online-Mandat angelegt'));
    if (r) (setDone(r), onSaved());
  };
  return (
    <Modal
      title={tx('Online-Mandat anfordern')}
      onClose={onClose}
      footer={
        done ? (
          <button className="btn" onClick={onClose}>
            {tx('Fertig')}
          </button>
        ) : (
          <button className="btn" onClick={go} disabled={!c} data-tour="sepa-request-send">
            {tx('Link erzeugen')}
          </button>
        )
      }
    >
      {done ? (
        <>
          <Callout tone={done.mail && !done.mail.sent ? 'warn' : 'info'}>{done.mail ? (done.mail.sent ? tx('Der Link ist per E-Mail unterwegs.') : tx('Nicht gesendet: {error}', { error: done.mail.error })) : tx('Gib den Link an die Person weiter.')}</Callout>
          <Field label={tx('Link zum Mandat {reference}', { reference: done.reference })}>
            <div className="sepa-link">
              <code>{done.capture_url}</code>
              <Copy text={done.capture_url} />
            </div>
          </Field>
          <p className="muted small">{tx('Gültig bis {dt}. Die Person liest den Mandatstext, trägt ihr Konto ein und bestätigt – gespeichert werden Zeitpunkt, IP-Netz, Browser-Fingerabdruck und die Prüfsumme des Textes.', { dt: dt(done.capture_expires_at) })}</p>
        </>
      ) : (
        <>
          <p className="cr-hint">{tx('Die Person bekommt einen persönlichen Link zu einer Seite mit dem Mandatstext. Dort trägt sie ihr Konto selbst ein – du siehst die IBAN danach maskiert in der Liste.')}</p>
          <ContactPicker value={c} onChange={setC} />
          {c && (
            <>
              <div className="row">
                <Field label={tx('Lastschriftart')}>
                  <Select value={scheme} onChange={setScheme} options={[['CORE', tx('Basislastschrift (CORE)')], ['B2B', tx('Firmenlastschrift (B2B)')]]} />
                </Field>
                <Field label={tx('Mandat für')}>
                  <Select value={kind} onChange={setKind} options={[['RCUR', tx('Wiederkehrende Zahlungen')], ['OOFF', tx('Eine einmalige Zahlung')]]} />
                </Field>
              </div>
              <Check checked={send} onChange={setSend} label={tx('Link gleich per E-Mail an den Kontakt senden')} />
            </>
          )}
        </>
      )}
    </Modal>
  );
}

function MandateDialog({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const tx = useT('b6invoices');
  const { data: m, reload } = useLoad(() => api.get(`/api/sepa/mandates/${id}`), [id]);
  if (!m)
    return (
      <Modal title={tx('SEPA-Mandat')} onClose={onClose}>
        <Spinner />
      </Modal>
    );
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    if (await act(fn, ok)) (reload(), onChanged());
  };
  const revoke = () => {
    const reason = window.prompt(tx('Warum endet das Mandat? (z. B. „Kunde hat widerrufen“)'), '');
    if (reason !== null) void run(() => api.post(`/api/sepa/mandates/${id}/revoke`, { reason }), tx('Mandat widerrufen'));
  };
  const proof = m.proof ?? {};
  const live = ['pending', 'active', 'suspended'].includes(m.status);
  return (
    <Modal
      title={tx('SEPA-Mandat {reference}', { reference: m.reference })}
      wide
      onClose={onClose}
      footer={
        <>
          {m.status === 'suspended' && (
            <button className="btn" onClick={() => run(() => api.post(`/api/sepa/mandates/${id}/reactivate`), tx('Mandat wieder freigegeben'))}>
              {tx('Wieder freigeben')}
            </button>
          )}
          {m.status === 'active' && m.kind === 'RCUR' && m.next_seq !== 'FRST' && (
            <button className="btn secondary" onClick={() => run(() => api.patch(`/api/sepa/mandates/${id}`, { final_next: !m.final_next }), m.final_next ? tx('Wieder normale Folgelastschrift') : tx('Nächster Einzug ist der letzte'))}>
              {m.final_next ? tx('Doch nicht der letzte Einzug') : tx('Nächster Einzug ist der letzte')}
            </button>
          )}
          {live && (
            <button className="btn danger" onClick={revoke}>
              {tx('Widerrufen')}
            </button>
          )}
        </>
      }
    >
      <Facts
        rows={[
          [tx('Kontakt'), m.contact ? <Link to={`contacts/${m.contact_id}`}>{m.contact.name}</Link> : tx('nicht (mehr) zugeordnet')],
          ['Status', <MandateBadge key="s" m={m} />],
          [tx('Nächste Lastschrift'), m.next_seq ? <SeqBadge key="q" seq={m.next_seq} label={m.next_seq_label} /> : ''],
          [tx('Lastschriftart'), m.scheme_label],
          [tx('Mandat für'), m.kind === 'OOFF' ? tx('eine einmalige Zahlung') : tx('wiederkehrende Zahlungen')],
          [tx('Kontoinhaber'), m.holder],
          ['IBAN', m.iban],
          ['BIC', m.bic],
          [tx('Anschrift'), [m.street, [m.postal_code, m.city].filter(Boolean).join(' '), m.country].filter(Boolean).join(', ')],
          [tx('Unterschrieben'), m.signed_at ? `${ymdDe(m.signed_at)}${m.signed_place ? ` in ${m.signed_place}` : ''}` : ''],
          [tx('Erfasst'), m.source === 'online' ? tx('online über den Mandats-Link') : m.source === 'import' ? 'importiert' : tx('Papier-Mandat')],
          [tx('Erste / letzte Lastschrift'), m.first_used_at ? `${ymdDe(m.first_used_at)} / ${ymdDe(m.last_used_at)}` : ''],
          [tx('Läuft ab'), m.expires_on ? tx('{ymdDe} (36 Monate ohne Einzug)', { ymdDe: ymdDe(m.expires_on) }) : ''],
          [tx('Beendet'), m.ended_at ? `${dt(m.ended_at)}${m.end_reason ? ` – ${m.end_reason}` : ''}` : ''],
        ]}
      />
      {m.status === 'pending' && (
        <Panel title={tx('Link zum Mandat')} sub={m.capture_url ? tx('Gültig bis {dt}', { dt: dt(m.capture_expires_at) }) : tx('Der Link ist abgelaufen.')}>
          {m.capture_url && (
            <div className="sepa-link">
              <code>{m.capture_url}</code>
              <Copy text={m.capture_url} />
            </div>
          )}
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn secondary" onClick={() => run(() => api.post(`/api/sepa/mandates/${id}/link`, { send: true }), tx('Neuer Link gesendet'))}>
              {tx('Neuen Link per E-Mail senden')}
            </button>
            <button className="btn secondary" onClick={() => run(() => api.post(`/api/sepa/mandates/${id}/link`, {}), tx('Neuer Link erzeugt'))}>
              {tx('Nur neuen Link erzeugen')}
            </button>
          </div>
        </Panel>
      )}
      {proof.method === 'online' && (
        <Fold title={tx('Nachweis der Zustimmung')} open>
          <Facts
            rows={[
              [tx('Zeitpunkt'), dt(proof.signed_at)],
              [tx('IP-Netz'), proof.ip_net || '–'],
              [tx('Browser-Fingerabdruck'), proof.ua_digest || '–'],
              [tx('Prüfsumme des Textes (SHA-256)'), <code key="h" className="sepa-hash">{proof.text_hash}</code>],
            ]}
          />
        </Fold>
      )}
      {m.text && (
        <Fold title={tx('Mandatstext')}>
          <div className="sepa-text">{m.text}</div>
        </Fold>
      )}
      <h4 className="sepa-h4">{tx('Lastschriften')}</h4>
      <div className="cr-list">
        {m.collections.map((x: any) => (
          <Item key={x.id} side={<Badge tone={x.status === 'paid' ? 'green' : x.status === 'returned' ? 'red' : x.status === 'dropped' ? 'gray' : 'yellow'}>{x.status === 'paid' ? 'bezahlt' : x.status === 'returned' ? tx('zurück {return_code}', { return_code: x.return_code }) : x.status === 'dropped' ? 'entfernt' : x.status === 'draft' ? tx('angekündigt') : 'eingereicht'}</Badge>}>
            <strong>{x.invoice_number || tx('Rechnung')}</strong> · {money(x.amount_cents)} · {x.seq} <span className="muted small">{tx('fällig {ymdDe}', { ymdDe: ymdDe(x.exec_date) })}</span>
          </Item>
        ))}
        {!m.collections.length && <p className="muted">{tx('Noch keine Lastschrift mit diesem Mandat.')}</p>}
      </div>
    </Modal>
  );
}

// --- tabs ------------------------------------------------------------------------------------------------------------------------

function MandatesTab({ reloadOverview }: { reloadOverview: () => void }) {
  const tx = useT('b6invoices');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [dialog, setDialog] = useState<'' | 'paper' | 'online'>('');
  const [open, setOpen] = useState('');
  const list = useLoad(() => api.get(`/api/sepa/mandates?${new URLSearchParams({ ...(status ? { status } : {}), ...(q.trim() ? { q: q.trim() } : {}) })}`), [status, q]);
  const changed = () => (list.reload(), reloadOverview());
  return (
    <Panel
      wide
      title={tx('Mandate')}
      sub={tx('Ohne gültiges Mandat keine Lastschrift. Ein Mandat läuft ab, wenn 36 Monate lang nichts eingezogen wurde.')}
      tour="sepa-mandates"
      actions={
        <>
          <button className="btn" onClick={() => setDialog('online')} data-tour="sepa-new-online">
            {tx('Online-Mandat anfordern')}
          </button>
          <button className="btn secondary" onClick={() => setDialog('paper')} data-tour="sepa-new-paper">
            {tx('Papier-Mandat erfassen')}
          </button>
        </>
      }
    >
      <div className="row sepa-filter">
        <Field label={tx('Suchen')}>
          <Input value={q} onChange={setQ} placeholder={tx('Referenz, Inhaber, Kontakt')} />
        </Field>
        <Field label="Status">
          <Select value={status} onChange={setStatus} options={[['', tx('Alle')], ['active', tx('Aktiv')], ['pending', tx('Wartet auf Unterschrift')], ['suspended', tx('Gesperrt')], ['ended', tx('Beendet / abgelaufen')]]} />
        </Field>
      </div>
      {!list.data ? (
        <Spinner />
      ) : !list.data.length ? (
        <Empty>{tx('Noch keine Mandate. Fordere ein Online-Mandat an oder erfasse ein unterschriebenes Papier-Mandat.')}</Empty>
      ) : (
        <div className="cr-list">
          {list.data.map((m: any) => (
            <Item key={m.id} onClick={() => setOpen(m.id)} side={<>{m.next_seq && <SeqBadge seq={m.next_seq} />} <MandateBadge m={m} /></>}>
              <strong>{m.contact?.name ?? m.holder ?? tx('Kontakt')}</strong> <span className="muted small">{m.reference}</span>
              <div className="cr-sub">
                {m.scheme} · {m.kind === 'OOFF' ? 'einmalig' : 'wiederkehrend'}
                {m.iban && ` · ${m.iban}`}
                {m.signed_at && tx(' · unterschrieben {ymdDe}', { ymdDe: ymdDe(m.signed_at) })}
                {m.status === 'pending' && !m.capture_url && tx(' · Link abgelaufen')}
              </div>
            </Item>
          ))}
        </div>
      )}
      {dialog === 'paper' && <PaperDialog onClose={() => setDialog('')} onSaved={(mid) => (setDialog(''), changed(), setOpen(mid))} />}
      {dialog === 'online' && <RequestDialog onClose={() => setDialog('')} onSaved={changed} />}
      {open && <MandateDialog id={open} onClose={() => setOpen('')} onChanged={changed} />}
    </Panel>
  );
}

function SettingsTab({ onSaved }: { onSaved: () => void }) {
  const tx = useT('b6invoices');
  const { data, reload } = useLoad(() => api.get('/api/sepa/settings'), []);
  const [f, setF] = useState<any>(null);
  const [fee, setFee] = useState('');
  useEffect(() => {
    if (data) (setF(data.settings), setFee(euroText(data.settings.return_fee_cents)));
  }, [data]);
  if (!data || !f) return <Spinner />;
  const set = (k: string) => (v: unknown) => setF((x: any) => ({ ...x, [k]: v }));
  const save = async () => {
    const cents = fee.trim() ? parseEuro(fee) : 0;
    if (cents === null) return act(() => Promise.reject(new Error(tx('Gebühr: bitte einen Betrag wie 3,50 eingeben'))));
    if (await act(() => api.put('/api/sepa/settings', { ...f, return_fee_cents: cents, prenotify_days: Number(f.prenotify_days), capture_days: Number(f.capture_days) }), tx('Einstellungen gespeichert'))) (reload(), onSaved());
  };
  const cr = data.creditor;
  return (
    <div className="cr-panels">
      <Panel title={tx('Zahlungsempfänger')} sub={tx('Die Gläubiger-ID bekommst du kostenlos bei der Deutschen Bundesbank (online beantragen).')} tour="sepa-creditor">
        <Field label={tx('Gläubiger-Identifikationsnummer')} hint={tx('z. B. DE98ZZZ09999999999 – wird mit Prüfziffern geprüft')}>
          <Input value={f.creditor_id} onChange={set('creditor_id')} spellCheck={false} maxLength={40} />
        </Field>
        <Field label={tx('Name des Zahlungsempfängers')} hint={tx('Leer: {n}', { n: cr.name || 'Name aus den Rechnungs-Einstellungen' })}>
          <Input value={f.creditor_name} onChange={set('creditor_name')} maxLength={70} />
        </Field>
        <div className="row">
          <Field label={tx('Eigene IBAN')} hint={cr.iban && !f.iban ? tx('Leer: {iban} (Rechnungs-Einstellungen)', { iban: cr.iban }) : tx('Das Konto, auf dem die Lastschriften eingehen und von dem Überweisungen abgehen')}>
            <Input value={f.iban} onChange={set('iban')} spellCheck={false} />
          </Field>
          <Field label={tx('Eigene BIC (optional)')}>
            <Input value={f.bic} onChange={set('bic')} spellCheck={false} maxLength={11} />
          </Field>
        </div>
        <Field label={tx('Standard-Lastschriftart')}>
          <Select value={f.default_scheme} onChange={set('default_scheme')} options={[['CORE', tx('Basislastschrift (CORE) – Verbraucher und Firmen')], ['B2B', tx('Firmenlastschrift (B2B) – nur Firmen, kein Widerspruch')]]} />
        </Field>
      </Panel>
      <Panel title={tx('Vorabankündigung')} sub={tx('Vor jedem Einzug erfährt der Kunde Betrag und Datum. Standard sind 14 Tage; kürzer (mindestens 1 Tag) nur, wenn es im Mandat steht – V Media CRM schreibt die Frist in den Mandatstext.')} tour="sepa-lead">
        <Field label={tx('Vorlauf in Tagen')}>
          <Input type="number" min={1} max={60} value={f.prenotify_days} onChange={set('prenotify_days')} />
        </Field>
        <Check checked={f.prenotify_email} onChange={set('prenotify_email')} label={tx('Vorabankündigung beim Anlegen eines Laufs per E-Mail senden')} />
        <Field label={tx('Betreff')}>
          <Input value={f.prenotify_subject} onChange={set('prenotify_subject')} />
        </Field>
        <Field label={tx('Text')} hint={tx('Platzhalter: {{due_date}}, {{total}}, {{items}}, {{iban}} (maskiert), {{mandate_reference}}, {{creditor_id}}, {{creditor_name}}, {{contact.first_name}}, {{location.name}}')}>
          <Textarea value={f.prenotify_body} onChange={set('prenotify_body')} rows={10} />
        </Field>
      </Panel>
      <Panel title={tx('Mandate und Dateien')}>
        <div className="row">
          <Field label={tx('Präfix der Mandatsreferenz')} hint={tx('z. B. M- → M-2026-000001')}>
            <Input value={f.mandate_prefix} onChange={set('mandate_prefix')} maxLength={12} />
          </Field>
          <Field label={tx('Mandats-Link gültig (Tage)')}>
            <Input type="number" min={1} max={365} value={f.capture_days} onChange={set('capture_days')} />
          </Field>
        </div>
        <Check checked={f.batch_booking} onChange={set('batch_booking')} label={tx('Sammelbuchung: einen Betrag je Lauf auf dem Kontoauszug (sonst jede Lastschrift einzeln – leichter abzugleichen)')} />
        <Field label={tx('Vorschlag Rücklastschrift-Gebühr (€)')} hint={tx('Steht im Rückgabe-Dialog vor; nur die echten Bankkosten weitergeben.')}>
          <Input value={fee} onChange={setFee} placeholder="0,00" inputMode="decimal" />
        </Field>
      </Panel>
      <div className="sepa-savebar">
        <button className="btn" onClick={save} data-tour="sepa-save">
          {tx('Einstellungen speichern')}
        </button>
      </div>
    </div>
  );
}

export function Sepa({ tab: tabParam }: { tab?: string }) {
  const tx = useT('b6invoices');
  const TABS: [string, string][] = [
    ['mandates', tx('Mandate')],
    ['collect', tx('Einzug')],
    ['runs', tx('Läufe')],
    ['transfers', tx('Überweisungen')],
    ['settings', tx('Einstellungen')],
  ];
  const [tab, setTab] = useState(TABS.some(([k]) => k === tabParam) ? tabParam! : 'mandates');
  const [openRun, setOpenRun] = useState('');
  const overview = useLoad(() => api.get('/api/sepa/overview'), []);
  const o = overview.data;
  return (
    <div className="cr sepa">
      <PageHead title="SEPA" sub={tx('Lastschriften mit eigenem Mandat einziehen und Überweisungsdateien erzeugen – ohne Zahlungsanbieter. Die Dateien lädst du im Online-Banking hoch.')} />
      {o && (
        <SortableGrid id="sepa-stats" className="sepa-stats" data-tour="sepa-stats">
          <Stat label={tx('Aktive Mandate')} value={o.mandates.active} sub={o.mandates.pending ? tx('{pending} warten auf Unterschrift', { pending: o.mandates.pending }) : undefined} />
          <Stat label={tx('Einziehbar')} value={money(o.candidates.total_cents)} sub={tx('{count} Rechnungen', { count: o.candidates.count })} />
          <Stat label={tx('Eingereicht, offen')} value={money(o.submitted_open.total_cents)} sub={tx('{count} Lastschriften', { count: o.submitted_open.count })} />
          <Stat label={tx('Rücklastschriften (30 Tage)')} value={o.returns_30d.count} sub={o.returns_30d.count ? money(o.returns_30d.total_cents) : undefined} />
        </SortableGrid>
      )}
      {o && !o.ready && (
        <Callout tone="warn">
          <strong>{tx('Noch nicht bereit für Lastschriften:')}</strong> {o.problems.join(' · ')}{' '}
          <button className="btn secondary small" onClick={() => setTab('settings')}>
            {tx('Zu den Einstellungen')}
          </button>
        </Callout>
      )}
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === 'mandates' && <MandatesTab reloadOverview={overview.reload} />}
      {tab === 'collect' && <CollectTab onCreated={(id) => (overview.reload(), setOpenRun(id), setTab('runs'))} />}
      {tab === 'runs' && <RunsTab open={openRun} setOpen={setOpenRun} onChanged={overview.reload} />}
      {tab === 'transfers' && <TransfersTab />}
      {tab === 'settings' && <SettingsTab onSaved={overview.reload} />}
    </div>
  );
}
