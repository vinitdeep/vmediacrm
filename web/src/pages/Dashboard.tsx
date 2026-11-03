import { Suspense, useState } from 'react';
import { api, euro, moneyList } from '../api';
import { Link, PageHead, Select, Spinner, useLoad } from '../ui';
import { lazyPages, preload } from '../lazy';
import { useSession } from '../session';
import { PluginWidgets } from '../werkstatt/PluginFrame';
import { useModules } from '../theme/store';
import { fmtDate, useT } from '../i18n';
import { LearnLink } from '../tour/learn';
import { AcademyWelcome } from '../tour/welcome';
import { MoreFields, useSimple } from '../areas/fields';
import { dashboardLayout, type DashCard, type DashStat } from '../areas/easy-core';
import { SortableGrid } from '../sortable/lazy';
import '../areas/easy-core.css';

// KPI tiles, card heads, empty states and the chart with their stylesheet: a chunk of its own, loaded with the app (DashKit.tsx).
const { Kpi, Spark, LeadsCard, NextCard, PipelineCard, SourcesCard } = lazyPages(() => import('./DashKit'), 'Kpi', 'Spark', 'LeadsCard', 'NextCard', 'PipelineCard', 'SourcesCard');
if (typeof window !== 'undefined') preload(Kpi);

/** "Guten Morgen" until 11, "Guten Tag" until 18, then "Guten Abend" – in the browser's own time. */
function useGreeting() {
  const t = useT('dashboard');
  const { user } = useSession();
  const first = (user?.name ?? '').trim().split(/\s+/)[0] ?? '';
  const h = new Date().getHours();
  const text = h >= 5 && h < 12 ? t('Guten Morgen, {name}', { name: first }) : h >= 12 && h < 18 ? t('Guten Tag, {name}', { name: first }) : t('Guten Abend, {name}', { name: first });
  // no name on the account: just "Guten Morgen"
  return first ? text : text.replace(/[,\s]+$/, '');
}

