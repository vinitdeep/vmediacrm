import { useState } from 'react';
import { ago, api, d, dt, euro } from '../api';
import { useSession, type Branding } from '../session';
import { useAppInfo } from '../demo';
import { LearnLink } from '../tour/learn';
import { AcademyWelcome } from '../tour/welcome';
// The default tab is in this chunk; every other tab loads when opened (web/src/lazy.tsx).
import { PageSuspense, lazyPages } from '../lazy';
const { AllTasks, ApiAndMcp, AuditLog, MailAccounts } = lazyPages(() => import('./AgencyPlatform'), 'AllTasks', 'ApiAndMcp', 'AuditLog', 'MailAccounts');
import { ProjectsOverview } from './Project';
const { AllContacts, AllDeals } = lazyPages(() => import('./AgencyLists'), 'AllContacts', 'AllDeals');
const { AgencyDocs } = lazyPages(() => import('./Docs'), 'AgencyDocs');
const { SupabaseMirror } = lazyPages(() => import('./SupabaseMirror'), 'SupabaseMirror');
const { SaasAdmin } = lazyPages(() => import('./Saas'), 'SaasAdmin');
const { CloudConsole } = lazyPages(() => import('./CloudConsole'), 'CloudConsole');
const { OAuthApps } = lazyPages(() => import('./OAuthConnect'), 'OAuthApps');
const { MailboxAgencyCard } = lazyPages(() => import('./Mailboxes'), 'MailboxAgencyCard');
const { LoginSettings } = lazyPages(() => import('./LoginSettings'), 'LoginSettings');
const { TodoistSync } = lazyPages(() => import('./TodoistSync'), 'TodoistSync');
const { OpenShortsSetup } = lazyPages(() => import('./VideoStudio'), 'OpenShortsSetup');
const { AgencyIntegrationsHub } = lazyPages(() => import('./Integrations'), 'AgencyIntegrationsHub');
const { AiTools } = lazyPages(() => import('./AiTools'), 'AiTools');
const { AiConnections } = lazyPages(() => import('./AiConnections'), 'AiConnections');
const { ComposioAgencySetup } = lazyPages(() => import('./Composio'), 'ComposioAgencySetup');
const { NangoAgencySetup } = lazyPages(() => import('./Nango'), 'NangoAgencySetup');
const { CogneeAgencySetup } = lazyPages(() => import('./CogneeAgency'), 'CogneeAgencySetup');
const { McpServers } = lazyPages(() => import('./McpServers'), 'McpServers');
const { PartnerLinks } = lazyPages(() => import('./PartnerLinks'), 'PartnerLinks');
const { BrandingLook, LogoPreview, LogoSet } = lazyPages(() => import('../theme/BrandingLook'), 'BrandingLook', 'LogoPreview', 'LogoSet');
import { SignupLink } from '../referrals';
import { Badge, Check, CodeBox, Empty, Field, Input, Modal, PageHead, Select, Spinner, Textarea, act, confirmAsk, navigate, toast, useLoad } from '../ui';
import { SnapshotTemplates } from './SnapshotTemplates';
import { Slot } from '../slots';
import { AgencyTabs } from '../areas/SettingsTabs';
import { MoreFields } from '../areas/fields';
import { DEFAULT_CLIENT_PERMS, PermissionPicker } from './PermissionPicker';
import { useT } from '../i18n';
const { AgencyFeedback } = lazyPages(() => import('./FeedbackAdmin'), 'AgencyFeedback');
const { SystemHealth } = lazyPages(() => import('./SystemHealth'), 'SystemHealth');
const { UmzugAssistent } = lazyPages(() => import('./UmzugAssistent'), 'UmzugAssistent');


export function DomainBadge({ status }: { status?: { status: string; message?: string } }) {
  const t = useT('b4agency');
  if (!status) return null;
  const map: Record<string, [string, any]> = {
    active: ['HTTPS aktiv', 'green'],
    pending_dns: [t('wartet auf DNS'), 'yellow'],
    pending: [t('wird eingerichtet'), 'blue'],
    unverified: [t('nicht bestätigt'), 'yellow'],
    error: [t('Fehler'), 'red'],
  };
  const [label, tone] = map[status.status] ?? [status.status, 'gray'];
  return (
    <span title={status.message}>
      <Badge tone={tone}>{label}</Badge>
    </span>
  );
}

