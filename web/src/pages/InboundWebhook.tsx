import { useEffect, useRef, useState } from 'react';
import { api, dt } from '../api';
import { Icon } from '../icons';
import { Badge, Check, CodeBox, Field, Input, Select, Spinner, TagInput, act, confirmAsk, useLoad } from '../ui';
import { useT } from '../i18n';

/** Workflow trigger "Webhook empfangen": secret URL, test data, field mapping, signature, rate limit. */

const TARGETS: [string, string][] = [
  ['email', 'E-Mail'],
  ['phone', 'Telefon'],
  ['first_name', 'Vorname'],
  ['last_name', 'Nachname'],
  ['name', 'Name (wird geteilt)'],
  ['company', 'Firma'],
  ['address', 'Adresse'],
  ['city', 'Ort'],
  ['postal_code', 'PLZ'],
  ['country', 'Land'],
  ['website', 'Website'],
  ['source', 'Quelle'],
  ['date_of_birth', 'Geburtstag'],
  ['tags', 'Tags'],
  ['dnd', 'Nicht stören'],
];

/** Suggests a target for a payload path from its last segment. */
export function guessTarget(path: string): string | undefined {
  const k = path.split('.').pop()!.toLowerCase().replace(/[^a-z]/g, '');
  if (/^(email|mail|emailaddress|epost)$/.test(k)) return 'email';
  if (/^(phone|tel|telefon|mobile|handy|phonenumber)$/.test(k)) return 'phone';
  if (/^(firstname|vorname|first|givenname)$/.test(k)) return 'first_name';
  if (/^(lastname|nachname|last|surname|familyname)$/.test(k)) return 'last_name';
  if (/^(name|fullname)$/.test(k)) return 'name';
  if (/^(company|firma|organization|organisation)$/.test(k)) return 'company';
  if (/^(city|ort|stadt)$/.test(k)) return 'city';
  if (/^(zip|plz|postalcode|postcode)$/.test(k)) return 'postal_code';
  if (/^(country|land)$/.test(k)) return 'country';
  if (/^(website|url|homepage)$/.test(k)) return 'website';
  if (/^(tags|labels)$/.test(k)) return 'tags';
  return undefined;
}