export function Dashboard() {
  const t = useT('dashboard');
  const session = useSession();
  const greeting = useGreeting();
  const [days, setDays] = useState('30');
  const { data, loading } = useLoad(() => api.get(`/api/dashboard?days=${days}`), [days]);
  // Areas hidden in Darstellung → Sichtbare Bereiche take their widgets with them.
  const { visible } = useModules();
  // Einfach-Modus: only what calls for action today; the rest behind one "Mehr anzeigen" (web/src/areas/easy-core.ts).
  const simple = useSimple();
  if (loading && !data) return <Spinner />;
  if (!data) return null;
  const layout = dashboardLayout(simple, visible);
  const conv = data.appointments.showed + data.appointments.noshow ? Math.round((data.appointments.showed / (data.appointments.showed + data.appointments.noshow)) * 100) : null;
  const range = <Select value={days} onChange={setDays} aria={t('Zeitraum')} options={[['7', t('Letzte 7 Tage')], ['30', t('Letzte 30 Tage')], ['90', t('Letzte 90 Tage')], ['365', t('Letztes Jahr')]]} />;
  const place = session?.locations?.find((l) => l.id === session.locationId)?.name;
  const today = fmtDate(`${data.today}T00:00:00Z`, { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const stat = (k: DashStat) => {
    switch (k) {
      case 'contacts':
        return <Kpi key={k} data-kpi={k} icon="contact" label={t('Neue Kontakte')} value={data.contacts.new} sub={t('{n} gesamt', { n: data.contacts.total })} extra={<Spark data={data.leadsPerDay} days={Number(days)} today={data.today} />} />;
      case 'pipeline':
        return <Kpi key={k} data-kpi={k} icon="opportunities" label={t('Offene Pipeline')} value={euro(data.opportunities.openValue)} sub={t('{n} Opportunities', { n: data.opportunities.open })} />;
      case 'won':
        return <Kpi key={k} data-kpi={k} icon="trophy" label={t('Gewonnen')} value={euro(data.opportunities.wonValue)} sub={t('{won} gewonnen · {lost} verloren', { won: data.opportunities.won, lost: data.opportunities.lost })} />;
      case 'booked':
        return <Kpi key={k} data-kpi={k} icon="calendars" label={t('Termine gebucht')} value={data.appointments.booked} sub={`${t('{n} anstehend', { n: data.appointments.upcoming })}${conv !== null ? ` · ${t('{n}% Show-Rate', { n: conv })}` : ''}`} />;
      case 'forms':
        return <Kpi key={k} data-kpi={k} icon="forms" label={t('Formular-Einsendungen')} value={data.forms.submissions} />;
      case 'messages':
        return <Kpi key={k} data-kpi={k} icon="conversations" label={t('Nachrichten')} value={data.messages.sent} sub={t('{received} empfangen · {unread} ungelesen', { received: data.messages.received, unread: data.messages.unread })} />;
      case 'revenue': {
        // per currency, never added up (100 € + 100 $ is not 200 €)
        const rows: { currency: string; paid: number; outstanding: number }[] = data.revenue.by_currency ?? [{ currency: data.revenue.currency ?? 'EUR', paid: data.revenue.paid, outstanding: data.revenue.outstanding }];
        const list = (key: 'paid' | 'outstanding') => moneyList(rows.filter((r) => r[key]).map((r) => [r.currency, r[key]]), data.revenue.currency);
        return <Kpi key={k} data-kpi={k} icon="invoices" label={t('Umsatz bezahlt')} value={list('paid')} sub={t('{amount} offen', { amount: list('outstanding') })} />;
      }
      case 'reviews':
        return <Kpi key={k} data-kpi={k} icon="star" label={t('Bewertungen')} value={data.reviews.average?.a ? `${data.reviews.average.a} ★` : '–'} sub={t.plural(data.reviews.average?.n ?? 0, { one: '{n} Bewertung', other: '{n} Bewertungen' })} />;
      case 'tasks':
        return (
          <Kpi
            key={k}
            data-kpi={k}
            icon="tasks"
            tone={data.tasks.overdue ? 'late' : undefined}
            label={t('Offene Aufgaben')}
            value={data.tasks.open}
            sub={<Link to="tasks" className={data.tasks.overdue ? 'dash-late' : undefined}>{data.tasks.overdue ? t('{n} überfällig', { n: data.tasks.overdue }) : t('Zu den Aufgaben')}</Link>}
          />
        );
      case 'unread':
        return <Kpi key={k} data-kpi={k} icon="inbox" label={t('Ungelesene Nachrichten')} value={data.messages.unread} sub={<Link to="conversations">{t('Zum Posteingang')}</Link>} />;
      case 'upcoming':
        return <Kpi key={k} data-kpi={k} icon="schedule" label={t('Anstehende Termine')} value={data.appointments.upcoming} sub={<Link to="calendars">{t('Zum Kalender')}</Link>} />;
    }
  };
  const card = (k: DashCard) => {
    switch (k) {
      case 'leads':
        return <LeadsCard key={k} data-tour="dashboard-leads" data={data.leadsPerDay} days={Number(days)} today={data.today} title={t('Neue Kontakte pro Tag')} total={(n) => t('{n} im Zeitraum', { n })} />;
      case 'next':
        return (
          <NextCard
            key={k}
            data-tour="dashboard-next"
            title={t('Nächste Termine')}
            items={visible('calendars') ? data.appointments.next : null}
            more={<Link to="calendars">{t('Zum Kalender')}</Link>}
            empty={
              <>
                {t('Keine anstehenden Termine.')} <Link to="calendars">{t('Kalender einrichten')}</Link>
              </>
            }
            // Einfach-Modus has its own tile for the tasks – not said twice
            tasks={
              visible('tasks') &&
              !layout.stats.includes('tasks') &&
              data.tasks.open > 0 && (
                <Link to="tasks">
                  {t.plural(data.tasks.open, { one: '{n} offene Aufgabe', other: '{n} offene Aufgaben' })}
                  {data.tasks.overdue ? ` (${t('{n} überfällig', { n: data.tasks.overdue })})` : ''}
                </Link>
              )
            }
          />
        );
      case 'pipelines':
        return data.pipelines.map((p: any) => (
          <PipelineCard
            key={p.id}
            data-tour="dashboard-pipeline"
            stages={p.stages}
            title={
              <>
                {t('Pipeline:')} <Link to={`/app/opportunities?pipeline=${p.id}`}>{p.name}</Link>
              </>
            }
          />
        ));
      case 'sources':
        return <SourcesCard key={k} data-tour="dashboard-sources" title={t('Lead-Quellen')} empty={t('Noch keine Kontakte im Zeitraum.')} rows={data.sources} />;
    }
  };
  const hasMore = layout.moreStats.length > 0 || layout.moreCards.length > 0 || layout.widgetsInMore;
  return (
    <Suspense fallback={<Spinner />}>
      <div className="dash">
        <div className="dash-hero">
          <p className="dash-eyebrow">{t('Dashboard')}</p>
          <PageHead
            title={greeting}
            sub={
              <>
                <span className="dash-date">{today}</span>
                {place && <span className="dash-place">{place}</span>}
              </>
            }
          >
            {visible('reports') && (
              <Link to="reports" className="btn secondary">
                {t('Eigene Dashboards')}
              </Link>
            )}
            {/* the period only changes the numbers behind "Mehr anzeigen" in Einfach-Modus – it sits there */}
            {!simple && range}
            <LearnLink label="learn" />
          </PageHead>
        </div>
        <AcademyWelcome />
        {/* Every tile and card can be dragged into your own order (web/src/sortable). The essential row of Einfach-Modus and the
            one behind "Mehr anzeigen" share one saved order with the full row, so switching modes keeps it. */}
        {layout.stats.length > 0 && (
          <SortableGrid id="dashboard.stats" className="stats dash-kpis" data-tour="dashboard-stats">
            {layout.stats.map(stat)}
          </SortableGrid>
        )}
        {!layout.widgetsInMore && <PluginWidgets />}
        {layout.cards.length > 0 && (
          <SortableGrid id="dashboard.cards" className="grid2 dash-cards" style={{ gap: 16 }}>
            {layout.cards.flatMap(card)}
          </SortableGrid>
        )}
        {simple && hasMore && (
          <MoreFields id="dashboard" label={t('Mehr anzeigen')}>
            <div className="dash-range">{range}</div>
            {layout.moreStats.length > 0 && (
              <SortableGrid id="dashboard.stats" className="stats dash-kpis">
                {layout.moreStats.map(stat)}
              </SortableGrid>
            )}
            <PluginWidgets />
            {layout.moreCards.length > 0 && (
              <SortableGrid id="dashboard.cards" className="grid2 dash-cards" style={{ gap: 16 }}>
                {layout.moreCards.flatMap(card)}
              </SortableGrid>
            )}
          </MoreFields>
        )}
      </div>
    </Suspense>
  );
}
