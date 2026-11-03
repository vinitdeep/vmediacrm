import { useState } from 'react';
import { ago, api, dt } from '../api';
import { Badge, Check, Copy, Field, Input, Select, Spinner, act, confirmAsk, useLoad } from '../ui';
import { SignupLink } from '../referrals';
import { useT } from '../i18n';

const MODES: Record<string, [string, string][]> = {
  sections: [
    ['auto', 'Eigener Abschnitt (automatisch)'],
    ['existing', 'Vorhandener Abschnitt …'],
    ['off', 'Nicht abgleichen'],
  ],
  projects: [
    ['auto', 'Eigenes Projekt (automatisch)'],
    ['existing', 'Vorhandenes Projekt …'],
    ['off', 'Nicht abgleichen'],
  ],
};
const COUNT_LABELS: [string, string][] = [
  ['created', 'neu in Todoist'],
  ['pushed', 'geändert in Todoist'],
  ['deleted', 'gelöscht in Todoist'],
  ['imported', 'aus Todoist übernommen'],
  ['pulled', 'aus Todoist geändert'],
  ['closed_here', 'hier erledigt'],
  ['conflicts', 'Konflikte'],
  ['errors', 'Fehler'],
];
const LEVEL_TONE: Record<string, 'gray' | 'yellow' | 'red' | 'purple'> = { info: 'gray', warn: 'yellow', error: 'red', conflict: 'purple' };
const LEVEL_LABEL: Record<string, string> = { info: 'Info', warn: 'Hinweis', error: 'Fehler', conflict: 'Konflikt' };
const LOAD = '__load';

type Pick = { id: string; name: string; inbox?: boolean };