function randomPassword() {
  const a = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.getRandomValues(new Uint32Array(14)), (n) => a[n % a.length]).join('');
}


function NewClient({ snapshots, onClose, onDone }: { snapshots: any[]; onClose: () => void; onDone: (r: any) => void }) {
  const t = useT('b4agency');
  const [f, setF] = useState<any>({ name: '', timezone: 'Asia/Kolkata', email: '', phone: '', website: '', snapshot_id: '', activate_workflows: false });
  const [login, setLogin] = useState(false);
  const [u, setU] = useState<any>({ email: '', name: '', password: randomPassword(), permissions: DEFAULT_CLIENT_PERMS });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const r = await act(() => api.post('/api/agency/clients', { ...f, user: login ? u : undefined }));
    setBusy(false);
    if (r) onDone({ ...r, password: login ? u.password : undefined });
  };
  return (
    <Modal
      title={t('Neuer Kunde')}
      onClose={onClose}
      wide
      footer={
        <button className="btn" disabled={!f.name || busy} onClick={save}>
          {t('Kunde anlegen')}
        </button>
      }
    >
      <div className="grid2">
        <Field label={t('Firmenname *')}>
          <Input value={f.name} onChange={(v) => setF({ ...f, name: v })} autoFocus />
        </Field>
        <Field label={t('E-Mail der Firma (bekommt Benachrichtigungen)')}>
          <Input value={f.email} onChange={(v) => setF({ ...f, email: v })} />
        </Field>
      </div>
      <MoreFields id="agency-new-client" values={[f.website, f.timezone !== 'Asia/Kolkata' && f.timezone]}>
        <div className="grid2">
          <Field label={t('Zeitzone')}>
            <Input value={f.timezone} onChange={(v) => setF({ ...f, timezone: v })} />
          </Field>
          <Field label={t('Webseite')}>
            <Input value={f.website} onChange={(v) => setF({ ...f, website: v })} />
          </Field>
        </div>
      </MoreFields>
      <Field label={t('Startpaket (Snapshot)')} hint={t('Kopiert Websites (mit Blog), Funnels, Formulare, Kalender, Workflows, Pipelines, Vorlagen, Kurse und Community-Gruppen – keine Kontakte, Teilnehmer oder Beiträge.')}>
        <Select value={f.snapshot_id} onChange={(v) => setF({ ...f, snapshot_id: v })} placeholder={t('– leer starten –')} options={snapshots.map((s) => [s.id, `${s.name} (${s.summary.funnels} Seiten-Projekte, ${s.summary.workflows} Workflows)`])} />
      </Field>
      {f.snapshot_id && <Check checked={f.activate_workflows} onChange={(v) => setF({ ...f, activate_workflows: v })} label={t('Workflows gleich aktivieren (sonst als Entwurf)')} />}
      <hr />
      <Check checked={login} onChange={setLogin} label={t('Login für den Kunden anlegen')} />
      {login && (
        <>
          <div className="grid3">
            <Field label="E-Mail">
              <Input value={u.email} onChange={(v) => setU({ ...u, email: v })} />
            </Field>
            <Field label="Name">
              <Input value={u.name} onChange={(v) => setU({ ...u, name: v })} />
            </Field>
            <Field label={t('Passwort')}>
              <Input value={u.password} onChange={(v) => setU({ ...u, password: v })} />
            </Field>
          </div>
          <MoreFields id="agency-new-client-perms" label={t('Bereiche einschränken')}>
            <Field label={t('Darf sehen')}>
              <PermissionPicker value={u.permissions} onChange={(v) => setU({ ...u, permissions: v })} />
            </Field>
          </MoreFields>
        </>
      )}
    </Modal>
  );
}

