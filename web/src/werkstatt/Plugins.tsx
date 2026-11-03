import { useEffect, useState } from 'react';
import { api, ago, dt } from '../api';
import { Icon } from '../icons';
import { Badge, Check, Empty, Field, Link, Modal, PageHead, Spinner, Stat, Textarea, act, confirmAsk, navigate, toast, useLoad } from '../ui';
import type { WerkstattMe } from './Build';
import { PluginFrame } from './PluginFrame';
import { PublishModal, RatingCard } from './Marktplatz';
import { CoreProposalModal } from './Admin';
import { NAMES, PluginIcon, ScopeBadge, refreshPlugins, usd } from './shared';
import { ConsentModal, ScopeList, scopeInfos, type ScopeInfo } from './scopes';
import { DiffList, ProMark, SignatureNotice, VersionBadges, type DiffData, type SignatureData, type VersionBadgesData } from './badges';
import { SortableGrid } from '../sortable/Sortable';
import { tr, useT } from '../i18n';

/** „Meine Plugins“ (list, examples, import) and the page of one plugin (versions, rollout, health, change). */

export interface Health {
  installs: number;
  usage_7d: number;
  usage_30d: number;
  errors_24h: number;
  errors_7d: number;
  last_error: string;
  last_error_at: string | null;
  votes: number;
  rating: number | null;
  reviews: number;
  killed: boolean;
  avg_ms_24h?: number;
  error_rate_24h?: number;
}
export interface PluginBrief {
  id: string;
  slug: string;
  name: string;
  icon: string;
  description: string;
  category: string;
  scope: 'private' | 'location' | 'agency' | 'marketplace';
  status: string;
  origin: string;
  version: string;
  scopes: ScopeInfo[];
  risk: string;
  entries: Entries | null;
  mine: boolean;
  can_manage: boolean;
  active_here: boolean;
  enabled_here: boolean;
  killed_reason: string;
  wish_id: string | null;
  core_status: string;
  core_version: string;
  owner?: { user: string; location: string };
  health?: Health;
  updated_at: string;
}
interface Entries {
  page: { title: string; icon?: string } | null;
  panels: { id: string; on: string; title: string }[];
  widgets: { id: string; title: string }[];
  actions: { id: string; label: string }[];
  jobs: { id: string; label: string; every: string; at?: string }[];
}
interface VersionBrief {
  id: string;
  version: string;
  status: string;
  changelog: string;
  source: string;
  created_at: string;
  active: boolean;
  scopes: string[];
  ok: boolean;
  issues: string[];
  warnings: number;
  badges?: VersionBadgesData;
  diff?: DiffData | null;
}
interface PluginFull extends PluginBrief {
  manifest: { scopes: string[]; entries: Entries; server?: { mode: string } } | null;
  versions: VersionBrief[];
  installs?: { id: string; location: string; private: boolean; enabled: boolean }[];
  runs?: { kind: string; entry_id: string; status: string; detail: string; ms: number; created_at: string }[];
  created_count?: number;
  wish: { id: string; title: string } | null;
}
interface Example {
  key: string;
  name: string;
  icon: string;
  description: string;
  scopes: ScopeInfo[];
  entries: Entries;
  wish: string;
  installed: string | null;
}

export const STATUS_LABEL: Record<string, string> = { active: 'aktiv', killed: 'automatisch abgeschaltet', in_core: NAMES.inCore, off: 'aus' };
const SOURCE_LABEL: Record<string, string> = { ai: 'KI', change: 'Änderung', example: 'Beispiel', import: 'Import', manual: 'von Hand' };

export function entrySummary(e: Entries | null): string[] {
  const t = tr('b7werk');
  if (!e) return [];
  const out: string[] = [];
  if (e.page) out.push(t('Seite „{title}“', { title: e.page.title }));
  for (const p of e.panels ?? []) out.push(t('Panel „{title}“ ({on})', { title: p.title, on: p.on === 'contact' ? t('Kontakt') : t('Deal') }));
  for (const w of e.widgets ?? []) out.push(t('Widget „{title}“', { title: w.title }));
  for (const a of e.actions ?? []) out.push(t('Automations-Schritt „{label}“', { label: a.label }));
  for (const j of e.jobs ?? []) out.push(t('Job „{label}“', { label: j.label }));
  return out;
}

