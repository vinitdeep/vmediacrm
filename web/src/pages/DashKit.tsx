import type { HTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from '../icons';
import { fmtDate } from '../i18n';
import { dt, euro, name } from '../api';
import './dashboard.css';

/**
 * The building blocks of the dashboard (pages/Dashboard.tsx): KPI tiles, card heads, empty states, the leads chart.
 * A chunk of its own with its stylesheet, loaded with the app – the dashboard waits for its numbers anyway, and the first
 * download stays within its budget (tests/bundle-budget.test.ts). Every text comes in as a prop (i18n namespace "dashboard").
 */

/** A local calendar day (YYYY-MM-DD) in the UI language: "Mo., 6. Okt. 2026" / "Mon, 6 Oct 2026". */
const fmtDay = (ymd: string) => fmtDate(`${ymd}T00:00:00Z`, { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

/** The calendar day (YYYY-MM-DD) n days from `ymd` (not the planner's date helpers: those are a big module of their own). */
const addDay = (ymd: string, n: number) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

type Day = { day: string; n: number };
/** The new contacts of every day of the chart (at most 90), oldest first – days without any count as 0. */
const leadSeries = (data: Day[], days: number, today: string) => {
  const map = new Map(data.map((d) => [d.day, d.n]));
  const len = Math.min(90, days);
  return Array.from({ length: len }, (_, i) => {
    const day = addDay(today, -(len - 1 - i));
    return { day, n: map.get(day) ?? 0 };
  });
};

/** `today` and the days of `data` are the sub-account's local dates (from the server), not the browser's UTC date. */
function LeadsChart({ series, today, label }: { series: Day[]; today: string; label: string }) {
  const max = Math.max(1, ...series.map((s) => s.n));
  const w = 100 / series.length;
  return (
    <div className="dash-chart">
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" style={{ width: '100%', height: 150 }} role="img" aria-label={label}>
        {[10, 20, 30].map((y) => (
          <line key={y} x1="0" x2="100" y1={y} y2={y} className="dash-chart-grid" vectorEffect="non-scaling-stroke" />
        ))}
        {series.map((s, i) => (
          <rect key={s.day} x={i * w + w * 0.15} width={w * 0.7} y={40 - (s.n / max) * 38} height={(s.n / max) * 38} rx={0.6} fill="var(--brand)" className={s.day === today ? 'is-today' : undefined}>
            <title>
              {fmtDay(s.day)}: {s.n}
            </title>
          </rect>
        ))}
      </svg>
      <div className="dash-chart-axis muted small">
        <span>{fmtDay(series[0].day)}</span>
        <span>{fmtDay(series[series.length - 1].day)}</span>
      </div>
    </div>
  );
}

/** A small line of the period's new contacts inside the tile. */
export function Spark({ data, days: period, today }: { data: Day[]; days: number; today: string }) {
  // at most ~15 points: a calm line, not a comb of single days
  const days = leadSeries(data, period, today);
  const size = Math.max(1, Math.ceil(days.length / 15));
  const series = Array.from({ length: Math.ceil(days.length / size) }, (_, i) => ({ n: days.slice(i * size, i * size + size).reduce((a, d) => a + d.n, 0) }));
  if (series.length < 2) return null;
  const max = Math.max(1, ...series.map((s) => s.n));
  const pts = series.map((s, i) => `${((i / (series.length - 1)) * 100).toFixed(2)},${(28 - (s.n / max) * 26).toFixed(2)}`);
  return (
    <svg className="kpi-spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
      <polygon points={`0,30 ${pts.join(' ')} 100,30`} className="kpi-spark-area" />
      <polyline points={pts.join(' ')} className="kpi-spark-line" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** One KPI tile: icon, label, the number, a line below. Keeps the `stat card` classes of the shared Stat tile. */
export function Kpi({ icon, label, value, sub, tone, extra, ...rest }: { icon: IconName; label: string; value: ReactNode; sub?: ReactNode; tone?: 'late'; extra?: ReactNode } & Omit<HTMLAttributes<HTMLDivElement>, 'children'>) {
  return (
    <div className="stat card kpi" data-tone={tone} {...rest}>
      <div className="kpi-top">
        <span className="kpi-ico" aria-hidden="true">
          <Icon name={icon} size={18} />
        </span>
        <span className="kpi-label">{label}</span>
      </div>
      <div className="stat-value">{value}</div>
      {sub && <div className="muted small kpi-sub">{sub}</div>}
      {extra}
    </div>
  );
}

/** Card head: icon, title, an optional link or note on the right. */
function CardHead({ icon, title, aside }: { icon: IconName; title: ReactNode; aside?: ReactNode }) {
  return (
    <div className="dash-card-head">
      <span className="dash-card-ico" aria-hidden="true">
        <Icon name={icon} size={16} />
      </span>
      <h2>{title}</h2>
      {aside && <span className="dash-card-aside">{aside}</span>}
    </div>
  );
}

/** Nothing to show yet: a quiet icon and one line, with the way to change that. */
function EmptyState({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <div className="dash-empty">
      <span className="dash-empty-ico" aria-hidden="true">
        <Icon name={icon} size={20} />
      </span>
      <p className="muted">{children}</p>
    </div>
  );
}

type Rest = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'title'>;

/** The "new contacts per day" card: head with the period's total, the bars below. */
export function LeadsCard({ data, days, today, title, total, ...rest }: { data: Day[]; days: number; today: string; title: string; total: (n: number) => string } & Rest) {
  const series = leadSeries(data, days, today);
  return (
    <div className="card dash-card" {...rest}>
      <CardHead icon="activity" title={title} aside={<span className="dash-pill">{total(series.reduce((n, s) => n + s.n, 0))}</span>} />
      <LeadsChart series={series} today={today} label={title} />
    </div>
  );
}

/** The next appointments with a date chip each (`items` null: the calendar area is hidden), and the open tasks below. */
export function NextCard({ title, items, more, empty, tasks, ...rest }: { title: string; items: any[] | null; more: ReactNode; empty: ReactNode; tasks?: ReactNode } & Rest) {
  return (
    <div className="card dash-card" {...rest}>
      <CardHead icon="schedule" title={title} aside={items?.length ? more : undefined} />
      {items &&
        (items.length ? (
          <ul className="timeline dash-timeline">
            {items.map((a) => (
              <li key={a.id}>
                <strong>{dt(a.start_at)}</strong> <span>{a.title || name(a)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon="calendars">{empty}</EmptyState>
        ))}
      {tasks && (
        <p className="dash-tasks-line">
          <Icon name="tasks" size={15} />
          {tasks}
        </p>
      )}
    </div>
  );
}

/** One pipeline: its stages with count, value and a bar relative to the fullest stage. */
export function PipelineCard({ title, stages, ...rest }: { title: ReactNode; stages: { id: string; name: string; count: number; value: number }[] } & Rest) {
  const max = Math.max(1, ...stages.map((s) => s.count));
  return (
    <div className="card dash-card" {...rest}>
      <CardHead icon="kanban" title={title} />
      {stages.map((s) => (
        <div key={s.id} className="dash-stage">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span>{s.name}</span>
            <span className="muted">
              {s.count} · {euro(s.value)}
            </span>
          </div>
          <div className="bar">
            <div style={{ width: `${(s.count / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Lead sources: name, count and a thin bar under each name. */
export function SourcesCard({ title, empty, rows, ...rest }: { title: string; empty: string; rows: { source: string; n: number }[] } & Rest) {
  const top = Math.max(1, ...rows.map((s) => s.n));
  return (
    <div className="card dash-card" {...rest}>
      <CardHead icon="attribution" title={title} />
      {rows.length ? (
        <table className="t dash-sources">
          <tbody>
            {rows.map((s) => (
              <tr key={s.source}>
                <td>
                  <span className="dash-source">
                    {s.source}
                    <span className="dash-source-bar" style={{ width: `${(s.n / top) * 100}%` }} />
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>{s.n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyState icon="attribution">{empty}</EmptyState>
      )}
    </div>
  );
}