function Clients() {
  const t = useT('b4agency');
  const session = useSession();
  const overview = useLoad(() => api.get<any[]>('/api/agency/overview'), []);
  const snapshots = useLoad(() => api.get<any[]>('/api/snapshots'), []);
  const [modal, setModal] = useState(false);
  const [done, setDone] = useState<any>(null);
  const [brand, setBrand] = useState<any>(null);
  const open = (id: string) => session.switchLocation(id);
  if (!overview.data) return <Spinner />;
  const list = overview.data;
  return (
    <>
      <div className="row" style={{ marginBottom: 12, justifyContent: 'space-between' }}>
        <span className="muted">
          {list.length} {t('Kunden ·')} {list.reduce((n, l) => n + l.contacts, 0)} {t('Kontakte ·')} {list.reduce((n, l) => n + l.funnels.length, 0)} {t('Websites/Funnels')}
        </span>
        <button className="btn" data-tour="clients-new" onClick={() => setModal(true)}>
          {t('+ Neuer Kunde')}
        </button>
      </div>
      <div className="table-wrap" data-tour="clients-list">
        <table className="t">
          <thead>
            <tr>
              <th>{t('Kunde')}</th>
              <th>{t('Kontakte')}</th>
              <th>{t('Leads (30 T.)')}</th>
              <th>Pipeline</th>
              <th>{t('Termine')}</th>
              <th>{t('Websites & Funnels')}</th>
              <th>{t('Logins')}</th>
              <th>{t('Aktiv')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((l) => (
              <tr key={l.id}>
                <td>
                  <strong>{l.name}</strong>
                  {l.unread > 0 && (
                    <>
                      {' '}
                      <Badge tone="blue">{l.unread} {t('ungelesen')}</Badge>
                    </>
                  )}
                  <div className="muted small">{t('seit')} {d(l.created_at)}</div>
                </td>
                <td>{l.contacts}</td>
                <td>
                  {l.new_contacts} <span className="muted small">· {l.submissions} {t('Formulare')}</span>
                </td>
                <td>{euro(l.open_value)}</td>
                <td>{l.appointments}</td>
                <td className="small">
                  {l.funnels.map((f: any) => (
                    <div key={f.id}>
                      <a href={f.url} target="_blank" rel="noreferrer">
                        {f.domain || f.name}
                      </a>{' '}
                      {f.domain && <DomainBadge status={f.domain_status} />}
                    </div>
                  ))}
                  {!l.funnels.length && <span className="muted">–</span>}
                </td>
                <td>{l.users}</td>
                <td className="muted small">{l.last_activity ? ago(l.last_activity) : '–'}</td>
                <td className="actions">
                  <button className="btn small" onClick={() => open(l.id)}>
                    {t('Öffnen')}
                  </button>
                  <button
                    className="btn small secondary"
                    onClick={async () => {
                      const r = await act(() => api.post('/api/snapshots', { location_id: l.id, name: `${l.name} – Vorlage` }), t('Snapshot erstellt'));
                      if (r) snapshots.reload();
                    }}
                  >
                    {t('Als Vorlage')}
                  </button>
                  <button className="btn small secondary" onClick={() => setBrand(l)}>
                    {t('Branding')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {brand && (
        <Modal title={t('Branding: {name}', { name: brand.name })} onClose={() => setBrand(null)} wide>
          <BrandingSettings locationId={brand.id} onSaved={() => setBrand(null)} />
        </Modal>
      )}
      {modal && (
        <NewClient
          snapshots={snapshots.data ?? []}
          onClose={() => setModal(false)}
          onDone={(r) => {
            setModal(false);
            setDone(r);
            overview.reload();
            session.reload();
          }}
        />
      )}
      {done && (
        <Modal title={t('{name} ist angelegt', { name: done.location.name })} onClose={() => setDone(null)} footer={<button className="btn" onClick={() => (setDone(null), open(done.location.id))}>{t('Zum Kunden wechseln')}</button>}>
          {done.created && (
            <p>
              {t('Aus dem Snapshot:')} {done.created.funnels.length} {t('Websites/Funnels,')} {done.created.forms.length} {t('Formulare,')} {done.created.calendars.length} {t('Kalender,')} {done.created.workflows.length} {t('Workflows.')}
            </p>
          )}
          {done.user && (
            <>
              <p>{t('Zugang für den Kunden (jetzt notieren, das Passwort wird nicht noch mal angezeigt):')}</p>
              <CodeBox text={t('{origin}/app  ·  {email}  ·  {password}', { origin: location.origin, email: done.user.email, password: done.password })} />
            </>
          )}
          <p className="muted">{t('Nächster Schritt: beim Kunden unter Funnels & Websites die Domain eintragen.')}</p>
        </Modal>
      )}
    </>
  );
}

function Snapshots() {
  const t = useT('b4agency');
  const session = useSession();
  const list = useLoad(() => api.get<any[]>('/api/snapshots'), []);
  const [src, setSrc] = useState(session.locationId);
  const [nameV, setName] = useState('');
  const [apply, setApply] = useState<any>(null);
  const [target, setTarget] = useState('');
  const [activate, setActivate] = useState(false);
  const importFile = async (file: File) => {
    const text = await file.text();
    let name = file.name.replace(/\.json$/, '');
    try {
      name = JSON.parse(text).name || name;
    } catch {
      /* the server reports bad files */
    }
    const r = await act(() => api.post('/api/snapshots/import', { name, data: text }), t('Snapshot importiert'));
    if (r) list.reload();
  };
  return (
    <>
      <SnapshotTemplates />
      <p className="muted">{t('Ein Snapshot ist ein Startpaket: Websites mit Blog-Beiträgen, Funnels, Formulare, Kalender, Workflows, Pipelines, Vorlagen, Produkte, eigene Felder, Kurse (Module & Lektionen) und die Struktur der Community-Gruppen eines Sub-Accounts – ohne Kontakte, Kursteilnehmer oder Community-Beiträge. Damit legst du neue Kunden in Sekunden an.')}</p>
      <div className="card row" style={{ alignItems: 'flex-end' }} data-tour="snapshots-create">
        <Field label={t('Aus Sub-Account')}>
          <Select value={src} onChange={setSrc} options={session.locations.map((l) => [l.id, l.name])} />
        </Field>
        <div className="grow">
          <Field label="Name">
            <Input value={nameV} onChange={setName} placeholder={t('z. B. Handwerker-Website')} />
          </Field>
        </div>
        <button className="btn" style={{ marginBottom: 12 }} onClick={() => act(() => api.post('/api/snapshots', { location_id: src, name: nameV }), t('Snapshot erstellt')).then(() => (setName(''), list.reload()))}>
          {t('Snapshot erstellen')}
        </button>
        <label className="btn secondary" style={{ marginBottom: 12 }}>
          {t('JSON importieren')}
          <input type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
        </label>
      </div>
      {list.data?.length ? (
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table className="t">
            <thead>
              <tr>
                <th>Name</th>
                <th>{t('Inhalt')}</th>
                <th>{t('Erstellt')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.data.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.name}</strong>
                    {s.description && <div className="muted small">{s.description}</div>}
                  </td>
                  <td className="small">
                    {s.summary.funnels} {t('Websites/Funnels (')}{s.summary.pages} {t('Seiten) ·')} {s.summary.forms} {t('Formulare ·')} {s.summary.calendars} {t('Kalender ·')} {s.summary.workflows} {t('Workflows ·')} {s.summary.pipelines} {t('Pipelines ·')} {s.summary.templates} {t('Vorlagen')}
                    {s.summary.blog_posts ? t(' · {blog_posts} Blog-Beiträge', { blog_posts: s.summary.blog_posts }) : ''}
                    {s.summary.courses ? t(' · {courses} Kurse ({lessons} Lektionen)', { courses: s.summary.courses, lessons: s.summary.lessons }) : ''}
                    {s.summary.community_groups ? t(' · {community_groups} Community-Gruppen', { community_groups: s.summary.community_groups }) : ''}
                  </td>
                  <td className="muted">{dt(s.created_at)}</td>
                  <td className="actions">
                    <button className="btn small" onClick={() => (setApply(s), setTarget(''))}>
                      {t('Anwenden')}
                    </button>
                    <a className="btn small secondary" href={`/api/snapshots/${s.id}/download`}>
                      {t('Download')}
                    </a>
                    <button className="btn small ghost" onClick={() => confirmAsk(t('Snapshot löschen?')) && act(() => api.del(`/api/snapshots/${s.id}`)).then(list.reload)}>
                      {t('Löschen')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>{t('Noch keine Snapshots. Bau einen Muster-Kunden mit Website & Workflows auf und speichere ihn als Vorlage.')}</Empty>
      )}
      {apply && (
        <Modal
          title={t('„{name}“ anwenden', { name: apply.name })}
          onClose={() => setApply(null)}
          footer={
            <button
              className="btn"
              disabled={!target}
              onClick={async () => {
                const r = await act(() => api.post(`/api/snapshots/${apply.id}/apply`, { location_id: target, activate_workflows: activate }));
                if (r) {
                  toast(t('Kopiert: {length} Websites/Funnels, {length2} Formulare, {length3} Workflows', { length: r.funnels.length, length2: r.forms.length, length3: r.workflows.length }));
                  setApply(null);
                }
              }}
            >
              {t('Hinzufügen')}
            </button>
          }
        >
          <p className="muted">{t('Fügt alles als Kopie zum Sub-Account hinzu. Bestehendes bleibt unverändert.')}</p>
          <Field label={t('Ziel-Sub-Account')}>
            <Select value={target} onChange={setTarget} placeholder={t('wählen…')} options={session.locations.map((l) => [l.id, l.name])} />
          </Field>
          <Check checked={activate} onChange={setActivate} label={t('Workflows gleich aktivieren')} />
        </Modal>
      )}
    </>
  );
}

function Domains() {
  const t = useT('b4agency');
  const data = useLoad(() => api.get('/api/agency/domains'), []);
  if (!data.data) return <Spinner />;
  const { server_ip, agent, domains } = data.data;
  return (
    <>
      <div className="card" data-tour="domains-howto">
        <h2>{t('So kommt eine Kundendomain online')}</h2>
        <ol>
          <li>{t('Beim Kunden unter Funnels & Websites → Einstellungen & Domain die Domain eintragen (z. B.')} <code>malerbetrieb-meier.de</code>).</li>
          <li>
            {t('Beim Domain-Anbieter einen')} <strong>{t('A-Record')}</strong> {t('auf')} <code>{server_ip || t('die Server-IP')}</code> {t('setzen – für')} <code>@</code> {t('und')} <code>www</code>.
          </li>
          <li>{t('Fertig: Innerhalb weniger Minuten richtet der Domain-Agent nginx und das SSL-Zertifikat ein. Der Status steht unten.')}</li>
        </ol>
        {!agent && <p style={{ color: 'var(--red)' }}>{t('Der Domain-Agent ist auf diesem Server nicht eingerichtet (PGHL_AGENT_TOKEN fehlt) – Domains müssen dann von Hand im Proxy eingetragen werden.')}</p>}
      </div>
      <div className="table-wrap" style={{ marginTop: 12 }} data-tour="domains-list">
        <table className="t">
          <thead>
            <tr>
              <th>{t('Domain')}</th>
              <th>{t('Art')}</th>
              <th>{t('Kunde')}</th>
              <th>Status</th>
              <th>{t('Geprüft')}</th>
            </tr>
          </thead>
          <tbody>
            {domains.map((x: any) => (
              <tr key={x.domain}>
                <td>
                  <a href={`https://${x.domain}`} target="_blank" rel="noreferrer">
                    {x.domain}
                  </a>
                  {x.alias && <div className="muted small">+ {x.alias}</div>}
                </td>
                <td>{x.kind === 'app' ? t('Agentur-App') : t('Website/Funnel')}</td>
                <td>{x.location ?? '–'}</td>
                <td>
                  <DomainBadge status={x} />
                  <div className="muted small">{x.message}</div>
                </td>
                <td className="muted">{x.checked_at ? ago(x.checked_at) : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!domains.length && <Empty>{t('Noch keine eigenen Domains.')}</Empty>}
      </div>
      <p>
        <button className="btn small secondary" onClick={() => data.reload()}>
          {t('Aktualisieren')}
        </button>
      </p>
    </>
  );
}

function BrandingSettings({ locationId, onSaved }: { locationId?: string; onSaved?: () => void }) {
  const t = useT('b4agency');
  const session = useSession();
  const url = locationId ? `/api/agency/locations/${locationId}/branding` : '/api/agency/branding';
  const b = useLoad(() => api.get(url), [url]);
  const agency = useLoad(() => (locationId ? api.get('/api/agency/branding') : Promise.resolve(null)), [locationId]);
  const info = useLoad(() => api.get('/api/agency/domains'), []);
  if (!b.data || (locationId && !agency.data)) return <Spinner />;
  const v = b.data;
  const fb = agency.data ?? {};
  const shown = { ...v, name: v.name || fb.name || '', color: v.color || fb.color || '#c8191f', logo_url: v.logo_url || fb.logo_url || '' };
  const set = (p: any) => b.setData({ ...v, ...p });
  // The client's own values over the agency's: what the logins actually see.
  const merged = (locationId ? { ...fb, ...Object.fromEntries(Object.entries(v).filter(([, x]) => x !== '' && x !== undefined && x !== null)) } : v) as Branding;
  return (
    <>
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <div className="card" style={{ flex: '2 1 420px' }} data-tour="branding-form">
        <div className="grid2">
          <Field label={locationId ? t('App-Name für diesen Kunden') : t('Name deiner Agentur / App')}>
            <Input value={v.name} onChange={(x) => set({ name: x })} placeholder={fb.name} />
          </Field>
          <Field label={t('Markenfarbe')}>
            <input type="color" value={shown.color} onChange={(e) => set({ color: e.target.value })} />
            {locationId && v.color && (
              <button className="btn small secondary" onClick={() => set({ color: '' })}>
                {t('Agentur-Farbe')}
              </button>
            )}
          </Field>
        </div>
        <h3 style={{ margin: '4px 0 8px' }}>{t('Logos und Favicon')}</h3>
        <LogoSet v={v as Branding} fb={fb} set={set} client={!!locationId} />
        <MoreFields id="agency-branding-login" label={t('Texte der Login-Seite')} values={[v.login_title, v.login_text, v.support_email]}>
          <Field label={t('Login: Überschrift')}>
            <Input value={v.login_title} onChange={(x) => set({ login_title: x })} placeholder={t('Anmelden bei {name}', { name: shown.name })} />
          </Field>
          <Field label={t('Login: Text')}>
            <Textarea value={v.login_text} onChange={(x) => set({ login_text: x })} rows={2} placeholder={t('Willkommen in deinem Kundenportal.')} />
          </Field>
          <Field label={t('Support-E-Mail (auf der Login-Seite)')}>
            <Input value={v.support_email} onChange={(x) => set({ support_email: x })} />
          </Field>
        </MoreFields>
        <Field
          tour="branding-domain"
          label={locationId ? t('Login-Domain des Kunden (optional)') : t('Eigene App-Domain')}
          hint={
            locationId ? (
              <>
                {t('z. B.')} <code>crm.kunde.de</code> {t('– A-Record auf')} <code>{info.data?.server_ip || t('die Server-IP')}</code>{t('. Die Login-Seite dort zeigt das Branding des Kunden.')}
              </>
            ) : (
              <>
                {t('z. B.')} <code>app.deine-agentur.de</code> {t('– A-Record auf')} <code>{info.data?.server_ip || t('die Server-IP')}</code>{t('. Kunden loggen sich dann dort ein, und Links in Mails (Buchung, Rechnung) nutzen diese Domain, sobald HTTPS aktiv ist.')}
              </>
            )
          }
        >
          <Input value={v.app_domain} onChange={(x) => set({ app_domain: x })} />
        </Field>
        {v.app_domain && <DomainBadge status={v.app_domain_status} />}
        <p>
          <button
            className="btn"
            onClick={async () => {
              const r = await act(() => api.patch(url, v), t('Branding gespeichert'));
              if (r) {
                b.setData(r);
                if (onSaved) onSaved();
                else session.reload();
              }
            }}
          >
            {t('Speichern')}
          </button>
        </p>
      </div>
      <div className="card" style={{ flex: '1 1 260px' }} data-tour="branding-preview">
        <h2>{t('Vorschau')}</h2>
        <LogoPreview shown={{ ...merged, name: shown.name, color: shown.color }} />
        <p className="muted small">{locationId ? t('Das sehen die Logins dieses Kunden. Leere Felder = dein Agentur-Branding.') : t('„V Media CRM“ taucht danach nirgends mehr auf – auch nicht für Kunden-Logins.')}</p>
      </div>
    </div>
    <BrandingLook locationId={locationId} />
    </>
  );
}

function Integrations() {
  const t = useT('b4agency');
  const s = useLoad(() => api.get<any>('/api/agency/social'), []);
  const locs = useLoad(() => api.get<any[]>('/api/agency/overview'), []);
  const [url, setUrl] = useState<string | null>(null);
  const [key, setKey] = useState('');
  if (!s.data || !locs.data) return <Spinner />;
  const v = s.data;
  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <div className="card" style={{ flex: '1 1 340px' }} data-tour="integrations-postiz">
        <h2>{t('Postiz (Social Planner)')} <SignupLink id="postiz" /></h2>
        <p className="muted small">{t('Postiz veröffentlicht die Posts. Deine Kunden planen im Social Planner, ohne Postiz zu sehen.')}</p>
        <Field label={t('Adresse')}>
          <Input value={url ?? v.url} onChange={setUrl} placeholder="https://postiz.deine-domain.de" />
        </Field>
        <Field label={t('API-Schlüssel')} hint={t('Postiz → Einstellungen → Public API')}>
          <Input type="password" value={key} onChange={setKey} placeholder={v.key_set ? t('•••••••• (gespeichert)') : ''} autoComplete="off" />
        </Field>
        <p>
          <button
            className="btn"
            onClick={async () => {
              const r = await act(() => api.patch('/api/agency/social', { url: url ?? v.url, ...(key ? { api_key: key } : {}) }), t('Verbunden'));
              if (r) (setKey(''), setUrl(null), s.reload());
            }}
          >
            {t('Speichern & testen')}
          </button>{' '}
          {v.key_set && (v.connected ? <Badge tone="green">{t('verbunden')}</Badge> : <Badge tone="red">{v.error || t('nicht erreichbar')}</Badge>)}
        </p>
      </div>
      {v.connected && (
        <div className="card" style={{ flex: '2 1 480px' }}>
          <h2>{t('Kanäle → Projekte')}</h2>
          <p className="muted small">{t('Ein Kanal kann mehreren Projekten dienen (z. B. dein X-Account für die Agentur und ein Produkt). Verbindet ein Kunde selbst einen Kanal, wird er automatisch zugeordnet.')}</p>
          {v.channels.length ? (
            <table className="t">
              <tbody>
                {v.channels.map((c: any) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.name}</strong> <span className="muted small">{c.identifier}{c.profile ? ` · ${c.profile}` : ''}</span>
                      {!c.supported && <div className="muted small">{t('Planen nur in Postiz (Video/Newsletter)')}</div>}
                    </td>
                    <td style={{ width: 280 }}>
                      <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
                        {(c.location_ids ?? []).map((id: string) => (
                          <span key={id} className="social-chip" style={{ padding: '2px 8px' }}>
                            {locs.data!.find((l: any) => l.id === id)?.name ?? id}
                            <button
                              className="btn small ghost"
                              style={{ padding: '0 4px' }}
                              aria-label={t('Zuordnung entfernen')}
                              onClick={async () => (await act(() => api.put(`/api/agency/social/channels/${c.id}`, { location_ids: c.location_ids.filter((x: string) => x !== id) }), t('Entfernt'))) && s.reload()}
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                      <Select
                        value=""
                        placeholder={t('+ Projekt zuordnen')}
                        onChange={async (loc) => {
                          if (loc && (await act(() => api.put(`/api/agency/social/channels/${c.id}`, { location_ids: [...(c.location_ids ?? []), loc] }), t('Zugeordnet')))) s.reload();
                        }}
                        options={locs.data!.filter((l: any) => !(c.location_ids ?? []).includes(l.id)).map((l: any) => [l.id, l.name])}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty>{t('In Postiz sind noch keine Kanäle verbunden.')}</Empty>
          )}
        </div>
      )}
    </div>
  );
}

export function Agency({ tab = 'projects' }: { tab?: string }) {
  const t = useT('b4agency');
  const cloud = !!useAppInfo()?.cloud?.enabled;
  return (
    <>
      <PageHead title={t('Agentur')} sub={t('Alle Projekte und Kunden, Vorlagen, Domains, White-Label, API und Protokoll an einem Ort')}>
        <LearnLink label="learn" />
      </PageHead>
      {tab === 'projects' && <AcademyWelcome />}
      <AgencyTabs
        tabs={([
          ['projects', 'Projekte'],
          ['contacts', 'Kontakte'],
          ['deals', 'Deals'],
          ['tasks', 'Aufgaben'],
          ['docs', 'Dokumente'],
          ['clients', 'Kunden'],
          ['saas', 'SaaS'],
          ...(cloud ? ([['cloud', 'Cloud']] as [string, string][]) : []),
          ['snapshots', 'Snapshots'],
          ['umzug', 'Umzug'],
          ['domains', 'Domains'],
          ['branding', 'White-Label'],
          ['login', 'Anmeldung'],
          ['integrations', 'Integrationen'],
          ['partner-links', 'Partner-Links'],
          ['api', 'API & MCP'],
          ['mcp-servers', 'MCP-Server'],
          ['ai-tools', 'KI-Werkzeuge'],
          ['ai-providers', 'KI-Anbieter (BYOK)'],
          ['feedback', 'Fehler & Wünsche'],
          ['audit', 'Protokoll'],
          ['system', 'System'],
        ] as [string, string][]).map(([k, l]) => [k, t(l)])}
        value={tab}
        onChange={(t) => navigate(`agency/${t}`)}
      />
      <PageSuspense key={tab}>
      {tab === 'projects' && <ProjectsOverview />}
      {tab === 'contacts' && <AllContacts />}
      {tab === 'deals' && <AllDeals />}
      {tab === 'tasks' && <AllTasks />}
      {tab === 'docs' && <AgencyDocs />}
      {tab === 'clients' && (
        <>
          <Clients />
          <Slot name="agency.clients" />
        </>
      )}
      {tab === 'saas' && <SaasAdmin />}
      {tab === 'cloud' && cloud && <CloudConsole />}
      {tab === 'snapshots' && <Snapshots />}
      {tab === 'umzug' && <UmzugAssistent embedded />}
      {tab === 'domains' && <Domains />}
      {tab === 'branding' && (
        <>
          <BrandingSettings />
          <Slot name="agency.branding" />
        </>
      )}
      {tab === 'login' && <LoginSettings />}
      {tab === 'integrations' && (
        <AgencyIntegrationsHub>
          <Integrations />
          <OAuthApps />
          <MailAccounts />
          <MailboxAgencyCard />
          <SupabaseMirror />
          <TodoistSync />
          <OpenShortsSetup />
          <ComposioAgencySetup />
          <NangoAgencySetup />
          <CogneeAgencySetup />
        </AgencyIntegrationsHub>
      )}
      {tab === 'partner-links' && <PartnerLinks />}
      {tab === 'api' && <ApiAndMcp />}
      {tab === 'mcp-servers' && <McpServers agency />}
      {tab === 'ai-tools' && <AiTools agency />}
      {tab === 'ai-providers' && <AiConnections agency />}
      {tab === 'feedback' && <AgencyFeedback />}
      {tab === 'audit' && <AuditLog />}
      {tab === 'system' && (
        <>
          <SystemHealth />
          <Slot name="agency.system" />
        </>
      )}
      </PageSuspense>
    </>
  );
}