export function download(name: string, text: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function PluginCard({ p }: { p: PluginBrief }) {
  const t = useT('b7werk');
  const errors = p.health?.errors_7d ?? 0;
  return (
    <Link to={`werkstatt/plugins/${p.id}`} className="wk-row card wk-plugin" tour="wk-plugin-card">
      <span className="wk-ico">
        <PluginIcon name={p.icon} size={20} />
      </span>
      <div className="grow">
        <strong>{p.name}</strong> <span className="muted small">v{p.version}</span>
        <div className="muted small">{p.description}</div>
        <div className="wk-badges">
          <ScopeBadge scope={p.scope} />
          {p.status !== 'active' && <Badge tone={p.status === 'killed' ? 'red' : 'purple'}>{t(STATUS_LABEL[p.status] ?? p.status)}</Badge>}
          {p.active_here && !p.enabled_here && <Badge tone="gray">{t('ausgeschaltet')}</Badge>}
          {errors > 0 && <Badge tone="yellow">{t('{errors} Fehler (7 Tage)', { errors })}</Badge>}
          {entrySummary(p.entries).slice(0, 2).map((s) => (
            <span key={s} className="muted small">
              {s}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}

export function PluginsTab({ me }: { me?: WerkstattMe }) {
  const t = useT('b7werk');
  const list = useLoad(() => api.get<{ plugins: PluginBrief[] }>('/api/plugins'), []);
  const examples = useLoad(() => api.get<Example[]>('/api/plugins/examples'), []);
  const [example, setExample] = useState<Example>();
  const [importing, setImporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const plugins = list.data?.plugins ?? [];
  const mine = plugins.filter((p) => p.can_manage);
  const others = plugins.filter((p) => !p.can_manage);
  const install = async (e: Example) => {
    setBusy(true);
    const r = await act(() => api.post(`/api/plugins/examples/${e.key}/install`, { consent: e.scopes.map((s) => s.key) }), t('„{name}“ ist eingerichtet', { name: e.name }));
    setBusy(false);
    if (r) {
      setExample(undefined);
      void refreshPlugins();
      void list.reload();
      void examples.reload();
    }
  };
  return (
    <>
      <div className="actions" style={{ justifyContent: 'flex-end', marginBottom: 10 }}>
        <button className="btn secondary" data-tour="wk-import" onClick={() => setImporting(true)}>
          <Icon name="upload" size={14} /> {t('Plugin importieren')}
        </button>
      </div>
      {list.loading && !list.data ? (
        <Spinner />
      ) : (
        <>
          {mine.length ? (
            <div className="wk-list" data-tour="wk-plugins">
              {mine.map((p) => (
                <PluginCard key={p.id} p={p} />
              ))}
            </div>
          ) : (
            <Empty tour="wk-plugins-empty">{t('Du hast noch kein Plugin. Probiere unten ein Beispiel aus oder lass dir einen Wunsch bauen.')}</Empty>
          )}
          {others.length > 0 && (
            <>
              <h3>{t('Von anderen für diesen Sub-Account')}</h3>
              <div className="wk-list">
                {others.map((p) => (
                  <PluginCard key={p.id} p={p} />
                ))}
              </div>
            </>
          )}
        </>
      )}
      <h3>{t('Beispiele zum Ausprobieren')}</h3>
      <p className="muted small">{t('Fertige Plugins – so sieht ein Ergebnis aus. Sie laufen zuerst nur für dich und lassen sich jederzeit entfernen.')}{me && !me.can_build ? ` (${me.reason})` : ''}</p>
      <div className="wk-examples" data-tour="wk-examples">
        {(examples.data ?? []).map((e) => (
          <div className="card wk-example" key={e.key}>
            <div className="row" style={{ gap: 10, flexWrap: 'nowrap' }}>
              <span className="wk-ico">
                <PluginIcon name={e.icon} size={20} />
              </span>
              <div className="grow">
                <strong>{e.name}</strong>
                <div className="muted small">{e.description}</div>
                <div className="muted small">{entrySummary(e.entries).join(' · ')}</div>
              </div>
            </div>
            <div className="actions" style={{ marginTop: 10 }}>
              {e.installed ? (
                <Link to={`werkstatt/plugins/${e.installed}`} className="btn secondary small">
                  {t('Eingerichtet – ansehen')}
                </Link>
              ) : (
                <button className="btn small" disabled={!me?.can_build} onClick={() => setExample(e)}>
                  {t('Einrichten')}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {example && <ConsentModal title={t('„{name}“ einrichten', { name: example.name })} intro={example.wish} scopes={example.scopes} confirm={t('Einrichten')} busy={busy} onConfirm={() => install(example)} onClose={() => setExample(undefined)} />}
      {importing && <ImportModal onClose={() => setImporting(false)} onDone={(id) => (setImporting(false), void refreshPlugins(), navigate(`werkstatt/plugins/${id}`))} />}
    </>
  );
}

interface Preview {
  name: string;
  version: string;
  description: string;
  scopes: ScopeInfo[];
  intact: boolean;
  entries: Entries;
  signature: SignatureData;
  pro_required: boolean;
}
function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: (id: string) => void }) {
  const t = useT('b7werk');
  const [text, setText] = useState('');
  const [pv, setPv] = useState<Preview>();
  const [ok, setOk] = useState(false);
  const [unverified, setUnverified] = useState(false);
  const [busy, setBusy] = useState(false);
  const parse = () => {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  };
  const check = async () => {
    const bundle = parse();
    if (!bundle) return void act(async () => Promise.reject(new Error(t('Das ist kein gültiges JSON.'))));
    setBusy(true);
    const r = await act(() => api.post<Preview>('/api/plugins/import/preview', { bundle }));
    setBusy(false);
    setPv(r);
    setOk(false);
    setUnverified(false);
  };
  const run = async () => {
    if (!pv) return;
    setBusy(true);
    const r = await act(() => api.post<PluginBrief>('/api/plugins/import', { bundle: parse(), consent: pv.scopes.map((s) => s.key), accept_unverified: pv.signature.state === 'signed' ? undefined : unverified }), t('Plugin importiert'));
    setBusy(false);
    if (r) onDone(r.id);
  };
  return (
    <Modal
      title={t('Plugin importieren')}
      wide
      onClose={onClose}
      footer={
        pv ? (
          <>
            <button className="btn secondary" onClick={() => setPv(undefined)}>
              Zurück
            </button>
            <button className="btn" disabled={!ok || busy || pv.signature.state === 'invalid' || pv.pro_required || (pv.signature.state !== 'signed' && !unverified)} onClick={run}>
              {t('Importieren')}
            </button>
          </>
        ) : (
          <button className="btn" disabled={busy || text.trim().length < 20} onClick={check}>
            {t('Prüfen')}
          </button>
        )
      }
    >
      {!pv ? (
        <>
          <p className="muted small">{t('Ein Plugin-Paket (.gohigh-plugin.json) von einer anderen Installation. Es wird vor dem Einrichten genauso geprüft wie ein selbst gebautes.')}</p>
          <input type="file" accept=".json,application/json" onChange={(e) => e.target.files?.[0]?.text().then(setText)} />
          <Field label={t('oder hier einfügen')}>
            <Textarea value={text} onChange={setText} rows={8} placeholder={t('{ "format": "gohigh-plugin", … }')} />
          </Field>
        </>
      ) : (
        <>
          <p>
            <strong>{pv.name}</strong> <span className="muted small">v{pv.version}</span>
          </p>
          <p className="muted">{pv.description}</p>
          <p className="muted small">{entrySummary(pv.entries).join(' · ')}</p>
          <SignatureNotice sig={pv.signature} proRequired={pv.pro_required} />
          {pv.signature.state !== 'signed' && pv.signature.state !== 'invalid' && <Check checked={unverified} onChange={setUnverified} label={t('Ich weiß, dass dieses Paket ungeprüft ist, und installiere es auf eigene Verantwortung.')} />}
          {!pv.intact && <div className="card notice-card">{t('Die Prüfsumme des Pakets stimmt nicht – der Inhalt wurde seit dem Export verändert. Prüfe, woher es kommt.')}</div>}
          <h4>{t('Das Plugin darf')}</h4>
          <ScopeList scopes={pv.scopes} />
          <Check checked={ok} onChange={setOk} label={t('Ich habe die Berechtigungen gelesen und stimme zu.')} />
        </>
      )}
    </Modal>
  );
}

// --- one plugin ---------------------------------------------------------------------------------------------------------

export function PluginDetail({ id }: { id: string }) {
  const t = useT('b7werk');
  const r = useLoad(() => api.get<PluginFull>(`/api/plugins/${id}`), [id]);
  const me = useLoad(() => api.get<WerkstattMe>('/api/werkstatt/me'), []);
  const [modal, setModal] = useState<'change' | 'uninstall' | 'kill' | 'publish' | 'core' | 'rollback' | null>(null);
  const [roll, setRoll] = useState<VersionBrief>();
  // Deep link from the alarm (push button or email): ?action=rollback opens the confirmation – it never rolls back by itself.
  useEffect(() => {
    if (new URLSearchParams(location.search).get('action') === 'rollback') {
      setModal('rollback');
      history.replaceState(history.state, '', location.pathname);
    }
  }, [id]);
  const p = r.data;
  if (r.loading && !p) return <Spinner />;
  if (!p) return <Empty action={<Link to="werkstatt/plugins">{t('Zu den Plugins')}</Link>}>{r.error || t('Plugin nicht gefunden.')}</Empty>;
  const admin = !!me.data?.admin;
  const manage = p.can_manage;
  const done = async (fn: () => Promise<unknown>, ok: string) => {
    if (await act(fn, ok) !== undefined) {
      void refreshPlugins();
      void r.reload();
    }
  };
  const mf = p.manifest;
  const current = new Set(mf?.scopes ?? []);
  const activate = (v: VersionBrief, consent?: string[]) => done(() => api.post(`/api/plugins/${p.id}/versions/${v.id}/activate`, { consent: consent ?? v.scopes }), t('Version {version} ist aktiv', { version: v.version }));
  const rollTo = (v: VersionBrief) => (v.scopes.some((s) => !current.has(s)) ? setRoll(v) : void activate(v));
  const exportIt = async () => {
    const text = await act(() => api.text('GET', `/api/plugins/${p.id}/export`));
    if (text) download(`${p.slug}-${p.version}.gohigh-plugin.json`, text);
  };
  const h = p.health;
  return (
    <div className="wk-detail">
      <p>
        <Link to="werkstatt/plugins">{t('← Alle Plugins')}</Link>
      </p>
      <PageHead title={p.name} sub={p.description}>
        {p.active_here && p.enabled_here && mf?.entries.page && (
          <Link to={`plugin/${p.id}`} className="btn">
            <Icon name="play" size={14} /> Öffnen
          </Link>
        )}
        {manage && p.status === 'active' && (
          <button className="btn secondary" data-tour="wk-change" onClick={() => setModal('change')}>
            <Icon name="hammer" size={14} /> {NAMES.change}
          </button>
        )}
        {p.active_here && (
          <button className="btn secondary" onClick={() => done(() => api.post(`/api/plugins/${p.id}/toggle`, { enabled: !p.enabled_here }), p.enabled_here ? t('Ausgeschaltet') : t('Eingeschaltet'))}>
            <Icon name="power" size={14} /> {p.enabled_here ? t('Ausschalten') : t('Einschalten')}
          </button>
        )}
      </PageHead>
      <div className="wk-badges" style={{ marginBottom: 12 }}>
        <ScopeBadge scope={p.scope} />
        <Badge tone={p.status === 'active' ? 'green' : p.status === 'killed' ? 'red' : 'purple'}>{t(STATUS_LABEL[p.status] ?? p.status)}</Badge>
        <span className="muted small">{t('Version {version} ·', { version: p.version })} {p.origin === 'ai' ? t('von der KI gebaut') : p.origin === 'example' ? t('Beispiel') : p.origin === 'import' ? t('importiert') : t('von Hand')}</span>
        {p.core_status && <Badge tone="purple">{t('Kernfeature:')} {p.core_status === 'shipped' ? NAMES.inCore : t('vorgeschlagen')}</Badge>}
        {p.owner && <span className="muted small">{t('von {user} ({location})', { user: p.owner.user, location: p.owner.location })}</span>}
      </div>
      {p.status === 'killed' && (
        <div className="card notice-card" data-tour="wk-killed">
          <strong>{t('Automatisch abgeschaltet.')}</strong> {p.killed_reason}
          {(admin || (manage && p.versions.filter((v) => v.status === 'checked').length > 1)) && (
            <p style={{ marginBottom: 0 }} className="actions">
              {manage && p.versions.filter((v) => v.status === 'checked').length > 1 && (
                <button className="btn small" onClick={() => setModal('rollback')}>
                  <Icon name="undo" size={14} /> {t('Zurückrollen auf die Vorversion')}
                </button>
              )}
              {admin && (
                <button className="btn secondary small" onClick={() => done(() => api.post(`/api/plugins/${p.id}/revive`), t('Wieder eingeschaltet'))}>
                  {t('Wieder einschalten')}
                </button>
              )}
            </p>
          )}
        </div>
      )}
      {p.status === 'in_core' && <div className="card notice-card">{t('Diese Funktion ist {inCore} (ab Version {core_version}). Das Plugin ist abgelöst.', { inCore: NAMES.inCore, core_version: p.core_version })}</div>}

      <div className="grid2">
        <div className="card">
          <h3>{t('Berechtigungen')}</h3>
          <ScopeList scopes={p.scopes} />
          <h4>{t('Wo es auftaucht')}</h4>
          <ul className="wk-entries">
            {entrySummary(p.manifest?.entries ?? p.entries).map((s) => (
              <li key={s}>{s}</li>
            ))}
            {mf?.server && <li>{t('Server-Logik:')} {mf.server.mode === 'script' ? t('Skript in der Sandbox') : t('deklarative Schritte')}</li>}
          </ul>
        </div>
        <div className="card" data-tour="wk-rollout">
          <h3>{t('Verfügbar für')}</h3>
          <p>
            <ScopeBadge scope={p.scope} />
          </p>
          <p className="muted small">{t('Privat → Sub-Account → Agentur-weit → {marktplatz}. Jede Stufe macht das Plugin für mehr Menschen verfügbar; es läuft immer mit den Rechten der jeweiligen Person.', { marktplatz: NAMES.marktplatz })}</p>
          <div className="actions">
            {manage && p.scope === 'private' && p.status === 'active' && (
              <button className="btn secondary small" onClick={() => confirmAsk(t('„{name}“ für alle Personen dieses Sub-Accounts freigeben?', { name: p.name })) && done(() => api.post(`/api/plugins/${p.id}/scope`, { scope: 'location' }), t('Für den Sub-Account freigegeben'))}>
                {t('Für den Sub-Account freigeben')}
              </button>
            )}
            {admin && p.scope === 'location' && p.status === 'active' && (
              <button className="btn secondary small" onClick={() => confirmAsk(t('„{name}“ in allen Sub-Accounts der Agentur verfügbar machen?', { name: p.name })) && done(() => api.post(`/api/plugins/${p.id}/scope`, { scope: 'agency' }), t('Agentur-weit freigegeben'))}>
                {t('Agentur-weit freigeben')}
              </button>
            )}
            {manage && (p.scope === 'location' || (p.scope === 'agency' && admin)) && (
              <button className="btn ghost small" onClick={() => done(() => api.post(`/api/plugins/${p.id}/scope`, { scope: 'private' }), t('Wieder privat'))}>
                {t('Wieder privat')}
              </button>
            )}
            {admin && p.scope !== 'marketplace' && p.status === 'active' && (
              <button className="btn small" data-tour="wk-publish" onClick={() => setModal('publish')}>
                <Icon name="store" size={14} /> {t('Im {marktplatz} veröffentlichen', { marktplatz: NAMES.marktplatz })}
                {me.data && !me.data.license.pro && <ProMark />}
              </button>
            )}
            {p.scope === 'marketplace' && (
              <Link to={`marktplatz/${p.id}`} className="btn secondary small">
                {t('Im {marktplatz} ansehen', { marktplatz: NAMES.marktplatz })}
              </Link>
            )}
            {admin && p.status !== 'in_core' && (
              <button className="btn secondary small" data-tour="wk-core" onClick={() => setModal('core')}>
                <Icon name="rocket" size={14} /> {t('Als Kernfeature vorschlagen')}
              </button>
            )}
          </div>
        </div>
      </div>

      {p.active_here && p.enabled_here && mf?.entries.page && p.status === 'active' && (
        <div className="card">
          <h3>{t('Vorschau')}</h3>
          <PluginFrame pluginId={p.id} entry="page" title={p.name} height={320} />
        </div>
      )}

      {p.active_here && p.status === 'active' && <RatingCard pluginId={p.id} />}

      {manage && h && (
        <div className="card" data-tour="wk-health">
          <h3>{t('Gesundheit')}</h3>
          <SortableGrid id="werkstatt.health" className="stats">
            <Stat label={t('Installationen')} value={h.installs} />
            <Stat label={t('Nutzung (30 Tage)')} value={h.usage_30d} sub={t('{usage_7d} in 7 Tagen', { usage_7d: h.usage_7d })} />
            <Stat label={t('Fehler (7 Tage)')} value={h.errors_7d} sub={t('{errors_24h} in 24 Std.', { errors_24h: h.errors_24h })} />
            <Stat label={t('Stimmen')} value={h.votes} sub={h.rating !== null ? t('Bewertung {rating}/5 ({reviews})', { rating: h.rating, reviews: h.reviews }) : t('noch keine Bewertung')} />
            <Stat label={t('Antwortzeit (24 Std.)')} value={h.avg_ms_24h ? `${h.avg_ms_24h} ms` : '–'} sub={h.error_rate_24h ? t('{v1} % Fehler', { v1: Math.round(h.error_rate_24h * 100) }) : t('keine Fehler')} />
          </SortableGrid>
          {h.last_error && (
            <p className="muted small">
              {t('Letzter Fehler {v1}: {last_error}', { v1: ago(h.last_error_at), last_error: h.last_error })}
            </p>
          )}
          {p.runs && p.runs.length > 0 && (
            <details>
              <summary>{t('Letzte Läufe')}</summary>
              <div className="table-wrap">
                <table>
                  <tbody>
                    {p.runs.map((x, i) => (
                      <tr key={i}>
                        <td>{dt(x.created_at)}</td>
                        <td>{x.kind === 'job' ? t('Job') : t('Aktion')} {x.entry_id}</td>
                        <td>
                          <Badge tone={x.status === 'ok' ? 'green' : 'red'}>{x.status === 'ok' ? 'ok' : t('Fehler')}</Badge>
                        </td>
                        <td className="muted small">{x.detail}</td>
                        <td className="muted small">{x.ms} ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
          <p style={{ marginBottom: 0 }} className="actions">
            {manage && p.versions.filter((v) => v.status === 'checked').length > 1 && (
              <button className="btn secondary small" data-tour="wk-rollback" onClick={() => setModal('rollback')}>
                <Icon name="undo" size={14} /> {t('Zurückrollen auf die Vorversion')}
              </button>
            )}
            {admin && p.status === 'active' && (
              <button className="btn danger small" onClick={() => setModal('kill')}>
                {t('Notausschalter: sofort abschalten')}
              </button>
            )}
          </p>
        </div>
      )}

      {manage && (
        <div className="card" data-tour="wk-versions">
          <h3>{t('Versionen')}</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('Version')}</th>
                  <th>{t('Änderung und Siegel')}</th>
                  <th>{t('Von')}</th>
                  <th>{t('Stand')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {p.versions.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <strong>{v.version}</strong> {v.active && <Badge tone="green">aktiv</Badge>}
                    </td>
                    <td>
                      {v.changelog || '–'}
                      <DiffList d={v.diff} />
                      {v.status !== 'checked' && v.issues.length > 0 && <div className="muted small">{t('Prüfung fehlgeschlagen: {v1}', { v1: v.issues[0] })}</div>}
                      <VersionBadges b={v.badges} />
                    </td>
                    <td>{t(SOURCE_LABEL[v.source] ?? v.source)}</td>
                    <td className="muted small">{dt(v.created_at)}</td>
                    <td>
                      {!v.active && v.status === 'checked' && p.status === 'active' && (
                        <button className="btn secondary small" onClick={() => rollTo(v)}>
                          {t('Zu dieser Version')}
                        </button>
                      )}
                      {v.status !== 'checked' && <Badge tone="red">{t('nicht bestanden')}</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {manage && p.installs && p.installs.length > 0 && (
        <div className="card">
          <h3>{t('Installationen')}</h3>
          <ul className="wk-entries">
            {p.installs.map((i) => (
              <li key={i.id}>
                {i.location} · {i.private ? t('nur für die Autorin bzw. den Autor') : t('ganzer Sub-Account')} {!i.enabled && <Badge tone="gray">aus</Badge>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="actions" style={{ marginTop: 16 }}>
        <button className="btn secondary small" onClick={exportIt}>
          <Icon name="download" size={14} /> {t('Exportieren (JSON)')}
        </button>
        {p.active_here && (
          <button className="btn secondary small" onClick={() => setModal('uninstall')}>
            {t('Deinstallieren')}
          </button>
        )}
        {manage && (
          <button className="btn danger small" onClick={() => confirmAsk(t('„{name}“ mit allen Versionen endgültig löschen?', { name: p.name })) && act(() => api.del(`/api/plugins/${p.id}`), 'Gelöscht').then((x) => x && (void refreshPlugins(), navigate('werkstatt/plugins')))}>
            Löschen
          </button>
        )}
        {p.wish && (
          <Link to={`wishes/${p.wish.id}`} className="btn ghost small">
            {t('Wunsch: {title}', { title: p.wish.title })}
          </Link>
        )}
      </div>

      {modal === 'change' && <ChangeModal p={p} onClose={() => setModal(null)} />}
      {modal === 'uninstall' && <UninstallModal p={p} onClose={() => setModal(null)} onDone={() => (setModal(null), void refreshPlugins(), void r.reload())} />}
      {modal === 'rollback' && <RollbackModal p={p} onClose={() => setModal(null)} onDone={() => (setModal(null), void refreshPlugins(), void r.reload())} />}
      {modal === 'kill' && <KillModal p={p} onClose={() => setModal(null)} onDone={() => (setModal(null), void refreshPlugins(), void r.reload())} />}
      {modal === 'publish' && <PublishModal plugin={{ id: p.id, name: p.name, version: p.version }} onClose={() => setModal(null)} onDone={() => (setModal(null), void r.reload())} />}
      {modal === 'core' && <CoreProposalModal plugin={{ id: p.id, name: p.name }} onClose={() => setModal(null)} onDone={() => (setModal(null), navigate('werkstatt/core'))} />}
      {roll && (
        <ConsentModal
          title={t('Zu Version {version} wechseln', { version: roll.version })}
          intro={t('Diese Version fragt zusätzliche Berechtigungen an.')}
          scopes={scopeInfos(roll.scopes)}
          confirm={t('Version aktivieren')}
          onConfirm={() => (void activate(roll), setRoll(undefined))}
          onClose={() => setRoll(undefined)}
        />
      )}
    </div>
  );
}

function ChangeModal({ p, onClose }: { p: PluginFull; onClose: () => void }) {
  const t = useT('b7werk');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const est = useLoad(() => api.get<{ typical_usd: number; max_usd: number }>('/api/werkstatt/estimate?kind=change'), []);
  const go = async () => {
    setBusy(true);
    const r = await act(() => api.post<{ id: string }>(`/api/werkstatt/plugins/${p.id}/change`, { feedback: text.trim() }));
    setBusy(false);
    if (r) (onClose(), navigate(`werkstatt/${r.id}`));
  };
  return (
    <Modal
      title={`${NAMES.change}: ${p.name}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={onClose}>
            Abbrechen
          </button>
          <button className="btn" disabled={busy || text.trim().length < 5} onClick={go}>
            <Icon name="hammer" size={14} /> {t('Neue Version bauen')}
          </button>
        </>
      }
    >
      <p className="muted small">{t('Beschreibe, was anders sein soll. Es entsteht eine neue Version; die bisherige bleibt in der Versionsliste und lässt sich jederzeit wieder aktivieren.')}</p>
      <Field label={t('Was soll sich ändern?')}>
        <Textarea value={text} onChange={setText} rows={5} placeholder={t('z. B. Zeige die Geburtstage der nächsten 30 Tage statt 14.')} />
      </Field>
      {est.data && (
        <p className="muted small">
          {t('Geschätzte KI-Kosten: etwa {v1}, höchstens {v2}. Fragt die neue Version zusätzliche Berechtigungen an, wirst du vor dem Aktivieren gefragt.', { v1: usd(est.data.typical_usd), v2: usd(est.data.max_usd) })}
        </p>
      )}
    </Modal>
  );
}

function UninstallModal({ p, onClose, onDone }: { p: PluginFull; onClose: () => void; onDone: () => void }) {
  const t = useT('b7werk');
  const [cleanup, setCleanup] = useState(false);
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    const r = await act(() => api.post<{ removed: number; failed: number }>(`/api/plugins/${p.id}/uninstall`, { cleanup }));
    setBusy(false);
    if (r) {
      toast(cleanup ? t('Deinstalliert, {removed} Einträge entfernt{v2}', { removed: r.removed, v2: r.failed ? t(', {failed} nicht', { failed: r.failed }) : '' }) : t('Deinstalliert'));
      onDone();
    }
  };
  return (
    <Modal
      title={t('„{name}“ deinstallieren', { name: p.name })}
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={onClose}>
            Abbrechen
          </button>
          <button className="btn danger" disabled={busy} onClick={go}>
            {t('Deinstallieren')}
          </button>
        </>
      }
    >
      <p>{t('Das Plugin verschwindet aus diesem Sub-Account. Der Code bleibt in der {werkstatt}, falls du es wieder brauchst.', { werkstatt: NAMES.werkstatt })}</p>
      <Check checked={cleanup} onChange={setCleanup} label={t('Auch aufräumen: vom Plugin angelegte Datensätze ({v1}) und gespeicherte Plugin-Daten entfernen', { v1: p.created_count ?? 0 })} />
    </Modal>
  );
}

function KillModal({ p, onClose, onDone }: { p: PluginFull; onClose: () => void; onDone: () => void }) {
  const t = useT('b7werk');
  const [reason, setReason] = useState('');
  return (
    <Modal
      title={t('Plugin abschalten')}
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={onClose}>
            Abbrechen
          </button>
          <button className="btn danger" onClick={async () => (await act(() => api.post(`/api/plugins/${p.id}/kill`, { reason }), t('Abgeschaltet'))) && onDone()}>
            {t('Sofort abschalten')}
          </button>
        </>
      }
    >
      <p>{t('„{name}“ wird in allen Sub-Accounts angehalten (Seiten, Panels, Widgets, Jobs, Automations-Schritte). Du kannst es später wieder einschalten.', { name: p.name })}</p>
      <Field label={t('Grund (sehen die Betroffenen)')}>
        <Textarea value={reason} onChange={setReason} rows={2} />
      </Field>
    </Modal>
  );
}


/** One-click rollback: the version before runs again (installs, the Marktplatz listing and a killed plugin included). */
function RollbackModal({ p, onClose, onDone }: { p: PluginFull; onClose: () => void; onDone: () => void }) {
  const t = useT('b7werk');
  const [busy, setBusy] = useState(false);
  const checked = p.versions.filter((v) => v.status === 'checked');
  const cur = checked.findIndex((v) => v.active);
  const target = checked[cur + 1] ?? checked.find((v) => !v.active);
  const go = async () => {
    setBusy(true);
    const r = await act(() => api.post<{ from: string; to: string; unpublished: boolean; revived: boolean }>(`/api/plugins/${p.id}/rollback`, {}));
    setBusy(false);
    if (r) {
      toast(t('Zurückgerollt: Version {to} läuft wieder{v2}{v3}', { to: r.to, v2: r.revived ? t(' (wieder eingeschaltet)') : '', v3: r.unpublished ? t('; aus dem {marktplatz} genommen (die ältere Version war dort nie geprüft)', { marktplatz: NAMES.marktplatz }) : '' }));
      onDone();
    }
  };
  return (
    <Modal
      title={t('„{name}“ zurückrollen', { name: p.name })}
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={onClose}>
            Abbrechen
          </button>
          <button className="btn" data-tour="wk-rollback-ok" disabled={busy || !target} onClick={go}>
            <Icon name="undo" size={14} /> {t('Zurückrollen')}
          </button>
        </>
      }
    >
      {target ? (
        <>
          <p>
            {t('Version')} <strong>{p.version}</strong> {t('wird durch die Vorversion')} <strong>{target.version}</strong> {t('ersetzt – für dich, für alle, die das Plugin installiert haben, und im {marktplatz}. Ein abgeschaltetes Plugin läuft danach wieder.', { marktplatz: NAMES.marktplatz })}
          </p>
          <VersionBadges b={target.badges} />
          <p className="muted small">{t('Die jetzige Version bleibt in der Versionsliste und lässt sich jederzeit wieder aktivieren. Berechtigungen, die du schon bestätigt hast, werden nicht erneut abgefragt.')}</p>
        </>
      ) : (
        <p>{t('Es gibt keine ältere geprüfte Version, auf die zurückgerollt werden könnte.')}</p>
      )}
    </Modal>
  );
}