/** Agency → Integrationen: two-way task sync with the owner's personal Todoist. */
export function TodoistSync() {
  const t = useT('b7misc');
  const s = useLoad(() => api.get<any>('/api/agency/todoist'), []);
  const [token, setToken] = useState('');
  const [parent, setParent] = useState<string | null>(null);
  const [secret, setSecret] = useState('');
  const [picking, setPicking] = useState<Record<string, boolean>>({});
  const [projects, setProjects] = useState<Pick[] | null>(null);
  const [sections, setSections] = useState<Pick[] | null>(null);
  const [busy, setBusy] = useState(false);
  if (!s.data) return <Spinner />;
  const v = s.data;
  const st = v.state ?? {};
  const bySections = v.layout === 'sections';
  const save = async (patch: any, ok = 'Gespeichert') => {
    const r = await act(() => api.patch('/api/agency/todoist', patch), ok);
    if (r) s.setData(r);
    return r;
  };
  const loadProjects = async () => {
    if (projects) return;
    const list = await act(() => api.get<Pick[]>('/api/agency/todoist/projects'));
    if (list) setProjects(list);
  };
  const loadSections = async () => {
    const list = await act(() => api.get<Pick[]>('/api/agency/todoist/sections'));
    if (list) setSections(list);
  };
  const setMode = async (loc: any, mode: string) => {
    if (mode === 'existing') {
      setPicking({ ...picking, [loc.id]: true });
      return bySections ? loadSections() : loadProjects();
    }
    setPicking({ ...picking, [loc.id]: false });
    const r = await act(() => api.put(`/api/agency/todoist/mapping/${loc.id}`, { mode }), 'Gespeichert');
    if (r) s.setData(r);
  };
  const pickExisting = async (loc: any, id: string) => {
    const p = (bySections ? sections : projects)?.find((x) => x.id === id);
    if (!p) return;
    const body = bySections ? { mode: 'existing', section_id: p.id, section_name: p.name } : { mode: 'existing', project_id: p.id, project_name: p.name };
    const r = await act(() => api.put(`/api/agency/todoist/mapping/${loc.id}`, body), t('Zugeordnet'));
    if (r) (s.setData(r), setPicking({ ...picking, [loc.id]: false }));
  };
  const pickHome = async (id: string) => {
    if (id === LOAD) return loadProjects();
    const p = projects?.find((x) => x.id === id);
    if (await save(id && p ? { home_project_id: p.id, home_project_name: p.name } : { home_project_id: '' })) setSections(null);
  };
  const setEnabled = async (enabled: boolean) => {
    const toCreate = v.locations.filter((l: any) => l.mode === 'auto' && !l.project_id).length;
    if (enabled && !bySections && toCreate > 1 && !confirmAsk(t('Das legt bis zu {toCreate} neue Projekte in Todoist an{v2}. Trotzdem einschalten?', { toCreate, v2: v.account?.premium === false ? t(' – im kostenlosen Plan sind nur 5 Projekte erlaubt') : '' }))) return;
    await save({ enabled });
  };
  const runNow = async (full: boolean) => {
    setBusy(true);
    const r = await act(() => api.post('/api/agency/todoist/sync', { full }), t('Abgeglichen'));
    setBusy(false);
    s.reload();
    return r;
  };
  const counts = st.counts ? COUNT_LABELS.filter(([k]) => st.counts[k]).map(([k, l]) => `${st.counts[k]} ${t(l)}`) : [];
  const homeOptions: [string, string][] = [
    ['', t('Automatisch: „{name}“', { name: v.parent_name || 'V Media CRM' })],
    ...(projects ?? (v.home.picked ? [{ id: v.home.id, name: v.home.name }] : [])).map((p: Pick) => [p.id, p.inbox ? t('{name} (Eingang)', { name: p.name }) : p.name] as [string, string]),
    ...(projects ? [] : [[LOAD, t('Vorhandenes Projekt wählen …')] as [string, string]]),
  ];
  const targetLabel = (l: any) => {
    if (l.mode === 'off') return '';
    if (bySections) return l.section_id ? `→ ${v.home.name} / ${l.section_name || l.section_id}` : l.mode === 'auto' ? t('Abschnitt wird beim nächsten Abgleich angelegt (in „{name}“)', { name: v.home.name }) : '';
    return l.project_id ? `→ ${l.project_name || l.project_id}` : l.mode === 'auto' ? t('Projekt wird beim nächsten Abgleich angelegt{v1}', { v1: v.parent_name ? ` (unter „${v.parent_name}“)` : '' }) : '';
  };
  const pickList = bySections ? sections : projects;

  return (
    <div className="card todoist-card" data-tour="todoist">
      <h2>{t('Todoist')} <SignupLink id="todoist" /></h2>
      <p className="muted small">
        {t('Aufgaben in beide Richtungen mit deinem Todoist abgleichen: Titel, Beschreibung (mit Link zurück), Fälligkeit, Erledigt und Löschen. Standard: ein Projekt „V Media CRM“ mit einem Abschnitt je Sub-Account. Alle 3 Minuten Änderungen, einmal am Tag alles; was du hier änderst, geht nach wenigen Sekunden raus.')}
      </p>
      <div className="grid2">
        <Field label={t('Persönlicher API-Token')} hint={t('Todoist → Einstellungen → Integrationen → Entwickler → API-Token kopieren (bleibt verschlüsselt hier)')}>
          <Input type="password" value={token} onChange={setToken} placeholder={v.token_set ? t('•••••••• {token_hint} (gespeichert)', { token_hint: v.token_hint }) : ''} autoComplete="off" />
        </Field>
        <div className="todoist-conn">
          {v.token_set && v.account ? (
            <>
              <Badge tone="green">{t('verbunden')}</Badge> <strong>{v.account.name || v.account.email}</strong>
              {v.account.premium === false && <Badge>{t('kostenloser Plan')}</Badge>}
              {v.account.email && v.account.name && <span className="muted small"> · {v.account.email}</span>}
            </>
          ) : (
            <Badge>{t('nicht verbunden')}</Badge>
          )}
        </div>
      </div>
      <p className="actions">
        <button className="btn" disabled={!token.trim()} onClick={async () => (await save({ token }, t('Verbunden'))) && setToken('')}>
          {t('Speichern & testen')}
        </button>
        {v.token_set && (
          <button
            className="btn ghost"
            onClick={async () => {
              if (!confirmAsk(t('Todoist trennen? Die Aufgaben bleiben in beiden Systemen, der Abgleich stoppt.'))) return;
              const r = await act(() => api.del('/api/agency/todoist'), t('Getrennt'));
              if (r) s.setData(r);
            }}
          >
            {t('Trennen')}
          </button>
        )}
      </p>

      {v.token_set && (
        <>
          <Check checked={v.enabled} onChange={setEnabled} label={t('Abgleich aktiv')} />
          {!v.enabled && !bySections && <p className="muted small">{t('Bei „Ein Projekt je Sub-Account“ startet der Abgleich erst, wenn du ihn einschaltest.')}</p>}
          <div className="grid2" style={{ marginTop: 10 }}>
            <Field
              label={t('Aufbau in Todoist')}
              hint={
                bySections ? (
                  t('Ein Projekt, darin ein Abschnitt je Sub-Account – passt auch in den kostenlosen Plan (max. 5 Projekte, 20 Abschnitte je Projekt).')
                ) : (
                  <span className={v.account?.premium === false ? 'todoist-err' : ''}>
                    {v.account?.premium === false ? t('Kostenloser Plan: höchstens 5 Projekte – bei mehr Sub-Accounts „Ein Projekt mit Abschnitten“ nehmen.') : t('Ein Projekt je Sub-Account unter einem übergeordneten Projekt.')}
                  </span>
                )
              }
            >
              <Select value={v.layout} onChange={(layout) => (setPicking({}), save({ layout }))} options={[['sections', t('Ein Projekt mit Abschnitten (empfohlen)')], ['projects', t('Ein Projekt je Sub-Account')]]} />
            </Field>
            {bySections ? (
              <Field label={t('Todoist-Projekt')} hint={v.home.picked ? t('Abschnitte werden in diesem Projekt angelegt') : v.home.id ? t('Angelegt – die Abschnitte liegen in „{name}“', { name: v.home.name }) : t('Wird beim ersten Abgleich angelegt (oder ein vorhandenes gleichen Namens genommen)')}>
                <Select value={v.home.picked ? v.home.id : ''} onChange={pickHome} options={homeOptions} />
              </Field>
            ) : (
              <Field label={t('Übergeordnetes Projekt')} hint={t('Automatische Projekte landen darunter; leer = oberste Ebene')}>
                <Input value={parent ?? v.parent_name} onChange={setParent} onBlur={async () => parent !== null && parent !== v.parent_name && (await save({ parent_name: parent })) && setParent(null)} placeholder={t('V Media CRM')} />
              </Field>
            )}
            {bySections && !v.home.picked && (
              <Field label={t('Projektname')} hint={v.home.id ? t('Ein neuer Name benennt das Projekt in Todoist um') : undefined}>
                <Input value={parent ?? v.parent_name} onChange={setParent} onBlur={async () => parent !== null && parent !== v.parent_name && (await save({ parent_name: parent || t('V Media CRM') })) && setParent(null)} placeholder={t('V Media CRM')} />
              </Field>
            )}
            {bySections && (
              <Field label={t('Aufgaben ohne Abschnitt')} hint={t('Neue Aufgaben im Projekt, die in keinem Abschnitt liegen')}>
                <Select value={v.unsectioned_location_id ?? ''} onChange={(id) => save({ unsectioned_location_id: id })} options={[['', t('Ignorieren')], ...v.locations.map((l: any) => [l.id, `→ ${l.name}`] as [string, string])]} />
              </Field>
            )}
            <Field label={t('Richtung')}>
              <Select value={v.direction} onChange={(direction) => save({ direction })} options={[['both', t('Beide Richtungen')], ['push', t('Nur V Media CRM → Todoist')]]} />
            </Field>
            <Field label={t('Welche Aufgaben')} hint={t('Bereits verknüpfte Aufgaben bleiben verknüpft')}>
              <Select value={v.scope} onChange={(scope) => save({ scope })} options={[['all', t('Alle Aufgaben')], ['mine', t('Nur mir zugewiesene')]]} />
            </Field>
            <Field label={t('Sub-Accounts ohne eigene Einstellung')}>
              <Select value={v.default_mode} onChange={(default_mode) => save({ default_mode })} options={[['auto', bySections ? t('Abschnitt automatisch anlegen') : t('Projekt automatisch anlegen')], ['off', t('Nicht abgleichen')]]} />
            </Field>
          </div>
          <Check checked={v.label} onChange={(label) => save({ label })} label={<>{t('Label')} <code>ghp</code> {t('an Aufgaben, die von hier kommen')}</>} />

          <h3 className="todoist-h">{bySections ? t('Abschnitt je Sub-Account') : t('Projekt je Sub-Account')}</h3>
          <div className="todoist-table">
            <table className="t">
              <thead>
                <tr>
                  <th>{t('Sub-Account')}</th>
                  <th>{bySections ? t('Abschnitt in Todoist') : t('Projekt in Todoist')}</th>
                  <th>{t('Verknüpft')}</th>
                </tr>
              </thead>
              <tbody>
                {v.locations.map((l: any) => (
                  <tr key={l.id}>
                    <td>
                      <strong>{l.name}</strong>
                    </td>
                    <td>
                      <div className="todoist-map">
                        <Select value={picking[l.id] ? 'existing' : l.mode} onChange={(m) => setMode(l, m)} options={(MODES[v.layout] ?? MODES.sections).map(([k, l]) => [k, t(l)] as [string, string])} />
                        {picking[l.id] &&
                          (pickList ? (
                            <Select value="" placeholder={bySections ? t('Abschnitt wählen …') : t('Projekt wählen …')} onChange={(p) => pickExisting(l, p)} options={pickList.map((p) => [p.id, p.inbox ? `${p.name} (Eingang)` : p.name] as [string, string])} />
                          ) : (
                            <span className="muted small">{t('wird geladen …')}</span>
                          ))}
                      </div>
                      {!picking[l.id] && targetLabel(l) && <div className="muted small">{targetLabel(l)}</div>}
                    </td>
                    <td>{l.linked ? <Badge tone="blue">{t('{linked} verknüpft', { linked: l.linked })}</Badge> : <span className="muted">–</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {bySections && <p className="muted small">{t('Wird eine Aufgabe in Todoist in einen anderen Abschnitt verschoben, bleibt sie hier im bisherigen Sub-Account.')}</p>}

          <h3 className="todoist-h">Status</h3>
          {st.limit_error && (
            <p className="todoist-limit small">
              <Badge tone="red">{t('Limit')}</Badge> {st.limit_error}
            </p>
          )}
          <p className="small">
            {st.last_run ? (
              <>
                {st.last_error ? <Badge tone="red">{t('Fehler')}</Badge> : <Badge tone="green">ok</Badge>} {t('Letzter Abgleich {v1}', { v1: ago(st.last_run) })}
                {st.last_full ? t(' · komplett {v1}', { v1: ago(st.last_full) }) : ''}
                {' · '}
                {t('{linked} verknüpft', { linked: v.totals.linked })}
                {v.totals.pending ? t(' · {pending} unterwegs', { pending: v.totals.pending }) : ''}
                {v.totals.failed ? t(' · {failed} mit Fehlern', { failed: v.totals.failed }) : ''}
                {st.last_error && <span className="todoist-err"> · {st.last_error}</span>}
              </>
            ) : (
              <span className="muted">{t('Noch nicht abgeglichen.')}</span>
            )}
          </p>
          {counts.length > 0 && !st.last_error && <p className="muted small">{t('Letzter Lauf:')} {counts.join(', ')}</p>}
          <p className="actions">
            <button className="btn secondary" disabled={!v.enabled || busy} onClick={() => runNow(false)}>
              {busy ? t('Gleiche ab …') : t('Jetzt abgleichen')}
            </button>
            <button className="btn ghost" disabled={!v.enabled || busy} onClick={() => runNow(true)}>
              {t('Komplett abgleichen')}
            </button>
          </p>
          <p className="muted small">
            {t('In Todoist gelöschte Aufgaben werden hier nicht gelöscht, sondern als erledigt markiert und abgekoppelt. Haben sich beide Seiten geändert, gewinnt die spätere Änderung (steht im Protokoll).')}
          </p>

          <details className="todoist-details">
            <summary>{t('Webhook (optional, für sofortige Übernahme aus Todoist)')}</summary>
            <p className="muted small">
              {t('Ohne Webhook holt der Abgleich Änderungen alle 3 Minuten. Für sofortige Übernahme: in der Todoist App Console (Einstellungen → Integrationen → Entwickler → App Console) eine App anlegen, als Webhook-URL die Adresse unten eintragen, die Ereignisse')} <code>{t('item:*')}</code> {t('wählen und das Client Secret hier speichern.')}
            </p>
            <div className="grid2">
              <Field label={t('Webhook-URL')}>
                <div className="actions">
                  <code className="todoist-url">{v.webhook_url}</code>
                  <Copy text={v.webhook_url} />
                </div>
              </Field>
              <Field label={t('Client Secret')}>
                <Input type="password" value={secret} onChange={setSecret} placeholder={v.webhook_secret_set ? t('•••••••• (gespeichert)') : ''} autoComplete="off" />
              </Field>
            </div>
            <p className="actions">
              <button className="btn secondary" disabled={!secret.trim()} onClick={async () => (await save({ webhook_secret: secret })) && setSecret('')}>
                {t('Secret speichern')}
              </button>
              {v.webhook_secret_set && (
                <button className="btn ghost" onClick={() => save({ webhook_secret: '' }, t('Entfernt'))}>
                  {t('Webhook entfernen')}
                </button>
              )}
            </p>
          </details>

          <details className="todoist-details" open={v.log.some((e: any) => e.level === 'error' || e.level === 'conflict') || undefined}>
            <summary>{t('Protokoll ({length})', { length: v.log.length })}</summary>
            {v.log.length ? (
              <ul className="todoist-log">
                {v.log.map((e: any) => (
                  <li key={e.id}>
                    <Badge tone={LEVEL_TONE[e.level] ?? 'gray'}>{t(LEVEL_LABEL[e.level] ?? e.level)}</Badge> <span className="muted small">{dt(e.at)}</span> {e.message}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">{t('Noch keine Einträge.')}</p>
            )}
          </details>
        </>
      )}
    </div>
  );
}
