import { useEffect, useState } from 'react';
import { api, dt } from '../api';
import { Icon } from '../icons';
import { Badge, Check, Empty, Field, Input, Link, Select, Spinner, TagInput, Textarea, act, confirmAsk, useLoad } from '../ui';
import { AdsModal, PlatformBadge, type Platform } from './AdsKit';
import { MoreFields } from '../areas/fields';
import { GoogleLeadsCard } from './GoogleLeads';
import { useT } from '../i18n';

/** Zielgruppen (customer lists from smart lists, lookalikes) and Lead-Formulare (instant forms, lead import). */

// --- audiences ---------------------------------------------------------------------------------------------------

export function AdsAudiences() {
  const t = useT('b4ads');
  const { data, loading, reload } = useLoad(() => api.get<any[]>('/api/ads/audiences'), []);
  const [modal, setModal] = useState<null | { kind: 'new' } | { kind: 'sync' | 'lookalike'; a: any }>(null);
  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div>
            <h2 style={{ margin: 0 }}>{t('Zielgruppen aus Smart Lists')}</h2>
            <p className="muted small" style={{ margin: '4px 0 0' }}>
              {t('Deine Kontakte als Kundenliste bei Meta (Custom Audience) oder Google (Customer Match) – übertragen werden nur SHA-256-Hashes. Daraus lassen sich bei Meta Lookalikes machen.')}
            </p>
          </div>
          <button className="btn" data-tour="ads-audience-new" onClick={() => setModal({ kind: 'new' })}>
            {t('+ Zielgruppe')}
          </button>
        </div>
      </div>
      {loading && !data ? (
        <Spinner />
      ) : !data?.length ? (
        <Empty>{t('Noch keine Zielgruppen. Lege eine Smart List an (Kontakte) und mach daraus eine Zielgruppe.')}</Empty>
      ) : (
        <div className="table-wrap">
          <table className="t">
            <thead>
              <tr>
                <th>{t('Zielgruppe')}</th>
                <th>{t('Quelle')}</th>
                <th>Status</th>
                <th className="num">{t('Übertragen')}</th>
                <th>{t('Zuletzt')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((a) => (
                <tr key={a.id}>
                  <td>
                    <PlatformBadge platform={a.platform} /> <strong>{a.name}</strong>
                    {a.kind === 'lookalike' && <span className="muted small"> {t('· Lookalike')} {a.country} {a.ratio ? `${Math.round(a.ratio * 100)} %` : ''}</span>}
                  </td>
                  <td className="muted">{a.kind === 'lookalike' ? t('aus einer Zielgruppe') : a.smart_list_name ? t('Smart List „{smart_list_name}“', { smart_list_name: a.smart_list_name }) : '–'}</td>
                  <td>
                    <Badge tone={a.status === 'ready' ? 'green' : a.status === 'error' ? 'red' : 'gray'}>{a.status === 'ready' ? t('bereit') : a.status === 'error' ? t('Fehler') : t('läuft')}</Badge>
                    {a.last_error && <div className="small" style={{ color: 'var(--red)' }}>{a.last_error}</div>}
                  </td>
                  <td className="num">{a.kind === 'lookalike' ? '–' : `${a.sent}${a.skipped ? t(' ({skipped} ausgelassen)', { skipped: a.skipped }) : ''}`}</td>
                  <td className="muted">{dt(a.last_sync_at)}</td>
                  <td className="ads-actions">
                    {a.kind === 'customer_list' && a.smart_list_id && (
                      <button className="btn small secondary" onClick={() => setModal({ kind: 'sync', a })}>
                        {t('Aktualisieren')}
                      </button>
                    )}
                    {a.platform === 'meta' && a.kind === 'customer_list' && a.status === 'ready' && (
                      <button className="btn small secondary" onClick={() => setModal({ kind: 'lookalike', a })}>
                        {t('Lookalike')}
                      </button>
                    )}
                    <button className="btn small ghost" onClick={async () => confirmAsk(t('Zielgruppe „{name}“ löschen{Plattform}?', { name: a.name, Plattform: a.platform_id ? t(' (auch bei der Plattform)') : '' })) && (await act(() => api.del(`/api/ads/audiences/${a.id}`), t('Gelöscht')), reload())}>
                      {t('Löschen')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small">
        {t('Meta braucht mindestens 100 passende Personen, Google je nach Liste 1.000 und mehr, bevor eine Liste ausgespielt wird. Neue Listen füllen sich bei Google innerhalb von bis zu 48 Stunden. Abgemeldete Kontakte („Nicht stören“) werden nie übertragen.')}
      </p>
      {modal?.kind === 'new' && <AudienceModal onClose={() => setModal(null)} onDone={() => (setModal(null), reload())} />}
      {modal?.kind === 'sync' && <AudienceModal sync={modal.a} onClose={() => setModal(null)} onDone={() => (setModal(null), reload())} />}
      {modal?.kind === 'lookalike' && <LookalikeModal a={modal.a} onClose={() => setModal(null)} onDone={() => (setModal(null), reload())} />}
    </>
  );
}

const CONSENT = 'Ich bestätige: Die Kontakte dieser Liste haben der Nutzung ihrer Daten für Werbung zugestimmt. Es werden nur SHA-256-Hashes von E-Mail, Telefon und Name übertragen.';

function AudienceModal({ sync, onClose, onDone }: { sync?: any; onClose: () => void; onDone: () => void }) {
  const t = useT('b4ads');
  const lists = useLoad(() => api.get<any[]>('/api/smart-lists').catch(() => []), []);
  const conns = useLoad(() => api.get<any>('/api/ads/overview').catch(() => null), []);
  const [platform, setPlatform] = useState<Platform>(sync?.platform ?? 'meta');
  const [name, setName] = useState('');
  const [list, setList] = useState(sync?.smart_list_id ?? '');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  useEffect(() => {
    if (!list) return setPreview(null);
    api.get(`/api/ads/audiences/preview?platform=${platform}&smart_list_id=${list}`).then(setPreview).catch(() => setPreview(null));
  }, [list, platform]);
  const go = async () => {
    setBusy(true);
    const r = await act(() => (sync ? api.post(`/api/ads/audiences/${sync.id}/sync`, { consent }) : api.post('/api/ads/audiences', { platform, name, smart_list_id: list, consent })), sync ? t('Aktualisiert') : t('Zielgruppe angelegt'));
    setBusy(false);
    if (r) onDone();
  };
  return (
    <AdsModal
      title={sync ? t('Zielgruppe „{name}“ aktualisieren', { name: sync.name }) : t('Zielgruppe aus Smart List')}
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={onClose}>
            {t('Abbrechen')}
          </button>
          <button className="btn" disabled={busy || !consent || !list || (!sync && !name.trim()) || !preview?.usable} onClick={go}>
            {busy ? t('Überträgt …') : sync ? t('Jetzt übertragen') : t('Anlegen und übertragen')}
          </button>
        </>
      }
    >
      {!sync && (
        <>
          <Field label={t('Plattform')}>
            <Select value={platform} onChange={(v) => setPlatform(v as Platform)} options={[['meta', t('Meta{verbunden}', { verbunden: conns.data && !conns.data.connected.meta ? t(' (nicht verbunden)') : '' })], ['google', t('Google Ads{verbunden}', { verbunden: conns.data && !conns.data.connected.google ? t(' (nicht verbunden)') : '' })]]} />
          </Field>
          <Field label="Name">
            <Input value={name} onChange={setName} placeholder={t('z. B. Bestandskunden')} />
          </Field>
        </>
      )}
      <Field label={t('Smart List')} hint={t('Die Kontakte, die die Smart List gerade enthält')}>
        <Select value={list} onChange={setList} placeholder={t('– wählen –')} options={(lists.data ?? []).map((l) => [l.id, l.name] as [string, string])} />
      </Field>
      {preview && (
        <p className="small">
          <strong>{preview.usable}</strong> {t('von')} {preview.total} {t('Kontakten werden übertragen')}
          {preview.skipped.opted_out > 0 && t(' · {opted_out} abgemeldet', { opted_out: preview.skipped.opted_out })}
          {preview.skipped.no_identifier > 0 && t(' · {no_identifier} ohne E-Mail/Telefon', { no_identifier: preview.skipped.no_identifier })}.
        </p>
      )}
      <Check checked={consent} onChange={setConsent} label={t(CONSENT)} />
    </AdsModal>
  );
}

function LookalikeModal({ a, onClose, onDone }: { a: any; onClose: () => void; onDone: () => void }) {
  const t = useT('b4ads');
  const [country, setCountry] = useState('DE');
  const [ratio, setRatio] = useState('1');
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    const r = await act(() => api.post(`/api/ads/audiences/${a.id}/lookalike`, { country, ratio: Number(ratio) / 100 }), t('Lookalike angelegt – Meta baut ihn in bis zu 24 Stunden'));
    setBusy(false);
    if (r) onDone();
  };
  return (
    <AdsModal
      title={t('Lookalike erstellen')}
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={onClose}>
            {t('Abbrechen')}
          </button>
          <button className="btn" disabled={busy || country.length !== 2} onClick={go}>
            {t('Lookalike anlegen')}
          </button>
        </>
      }
    >
      <p>
        {t('Meta sucht Menschen, die den Kontakten in')} <strong>„{a.name}“</strong> {t('ähneln.')}
      </p>
      <div className="grid2">
        <Field label={t('Land')} hint={t('Zweistelliger Code, z. B. DE')}>
          <Input value={country} onChange={(v) => setCountry(v.toUpperCase().slice(0, 2))} />
        </Field>
        <Field label={t('Größe')} hint={t('1 % = die ähnlichsten, 20 % = breiter')}>
          <Select value={ratio} onChange={setRatio} options={['1', '2', '3', '5', '10', '15', '20'].map((v) => [v, `${v} %`] as [string, string])} />
        </Field>
      </div>
    </AdsModal>
  );
}

// --- leads ------------------------------------------------------------------------------------------------------------

const QUESTION_LABEL: Record<string, string> = { FULL_NAME: 'Name', FIRST_NAME: 'Vorname', LAST_NAME: 'Nachname', EMAIL: 'E-Mail', PHONE: 'Telefon', CITY: 'Stadt', ZIP: 'PLZ', STREET_ADDRESS: 'Straße', COMPANY_NAME: 'Firma', JOB_TITLE: 'Beruf', STATE: 'Bundesland', COUNTRY: 'Land', DOB: 'Geburtstag', GENDER: 'Geschlecht' };
const STANDARD: [string, string][] = [['FULL_NAME', 'Vollständiger Name'], ['EMAIL', 'E-Mail'], ['PHONE', 'Telefon'], ['CITY', 'Stadt'], ['ZIP', 'PLZ'], ['COMPANY_NAME', 'Firma']];

export function LeadFormModal({ onClose, onCreated }: { onClose: () => void; onCreated: (f: any) => void }) {
  const t = useT('b4ads');
  const [f, setF] = useState({ name: '', headline: '', description: '', privacy_url: '', thank_title: t('Danke!'), thank_body: t('Wir melden uns bei dir.'), thank_url: '' });
  const [std, setStd] = useState<string[]>(['FULL_NAME', 'EMAIL', 'PHONE']);
  const [custom, setCustom] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF({ ...f, [k]: v });
  const go = async () => {
    setBusy(true);
    const r = await act(
      () =>
        api.post('/api/ads/leadforms', {
          name: f.name,
          headline: f.headline,
          description: f.description,
          questions: [...std, ...custom.filter(Boolean).map((label) => ({ type: 'CUSTOM', label }))],
          privacy_url: f.privacy_url,
          thank_you: { title: f.thank_title, body: f.thank_body, url: f.thank_url },
        }),
      t('Sofortformular bei Meta angelegt'),
    );
    setBusy(false);
    if (r) onCreated(r);
  };
  return (
    <AdsModal
      title={t('Neues Sofortformular')}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn secondary" onClick={onClose}>
            {t('Abbrechen')}
          </button>
          <button className="btn" disabled={busy || !f.name.trim() || !f.privacy_url.trim() || !std.length} onClick={go}>
            {busy ? t('Legt an …') : t('Bei Meta anlegen')}
          </button>
        </>
      }
    >
      <div className="grid2">
        <Field label={t('Name des Formulars')} hint={t('Nur intern sichtbar')}>
          <Input value={f.name} onChange={(v) => set('name', v)} placeholder={t('Probestunde Herbst')} />
        </Field>
        <Field label={t('Link zur Datenschutzerklärung (nötig)')} hint={t('Beginnt mit https://')}>
          <Input value={f.privacy_url} onChange={(v) => set('privacy_url', v)} placeholder="https://" />
        </Field>
      </div>
      <h3>{t('Fragen')}</h3>
      <div className="ads-langs">
        {STANDARD.map(([k, label]) => (
          <Check key={k} checked={std.includes(k)} onChange={(v) => setStd(v ? [...std, k] : std.filter((x) => x !== k))} label={t(label)} />
        ))}
      </div>
      {/* Einfach-Modus: headline, short text, own questions and the thank-you page (good defaults) behind one toggle */}
      <MoreFields id="ads-leadform" values={[f.headline, f.description, custom, f.thank_title !== 'Danke!', f.thank_body !== 'Wir melden uns bei dir.', f.thank_url]}>
        <div className="grid2">
          <Field label={t('Überschrift (optional)')}>
            <Input value={f.headline} onChange={(v) => set('headline', v)} maxLength={60} />
          </Field>
          <Field label={t('Kurztext (optional)')}>
            <Input value={f.description} onChange={(v) => set('description', v)} />
          </Field>
        </div>
        <Field label={t('Eigene Fragen')} hint={t('Antworten landen als eigenes Feld am Kontakt und in der Notiz')}>
          <TagInput value={custom} onChange={setCustom} placeholder={t('Frage + Enter, z. B. Welche Erfahrung hast du?')} />
        </Field>
        <h3>{t('Danke-Seite')}</h3>
        <div className="grid2">
          <Field label={t('Titel')}>
            <Input value={f.thank_title} onChange={(v) => set('thank_title', v)} maxLength={60} />
          </Field>
          <Field label={t('Link (optional)')}>
            <Input value={f.thank_url} onChange={(v) => set('thank_url', v)} placeholder="https://" />
          </Field>
        </div>
        <Field label={t('Text')}>
          <Textarea rows={2} value={f.thank_body} onChange={(v) => set('thank_body', v)} />
        </Field>
      </MoreFields>
    </AdsModal>
  );
}

export function AdsLeads() {
  const t = useT('b4ads');
  const status = useLoad(() => api.get<any>('/api/ads/leads/status').catch(() => null), []);
  const forms = useLoad(() => api.get<any[]>('/api/ads/leadforms').catch(() => []), []);
  const leads = useLoad(() => api.get<any[]>('/api/ads/leads').catch(() => []), []);
  const [newForm, setNewForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tags, setTags] = useState<string[] | null>(null);
  const s = status.data;
  const run = async (fn: () => Promise<any>, ok: string) => {
    setBusy(true);
    const r = await act(fn, ok);
    setBusy(false);
    status.reload();
    leads.reload();
    return r;
  };
  if (status.loading && !s) return <Spinner />;
  return (
    <>
      <div className="card" data-tour="ads-leads-enable">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0 }}>{t('Leads aus Meta-Lead-Anzeigen')}</h2>
            <p className="muted small" style={{ margin: '4px 0 0' }}>
              {t('Jede Antwort wird zum Kontakt (mit Tags, Antworten als Notiz, Kampagne als Quelle) und startet Automationen mit dem Auslöser „Neuer Lead aus Anzeige“.')}
            </p>
          </div>
          {s?.enabled ? <Badge tone="green">{t('Import an')}</Badge> : <Badge>{t('Import aus')}</Badge>}
        </div>
        {!s?.page ? (
          <p className="muted">
            {t('Dafür braucht es eine verbundene Facebook-Seite – unter')} <Link to="ads/connections">{t('Verbindungen')}</Link> {t('mit der Option „Lead-Formulare“ verbinden und die Seite wählen.')}
          </p>
        ) : (
          <>
            <p className="small">
              {t('Seite:')} <strong>{s.page.name || s.page.id}</strong>
              {!s.page_token && <span style={{ color: 'var(--red)' }}> {t('· kein Seiten-Zugriff – neu verbinden mit „Lead-Formulare“')}</span>}
              {s.polled_at && <span className="muted"> {t('· zuletzt abgeholt')} {dt(s.polled_at)}</span>}
            </p>
            <Field label={t('Tags für neue Leads')} hint={t('Lösen auch „Tag hinzugefügt“-Automationen aus')}>
              <TagInput value={tags ?? s.tags} onChange={setTags} placeholder={t('Tag + Enter')} />
            </Field>
            <div className="actions">
              {!s.enabled ? (
                <button className="btn" disabled={busy || !s.page_token} onClick={() => run(async () => { const r = await api.post('/api/ads/leads/enable', { tags: tags ?? s.tags }); if (r.warning) await act(() => Promise.reject(new Error(r.warning))); return r; }, t('Lead-Import ist an'))}>
                  {t('Lead-Import einschalten')}
                </button>
              ) : (
                <>
                  <button className="btn secondary" disabled={busy || !tags} onClick={() => run(() => api.put('/api/ads/leads/settings', { tags }), 'Gespeichert')}>
                    {t('Tags speichern')}
                  </button>
                  <button className="btn secondary" disabled={busy} onClick={() => run(() => api.post('/api/ads/leads/poll', {}), 'Abgeholt')}>
                    <Icon name="refresh" /> {t('Jetzt abholen')}
                  </button>
                  <button className="btn ghost" disabled={busy} onClick={() => confirmAsk(t('Lead-Import ausschalten?')) && run(() => api.post('/api/ads/leads/disable', {}), 'Ausgeschaltet')}>
                    {t('Ausschalten')}
                  </button>
                </>
              )}
            </div>
            <details className="ads-more">
              <summary>{t('Webhook bei Meta einrichten (einmal pro Meta-App)')}</summary>
              <p className="small">
                {t('Meta-App → Webhooks → Objekt')} <em>{t('Page')}</em> {t('→ Callback-URL')} <code>{s.webhook_url}</code>{t(', Verifizierungs-Token')} <code>{s.verify_token}</code>{t(', Feld')} <code>leadgen</code> {t('abonnieren. Ohne Webhook holt V Media CRM die Leads alle 10 Minuten ab. Details in docs/ads-manager.md.')}
              </p>
            </details>
          </>
        )}
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>{t('Sofortformulare')}</h2>
          <button className="btn" disabled={!s?.page_token} onClick={() => setNewForm(true)}>
            {t('+ Formular')}
          </button>
        </div>
        {(forms.data ?? []).length === 0 ? (
          <p className="muted">{t('Noch keine Formulare von V Media CRM. Lege eines an und wähle es in der Kampagne.')}</p>
        ) : (
          <div className="table-wrap" style={{ marginTop: 10 }}>
            <table className="t">
              <thead>
                <tr>
                  <th>{t('Formular')}</th>
                  <th>{t('Fragen')}</th>
                  <th>{t('Angelegt')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {forms.data!.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <strong>{f.name}</strong>
                    </td>
                    <td className="muted">{(f.spec?.questions ?? []).map((q: any) => (typeof q === 'string' ? t(QUESTION_LABEL[q] ?? q) : q.label)).join(', ')}</td>
                    <td className="muted">{dt(f.created_at)}</td>
                    <td className="ads-actions">
                      <button className="btn small ghost" onClick={async () => confirmAsk(t('Formular „{name}“ archivieren?', { name: f.name })) && (await act(() => api.del(`/api/ads/leadforms/${f.id}`), t('Archiviert')), forms.reload())}>
                        {t('Archivieren')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(leads.data ?? []).length > 0 && (
        <div className="card">
          <h2>{t('Zuletzt importierte Leads')}</h2>
          <div className="table-wrap">
            <table className="t">
              <thead>
                <tr>
                  <th>{t('Zeit')}</th>
                  <th>{t('Kontakt')}</th>
                  <th>{t('Kampagne')}</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {leads.data!.slice(0, 20).map((l) => (
                  <tr key={l.leadgen_id}>
                    <td className="muted">{dt(l.created_at)}</td>
                    <td>{l.contact_id ? <Link to={`contacts/${l.contact_id}`}>{[l.first_name, l.last_name].filter(Boolean).join(' ') || l.email || t('Kontakt')}</Link> : '–'}</td>
                    <td className="muted">{l.campaign_name || '–'}</td>
                    <td>
                      <Badge tone={l.status === 'imported' ? 'green' : l.status === 'failed' ? 'red' : 'gray'}>{l.status === 'imported' ? t('importiert') : l.status === 'failed' ? t('Fehler') : t('übersprungen')}</Badge>
                      {l.error && <span className="muted small"> {l.error}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {newForm && <LeadFormModal onClose={() => setNewForm(false)} onCreated={() => (setNewForm(false), forms.reload())} />}
      <GoogleLeadsCard />
    </>
  );
}
