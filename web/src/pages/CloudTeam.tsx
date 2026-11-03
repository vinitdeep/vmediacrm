import { useState } from 'react';
import { api } from '../api';
import { Icon } from '../icons';
import { useSession } from '../session';
import { Badge, Check, Empty, Field, Input, Modal, Spinner, act, toast, useLoad } from '../ui';
import { MeterBar, type CloudMe } from './CloudKit';
import { useT } from '../i18n';
import { trData } from '../i18n/data';

/** Cloud-Konto: the team (members of the account) and – for Agentur – client accounts, white-label and login domains. */

interface Member {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'member';
  all_locations: boolean;
  locations: string[];
  hr: boolean;
  invited: boolean;
  created_at: string;
}

function InviteModal({ me, locations, onClose, onDone }: { me: CloudMe; locations: { id: string; name: string; primary: boolean }[]; onClose: () => void; onDone: () => void }) {
  const t = useT('b5cloud');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [hr, setHr] = useState(false);
  const [only, setOnly] = useState<string[]>([]);
  const agency = me.tenant.entitlements.client_accounts;
  const save = async () => {
    const r = await act(() => api.post<{ mail: string; link: string }>('/api/cloud/team', { email, name, hr, ...(only.length ? { locations: only } : {}) }));
    if (r) {
      toast(r.mail === 'sent' ? t('Einladung verschickt') : t('Nutzer angelegt – Einladungslink kopieren'));
      onDone();
      onClose();
    }
  };
  return (
    <Modal
      title={t('Nutzer einladen')}
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={onClose}>{t('Abbrechen')}</button>
          <button className="btn" disabled={!email.includes('@')} onClick={save}>{t('Einladung senden')}</button>
        </>
      }
    >
      <Field label="E-Mail">
        <Input type="email" value={email} onChange={setEmail} autoFocus />
      </Field>
      <Field label={t('Name (optional)')}>
        <Input value={name} onChange={setName} />
      </Field>
      <Check checked={hr} onChange={setHr} label={t('Darf den Bereich Personal sehen (Gehälter, Abwesenheiten)')} />
      {agency && (
        <Field label={t('Zugriff auf')} hint={t('Leer = alle Sub-Accounts. Ein Login nur für einen Kunden bekommt die üblichen Kunden-Bereiche.')}>
          <div className="cloud-locs">
            {locations.map((l) => (
              <Check key={l.id} checked={only.includes(l.id)} onChange={(v) => setOnly(v ? [...only, l.id] : only.filter((x) => x !== l.id))} label={l.name + (l.primary ? t(' (Haupt-Konto)') : '')} />
            ))}
          </div>
        </Field>
      )}
    </Modal>
  );
}

