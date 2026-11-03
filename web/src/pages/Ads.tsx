import { useEffect, useRef, useState, type ReactNode } from 'react';
import { api, dt, money } from '../api';
import { Icon } from '../icons';
import { Badge, Check, Empty, Field, Input, Link, Select, Spinner, Stat, act, confirmAsk, useLoad } from '../ui';
import { SignupLink } from '../referrals';
import { SortableGrid } from '../sortable/Sortable';
import { useT } from '../i18n';

/** Ads reporting: spend per campaign from Meta / Google joined with attribution (CPL, ROAS), and the account connections. */

export const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** Date range with quick presets; shared by the report and the ads tab. */
export function RangePicker({ from, to, onChange, children }: { from: string; to: string; onChange: (from: string, to: string) => void; children?: ReactNode }) {
  const t = useT('b4ads');
  const preset = (days: number) => onChange(ymd(new Date(Date.now() - (days - 1) * 864e5)), ymd(new Date()));
  return (
    <div className="row attr-filters" data-tour="range-picker">
      <div style={{ width: 150 }}>
        <Field label={t('Von')}>
          <Input type="date" value={from} onChange={(v) => v && onChange(v, to)} />
        </Field>
      </div>
      <div style={{ width: 150 }}>
        <Field label={t('Bis')}>
          <Input type="date" value={to} onChange={(v) => v && onChange(from, v)} />
        </Field>
      </div>
      <div className="actions attr-presets">
        <button className="btn small secondary" onClick={() => preset(7)}>{t('7 Tage')}</button>
        <button className="btn small secondary" onClick={() => preset(30)}>{t('30 Tage')}</button>
        <button className="btn small secondary" onClick={() => preset(90)}>{t('90 Tage')}</button>
        <button className="btn small secondary" onClick={() => onChange(`${new Date().getFullYear()}-01-01`, ymd(new Date()))}>{t('Jahr')}</button>
      </div>
      {children}
    </div>
  );
}

const PLATFORM: Record<string, string> = { meta: 'Meta', google: 'Google' };
const pct = (v: number | null) => (v === null || v === undefined ? '–' : `${v.toLocaleString('de-DE', { maximumFractionDigits: 2 })} %`);
const roas = (v: number | null) => (v === null || v === undefined ? '–' : `${v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}×`);
const int = (v: number) => (v || 0).toLocaleString('de-DE');

/** Spend per day: one series, columns from one baseline, value on the tallest, hover title on every day. */
function SpendChart({ days }: { days: { date: string; spend_cents: number; clicks: number }[] }) {
  const t = useT('b4ads');
  // Drawn at the card's real width, so text never scales and columns keep their 2px gap.
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(720);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(280, Math.floor(el.clientWidth))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [days.length >= 2]);
  if (days.length < 2) return null;
  const h = 150;
  const top = 18;
  const base = h - 20;
  const max = Math.max(1, ...days.map((d) => d.spend_cents));
  const slot = w / days.length;
  const bw = Math.min(24, Math.max(2, slot - 2));
  const peak = days.reduce((a, b) => (b.spend_cents > a.spend_cents ? b : a), days[0]);
  const day = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  return (
    <div className="card ads-chart">
      <h2 style={{ marginBottom: 2 }}>{t('Ausgaben pro Tag')}</h2>
      <div ref={box}>
      <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label={t('Ausgaben pro Tag vom {date} bis {date2}, höchster Tag {date3} mit {spend_cents}', { date: day(days[0].date), date2: day(days[days.length - 1].date), date3: day(peak.date), spend_cents: money(peak.spend_cents) })}>
        <line x1="0" x2={w} y1={base} y2={base} stroke="var(--line)" strokeWidth="1" />
        {days.map((d, i) => {
          const bh = Math.max(d.spend_cents ? 2 : 0, ((base - top) * d.spend_cents) / max);
          const x = i * slot + (slot - bw) / 2;
          const r = Math.min(4, bw / 2, bh);
          const y = base - bh;
          return (
            <g key={d.date}>
              {bh > 0 && <path d={`M${x},${base} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${base} Z`} fill="var(--brand)" />}
              {d === peak && (
                <text x={x + bw / 2} y={y - 5} textAnchor="middle" fontSize="11" fill="var(--muted)">
                  {money(d.spend_cents)}
                </text>
              )}
              <rect x={i * slot} y={0} width={slot} height={h} fill="transparent">
                <title>{t('{date}: {spend_cents} · {clicks} Klicks', { date: day(d.date), spend_cents: money(d.spend_cents), clicks: int(d.clicks) })}</title>
              </rect>
            </g>
          );
        })}
        <text x="0" y={h - 4} fontSize="11" fill="var(--muted)">
          {day(days[0].date)}
        </text>
        <text x={w} y={h - 4} fontSize="11" fill="var(--muted)" textAnchor="end">
          {day(days[days.length - 1].date)}
        </text>
      </svg>
      </div>
    </div>
  );
}

