import { useState, type ReactNode } from 'react';
import { METRICS, headline, metricValue, money, waterfall, type CalcInput, type MetricKey, type RunResult } from '../../../server/services/calc-engine';
import { Stat, Tabs } from '../ui';
import { ProjectionCharts, TornadoChart, Waterfall } from './CalcCharts';
import { SortableGrid } from '../sortable/Sortable';
import { useT } from '../i18n';

/**
 * The results side of the Gewinnrechner: the answer in one sentence with the key figures, the heatmap matrix
 * (customers × price variants, one metric at a time) and the detail of the selected cell – waterfall, levers,
 * projection, unit economics and taxes.
 */

export type Period = 'month' | 'year';
export interface Focus {
  /** Matrix cell (row/column index) or null = the prices as entered at `customers.count`. */
  cell: { row: number; col: number } | null;
}

const de = (v: number, d = 0) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: d }).format(v);
const eur = (v: number | null | undefined, d = 0) => (v === null || v === undefined || !Number.isFinite(v) ? '–' : money(v, d).replace(/^-/, '−'));
const pctS = (v: number | null | undefined) => (v === null || v === undefined ? '–' : `${de(v, 1)} %`);
const neg = (v: number | null | undefined) => (typeof v === 'number' && v < 0 ? ' neg' : '');

// --- headline and key figures --------------------------------------------------------------------------------------------------

export function Headline({ input, res }: { input: CalcInput; res: RunResult }) {
  const tt = useT('b4calc');
  const f = res.focus;
  const c = f.cell;
  const u = f.unit;
  const mrr = f.customers * u.arpu_net;
  const be = u.breakeven;
  return (
    <section className="calc-head card" data-tour="calc-headline">
      <p className="calc-answer">{headline(input, f)}</p>
      {res.warnings.map((w) => (
        <p className="calc-callout" key={w} role="note">
          {w}
        </p>
      ))}
      <SortableGrid id="calc-results.stats" className="stats calc-stats">
        <Stat label={tt('Umsatz netto pro Monat')} value={eur(c.m.revenue_net)} sub={tt('brutto {revenue_gross}', { revenue_gross: eur(c.m.revenue_gross) })} />
        <Stat label={tt('Nach variablen Kosten')} value={<span className={neg(c.m.contribution)}>{eur(c.m.contribution)}</span>} sub={tt('{contribution_margin} vom Umsatz', { contribution_margin: pctS(c.contribution_margin) })} />
        <Stat label={tt('EBIT pro Monat')} value={<span className={neg(c.m.ebit)}>{eur(c.m.ebit)}</span>} sub={tt('nach Fixkosten {fixed}', { fixed: eur(c.m.fixed) })} />
        <Stat label={tt('Nettogewinn pro Monat')} value={<span className={neg(c.m.net_profit)}>{eur(c.m.net_profit)}</span>} sub={tt('{net_profit} im Jahr · Marge {margin}', { net_profit: eur(c.y.net_profit), margin: pctS(c.margin) })} tour="calc-net" />
        <Stat label={tt('Break-even')} value={be.customers === null ? 'nie' : be.customers === 0 ? 'sofort' : `ab ${de(be.customers)} Kunden`} sub={be.customers_net !== null && be.customers_net !== be.customers ? tt('nach Steuern ab {customers_net}', { customers_net: de(be.customers_net) }) : be.customers === null ? tt('bei diesen Preisen') : tt('vor Steuern')} />
        <Stat label={tt('MRR / ARR')} value={eur(mrr)} sub={tt('ARR {v1}', { v1: eur(mrr * 12) })} />
        <Stat label={tt('Kundenwert / Kosten')} value={u.ltv_cac === null ? '–' : `${de(u.ltv_cac, 1)}×`} sub={tt('LTV {ltv} · CAC {cac}', { ltv: eur(u.ltv), cac: eur(u.cac) })} />
        <Stat label={tt('Amortisation je Kunde')} value={u.payback_months === null ? 'nie' : `${de(u.payback_months, 1)} Monate`} sub={tt('Ø Laufzeit {v1} Monate', { v1: de(u.lifetime_months, 1) })} />
      </SortableGrid>
    </section>
  );
}

// --- heatmap -------------------------------------------------------------------------------------------------------------------

