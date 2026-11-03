import { useEffect, useMemo, useState } from 'react';
import { api, d } from '../api';
import { Icon } from '../icons';
import { PARTNER_HINT, refreshReferrals } from '../referrals';
import { useSession } from '../session';
import { Badge, Check, Empty, Spinner, act, confirmAsk, useLoad } from '../ui';
import { useT } from '../i18n';

/**
 * Agentur → Partner-Links: which „Konto anlegen“ link each provider gets – the maintainer's partner link
 * (REFERRAL_DEFAULTS), one from PGHL_REFERRALS, your own, or the plain sign-up page – plus click counts.
 * Server: server/modules/referrals.ts, docs/referrals.md.
 */

interface Row {
  id: string;
  name: string;
  category: string;
  signup: string | null;
  default_url: string | null;
  env_url: string | null;
  override: string | null;
  url: string | null;
  is_referral: boolean;
  source: 'agency' | 'env' | 'default' | 'signup' | null;
  go: string | null;
  clicks: number;
  partner_clicks: number;
  last_click_on: string | null;
}
interface Overview {
  enabled: boolean;
  disabled_by_env: boolean;
  env_set: boolean;
  env_invalid: boolean;
  categories: string[];
  total_clicks: number;
  providers: Row[];
}

const SOURCE: Record<string, string> = { agency: 'Eigener Link', env: 'PGHL_REFERRALS', default: 'HyperLevel-Partner-Link', signup: 'Anmelde-Seite' };
/** Whose partner link is active right now. */
const BY: Record<string, string> = { agency: 'eigener', env: 'Server', default: 'V Media CRM' };
const host = (u: string) => {
  try {
    const x = new URL(u);
    return `${x.host}${x.pathname === '/' ? '' : x.pathname}${x.search}`;
  } catch {
    return u;
  }
};

function Ext({ url }: { url: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="pl-url" title={url}>
      {host(url)}
    </a>
  );
}

/** What applies when there is no own link: env first, then the maintainer default, then the sign-up page. */
function Fallback({ r }: { r: Row }) {
  const t = useT('b6saas');
  if (r.env_url !== null)
    return r.env_url ? (
      <>
        <Ext url={r.env_url} /> <span className="muted small">{t('PGHL_REFERRALS')}</span>
      </>
    ) : (
      <span className="muted small">{t('Anmelde-Seite (PGHL_REFERRALS)')}</span>
    );
  if (r.default_url)
    return (
      <>
        <Ext url={r.default_url} /> <span className="muted small">{t('HyperLevel-Partner-Link')}</span>
      </>
    );
  return r.signup ? (
    <>
      <Ext url={r.signup} /> <span className="muted small">{t('kein Partner-Link')}</span>
    </>
  ) : (
    <span className="muted small">{t('kein Link bekannt')}</span>
  );
}