export function AdsReport({ range, setRange }: { range: { from: string; to: string }; setRange: (from: string, to: string) => void }) {
  const t = useT('b4ads');
  const [model, setModel] = useState('last');
  const [busy, setBusy] = useState(false);
  const qs = `from=${range.from}&to=${range.to}&model=${model}`;
  const { data, loading, reload } = useLoad(() => api.get(`/api/ads/report?${qs}`), [qs]);
  const accounts = useLoad(() => api.get<any[]>('/api/ads/accounts'), []);
  const anyConnected = (accounts.data ?? []).some((a) => a.connected);
  const tot = data?.totals;
  return (
    <>
      <RangePicker from={range.from} to={range.to} onChange={setRange}>
        <div style={{ width: 160 }}>
          <Field label={t('Leads zählen nach')}>
            <Select
              value={model}
              onChange={setModel}
              options={[
                ['last', t('Letztem Kontakt')],
                ['first', t('Erstem Kontakt')],
              ]}
            />
          </Field>
        </div>
        {anyConnected && (
          <button
            className="btn secondary attr-export"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await act(() => api.post('/api/ads/sync', {}), t('Zahlen abgerufen'));
              setBusy(false);
              void reload();
              void accounts.reload();
            }}
          >
            <Icon name="refresh" /> {busy ? t('Ruft ab…') : t('Jetzt abrufen')}
          </button>
        )}
      </RangePicker>
      {loading && !data ? (
        <Spinner />
      ) : !data?.rows.length ? (
        <Empty action={!anyConnected ? <Link to="attribution/settings" className="btn">{t('Werbekonto verbinden')}</Link> : undefined}>
          {anyConnected ? t('Für diesen Zeitraum sind noch keine Werbedaten da. Der Abruf läuft täglich – oder jetzt mit „Jetzt abrufen“.') : t('Verbinde Meta Ads oder Google Ads, um Ausgaben, Kosten pro Lead und ROAS zu sehen.')}
        </Empty>
      ) : (
        <>
          <SortableGrid id="ads.stats" className="stats">
            <Stat label={t('Ausgaben')} value={money(tot.spend_cents)} sub={t('{impressions} Impressionen · {clicks} Klicks', { impressions: int(tot.impressions), clicks: int(tot.clicks) })} />
            <Stat label={t('Leads im CRM')} value={tot.crm_leads} sub={t('laut Werbeplattform: {platform_leads}', { platform_leads: int(tot.platform_leads) })} />
            <Stat label={t('Kosten pro Lead')} value={tot.cpl_cents === null ? '–' : money(tot.cpl_cents)} sub={t('Ausgaben ÷ Leads im CRM')} />
            <Stat label={t('Umsatz')} value={money(tot.revenue_cents)} sub={t('bezahlte Rechnungen dieser Leads')} />
            <Stat label={t('ROAS')} value={roas(tot.roas)} sub={t('Umsatz ÷ Ausgaben')} />
          </SortableGrid>
          <SpendChart days={data.days} />
          <div className="table-wrap" style={{ marginTop: 14 }}>
            <table className="t attr-table">
              <thead>
                <tr>
                  <th>{t('Kampagne')}</th>
                  <th className="num">{t('Ausgaben')}</th>
                  <th className="num">{t('Klicks')}</th>
                  <th className="num">{t('CTR')}</th>
                  <th className="num">{t('Leads (Plattform)')}</th>
                  <th className="num">{t('Leads (CRM)')}</th>
                  <th className="num">{t('CPL')}</th>
                  <th className="num">{t('Umsatz')}</th>
                  <th className="num">{t('ROAS')}</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r: any) => (
                  <tr key={`${r.platform}-${r.campaign_id}`}>
                    <td>
                      <Badge tone={r.platform === 'meta' ? 'blue' : 'yellow'}>{PLATFORM[r.platform]}</Badge> <strong>{r.campaign_name || r.campaign_id}</strong>
                      <div className="muted small">ID {r.campaign_id}</div>
                    </td>
                    <td className="num">{money(r.spend_cents, r.currency)}</td>
                    <td className="num">{int(r.clicks)}</td>
                    <td className="num">{pct(r.ctr)}</td>
                    <td className="num">{int(r.platform_leads)}</td>
                    <td className="num">{r.crm_leads}</td>
                    <td className="num">{r.cpl_cents === null ? '–' : money(r.cpl_cents, r.currency)}</td>
                    <td className="num">{money(r.revenue_cents)}</td>
                    <td className="num">{roas(r.roas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small">
            {t('CRM-Leads und Umsatz werden über')} <code>utm_campaign</code> {t('zugeordnet: Name oder ID der Kampagne (z. B.')} <code>utm_campaign={'{{campaign.name}}'}</code> {t('bei Meta,')} <code>{'{campaignid}'}</code> {t('bei Google).')}
          </p>
        </>
      )}
    </>
  );
}