export function CloudTeam({ me, owner, reload }: { me: CloudMe; owner: boolean; reload: () => void }) {
  const t = useT('b5cloud');
  const team = useLoad(() => api.get<{ members: Member[]; limit: number | null; locations: { id: string; name: string; primary: boolean }[] }>('/api/cloud/team'), []);
  const [invite, setInvite] = useState(false);
  const x = team.data;
  if (!x) return <Spinner />;
  const full = x.limit !== null && x.members.length >= x.limit;
  return (
    <div className="card" data-tour="cloud-team">
      <div className="saas-subtabs">
        <div>
          <h3 style={{ marginTop: 0 }}>Team</h3>
          <p className="muted small" style={{ marginTop: 0 }}>
            {x.limit === null ? t('Unbegrenzt Nutzer – keine Gebühr pro Platz.') : t('Dein Tarif ist für {limit} Nutzer. Für mehr wechsle auf Cloud Team & Company – ohne Gebühr pro Nutzer.', { limit: x.limit })}
          </p>
        </div>
        {owner && (
          <button className="btn" disabled={full || me.tenant.read_only} onClick={() => setInvite(true)} data-tour="cloud-invite">
            <Icon name="plus" />{' '}{t('Nutzer einladen')}</button>
        )}
      </div>
      <div className="table-wrap">
<table className="t">
        <thead>
          <tr>
            <th>Name</th>
            <th>{t('E-Mail')}</th>
            <th>{t('Rolle')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {x.members.map((m) => (
            <tr key={m.id}>
              <td>{m.name}</td>
              <td>{m.email}</td>
              <td>
                {m.role === 'owner' ? <Badge tone="blue">{t('Inhaber:in')}</Badge> : <Badge>{t('Mitglied')}</Badge>} {m.invited && <Badge tone="yellow">{t('eingeladen')}</Badge>} {m.hr && m.role !== 'owner' && <Badge tone="purple">{t('Personal')}</Badge>}
                {!m.all_locations && <span className="muted small">{t('· {length} Sub-Account(s)', { length: m.locations.length })}</span>}
              </td>
              <td className="nowrap" style={{ textAlign: 'right' }}>
                {owner && m.role !== 'owner' && m.invited && (
                  <button
                    className="btn small secondary"
                    onClick={async () => {
                      const r = await act(() => api.post<{ mail: string }>(`/api/cloud/team/${m.id}/invite`, {}));
                      if (r) toast(r.mail === 'sent' ? t('Einladung noch einmal verschickt') : t('Link erzeugt'));
                    }}
                  >{t('Einladung neu')}</button>
                )}{' '}
                {owner && m.role !== 'owner' && (
                  <button
                    className="btn small ghost"
                    onClick={async () => {
                      if (!window.confirm(t('{v} entfernen? Der Login wird gelöscht.', { v: m.name || m.email }))) return;
                      if (await act(() => api.del(`/api/cloud/team/${m.id}`), t('Entfernt'))) {
                        void team.reload();
                        reload();
                      }
                    }}
                  >{t('Entfernen')}</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
</div>
      {invite && <InviteModal me={me} locations={x.locations} onClose={() => setInvite(false)} onDone={() => (void team.reload(), reload())} />}
    </div>
  );
}

// --- Agentur: clients and white-label --------------------------------------------------------------------

interface Client {
  id: string;
  name: string;
  primary: boolean;
  contacts: number;
  users: number;
  meters: Record<'emails' | 'sms' | 'ai' | 'storage_mb', { used: number; limit: number | null; overage: string }>;
  domain: string;
  domain_status?: { status: string };
}

const BRAND_FIELDS: [string, string, string][] = trData('b5cloud', [
  ['name', 'Name der Anwendung', 'z. B. Pixel CRM'],
  ['logo_url', 'Logo-Adresse (https://…)', ''],
  ['color', 'Akzentfarbe (#rrggbb)', '#2563eb'],
  ['login_title', 'Überschrift auf der Anmeldeseite', ''],
  ['login_text', 'Text auf der Anmeldeseite', ''],
  ['support_email', 'Support-E-Mail', ''],
]);

function NewClient({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const t = useT('b5cloud');
  const [name, setName] = useState('');
  return (
    <Modal
      title={t('Neuer Kunden-Account')}
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={onClose}>{t('Abbrechen')}</button>
          <button
            className="btn"
            disabled={!name.trim()}
            onClick={async () => {
              if (await act(() => api.post('/api/cloud/clients', { name }), t('Kunden-Account angelegt'))) {
                onDone();
                onClose();
              }
            }}
          >{t('Anlegen')}</button>
        </>
      }
    >
      <Field label={t('Name des Kunden')} hint={t('Jeder Kunde bekommt ein eigenes, getrenntes Konto mit Pipeline und Vorlagen – ohne Aufpreis.')}>
        <Input value={name} onChange={setName} autoFocus />
      </Field>
    </Modal>
  );
}

function DeleteClient({ c, onClose, onDone }: { c: Client; onClose: () => void; onDone: () => void }) {
  const t = useT('b5cloud');
  const [confirm, setConfirm] = useState('');
  return (
    <Modal
      title={t('Kunden-Account löschen')}
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={onClose}>{t('Abbrechen')}</button>
          <button
            className="btn danger"
            disabled={confirm !== c.name}
            onClick={async () => {
              if (await act(() => api.post(`/api/cloud/clients/${c.id}/delete`, { confirm }), t('Gelöscht'))) {
                onDone();
                onClose();
              }
            }}
          >{t('Endgültig löschen')}</button>
        </>
      }
    >
      <p>{t('„{name}“ mit {contacts} Kontakten und allen Daten wird', { name: c.name, contacts: c.contacts })}{' '}<strong>{t('sofort und endgültig')}</strong>{' '}{t('gelöscht. Exportiere vorher, was du brauchst (Daten & Konto → Export, gilt für alle Accounts).')}</p>
      <Field label={t('Zur Bestätigung „{name}“ eintippen', { name: c.name })}>
        <Input value={confirm} onChange={setConfirm} />
      </Field>
    </Modal>
  );
}

function Branding({ reload }: { reload: () => void }) {
  const t = useT('b5cloud');
  const b = useLoad(() => api.get<Record<string, string>>('/api/cloud/branding'), []);
  const [v, setV] = useState<Record<string, string> | null>(null);
  if (!b.data) return <Spinner />;
  const cur = v ?? b.data;
  return (
    <div className="card" data-tour="cloud-branding">
      <h3 style={{ marginTop: 0 }}>{t('White-Label')}</h3>
      <p className="muted small" style={{ marginTop: 0 }}>{t('Gilt für dein Konto und alle Kunden-Accounts: Name, Logo und Farbe erscheinen statt der Marke des Anbieters.')}</p>
      <div className="grid2">
        {BRAND_FIELDS.map(([k, label, ph]) => (
          <Field key={k} label={label}>
            <Input value={cur[k] ?? ''} placeholder={ph} onChange={(x) => setV({ ...cur, [k]: x })} />
          </Field>
        ))}
      </div>
      <button
        className="btn"
        disabled={!v}
        onClick={async () => {
          if (await act(() => api.put('/api/cloud/branding', v), t('Gespeichert'))) {
            setV(null);
            void b.reload();
            reload();
          }
        }}
      >{t('Speichern')}</button>
    </div>
  );
}

function DomainModal({ c, onClose, onDone }: { c: Client; onClose: () => void; onDone: () => void }) {
  const t = useT('b5cloud');
  const [domain, setDomain] = useState(c.domain);
  return (
    <Modal
      title={t('Login-Domain für {name}', { name: c.name })}
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={onClose}>{t('Abbrechen')}</button>
          <button
            className="btn"
            onClick={async () => {
              if (await act(() => api.put('/api/cloud/domain', { location_id: c.id, domain }), t('Gespeichert'))) {
                onDone();
                onClose();
              }
            }}
          >{t('Speichern')}</button>
        </>
      }
    >
      <Field label={t('Domain')} hint={t('z. B. crm.kunde.de – lege bei deinem DNS-Anbieter einen CNAME-Eintrag auf die Adresse deines Anbieters an. Das Zertifikat kommt automatisch, sobald die Domain zeigt. Leer = keine eigene Domain.')}>
        <Input value={domain} onChange={setDomain} placeholder="crm.kunde.de" autoFocus />
      </Field>
    </Modal>
  );
}

export function CloudClients({ me, owner, reload }: { me: CloudMe; owner: boolean; reload: () => void }) {
  const t = useT('b5cloud');
  const session = useSession();
  const list = useLoad(() => api.get<{ items: Client[]; max: number | null }>('/api/cloud/clients'), []);
  const [add, setAdd] = useState(false);
  const [del, setDel] = useState<Client | null>(null);
  const [dom, setDom] = useState<Client | null>(null);
  const x = list.data;
  if (!x) return <Spinner />;
  const again = () => {
    void list.reload();
    reload();
    void session.reload();
  };
  const full = !!x.max && x.items.length - 1 >= x.max;
  return (
    <>
      <div className="card" data-tour="cloud-clients">
        <div className="saas-subtabs">
          <div>
            <h3 style={{ marginTop: 0 }}>{t('Kunden-Accounts')}</h3>
            <p className="muted small" style={{ marginTop: 0 }}>{t('{v} Jeder Account ist komplett getrennt; die Fair-Use-Grenzen gelten je Account.', { v: x.max ? t('Bis {max} Kunden-Accounts inklusive (Fair Use).', { max: x.max }) : t('Unbegrenzt Kunden-Accounts – ohne Aufpreis.') })}</p>
          </div>
          {owner && (
            <button className="btn" disabled={full || me.tenant.read_only} onClick={() => setAdd(true)} data-tour="cloud-new-client">
              <Icon name="plus" />{' '}{t('Neuer Kunde')}</button>
          )}
        </div>
        <div className="table-wrap">
<table className="t">
          <thead>
            <tr>
              <th>{t('Account')}</th>
              <th>{t('Kontakte')}</th>
              <th>{t('Nutzer')}</th>
              <th>{t('E-Mails')}</th>
              <th>{t('Domain')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {x.items.map((c) => (
              <tr key={c.id}>
                <td>
                  {c.name} {c.primary && <Badge tone="blue">{t('Haupt-Konto')}</Badge>}
                </td>
                <td>{c.contacts.toLocaleString('de-DE')}</td>
                <td>{c.users}</td>
                <td style={{ minWidth: 150 }}>
                  <MeterBar label="" m={c.meters.emails} />
                </td>
                <td>{c.domain ? <span className="mono">{c.domain}</span> : <span className="muted">–</span>} {c.domain_status && <Badge tone={c.domain_status.status === 'active' ? 'green' : 'yellow'}>{c.domain_status.status === 'active' ? t('HTTPS aktiv') : t('wartet auf DNS')}</Badge>}</td>
                <td className="nowrap" style={{ textAlign: 'right' }}>
                  {c.id !== session.locationId && (
                    <button className="btn small secondary" onClick={() => session.switchLocation(c.id)}>{t('Öffnen')}</button>
                  )}{' '}
                  {owner && me.tenant.entitlements.custom_domain && (
                    <button className="btn small ghost" onClick={() => setDom(c)}>{t('Domain')}</button>
                  )}{' '}
                  {owner && !c.primary && (
                    <button className="btn small ghost" onClick={() => setDel(c)}>{t('Löschen')}</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
</div>
        {x.items.length < 2 && <Empty>{t('Noch kein Kunden-Account – lege den ersten an.')}</Empty>}
      </div>
      {owner && <Branding reload={again} />}
      {add && <NewClient onClose={() => setAdd(false)} onDone={again} />}
      {del && <DeleteClient c={del} onClose={() => setDel(null)} onDone={again} />}
      {dom && <DomainModal c={dom} onClose={() => setDom(null)} onDone={again} />}
    </>
  );
}