export function InboundWebhookTrigger({ workflowId }: { workflowId: string }) {
  const tx = useT('b6integ');
  const cfg = useLoad(() => api.get<any>(`/api/inbound-webhooks/${workflowId}`), [workflowId]);
  const [mapping, setMapping] = useState<{ from: string; to: string }[] | null>(null);
  const [tags, setTags] = useState<string[] | null>(null);
  const [capture, setCapture] = useState(0);
  const [secret, setSecret] = useState('');
  const [preview, setPreview] = useState<any>();
  const [waiting, setWaiting] = useState(false);
  const seen = useRef('');
  const c = cfg.data;
  useEffect(() => {
    if (!c) return;
    setMapping((m) => m ?? c.mapping);
    setTags((t) => t ?? c.tags);
  }, [c]);
  useEffect(() => {
    if (!waiting) return;
    seen.current = c?.captures?.[0]?.id ?? '';
    let n = 0;
    const timer = setInterval(async () => {
      n++;
      const next = await api.get<any>(`/api/inbound-webhooks/${workflowId}`).catch(() => null);
      if (next) cfg.setData(next);
      if ((next && next.captures[0]?.id && next.captures[0].id !== seen.current) || n > 40) setWaiting(false);
    }, 3000);
    return () => clearInterval(timer);
  }, [waiting]);
  if (!c || !mapping || !tags) return <Spinner />;
  const cap = c.captures[Math.min(capture, c.captures.length - 1)];
  const fields: { path: string; sample: string }[] = cap?.fields ?? [];
  const targets: [string, string][] = [...TARGETS.map(([k, l]) => [k, tx(l)] as [string, string]), ...c.custom_fields.map((f: any) => [`custom.${f.key}`, tx('Eigenes Feld: {label}', { label: f.label })] as [string, string])];
  const save = async (patch: any, ok = tx('Gespeichert')) => {
    const r = await act(() => api.put(`/api/inbound-webhooks/${workflowId}`, patch), ok);
    if (r) cfg.setData(r);
    return r;
  };
  const auto = () => {
    const used = new Set(mapping.map((m) => m.to));
    const add = fields.map((f) => ({ from: f.path, to: guessTarget(f.path) ?? '' })).filter((m) => m.to && !used.has(m.to) && (used.add(m.to), true));
    setMapping([...mapping, ...add]);
  };
  const dirty = JSON.stringify(mapping) !== JSON.stringify(c.mapping) || JSON.stringify(tags) !== JSON.stringify(c.tags);
  return (
    <div className="inbound">
      <Field label={tx('Webhook-URL (POST mit JSON)')} tour="inbound-url">
        <CodeBox text={c.url} />
      </Field>
      <div className="row inbound-meta">
        <span className="muted small">
          {c.hits ? tx('{hits} {v} · zuletzt {dt}: {last_status}', { hits: c.hits, v: c.hits === 1 ? tx('Aufruf') : tx('Aufrufe'), dt: dt(c.last_at), last_status: c.last_status }) : tx('Noch nicht aufgerufen')}
        </span>
        <button className="btn small ghost" onClick={() => confirmAsk(tx('Neue URL erzeugen? Die alte funktioniert dann nicht mehr.')) && act(() => api.post(`/api/inbound-webhooks/${workflowId}/rotate`, {}), tx('Neue URL')).then((r) => r && cfg.setData(r))}>
          {tx('Neue URL')}
        </button>
      </div>
      {!c.active && <p className="inbound-warn small">{tx('Der Workflow ist nicht aktiv: Anfragen werden nur als Test-Daten gespeichert (Antwort 409).')}</p>}
      <Check checked={c.capture} onChange={(v) => save({ capture: v }, v ? tx('Testmodus an') : tx('Testmodus aus'))} label={tx('Testmodus – nur Test-Daten speichern, Workflow nicht starten')} />

      <div className="inbound-box" data-tour="inbound-test">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>{tx('Test-Daten')}</strong>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn small secondary" disabled={waiting} onClick={() => setWaiting(true)}>
              {waiting ? tx('Warte auf Anfrage …') : tx('Auf Test-Daten warten')}
            </button>
            {c.captures.length > 0 && (
              <button className="btn small ghost" aria-label={tx('Test-Daten löschen')} onClick={() => act(() => api.del(`/api/inbound-webhooks/${workflowId}/captures`)).then((r) => r && cfg.setData(r))}>
                <Icon name="trash" />
              </button>
            )}
          </div>
        </div>
        {c.captures.length ? (
          <>
            {c.captures.length > 1 && (
              <Select value={String(capture)} onChange={(v) => setCapture(Number(v))} options={c.captures.map((x: any, i: number) => [String(i), `${dt(x.created_at)}${x.signed ? ' · signiert' : ''}`])} />
            )}
            <pre className="hook-pre inbound-pre">{JSON.stringify(cap.payload, null, 2)}</pre>
          </>
        ) : (
          <p className="muted small">{tx('Schick eine Anfrage an die URL – die letzten fünf erscheinen hier und liefern die Felder für die Zuordnung.')}</p>
        )}
      </div>

      <div className="inbound-box" data-tour="inbound-map">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>{tx('Feldzuordnung')}</strong>
          {fields.length > 0 && (
            <button className="btn small secondary" onClick={auto}>
              {tx('Automatisch zuordnen')}
            </button>
          )}
        </div>
        <p className="muted small">{tx('Ohne Zuordnung werden email, phone, first_name, last_name, name, company … und tags direkt aus dem JSON (oder aus „contact“) gelesen.')}</p>
        <datalist id={`inbound-paths-${workflowId}`}>
          {fields.map((f) => (
            <option key={f.path} value={f.path}>
              {f.sample}
            </option>
          ))}
        </datalist>
        {mapping.map((m, i) => (
          <div key={i} className="inbound-map">
            <Input value={m.from} onChange={(v) => setMapping(mapping.map((x, j) => (j === i ? { ...x, from: v } : x)))} placeholder={tx('Feld im JSON, z. B. customer.email')} list={`inbound-paths-${workflowId}`} aria-label={tx('Feld im JSON')} />
            <Select value={m.to} onChange={(v) => setMapping(mapping.map((x, j) => (j === i ? { ...x, to: v } : x)))} placeholder={tx('Zielfeld wählen')} options={targets} />
            <button className="btn small ghost" aria-label={tx('Zuordnung entfernen')} onClick={() => setMapping(mapping.filter((_, j) => j !== i))}>
              ✕
            </button>
          </div>
        ))}
        <button className="btn small ghost" onClick={() => setMapping([...mapping, { from: '', to: '' }])}>
          {tx('+ Zuordnung')}
        </button>
        <Field label={tx('Zusätzliche Tags für jeden Kontakt')}>
          <TagInput value={tags} onChange={setTags} />
        </Field>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn small" disabled={!dirty} onClick={() => save({ mapping: mapping.filter((m) => m.from && m.to), tags })}>
            {tx('Zuordnung speichern')}
          </button>
          <button
            className="btn small secondary"
            disabled={!c.captures.length}
            onClick={async () => setPreview(await act(() => api.post(`/api/inbound-webhooks/${workflowId}/preview`, { capture_id: cap?.id, mapping: mapping.filter((m) => m.from && m.to) })))}
          >
            {tx('Vorschau')}
          </button>
        </div>
        {preview && (
          <div className="inbound-preview">
            {preview.ok ? <Badge tone="green">{tx('Kontakt wird angelegt/aktualisiert')}</Badge> : <Badge tone="red">{tx('Keine E-Mail, Telefon oder Name – Anfrage würde abgelehnt')}</Badge>}
            <pre className="hook-pre">{JSON.stringify({ ...preview.contact, tags: preview.tags }, null, 2)}</pre>
          </div>
        )}
      </div>

      <div className="inbound-box" data-tour="inbound-security">
        <strong>{tx('Sicherheit')}</strong>
        <div className="grid2" style={{ marginTop: 8 }}>
          <Field label={tx('Max. Anfragen pro Minute')}>
            <Input type="number" min={1} max={600} value={c.rate_limit} onChange={(v) => cfg.setData({ ...c, rate_limit: v })} onBlur={() => save({ rate_limit: Number(c.rate_limit) || 60 })} />
          </Field>
          <Field label={tx('HMAC-Signatur')}>
            {c.signature.enabled ? (
              <div>
                <Badge tone="green">{tx('verlangt')}</Badge> <small className="muted">Secret {c.signature.hint}</small>
              </div>
            ) : (
              <div className="muted small">{tx('aus – jeder mit der URL darf senden')}</div>
            )}
          </Field>
        </div>
        {secret && (
          <>
            <p className="small">{tx('Nur jetzt sichtbar – im sendenden Tool als Signatur-Secret eintragen:')}</p>
            <CodeBox text={secret} />
          </>
        )}
        <p className="muted small">
          {tx('Header')} <code>{tx('X-Signature-256: sha256=<HMAC-SHA256 des Rohtexts als Hex>')}</code> {tx('(auch')} <code>{tx('X-Hub-Signature-256')}</code> {tx('oder')} <code>{tx('X-Pghl-Hmac')}</code>).
        </p>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn small secondary" onClick={() => act(() => api.post(`/api/inbound-webhooks/${workflowId}/secret`, {}), tx('Secret erzeugt')).then((r) => r && (setSecret(r.secret), cfg.setData(r)))}>
            {c.signature.enabled ? tx('Neues Secret') : tx('Signatur verlangen')}
          </button>
          {c.signature.enabled && (
            <button className="btn small ghost" onClick={() => act(() => api.post(`/api/inbound-webhooks/${workflowId}/secret`, { enabled: false }), tx('Signatur aus')).then((r) => r && (setSecret(''), cfg.setData(r)))}>
              {tx('Signatur abschalten')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