const FIELDS: Record<string, [key: string, label: string, secret?: boolean, hint?: string][]> = {
  meta: [
    ['ad_account_id', 'Werbekonto-ID', false, 'act_1234567890 – Meta Business Suite → Werbekonten'],
    ['token', 'Zugriffstoken (System-User, ads_read)', true, 'Langlebiges Token eines System-Users mit Recht ads_read (nur Berichte; Kampagnen verwalten: Marketing → Anzeigen)'],
  ],
  google: [
    ['customer_id', 'Kunden-ID', false, '123-456-7890 (oben rechts in Google Ads)'],
    ['login_customer_id', 'Verwaltungskonto-ID (optional)', false, 'nur wenn der Zugriff über ein MCC-Konto läuft'],
    ['developer_token', 'Developer-Token', true, 'Google Ads → Tools → API-Center'],
    ['client_id', 'OAuth Client-ID', true],
    ['client_secret', 'OAuth Client-Secret', true],
    ['refresh_token', 'Refresh-Token', true, 'z. B. mit dem OAuth 2.0 Playground erzeugt (Scope adwords) – Anleitung in docs/growth.md'],
  ],
};

function AccountCard({ a, onChange }: { a: any; onChange: () => void }) {
  const t = useT('b4ads');
  const [f, setF] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);
  const val = (k: string) => (f[k] !== undefined ? f[k] : (a.config[k] ?? ''));
  const set = (k: string, v: unknown) => setF({ ...f, [k]: v });
  const run = async (fn: () => Promise<any>, ok?: string) => {
    setBusy(true);
    const r = await act(fn, ok);
    setBusy(false);
    if (r) (setF({}), onChange());
    return r;
  };
  return (
    <div className="card" data-tour="ads-account">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>{a.platform === 'meta' ? t('Meta Ads (Facebook & Instagram)') : t('Google Ads')} {a.platform === 'meta' && <SignupLink id="meta" />}</h2>
        {a.connected ? <Badge tone={a.last_error ? 'red' : 'green'}>{a.last_error ? t('Fehler') : t('verbunden')}</Badge> : <Badge>{t('nicht verbunden')}</Badge>}
      </div>
      <p className="muted small">
        {a.last_sync_at ? t('Zuletzt abgerufen {last_sync_at} · {campaigns} Kampagnen', { last_sync_at: dt(a.last_sync_at), campaigns: a.campaigns }) : t('Nur lesender Zugriff: Ausgaben, Impressionen, Klicks und Leads je Kampagne, täglich.')}
        {a.last_error ? <span style={{ color: 'var(--red)' }}> · {a.last_error}</span> : null}
      </p>
      <div className="grid2">
        {FIELDS[a.platform].map(([k, label, secret, hint]) => (
          <Field key={k} label={t(label)} hint={hint ? t(hint) : undefined}>
            {secret ? (
              <Input type="password" autoComplete="off" value={f[k] ?? ''} onChange={(v) => set(k, v)} placeholder={a.secrets[k] ? t('•••••• gespeichert') : ''} />
            ) : (
              <Input value={val(k)} onChange={(v) => set(k, v)} />
            )}
          </Field>
        ))}
      </div>
      {a.platform === 'meta' && (
        <details className="attr-capi" open={!!a.config.capi_enabled}>
          <summary>{t('Conversions API (optional): Leads und Käufe an Meta zurückmelden')}</summary>
          <Check checked={!!val('capi_enabled')} onChange={(v) => set('capi_enabled', v)} label={t('Lead (neuer Kontakt aus Formular, Termin, Chat) und Purchase (bezahlte Rechnung) senden')} />
          <div className="grid2">
            <Field label={t('Pixel-/Dataset-ID')}>
              <Input value={val('pixel_id')} onChange={(v) => set('pixel_id', v)} />
            </Field>
            <Field label={t('CAPI-Token (optional)')} hint={t('leer = Zugriffstoken oben')}>
              <Input type="password" autoComplete="off" value={f.capi_token ?? ''} onChange={(v) => set('capi_token', v)} placeholder={a.secrets.capi_token ? t('•••••• gespeichert') : ''} />
            </Field>
            <Field label={t('Test-Code (optional)')} hint={t('aus dem Events-Manager, nur zum Testen')}>
              <Input value={val('test_event_code')} onChange={(v) => set('test_event_code', v)} />
            </Field>
          </div>
          <Check checked={val('capi_only_meta_leads') !== false} onChange={(v) => set('capi_only_meta_leads', v)} label={t('Nur Kontakte senden, die über Meta-Werbung kamen (fbclid oder utm_source facebook/instagram)')} />
          <p className="muted small">{t('E-Mail, Telefon und Name gehen nur als SHA-256-Hash raus. Du brauchst dafür eine Rechtsgrundlage (Einwilligung) – siehe Datenschutz-Hinweise in docs/growth.md.')}</p>
        </details>
      )}
      <div className="actions" style={{ marginTop: 12 }}>
        <button className="btn" disabled={busy} onClick={() => run(() => api.put(`/api/ads/accounts/${a.platform}`, f), 'Gespeichert')}>
          {t('Speichern')}
        </button>
        {a.connected && (
          <>
            <button className="btn secondary" disabled={busy} onClick={() => run(() => api.post(`/api/ads/accounts/${a.platform}/test`, {}).then((r) => (r ? { ...r, ok: true } : r)), 'Verbindung klappt')}>
              {t('Verbindung testen')}
            </button>
            <button className="btn secondary" disabled={busy} onClick={() => run(() => api.post('/api/ads/sync', { platform: a.platform, days: 30 }), 'Letzte 30 Tage abgerufen')}>
              <Icon name="refresh" /> {t('30 Tage abrufen')}
            </button>
            <button className="btn ghost" disabled={busy} onClick={() => confirmAsk(t('Verbindung trennen und gespeicherte Werbezahlen löschen?')) && run(() => api.del(`/api/ads/accounts/${a.platform}`), 'Getrennt')}>
              {t('Trennen')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function AdsAccounts() {
  const t = useT('b4ads');
  const { data, reload } = useLoad(() => api.get<any[]>('/api/ads/accounts'), []);
  const log = useLoad(() => api.get<any[]>('/api/ads/capi-log').catch(() => []), []);
  if (!data) return <Spinner />;
  return (
    <>
      {data.map((a) => (
        <AccountCard key={a.platform} a={a} onChange={() => (reload(), log.reload())} />
      ))}
      {(log.data ?? []).length > 0 && (
        <div className="card">
          <h2>{t('Gesendete Conversions')}</h2>
          <div className="table-wrap">
            <table className="t">
              <thead>
                <tr>
                  <th>{t('Zeit')}</th>
                  <th>{t('Ereignis')}</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {log.data!.slice(0, 30).map((l) => (
                  <tr key={l.id}>
                    <td className="muted">{dt(l.created_at)}</td>
                    <td>{l.event_name}</td>
                    <td>
                      <Badge tone={l.status === 'sent' ? 'green' : l.status === 'failed' ? 'red' : l.status === 'blocked' ? 'yellow' : 'gray'}>{l.status === 'sent' ? t('gesendet') : l.status === 'failed' ? t('Fehler') : l.status === 'blocked' ? t('blockiert') : t('läuft')}</Badge> <span className="muted small">{l.error}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