export function PartnerLinks() {
  const t = useT('b6saas');
  const brand = useSession().branding.name;
  const s = useLoad(() => api.get<Overview>('/api/agency/referrals'), []);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const saved = useMemo(() => Object.fromEntries((s.data?.providers ?? []).filter((p) => p.override !== null).map((p) => [p.id, p.override!])), [s.data]);
  useEffect(() => setLinks(saved), [saved]);
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (s.data?.providers ?? []).filter((p) => (!cat || p.category === cat) && (!term || `${p.name} ${p.id} ${p.category}`.toLowerCase().includes(term)));
  }, [s.data, cat, q]);
  if (s.error) return <Empty>{s.error}</Empty>;
  if (!s.data) return <Spinner />;
  const v = s.data;
  const dirty = JSON.stringify(Object.entries(links).sort()) !== JSON.stringify(Object.entries(saved).sort());
  const active = v.enabled && !v.disabled_by_env;
  const put = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true);
    const r = await act(() => api.put<Overview>('/api/agency/referrals', body), ok);
    setBusy(false);
    if (r) (s.setData(r), void refreshReferrals());
    return r;
  };
  const setLink = (id: string, value: string | null) =>
    setLinks((cur) => {
      const next = { ...cur };
      if (value === null) delete next[id];
      else next[id] = value;
      return next;
    });
  const partners = v.providers.filter((p) => p.is_referral).length;
  return (
    <div className="partner-links" data-tour="partner-links">
      <div className="card pl-intro">
        <h2>
          <Icon name="link" size={18} /> {t('Partner-Links')}
        </h2>
        <p>
          {t('Wo {brand} nach einem Schlüssel oder Konto bei einem Anbieter fragt, steht ein Link', { brand })} <b>{t('„Konto anlegen ↗“')}</b>{t('. Ist für den Anbieter ein')} <b>{t('Partner-Link')}</b> {t('hinterlegt, führt er über dessen Partnerprogramm und trägt das Kennzeichen')} <span className="partner-chip">{t('Partner-Link')}</span>{t('. Für dich und deine Kunden ändert sich dadurch nichts.')}
        </p>
        <p className="muted small">
          {t('Voreingestellt sind die Partner-Links des HyperLevel-Maintainers; die Kennzeichnung erklärt: „{PARTNER_HINT}“ Du kannst jeden durch einen eigenen Link ersetzen, einzeln oder ganz abschalten – dann erscheint die normale Anmelde-Seite. Gezählt werden nur Klicks je Anbieter über', { PARTNER_HINT })} <code>{t('/go/…')}</code>{t(', keine Personen, IP-Adressen oder Browser-Daten. Server-weit abschalten:')} <code>{t('PGHL_REFERRALS_DISABLED=1')}</code>{t('; eigene Links per Umgebung:')} <code>{t('PGHL_REFERRALS')}</code> {t('(JSON). Anleitung:')} <code>docs/referrals.md</code>.
        </p>
        <div className="pl-global" data-tour="partner-links-toggle">
          <Check checked={v.enabled} onChange={(enabled) => put({ enabled }, enabled ? t('Partner-Links an') : t('Nur noch normale Anmelde-Links'))} label={<b>{t('Partner-Links verwenden')}</b>} />
          <span className="muted small">
            {active ? t('{partners} von {length} Anbietern mit Partner-Link', { partners, length: v.providers.length }) : t('Aus – überall die normale Anmelde-Seite')} {t('· {total_clicks} Klicks gesamt', { total_clicks: v.total_clicks })}
          </span>
        </div>
        {v.disabled_by_env && <p className="pl-warn">{t('Auf dem Server ist')} <code>{t('PGHL_REFERRALS_DISABLED=1')}</code> {t('gesetzt – es werden nur normale Anmelde-Links gezeigt, egal was hier steht.')}</p>}
        {v.env_invalid && <p className="pl-warn"><code>{t('PGHL_REFERRALS')}</code> {t('ist kein gültiges JSON-Objekt und wird ignoriert.')}</p>}
      </div>

      <div className="integ-toolbar" data-tour="partner-links-filter">
        <input type="search" placeholder={t('Anbieter suchen …')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('Anbieter suchen')} />
        <div className="chips">
          <button className={`chip${cat === '' ? ' on' : ''}`} onClick={() => setCat('')}>
            {t('Alle')}
          </button>
          {v.categories.map((c) => (
            <button key={c} className={`chip${cat === c ? ' on' : ''}`} onClick={() => setCat(cat === c ? '' : c)}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {shown.length ? (
        <div className="table-wrap" data-tour="partner-links-table">
          <table className="t pl-table">
            <thead>
              <tr>
                <th>{t('Anbieter')}</th>
                <th>{t('Standard')}</th>
                <th>{t('Eigener Link')}</th>
                <th>{t('Partner-Link')}</th>
                <th>{t('Ziel jetzt')}</th>
                <th className="num">{t('Klicks')}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const own = links[r.id];
                const plain = own === '';
                // Is there a partner link this toggle switches? (own link, PGHL_REFERRALS or the maintainer default)
                const offered = !!own || (r.env_url === null ? !!r.default_url : !!r.env_url);
                return (
                  <tr key={r.id}>
                    <td data-label={t('Anbieter')}>
                      <b>{r.name}</b>
                      <div className="muted small">{r.category}</div>
                    </td>
                    <td data-label={t('Standard')} className="pl-default">
                      <Fallback r={r} />
                    </td>
                    <td data-label={t('Eigener Link')}>
                      <input
                        type="url"
                        inputMode="url"
                        value={own ?? ''}
                        onChange={(e) => setLink(r.id, e.target.value.trim() ? e.target.value : null)}
                        placeholder={t('https://… (leer = Standard)')}
                        aria-label={t('Eigener Link für {name}', { name: r.name })}
                      />
                    </td>
                    <td data-label={t('Partner-Link')}>
                      <Check checked={!plain} onChange={(on) => setLink(r.id, on ? null : '')} label={plain ? t('aus') : offered ? t('an') : 'erlaubt'} />
                    </td>
                    <td data-label={t('Ziel jetzt')} className="pl-target">
                      {r.url ? (
                        <>
                          {r.is_referral ? <span className="partner-chip">{t('Partner-Link')}</span> : <Badge>{t(SOURCE[r.source ?? 'signup'])}</Badge>}
                          {r.is_referral && <span className="muted small"> {t(BY[r.source!])}</span>}
                        </>
                      ) : (
                        <span className="muted small">{t('kein Link')}</span>
                      )}
                    </td>
                    <td data-label={t('Klicks')} className="num">
                      <b>{r.clicks}</b>
                      {r.partner_clicks > 0 && <div className="muted small">{t('{partner_clicks} als Partner-Link', { partner_clicks: r.partner_clicks })}</div>}
                      {r.last_click_on && <div className="muted small">{t('zuletzt {d}', { d: d(r.last_click_on) })}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>{t('Kein Anbieter passt zur Suche.')}</Empty>
      )}

      <div className="row pl-actions" data-tour="partner-links-save">
        <button className="btn" disabled={!dirty || busy} onClick={() => put({ links }, t('Partner-Links gespeichert'))}>
          {t('Speichern')}
        </button>
        {dirty && (
          <button className="btn secondary" onClick={() => setLinks(saved)}>
            {t('Verwerfen')}
          </button>
        )}
        <span className="grow" />
        <button className="btn ghost" disabled={!v.total_clicks || busy} onClick={async () => confirmAsk(t('Alle Klick-Zähler auf 0 setzen?')) && (await act(() => api.del<Overview>('/api/agency/referrals/clicks'), t('Zähler zurückgesetzt')).then((r) => r && s.setData(r)))}>
          {t('Zähler zurücksetzen')}
        </button>
      </div>
    </div>
  );
}
