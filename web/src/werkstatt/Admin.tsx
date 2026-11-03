import { useEffect, useState } from 'react';
import { api, ago } from '../api';
import { Icon } from '../icons';
import { Badge, Check, Empty, Field, Input, Link, Modal, Select, Spinner, TagInput, act, confirmAsk, toast, useLoad } from '../ui';
import { ScopeBadge, NAMES, usd } from './shared';
import { ProMark } from './badges';
import { STATUS_LABEL, type Health, type PluginBrief } from './Plugins';
import { useT } from '../i18n';

/** Admin tabs of the Werkstatt: all plugins with health, policy, feature flags, core proposals. */

// --- all plugins ----------------------------------------------------------------------------------------------------------

interface AdminPlugin extends PluginBrief {
  health: Health;
  review: { verdict: string; version: string; created_at: string } | null;
  market_version: string;
}
const VERDICT: Record<string, { label: string; tone: 'green' | 'yellow' | 'red' }> = { pass: { label: 'bestanden', tone: 'green' }, warn: { label: 'mit Hinweisen', tone: 'yellow' }, fail: { label: 'durchgefallen', tone: 'red' } };

export function AgencyTab() {
  const t = useT('b7werk');
  const l = useLoad(() => api.get<{ plugins: AdminPlugin[] }>('/api/marktplatz/admin/plugins'), []);
  if (l.loading && !l.data) return <Spinner />;
  const list = l.data?.plugins ?? [];
  if (!list.length) return <Empty>{t('Noch keine Plugins in der Agentur.')}</Empty>;
  return (
    <div className="table-wrap" data-tour="wk-agency">
      <table>
        <thead>
          <tr>
            <th>{t('Plugin')}</th>
            <th>{t('Verfügbar für')}</th>
            <th>{t('Installationen')}</th>
            <th>{t('Nutzung 30 T.')}</th>
            <th>{t('Fehler 7 T.')}</th>
            <th>{t('Stimmen')}</th>
            <th>{t('Prüfung')}</th>
          </tr>
        </thead>
        <tbody>
          {list.map((p) => (
            <tr key={p.id}>
              <td>
                <Link to={`werkstatt/plugins/${p.id}`}>
                  <strong>{p.name}</strong>
                </Link>{' '}
                <span className="muted small">v{p.version}</span>
                {p.status !== 'active' && (
                  <>
                    {' '}
                    <Badge tone={p.status === 'killed' ? 'red' : 'purple'}>{t(STATUS_LABEL[p.status] ?? p.status)}</Badge>
                  </>
                )}
                <div className="muted small">{p.owner?.user} {p.owner?.location ? `(${p.owner.location})` : ''}</div>
              </td>
              <td>
                <ScopeBadge scope={p.scope} />
              </td>
              <td>{p.health.installs}</td>
              <td>{p.health.usage_30d}</td>
              <td>{p.health.errors_7d > 0 ? <Badge tone="yellow">{p.health.errors_7d}</Badge> : 0}</td>
              <td>{p.health.votes}</td>
              <td>{p.review ? <Badge tone={VERDICT[p.review.verdict]?.tone ?? 'gray'}>{t(VERDICT[p.review.verdict]?.label ?? p.review.verdict)}</Badge> : <span className="muted small">–</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- policy -------------------------------------------------------------------------------------------------------------------

interface Policy {
  who: 'admins' | 'team' | 'everyone';
  allow_users: string[];
  allow_locations: string[];
  repair_rounds: number;
  approval: boolean;
  budget_usd: number;
  budgets: Record<string, number>;
  allowed_hosts: string[];
  server_logic: 'script' | 'declarative' | 'off';
  kill: { errors: number; window_min: number; ratio: number; latency_ms: number; min_calls: number };
  core: { repo: string; agent: 'codex' | 'claude'; location_id: string };
  model_gate: { enabled: boolean; families: string[]; newer: boolean; extra: string[]; stage1_normal: boolean };
  second_opinion: boolean;
  trusted_keys: { id: string; label: string; public_key: string }[];
}
interface Sandbox {
  ok: boolean;
  reason?: string;
  node: string;
  netns: boolean;
  network?: 'namespace' | 'in-process';
  probe?: Record<string, unknown>;
}

function SandboxCard({ s }: { s: Sandbox }) {
  const t = useT('b7werk');
  return (
    <div className="card" data-tour="wk-sandbox">
      <h3>{t('Sandbox für Skripte')}</h3>
      {s.ok ? (
        <p>
          <Badge tone="green">{t('bereit')}</Badge> {t('Node {node} · Netzwerk:', { node: s.node })}{' '}
          {s.network === 'namespace' ? t('eigener Netzwerk-Namensraum (stärkste Isolation)') : t('nur durch die Sperre im Prozess (Node blockiert das Netzwerk im Rechtemodell nicht selbst)')}
        </p>
      ) : (
        <p>
          <Badge tone="red">{t('nicht verfügbar')}</Badge> {s.reason}
        </p>
      )}
      <p className="muted small">
        {s.ok ? t('Skripte laufen in einem eigenen Prozess ohne Dateizugriff, ohne Unterprozesse und mit Speicher- und Zeitlimit; alle Daten gehen durch die Brücke, die die Berechtigungen prüft.') : t('Ohne Sandbox laufen nur deklarative Plugins (Schritte ohne Code). Plugins mit Skript lassen sich dann nicht aktivieren.')}
      </p>
      {s.probe && (
        <details>
          <summary>{t('Prüfprotokoll')}</summary>
          <ul className="wk-entries">
            {Object.entries(s.probe).map(([k, v]) => (
              <li key={k}>
                <code>{k}</code>: {String(v)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export function PolicyTab() {
  const t = useT('b7werk');
  const l = useLoad(() => api.get<{ policy: Policy; defaults: Policy; gate_families: { id: string; label: string; patterns: string[] }[]; license: { pro: boolean; stub: boolean }; locations: { id: string; name: string; spent_usd: number }[]; users: { id: string; name: string; email: string; role: string; locations: string[] }[]; sandbox: Sandbox }>('/api/werkstatt/policy'), []);
  const [p, setP] = useState<Policy>();
  const [busy, setBusy] = useState(false);
  useEffect(() => void (l.data && setP(l.data.policy)), [l.data]);
  if (!p || !l.data) return <Spinner />;
  const set = (patch: Partial<Policy>) => setP({ ...p, ...patch });
  const save = async () => {
    setBusy(true);
    const r = await act(() => api.put<{ policy: Policy }>('/api/werkstatt/policy', p), t('Richtlinie gespeichert'));
    setBusy(false);
    if (r) setP(r.policy);
  };
  return (
    <>
      <div className="card" data-tour="wk-policy">
        <h3>{t('Wer darf bauen lassen?')}</h3>
        <Field label={t('Berechtigt')}>
          <Select
            value={p.who}
            onChange={(v) => set({ who: v as Policy['who'] })}
            options={[
              ['admins', t('Nur Admins (Standard)')],
              ['team', t('Das Team (Personen mit Zugriff auf die Einstellungen)')],
              ['everyone', t('Alle Personen eines Sub-Accounts')],
            ]}
          />
        </Field>
        <PickList
          title={t('Zusätzlich erlaubte Personen')}
          items={l.data.users.filter((u) => u.role !== 'admin').map((u) => ({ id: u.id, label: `${u.name} (${u.email}${u.locations.length ? ` · ${u.locations.join(', ')}` : ''})` }))}
          value={p.allow_users}
          onChange={(v) => set({ allow_users: v })}
          tour="wk-policy-users"
        />
        <PickList title={t('Zusätzlich erlaubte Sub-Accounts (alle dort)')} items={l.data.locations.map((x) => ({ id: x.id, label: x.name }))} value={p.allow_locations} onChange={(v) => set({ allow_locations: v })} tour="wk-policy-locations" />
        <p className="muted small">
          {t('Wer hier angehakt ist, darf bauen lassen – auch wenn oben „Nur Admins“ steht. Für alle anderen ändert sich nichts. Admins dürfen immer.')}
        </p>
        <Check checked={p.approval} onChange={(v) => set({ approval: v })} label={t('Aufträge von Nicht-Admins brauchen die Freigabe eines Admins (mit Benachrichtigung per App, Push und E-Mail)')} tour="wk-policy-approval" />
        <Field label={t('KI-Budget je Sub-Account und Monat (US-Dollar)')} hint={t('Alle KI-Kosten der Werkstatt (Plan, Bau, Änderungen, Prüfungen) zählen dazu. Ist es aufgebraucht, startet nichts Neues.')}>
          <Input type="number" min={0} step={0.5} value={p.budget_usd} onChange={(v) => set({ budget_usd: Number(v) })} />
        </Field>
        <details>
          <summary>{t('Eigenes Budget je Sub-Account')}</summary>
          <div className="table-wrap">
            <table>
              <tbody>
                {l.data.locations.map((loc) => (
                  <tr key={loc.id}>
                    <td>{loc.name}</td>
                    <td className="muted small">{t('diesen Monat {v1}', { v1: usd(loc.spent_usd) })}</td>
                    <td style={{ width: 130 }}>
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        placeholder={String(p.budget_usd)}
                        value={p.budgets[loc.id] ?? ''}
                        onChange={(e) => {
                          const next = { ...p.budgets };
                          if (e.target.value === '') delete next[loc.id];
                          else next[loc.id] = Number(e.target.value);
                          set({ budgets: next });
                        }}
                        aria-label={t('Budget {name}', { name: loc.name })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
      <div className="card" data-tour="wk-model-policy">
        <h3>{t('Mindest-Modell für die {werkstatt}', { werkstatt: NAMES.werkstatt })}</h3>
        <p className="muted small">
          {t('Code schreiben und Code prüfen können nur Spitzenmodelle zuverlässig. Die {werkstatt} arbeitet deshalb nur mit einem der folgenden (auch hinter OpenRouter-Vorsilben wie', { werkstatt: NAMES.werkstatt })} <code>anthropic/</code>{t('). Welches Modell dient, stellst du unter Einstellungen → KI-Anbieter → „Werkstatt“ ein.')}
        </p>
        <Check checked={p.model_gate.enabled} onChange={(v) => set({ model_gate: { ...p.model_gate, enabled: v } })} label={t('Nur Spitzenmodelle zulassen (empfohlen)')} tour="wk-gate-on" />
        {p.model_gate.enabled && (
          <>
            <div className="wk-pick" role="group" aria-label={t('Erlaubte Modell-Familien')}>
              {l.data.gate_families.map((f) => (
                <Check
                  key={f.id}
                  checked={p.model_gate.families.includes(f.id)}
                  onChange={(v) => set({ model_gate: { ...p.model_gate, families: v ? [...p.model_gate.families, f.id] : p.model_gate.families.filter((x) => x !== f.id) } })}
                  label={
                    <>
                      {f.label} <span className="muted small wk-pat">{f.patterns.join(' · ')}</span>
                    </>
                  }
                />
              ))}
            </div>
            <Check checked={p.model_gate.newer} onChange={(v) => set({ model_gate: { ...p.model_gate, newer: v } })} label={t('Auch neuere Versionen dieser Familien (z. B. GPT-7 Sol, Claude Opus 5.6, Fable 6)')} />
            <Check checked={p.model_gate.stage1_normal} onChange={(v) => set({ model_gate: { ...p.model_gate, stage1_normal: v } })} label={t('Einrichtungen (Stufe 1, ohne Code) dürfen mit dem normalen Modell geplant und gebaut werden')} />
            <Field label={t('Eigene Muster')} hint={t('Modell-IDs mit * als Platzhalter, ohne Groß-/Kleinschreibung, z. B. *mein-modell*. Mindestens drei feste Zeichen.')}>
              <TagInput value={p.model_gate.extra} onChange={(v) => set({ model_gate: { ...p.model_gate, extra: v } })} placeholder={t('Muster + Enter')} />
            </Field>
          </>
        )}
        <p className="muted small">
          {t('Mehr Rechenzeit, bessere Ergebnisse: Die {werkstatt} fragt nie unter der Denkstufe „hoch“ an (Einstellungen → KI-Anbieter → Denkstufe). Versteht ein Modell die Stufe nicht, steht im Protokoll, was stattdessen gesendet wurde.', { werkstatt: NAMES.werkstatt })}
        </p>
      </div>
      <div className="card">
        <h3>{t('Plugins und Sicherheit')}</h3>
        <Field label={t('Server-Logik (Jobs und Automations-Schritte)')} hint={t('Skripte laufen in der Sandbox. „Nur deklarativ“ erlaubt ausschließlich Schritte ohne Code.')}>
          <Select
            value={p.server_logic}
            onChange={(v) => set({ server_logic: v as Policy['server_logic'] })}
            options={[
              ['script', t('Skripte und deklarative Schritte')],
              ['declarative', t('Nur deklarative Schritte')],
              ['off', t('Aus')],
            ]}
          />
        </Field>
        <Field label={t('Externe Hosts, die Plugins nutzen dürfen')} hint={t('Nur Namen wie cdn.example.com. Ein Plugin darf nur Hosts nutzen, die es im Manifest nennt und die hier stehen.')}>
          <TagInput value={p.allowed_hosts} onChange={(v) => set({ allowed_hosts: v })} placeholder={t('Host + Enter')} />
        </Field>
        <Field label={t('Korrekturrunden der KI')} hint={t('Liefert das Modell eine unbrauchbare Antwort oder fällt eine Prüfung durch, bekommt es den Fehler und darf es so oft noch einmal versuchen (0–4). Danach bricht der Bau mit einer lesbaren Meldung ab; das Protokoll bleibt.')}>
          <Input type="number" min={0} max={4} value={p.repair_rounds} onChange={(v) => set({ repair_rounds: Number(v) })} />
        </Field>
        <h4>{t('Notausschalter')}</h4>
        <div className="row">
          <Field label={t('Fehler')}>
            <Input type="number" min={3} value={p.kill.errors} onChange={(v) => set({ kill: { ...p.kill, errors: Number(v) } })} />
          </Field>
          <Field label={t('in Minuten')}>
            <Input type="number" min={1} value={p.kill.window_min} onChange={(v) => set({ kill: { ...p.kill, window_min: Number(v) } })} />
          </Field>
          <Field label={t('Anteil aller Aufrufe (0,1–1)')}>
            <Input type="number" min={0.1} max={1} step={0.1} value={p.kill.ratio} onChange={(v) => set({ kill: { ...p.kill, ratio: Number(v) } })} />
          </Field>
        </div>
        <div className="row">
          <Field label={t('Antwortzeit im Schnitt (ms, 0 = aus)')}>
            <Input type="number" min={0} step={500} value={p.kill.latency_ms} onChange={(v) => set({ kill: { ...p.kill, latency_ms: Number(v) } })} />
          </Field>
          <Field label={t('frühestens nach … Aufrufen')}>
            <Input type="number" min={3} value={p.kill.min_calls} onChange={(v) => set({ kill: { ...p.kill, min_calls: Number(v) } })} />
          </Field>
        </div>
        <p className="muted small">
          {t('Ab {errors} Fehlern in {window_min} Minuten (und mindestens {v3} % aller Aufrufe)', { errors: p.kill.errors, window_min: p.kill.window_min, v3: Math.round(p.kill.ratio * 100) })}{p.kill.latency_ms ? t(', oder wenn die Antworten im Schnitt länger als {latency_ms} ms dauern (ab {min_calls} Aufrufen)', { latency_ms: p.kill.latency_ms, min_calls: p.kill.min_calls }) : ''} {t('wird ein Plugin automatisch abgeschaltet. Admins und die Autorin bzw. der Autor werden benachrichtigt (App, Push, E-Mail) und können mit einem Klick auf die Vorversion zurückrollen.')}
        </p>
        <Check checked={p.second_opinion} onChange={(v) => set({ second_opinion: v })} label={<>{t('Vor dem Veröffentlichen eine Zweitmeinung eines anderen Spitzenmodells verlangen')} <ProMark /> {t('(nur wenn dafür ein zweites Modell eingestellt ist: KI-Anbieter → „Werkstatt: Zweitmeinung“)')}</>} />
      </div>
      <div className="card" data-tour="wk-trusted-keys">
        <h3>{t('Signierte Plugins')}</h3>
        <p className="muted small">
          {t('Plugin-Pakete können mit Ed25519 signiert sein. Die Schlüssel von V Media CRM sind eingebaut; hier trägst du die öffentlichen Schlüssel weiterer Herausgeber ein, deren Pakete als „signiert“ gelten. Alles ohne gültige Signatur ist „ungeprüft“ und wird nur nach ausdrücklicher Bestätigung installiert. Installieren signierter Plugins ist eine Pro-Funktion')} <ProMark />.
        </p>
        {p.trusted_keys.map((k, i) => (
          <div className="row" key={k.id} style={{ alignItems: 'center' }}>
            <span className="grow">
              <strong>{k.label}</strong> <code className="small">{k.id}</code>
            </span>
            <button className="btn ghost small" onClick={() => set({ trusted_keys: p.trusted_keys.filter((_, j) => j !== i) })}>
              {t('Entfernen')}
            </button>
          </div>
        ))}
        <NewKey onAdd={(k) => set({ trusted_keys: [...p.trusted_keys, k] })} />
      </div>
      <div className="card">
        <h3>{t('Kernfeatures (Stufe 3)')}</h3>
        <div className="row">
          <Field label={t('GitHub-Repository')} hint="besitzer/name">
            <Input value={p.core.repo} onChange={(v) => set({ core: { ...p.core, repo: v } })} placeholder="acme/gohigh" />
          </Field>
          <Field label={t('Coding-Agent')}>
            <Select value={p.core.agent} onChange={(v) => set({ core: { ...p.core, agent: v as 'codex' | 'claude' } })} options={[['codex', '@codex'], ['claude', '@claude']]} />
          </Field>
          <Field label={t('Sub-Account mit GitHub-Zugang')} hint={t('Einstellungen → KI-Werkzeuge → GitHub')}>
            <Select value={p.core.location_id} onChange={(v) => set({ core: { ...p.core, location_id: v } })} options={l.data.locations.map((x) => [x.id, x.name] as [string, string])} placeholder={t('automatisch')} />
          </Field>
        </div>
      </div>
      <div className="actions" style={{ margin: '14px 0' }}>
        <button className="btn" disabled={busy} onClick={save}>
          {t('Speichern')}
        </button>
      </div>
      <SandboxCard s={l.data.sandbox} />
    </>
  );
}

// --- feature flags -------------------------------------------------------------------------------------------------------------

interface Flag {
  name: string;
  description: string;
  stage: 'off' | 'private' | 'location' | 'percent' | 'all';
  percent: number;
  users: string[];
  locations: string[];
  on_for_me: boolean;
  updated_at: string;
}
interface FlagData {
  stages: [string, string][];
  pro_stages?: string[];
  license?: { pro: boolean };
  flags: Flag[];
  users: { id: string; name: string; email: string }[];
  sub_accounts: { id: string; name: string }[];
}

function NewKey({ onAdd }: { onAdd: (k: { id: string; label: string; public_key: string }) => void }) {
  const t = useT('b7werk');
  const [id, setId] = useState('');
  const [label, setLabel] = useState('');
  const [key, setKey] = useState('');
  return (
    <details>
      <summary>{t('Schlüssel hinzufügen')}</summary>
      <div className="row">
        <Field label={t('Kennung')} hint={t('a-z, 0-9, . _ -')}>
          <Input value={id} onChange={setId} placeholder="acme-2026" />
        </Field>
        <Field label="Name">
          <Input value={label} onChange={setLabel} placeholder={t('Acme GmbH')} />
        </Field>
      </div>
      <Field label={t('Öffentlicher Schlüssel')} hint={t('base64 (SPKI) oder PEM – von „node scripts/werkstatt-sign.mjs keygen“')}>
        <Input value={key} onChange={setKey} />
      </Field>
      <button className="btn secondary small" disabled={!id.trim() || key.trim().length < 20} onClick={() => (onAdd({ id: id.trim(), label: label.trim(), public_key: key.trim() }), setId(''), setLabel(''), setKey(''))}>
        {t('Hinzufügen (danach speichern)')}
      </button>
    </details>
  );
}

export function FlagsTab() {
  const t = useT('b7werk');
  const l = useLoad(() => api.get<FlagData>('/api/flags'), []);
  const [edit, setEdit] = useState<Flag | 'new'>();
  if (l.loading && !l.data) return <Spinner />;
  const d = l.data;
  if (!d) return null;
  return (
    <>
      <p className="muted">
        {t('Kernfunktionen führen sich hier stufenweise ein: erst für ausgewählte Personen (privat), dann ausgewählte Sub-Accounts, dann ein Prozentsatz aller Sub-Accounts, dann für alle. Neue Funktionen starten ausgeschaltet.')}
      </p>
      <div className="actions" style={{ justifyContent: 'flex-end', marginBottom: 10 }}>
        <button className="btn secondary" onClick={() => setEdit('new')}>
          {t('Neues Flag')}
        </button>
      </div>
      {!d.flags.length ? (
        <Empty>{t('Noch keine Funktionen mit Flag. Kernfunktionen legen ihr Flag selbst an (')}<code>app.services.flags.define</code>).</Empty>
      ) : (
        <div className="table-wrap" data-tour="wk-flags">
          <table>
            <thead>
              <tr>
                <th>{t('Funktion')}</th>
                <th>{t('Stufe')}</th>
                <th>{t('Für mich')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {d.flags.map((f) => (
                <tr key={f.name}>
                  <td>
                    <code>{f.name}</code>
                    <div className="muted small">{f.description}</div>
                  </td>
                  <td>
                    {d.stages.find(([k]) => k === f.stage)?.[1] ?? f.stage}
                    {f.stage === 'percent' && ` · ${f.percent} %`}
                    {d.pro_stages?.includes(f.stage) && <ProMark />}
                    <div className="muted small">
                      {t('{length} Personen · {length2} Sub-Accounts', { length: f.users.length, length2: f.locations.length })}
                    </div>
                  </td>
                  <td>{f.on_for_me ? <Badge tone="green">an</Badge> : <Badge tone="gray">aus</Badge>}</td>
                  <td>
                    <button className="btn secondary small" onClick={() => setEdit(f)}>
                      {t('Bearbeiten')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {edit && <FlagModal flag={edit === 'new' ? undefined : edit} data={d} onClose={() => setEdit(undefined)} onDone={() => (setEdit(undefined), void l.reload())} />}
    </>
  );
}

function PickList({ title, items, value, onChange, tour }: { title: string; items: { id: string; label: string }[]; value: string[]; onChange: (v: string[]) => void; tour?: string }) {
  const t = useT('b7werk');
  const [q, setQ] = useState('');
  const shown = items.filter((i) => i.label.toLowerCase().includes(q.toLowerCase()));
  return (
    <Field label={`${title} (${value.length})`} tour={tour}>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Filtern …')} />
      <div className="wk-pick">
        {shown.map((i) => (
          <Check key={i.id} checked={value.includes(i.id)} onChange={(on) => onChange(on ? [...value, i.id] : value.filter((x) => x !== i.id))} label={i.label} />
        ))}
      </div>
    </Field>
  );
}

function FlagModal({ flag, data, onClose, onDone }: { flag?: Flag; data: FlagData; onClose: () => void; onDone: () => void }) {
  const t = useT('b7werk');
  const [name, setName] = useState(flag?.name ?? '');
  const [desc, setDesc] = useState(flag?.description ?? '');
  const [stage, setStage] = useState<string>(flag?.stage ?? 'off');
  const [percent, setPercent] = useState(flag?.percent ?? 10);
  const [users, setUsers] = useState<string[]>(flag?.users ?? []);
  const [locs, setLocs] = useState<string[]>(flag?.locations ?? []);
  const save = async () => {
    const body = { description: desc, stage, percent, users, locations: locs };
    const r = await act(() => (flag ? api.put(`/api/flags/${flag.name}`, body) : api.post('/api/flags', { name, ...body })), 'Gespeichert');
    if (r) onDone();
  };
  return (
    <Modal
      title={flag ? t('Flag {name}', { name: flag.name }) : t('Neues Flag')}
      onClose={onClose}
      footer={
        <>
          {flag && (
            <button className="btn danger" style={{ marginRight: 'auto' }} onClick={() => confirmAsk(t('Flag löschen? Die Funktion gilt danach als ausgeschaltet.')) && act(() => api.del(`/api/flags/${flag.name}`), 'Gelöscht').then((x) => x && onDone())}>
              {t('Löschen')}
            </button>
          )}
          <button className="btn secondary" onClick={onClose}>
            {t('Abbrechen')}
          </button>
          <button className="btn" onClick={save}>
            {t('Speichern')}
          </button>
        </>
      }
    >
      {!flag && (
        <Field label="Name" hint={t('a–z, 0–9, Punkt, Unterstrich, Bindestrich')}>
          <Input value={name} onChange={setName} placeholder="core.mein-feature" />
        </Field>
      )}
      <Field label={t('Beschreibung')}>
        <Input value={desc} onChange={setDesc} />
      </Field>
      <Field label={t('Stufe')} hint={t('Jede Stufe schließt die davor ein.')}>
        <Select value={stage} onChange={setStage} options={data.stages.map(([k, l]) => [k, data.pro_stages?.includes(k) ? `${l} (Pro)` : l] as [string, string])} />
        {data.pro_stages?.includes(stage) && data.license && !data.license.pro && <p className="muted small">{t('Der Rollout nach Prozent ist eine Pro-Funktion – dafür fehlt hier die Lizenz.')}</p>}
      </Field>
      {stage === 'percent' && (
        <Field label={t('Anteil der Sub-Accounts: {percent} %', { percent })} hint={t('Stabil: wer drin ist, bleibt drin, wenn der Anteil wächst.')}>
          <input type="range" min={0} max={100} value={percent} onChange={(e) => setPercent(Number(e.target.value))} />
        </Field>
      )}
      {stage !== 'off' && stage !== 'all' && <PickList title={t('Ausgewählte Personen')} items={data.users.map((u) => ({ id: u.id, label: `${u.name} (${u.email})` }))} value={users} onChange={setUsers} />}
      {(stage === 'location' || stage === 'percent') && <PickList title={t('Ausgewählte Sub-Accounts')} items={data.sub_accounts.map((s) => ({ id: s.id, label: s.name }))} value={locs} onChange={setLocs} />}
    </Modal>
  );
}

// --- core proposals ------------------------------------------------------------------------------------------------------------

interface CoreRow {
  id: string;
  plugin_id: string;
  plugin: string;
  status: string;
  repo: string;
  agent: string;
  title: string;
  spec: string;
  issue_number: number | null;
  issue_url: string;
  flag: string;
  prs: { number: number; url: string; state: string; merged: boolean; title?: string }[];
  target_version: string;
  shipped_version: string;
  core_action: 'migrate' | 'retire';
  error: string;
  last_checked_at: string | null;
  created_at: string;
  health: Health | null;
}
const CORE_STATUS: Record<string, { label: string; tone: 'gray' | 'blue' | 'yellow' | 'green' | 'purple' | 'red' }> = {
  spec: { label: 'Spezifikation fertig', tone: 'gray' },
  issue_open: { label: 'Issue offen', tone: 'blue' },
  in_progress: { label: 'Pull Request in Arbeit', tone: 'yellow' },
  merged: { label: 'gemerged – wartet auf Auslieferung', tone: 'purple' },
  shipped: { label: NAMES.inCore, tone: 'green' },
  closed: { label: 'geschlossen', tone: 'red' },
};

export function CoreTab() {
  const t = useT('b7werk');
  const l = useLoad(() => api.get<{ proposals: CoreRow[]; core: { repo: string; agent: string }; github: boolean }>('/api/werkstatt/core'), []);
  if (l.loading && !l.data) return <Spinner />;
  const d = l.data;
  if (!d) return null;
  return (
    <>
      <p className="muted">
        {t('Beliebte Plugins können als {stage3} vorgeschlagen werden: Die KI schreibt aus Wunsch, Plugin-Code und Nutzungsdaten eine Spezifikation, daraus wird ein GitHub-Issue für', { stage3: NAMES.stage3 })} {d.core.agent === 'claude' ? '@claude' : '@codex'}{t('. Erscheint die Funktion im Kern, gilt das Plugin als „{inCore}“.', { inCore: NAMES.inCore })}
      </p>
      {!d.github && <div className="card notice-card">{t('GitHub ist noch nicht eingerichtet (Einstellungen → KI-Werkzeuge → GitHub für Codex). Vorschläge entstehen trotzdem; das Issue legst du später an.')}</div>}
      {!d.proposals.length ? (
        <Empty tour="wk-core-empty">{t('Noch keine Vorschläge. Öffne ein Plugin und wähle „Als Kernfeature vorschlagen“.')}</Empty>
      ) : (
        <div className="wk-list" data-tour="wk-core-list">
          {d.proposals.map((r) => (
            <CoreCard key={r.id} r={r} onChange={() => void l.reload()} />
          ))}
        </div>
      )}
    </>
  );
}

function CoreCard({ r, onChange }: { r: CoreRow; onChange: () => void }) {
  const t = useT('b7werk');
  const [target, setTarget] = useState(r.target_version);
  const [action, setAction] = useState<string>(r.core_action);
  const [ship, setShip] = useState(false);
  const st = CORE_STATUS[r.status] ?? { label: r.status, tone: 'gray' as const };
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    if (await act(fn, ok)) onChange();
  };
  return (
    <div className="card wk-core">
      <div className="row" style={{ alignItems: 'baseline' }}>
        <div className="grow">
          <strong>{r.title}</strong>
          <div className="muted small">
            {t('Plugin')} <Link to={`werkstatt/plugins/${r.plugin_id}`}>{r.plugin}</Link> {t('· {v1} · Flag', { v1: ago(r.created_at) })} <code>{r.flag}</code>
          </div>
        </div>
        <Badge tone={st.tone}>{t(st.label)}</Badge>
      </div>
      {r.issue_url && (
        <p className="small">
          <a href={r.issue_url} target="_blank" rel="noreferrer noopener">
            {r.repo}#{r.issue_number}
          </a>{' '}
          {r.prs.map((x) => (
            <span key={x.number}>
              {' · '}
              <a href={x.url} target="_blank" rel="noreferrer noopener">
                {t('PR #{number}', { number: x.number })}
              </a>{' '}
              ({x.merged ? t('gemerged') : x.state === 'open' ? t('offen') : t('geschlossen')})
            </span>
          ))}
          {r.last_checked_at && <span className="muted"> {t('· geprüft {v1}', { v1: ago(r.last_checked_at) })}</span>}
        </p>
      )}
      {r.error && <p className="small" style={{ color: 'var(--red)' }}>{r.error}</p>}
      <details>
        <summary>{t('Spezifikation')}</summary>
        <pre className="wk-spec">{r.spec}</pre>
      </details>
      {r.status !== 'shipped' && (
        <div className="row" style={{ alignItems: 'flex-end', marginTop: 8 }}>
          <Field label={t('Kommt in Version')} hint={t('z. B. 0.0.30')}>
            <Input value={target} onChange={setTarget} placeholder="0.0.30" />
          </Field>
          <Field label={t('Wenn ausgeliefert')}>
            <Select value={action} onChange={setAction} options={[['migrate', 'Plugin ausschalten, Daten behalten'], ['retire', t('Plugin und Installationen entfernen')]]} />
          </Field>
          <button className="btn secondary small" onClick={() => run(() => api.put(`/api/werkstatt/core/${r.id}`, { target_version: target, core_action: action }), 'Gespeichert')}>
            {t('Speichern')}
          </button>
        </div>
      )}
      <div className="actions" style={{ marginTop: 8 }}>
        {!r.issue_number && r.status !== 'shipped' && (
          <button
            className="btn small"
            onClick={async () => {
              const x = await act(() => api.post<{ issue_error?: string }>(`/api/werkstatt/core/${r.id}/issue`));
              if (x?.issue_error) toast(x.issue_error);
              else if (x) toast(t('Issue angelegt'));
              onChange();
            }}
          >
            {t('GitHub-Issue anlegen')}
          </button>
        )}
        {r.issue_number && r.status !== 'shipped' && (
          <button className="btn secondary small" onClick={() => run(() => api.post(`/api/werkstatt/core/${r.id}/refresh`), t('Status aktualisiert'))}>
            {t('Status prüfen')}
          </button>
        )}
        {r.status !== 'shipped' && (
          <button className="btn secondary small" onClick={() => setShip(true)}>
            {t('Als ausgeliefert markieren')}
          </button>
        )}
        <button className="btn ghost small" onClick={() => confirmAsk(t('Vorschlag entfernen?')) && run(() => api.del(`/api/werkstatt/core/${r.id}`), t('Entfernt'))}>
          {t('Entfernen')}
        </button>
      </div>
      {ship && <ShipModal r={r} action={action} onClose={() => setShip(false)} onDone={() => (setShip(false), onChange())} />}
    </div>
  );
}

function ShipModal({ r, action, onClose, onDone }: { r: CoreRow; action: string; onClose: () => void; onDone: () => void }) {
  const t = useT('b7werk');
  const [version, setVersion] = useState(r.target_version);
  return (
    <Modal
      title={t('„{plugin}“ ist im Kern', { plugin: r.plugin })}
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={onClose}>
            {t('Abbrechen')}
          </button>
          <button className="btn" disabled={!/^\d+\.\d+\.\d+$/.test(version)} onClick={async () => (await act(() => api.post(`/api/werkstatt/core/${r.id}/ship`, { version, action }), t('Als „im Kern enthalten“ markiert'))) && onDone()}>
            {t('Bestätigen')}
          </button>
        </>
      }
    >
      <p>
        {t('Ab dieser Version gehört die Funktion fest zum Produkt.')} {action === 'retire' ? t('Das Plugin und alle Installationen werden entfernt.') : t('Das Plugin wird überall ausgeschaltet, die Daten bleiben erhalten.')} {t('Alle, die es installiert hatten, werden benachrichtigt.')}
      </p>
      <Field label={t('Ausgeliefert in Version')}>
        <Input value={version} onChange={setVersion} placeholder="0.0.30" />
      </Field>
    </Modal>
  );
}

/** From the plugin page: spec + GitHub issue for a coding agent. */
export function CoreProposalModal({ plugin, onClose, onDone }: { plugin: { id: string; name: string }; onClose: () => void; onDone: () => void }) {
  const t = useT('b7werk');
  const pol = useLoad(() => api.get<{ policy: Policy }>('/api/werkstatt/policy'), []);
  const [agent, setAgent] = useState('');
  const [repo, setRepo] = useState('');
  const gh = useLoad(() => api.get<{ ready: boolean; hint: string }>(`/api/werkstatt/core/github?repo=${encodeURIComponent(repo)}`).catch(() => null), [repo]);
  const [target, setTarget] = useState('');
  const [action, setAction] = useState('migrate');
  const [issue, setIssue] = useState(true);
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    const r = await act(() => api.post<{ issue_error?: string; issue_url?: string }>(`/api/werkstatt/plugins/${plugin.id}/core-proposal`, { agent: agent || undefined, repo: repo || undefined, target_version: target || undefined, core_action: action, create_issue: issue && !!gh.data?.ready }));
    setBusy(false);
    if (r) {
      if (r.issue_error) toast(t('Spezifikation gespeichert – Issue nicht angelegt: {issue_error}', { issue_error: r.issue_error }));
      else toast(r.issue_url ? t('Spezifikation erstellt und Issue angelegt') : t('Spezifikation erstellt'));
      onDone();
    }
  };
  const d = pol.data?.policy.core;
  return (
    <Modal
      title={t('„{name}“ als {stage3} vorschlagen', { name: plugin.name, stage3: NAMES.stage3 })}
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={onClose}>
            {t('Abbrechen')}
          </button>
          <button className="btn" disabled={busy} onClick={go}>
            <Icon name="rocket" size={14} /> {busy ? t('Spezifikation wird erstellt …') : t('Vorschlagen')}
          </button>
        </>
      }
    >
      <p className="muted small">{t('Die KI schreibt aus dem Wunsch, dem Plugin-Code und den Nutzungsdaten eine Spezifikation. Damit wird ein GitHub-Issue für den Coding-Agenten angelegt; dort entsteht der Pull Request. Das kostet etwas KI-Budget.')}</p>
      <div className="row">
        <Field label={t('Coding-Agent')}>
          <Select value={agent} onChange={setAgent} options={[['codex', '@codex'], ['claude', '@claude']]} placeholder={t('Standard ({v1})', { v1: d?.agent === 'claude' ? '@claude' : '@codex' })} />
        </Field>
        <Field label={t('Repository')} hint="besitzer/name">
          <Input value={repo} onChange={setRepo} placeholder={d?.repo || t('aus der Richtlinie')} />
        </Field>
      </div>
      <div className="row">
        <Field label={t('Geplante Version (optional)')}>
          <Input value={target} onChange={setTarget} placeholder="0.0.30" />
        </Field>
        <Field label={t('Wenn ausgeliefert')}>
          <Select value={action} onChange={setAction} options={[['migrate', 'Plugin ausschalten, Daten behalten'], ['retire', t('Plugin und Installationen entfernen')]]} />
        </Field>
      </div>
      {gh.data && !gh.data.ready && (
        <div className="card notice-card" data-tour="wk-github-hint">
          {gh.data.hint}
        </div>
      )}
      <Check checked={issue && !!gh.data?.ready} onChange={setIssue} label={t('Gleich ein GitHub-Issue anlegen')} />
    </Modal>
  );
}