function heat(v: number | null, max: number, diverging: boolean): string | undefined {
  if (v === null || !Number.isFinite(v) || max <= 0) return undefined;
  const t = Math.min(1, Math.abs(v) / max);
  if (!diverging) return `color-mix(in srgb, var(--brand) ${Math.round(t * 42)}%, var(--panel))`;
  return `color-mix(in srgb, var(${v >= 0 ? '--green' : '--red'}) ${Math.round(t * 46)}%, var(--panel))`;
}

export function Matrix({ res, metric, setMetric, period, setPeriod, focus, setFocus }: { res: RunResult; metric: MetricKey; setMetric: (m: MetricKey) => void; period: Period; setPeriod: (p: Period) => void; focus: Focus; setFocus: (f: Focus) => void }) {
  const tt = useT('b4calc');
  const meta = METRICS.find((m) => m.key === metric)!;
  const values = res.matrix.map((row) => row.map((c) => metricValue(c, metric, period)));
  const flat = values.flat().filter((v): v is number => v !== null && Number.isFinite(v));
  const max = Math.max(0, ...flat.map((v) => Math.abs(v)));
  const diverging = metric !== 'revenue_gross' && metric !== 'revenue_net';
  const show = (v: number | null) => (v === null ? '–' : meta.unit === 'pct' ? `${de(v, 1)} %` : eur(v));
  const unit = meta.unit === 'pct' ? '' : period === 'year' ? tt(' pro Jahr') : tt(' pro Monat');
  const sel = focus.cell;
  return (
    <section className="card calc-matrix" data-tour="calc-matrix">
      <div className="calc-matrix-head">
        <div>
          <h3>{tt('Was bleibt übrig?')} <span className="muted small">{tt('Kunden × Preis')}</span></h3>
          <p className="muted small">{tt('Klick auf ein Feld zeigt unten die Rechnung dazu.')}</p>
        </div>
        <div className="calc-matrix-tools">
          <label className="calc-f compact" data-tour="calc-metric">
            <span>{tt('Kennzahl')}</span>
            <span className="calc-in">
              <select value={metric} onChange={(e) => setMetric(e.target.value as MetricKey)} aria-label={tt('Kennzahl der Tabelle')}>
                {METRICS.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </span>
          </label>
          {meta.unit !== 'pct' && (
            <div className="seg" role="group" aria-label={tt('Zeitraum')}>
              <button type="button" className={period === 'month' ? 'on' : ''} onClick={() => setPeriod('month')} aria-pressed={period === 'month'}>
                {tt('Monat')}
              </button>
              <button type="button" className={period === 'year' ? 'on' : ''} onClick={() => setPeriod('year')} aria-pressed={period === 'year'}>
                {tt('Jahr')}
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="table-wrap calc-table-wrap">
        <table className="calc-heat">
          <caption className="sr-only">
            {meta.label}
            {unit} {tt('je Kundenzahl (Zeilen) und Preisvariante (Spalten)')}
          </caption>
          <thead>
            <tr>
              <th scope="col">{tt('Kunden')}</th>
              {res.columns.map((c) => (
                <th scope="col" key={c.key}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {res.rows.map((n, ri) => (
              <tr key={n}>
                <th scope="row">{de(n)}</th>
                {values[ri].map((v, ci) => {
                  const on = sel?.row === ri && sel?.col === ci;
                  return (
                    <td key={ci} style={{ background: heat(v, max, diverging) }} className={on ? 'sel' : ''}>
                      <button type="button" className="calc-cell" aria-pressed={on} aria-label={tt('{n} Kunden zu {label}: {label2}{unit} {v}', { n: de(n), label: res.columns[ci].label, label2: meta.label, unit, v: show(v) })} onClick={() => setFocus({ cell: on ? null : { row: ri, col: ci } })}>
                        {show(v)}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">{tt('Break-even')}</th>
              {res.unit.map((u, i) => (
                <td key={i}>{u.breakeven.customers === null ? tt('nie') : tt('ab {customers}', { customers: de(u.breakeven.customers) })}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">{tt('LTV / CAC')}</th>
              {res.unit.map((u, i) => (
                <td key={i}>{u.ltv_cac === null ? '–' : `${de(u.ltv_cac, 1)}×`}</td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="muted small calc-foot">
        {meta.label}
        {unit} · {de(res.rows.length)} {tt('Kundenzahlen ×')} {de(res.columns.length)} {tt('Preisvarianten')}
      </p>
    </section>
  );
}

// --- detail ---------------------------------------------------------------------------------------------------------------------

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="table-wrap calc-mini">
      <table className="t">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i} className={i ? 'num' : ''}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={j ? 'num' : 'strong'}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
const TAX_TEXT: Record<string, string> = {
  einzelunternehmen: 'Einzelunternehmen: Einkommensteuer nach § 32a EStG (Grundtarif oder Splitting) auf Gewinn plus weitere Einkünfte, abzüglich Vorsorge und Abzügen; dazu Soli und optional Kirchensteuer. Die Gewerbesteuer wird nach § 35 EStG zum Teil auf die Einkommensteuer angerechnet.',
  kapitalgesellschaft: 'GmbH/UG: Körperschaftsteuer plus Soli auf den Gewinn und Gewerbesteuer ohne Freibetrag. Bei einer Ausschüttung kommt die Abgeltungsteuer beim Inhaber dazu.',
  keine: 'Ohne Steuern gerechnet: der Nettogewinn ist hier das Ergebnis vor Steuern.',
};

export function Detail({ input, res, period, focusLabel, onReset, isCell }: { input: CalcInput; res: RunResult; period: Period; focusLabel: string; onReset: () => void; isCell: boolean }) {
  const tt = useT('b4calc');
  const [tab, setTab] = useState('waterfall');
  const f = res.focus;
  const u = f.unit;
  const t = f.cell.tax;
  const steps = waterfall(f.cell, period);
  const per = period === 'year' ? tt('pro Jahr') : tt('pro Monat');
  return (
    <section className="card calc-detail" data-tour="calc-detail">
      <div className="calc-detail-head">
        <h3>{focusLabel}</h3>
        {isCell && (
          <button type="button" className="btn secondary small" onClick={onReset}>
            {tt('Zurück zu meiner Rechnung')}
          </button>
        )}
      </div>
      <Tabs
        tabs={[
          ['waterfall', tt('Wasserfall')],
          ['levers', tt('Hebel')],
          ['projection', tt('Prognose')],
          ['unit', tt('Pro Kunde')],
          ['tax', tt('Steuern')],
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'waterfall' && <Waterfall steps={steps} title={tt('Von der Zahlung zum Nettogewinn {per}', { per })} caption={tt('{customers} Kunden · {label}', { customers: de(f.customers), label: f.column.label })} />}
      {tab === 'levers' && f.sensitivity && <TornadoChart t={f.sensitivity} title={tt('Was den Nettogewinn pro Jahr am meisten bewegt (± {pct} %)', { pct: de(f.sensitivity.pct) })} caption={tt('Jeder Balken: dieser Wert um den Prozentsatz kleiner und größer, alles andere bleibt.')} />}
      {tab === 'projection' && (
        <>
          <ProjectionCharts p={f.projection} />
          <Table
            head={[tt('Nach'), tt('Kunden'), 'MRR', 'ARR', tt('Umsatz netto'), 'EBIT', tt('Steuern'), tt('Nettogewinn')]}
            rows={f.projection.horizons.map((h) => [`${h.months} Monaten`, de(h.customers), eur(h.mrr), eur(h.arr), eur(h.revenue_net), eur(h.ebit), eur(h.tax), eur(h.net_profit)])}
          />
          <p className="muted small calc-foot">
            {tt('Summen der ersten 12, 24 und 36 Monate (MRR und Kunden: Stand am Ende). Kunden wachsen mit')} {de(input.customers.growth.monthly_new)} {tt('Neukunden pro Monat')}{input.customers.growth.monthly_new_growth ? tt(' ({v1}{v2} % je Monat)', { v1: input.customers.growth.monthly_new_growth > 0 ? '+' : '', v2: de(input.customers.growth.monthly_new_growth, 1) }) : ''} {tt('abzüglich')} {de(input.customers.churn, 1)} {tt('% Kündigungen.')}{' '}
            {f.projection.breakeven_month ? tt('Insgesamt im Plus ab Monat {breakeven_month}.', { breakeven_month: f.projection.breakeven_month }) : tt('Innerhalb der Prognose wird das Geschäft insgesamt nicht ins Plus kommen.')}
          </p>
        </>
      )}
      {tab === 'unit' && (
        <>
          <SortableGrid id="calc-results.stats-2" className="stats calc-stats">
            <Stat label={tt('Umsatz je Kunde und Monat')} value={eur(u.arpu_net, 2)} sub={tt('brutto {v1}', { v1: eur(u.arpu_gross, 2) })} />
            <Stat label={tt('Bleibt je Kunde und Monat')} value={<span className={neg(u.contribution)}>{eur(u.contribution, 2)}</span>} sub={tt('nach Gebühren und variablen Kosten')} />
            <Stat label={tt('Ø Laufzeit')} value={`${de(u.lifetime_months, 1)} Monate`} sub={tt('Kündigungen {v1} % je Monat', { v1: de(input.customers.churn, 1) })} />
            <Stat label={tt('Kundenwert (LTV)')} value={eur(u.ltv)} sub={tt('Kosten je Neukunde {cac}', { cac: eur(u.cac) })} />
            <Stat label={tt('LTV / CAC')} value={u.ltv_cac === null ? '–' : `${de(u.ltv_cac, 1)}×`} sub={u.ltv_cac === null ? tt('ohne Kundengewinnungskosten') : u.ltv_cac >= 3 ? tt('gesund (ab 3×)') : tt('unter 3× – knapp')} />
            <Stat label={tt('Amortisation')} value={u.payback_months === null ? 'nie' : `${de(u.payback_months, 1)} Monate`} sub={tt('bis ein Neukunde seine Kosten eingespielt hat')} />
            <Stat label={tt('Ø Einheiten / Nutzer')} value={`${de(u.units, 1)} / ${de(u.users, 1)}`} sub={tt('je Kunde, über alle Tarife')} />
            <Stat label={tt('Mindestpreis')} value={f.min_price === null ? '–' : eur(f.min_price, 2)} sub={tt('Grundpreis für EBIT 0 bei {customers} Kunden', { customers: de(f.customers) })} />
          </SortableGrid>
          <Table
            head={[tt('Preisvariante'), 'Umsatz/Kunde', 'Bleibt/Kunde', 'LTV/CAC', tt('Amortisation'), tt('Break-even')]}
            rows={res.columns.map((c, i) => [c.label, eur(res.unit[i].arpu_net, 2), eur(res.unit[i].contribution, 2), res.unit[i].ltv_cac === null ? '–' : `${de(res.unit[i].ltv_cac!, 1)}×`, res.unit[i].payback_months === null ? 'nie' : `${de(res.unit[i].payback_months!, 1)} Mon.`, res.unit[i].breakeven.customers === null ? 'nie' : `ab ${de(res.unit[i].breakeven.customers!)}`])}
          />
        </>
      )}
      {tab === 'tax' && (
        <>
          <p className="calc-disclaimer-s">{tt('Schätzung, keine Steuerberatung.')}</p>
          <p className="small">{tt(TAX_TEXT[input.tax.legal_form])}</p>
          <Table
            head={[tt('Jahr (hochgerechnet aus einem Monat)'), tt('Betrag')]}
            rows={[
              ['EBIT (Gewinn vor Steuern)', eur(f.cell.y.ebit)],
              ...(input.tax.legal_form === 'einzelunternehmen' ? [[tt('Zu versteuerndes Einkommen (mit weiteren Einkünften)'), eur(t.zve)], [tt('Einkommensteuer auf den Gewinn'), eur(t.est)], ...(t.s35 > 0 ? [[tt('darin: Anrechnung der Gewerbesteuer (§ 35 EStG)'), `− ${eur(t.s35)}`]] : []), [tt('Solidaritätszuschlag'), eur(t.soli)], [tt('Kirchensteuer'), eur(t.church)]] : []),
              ...(input.tax.legal_form === 'kapitalgesellschaft' ? [[tt('Körperschaftsteuer'), eur(t.kst)], [tt('Solidaritätszuschlag'), eur(t.soli)], [tt('Steuer auf Ausschüttung'), eur(t.dividend_tax)]] : []),
              ...(input.tax.legal_form !== 'keine' ? [[tt('Gewerbesteuer'), eur(t.gewst)]] : []),
              [tt('Steuern gesamt'), eur(t.total)],
              ['Vorsorge (Kranken-/Rentenversicherung)', eur(f.cell.y.vorsorge)],
              [tt('Nettogewinn'), eur(f.cell.y.net_profit)],
            ]}
          />
          <p className="muted small calc-foot">
            {tt('Durchschnittliche Steuerlast')} {pctS(t.rate_pct)} {tt('vom Gewinn.')}
            {input.tax.legal_form === 'einzelunternehmen' ? tt(' Tarif {year}, Gewerbesteuer-Hebesatz {hebesatz} %.', { year: input.tax.est.year, hebesatz: de(input.tax.gewerbesteuer.hebesatz) }) : ''} {tt('Die Tarifwerte stehen im Eingabefeld „Steuern“ und lassen sich ändern; maßgeblich ist immer der Bescheid.')}
          </p>
        </>
      )}
    </section>
  );
}
