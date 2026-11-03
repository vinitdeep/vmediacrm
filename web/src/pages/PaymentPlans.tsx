import { useState } from 'react';
import { Icon } from '../icons';
import { api, d, dt, money } from '../api';
import { Check, Empty, Field, Input, Link, Modal, PageHead, Select, Spinner, Stat, Tabs, act, confirmAsk, useLoad } from '../ui';
import { ACCESS_LABEL, Callout, Facts, Item, Panel, Progress, StatusBadge, euroText, parseEuro } from './CreatorKit';
import { SortableGrid } from '../sortable/Sortable';
import { useT, tr } from '../i18n';

/**
 * Ratenzahlung: payment plans on one-time products (the buyer picks "3 × 99 €" on the buy page; Stripe collects the instalments
 * and stops by itself) and the purchases with their progress. Docs: docs/payment-plans.md.
 */

const ON_DEFAULT: [string, string][] = [
  ['pause', 'Zugang pausieren (kommt zurück, sobald bezahlt wird)'],
  ['revoke', 'Zugang entziehen'],
  ['keep', 'Zugang behalten (nur benachrichtigen)'],
];
const FILTERS: [string, string][] = [
  ['', 'Alle Käufe'],
  ['active', 'Laufend'],
  ['defaulted', 'Ausgefallen'],
  ['completed', 'Abgeschlossen'],
  ['canceled', 'Beendet'],
];

const every = (interval: string, n: number) => {
  const t = tr('b6invoices'); return (interval === 'week' ? (n === 1 ? t('wöchentlich') : t('alle {n} Wochen', { n })) : n === 1 ? t('monatlich') : n === 12 ? t('jährlich') : t('alle {n} Monate', { n })); };

function PlanDialog({ plan, products, productId, onClose, onSaved }: { plan?: any; products: any[]; productId?: string; onClose: () => void; onSaved: () => void }) {
  const t = useT('b6invoices');
  const [f, setF] = useState({
    product_id: plan?.product_id ?? productId ?? products[0]?.id ?? '',
    name: plan?.name ?? '',
    installments: String(plan?.installments ?? 3),
    interval: plan?.interval ?? 'month',
    interval_count: String(plan?.interval_count ?? 1),
    amount: euroText(plan?.amount_cents),
    first: euroText(plan?.first_amount_cents),
    on_default: plan?.on_default ?? 'pause',
    active: plan ? !!plan.active : true,
  });
  const set = (p: Partial<typeof f>) => setF({ ...f, ...p });
  const amount = parseEuro(f.amount);
  const first = f.first.trim() ? parseEuro(f.first) : null;
  const n = Math.round(Number(f.installments));
  const count = Math.round(Number(f.interval_count));
  const prod = products.find((p) => p.id === f.product_id);
  const problem = !prod
    ? t('Bitte ein Produkt wählen.')
    : !(n >= 2 && n <= 60)
      ? t('Raten: 2 bis 60.')
      : !(count >= 1 && count <= (f.interval === 'week' ? 52 : 12))
        ? f.interval === 'week' ? t('Abstand: 1 bis 52 Wochen.') : t('Abstand: 1 bis 12 Monate.')
        : amount === null || amount < 50
          ? t('Rate: mindestens 0,50 €.')
          : f.first.trim() && (first === null || first < 50)
            ? t('Erste Rate: mindestens 0,50 € – oder leer lassen.')
            : '';
  const total = amount === null || !(n >= 2) ? null : (first ?? amount) + (n - 1) * amount;
  const price = prod ? Math.round(prod.price_cents * (1 + (Number(prod.tax_rate) || 0) / 100)) : null;
  const save = async () => {
    const body = { product_id: f.product_id, name: f.name, installments: n, interval: f.interval, interval_count: count, amount_cents: amount, first_amount_cents: first, on_default: f.on_default, active: f.active };
    const r = await act(() => (plan ? api.patch(`/api/payment-plans/${plan.id}`, body) : api.post('/api/payment-plans', body)), t('Plan gespeichert'));
    if (r) {
      onSaved();
      onClose();
    }
  };
  return (
    <Modal
      title={plan ? t('Ratenplan bearbeiten') : t('Neuer Ratenplan')}
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={onClose}>
            {t('Abbrechen')}
          </button>
          <button className="btn" disabled={!!problem} onClick={save} data-tour="plan-save">
            {t('Speichern')}
          </button>
        </>
      }
    >
      {plan && <Callout tone="info">{t('Bestehende Käufe behalten die Bedingungen, zu denen sie gekauft wurden. Die Änderung gilt für neue Käufe.')}</Callout>}
      <Field label={t('Produkt *')} hint={t('Ratenzahlung gibt es für Einmal-Produkte, nicht für Abos.')}>
        <Select value={f.product_id} onChange={(v) => set({ product_id: v })} options={products.map((p) => [p.id, `${p.name} · ${money(p.price_cents, p.currency)}`] as [string, string])} />
      </Field>
      <Field label={t('Name (optional)')} hint={t('Erscheint auf der Kaufseite statt der Standard-Beschreibung, z. B. „Bequem in 3 Raten“.')}>
        <Input value={f.name} onChange={(v) => set({ name: v })} maxLength={120} />
      </Field>
      <div className="cr-form-row">
        <Field label={t('Anzahl Raten *')}>
          <Input type="number" min={2} max={60} value={f.installments} onChange={(v) => set({ installments: v })} />
        </Field>
        <Field label={t('Betrag je Rate (brutto) *')}>
          <Input inputMode="decimal" value={f.amount} onChange={(v) => set({ amount: v })} placeholder="99,00" />
        </Field>
      </div>
      <div className="cr-form-row">
        <Field label={t('Abstand')}>
          <Input type="number" min={1} max={f.interval === 'week' ? 52 : 12} value={f.interval_count} onChange={(v) => set({ interval_count: v })} />
        </Field>
        <Field label={t('Einheit')}>
          <Select value={f.interval} onChange={(v) => set({ interval: v })} options={[['month', t('Monat(e)')], ['week', t('Woche(n)')]]} />
        </Field>
      </div>
      <Field label={t('Erste Rate abweichend (optional)')} hint={t('Zum Beispiel eine höhere Anzahlung. Leer = alle Raten gleich.')}>
        <Input inputMode="decimal" value={f.first} onChange={(v) => set({ first: v })} placeholder="150,00" />
      </Field>
      <Field label={t('Wenn eine Rate nicht eingezogen werden kann')}>
        <Select value={f.on_default} onChange={(v) => set({ on_default: v })} options={ON_DEFAULT.map(([k, l]) => [k, t(l)] as [string, string])} />
      </Field>
      <Check checked={f.active} onChange={(v) => set({ active: v })} label={t('Auf der Kaufseite anbieten')} />
      {problem ? (
        <p className="cr-err">{problem}</p>
      ) : (
        <Callout tone="info">
          <strong>
            {first && first !== amount ? `${money(first)} + ${n - 1} × ${money(amount!)}` : `${n} × ${money(amount!)}`} {every(f.interval, count)}
          </strong>{t('· insgesamt {money}', { money: money(total!) })}
          {price !== null && total !== null && total < price && <p className="small">{t('Achtung: Die Summe liegt unter dem Preis des Produkts ({money}).', { money: money(price) })}</p>}
          {price !== null && total !== null && total > price && <p className="small">{t('Die Summe liegt über dem Einmalpreis ({money}) – ein Ratenaufschlag. Das ist erlaubt, muss aber auf der Kaufseite klar erkennbar sein.', { money: money(price) })}</p>}
        </Callout>
      )}
    </Modal>
  );
}

function PurchaseDialog({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const t = useT('b6invoices');
  const { data, reload } = useLoad(() => api.get(`/api/payment-plans/subscriptions/${id}`), [id]);
  if (!data)
    return (
      <Modal title={t('Ratenkauf')} onClose={onClose}>
        <Spinner />
      </Modal>
    );
  const s = data;
  const toggle = async (on: boolean) => {
    if (await act(() => api.post(`/api/payment-plans/subscriptions/${id}/access`, { on }), on ? t('Zugang fortgesetzt') : t('Zugang pausiert'))) {
      reload();
      onChanged();
    }
  };
  const cancel = async () => {
    if (!confirmAsk(t('Den Ratenplan beenden? Stripe bucht dann keine weiteren Raten ab (bisher bezahlt: {paid_count} von {installments}).', { paid_count: s.paid_count, installments: s.installments }))) return;
    if (await act(() => api.post(`/api/payment-plans/subscriptions/${id}/cancel`), t('Ratenplan beendet'))) {
      reload();
      onChanged();
    }
  };
  const ended = s.status === 'completed' || s.status === 'canceled';
  return (
    <Modal
      title={t('Ratenkauf')}
      wide
      onClose={onClose}
      footer={
        <>
          {s.contact_id && s.access === 'active' && s.status !== 'completed' && (
            <button className="btn secondary" onClick={() => toggle(false)}>
              {t('Zugang pausieren')}
            </button>
          )}
          {s.contact_id && s.access !== 'active' && (
            <button className="btn secondary" onClick={() => toggle(true)}>
              {t('Zugang fortsetzen')}
            </button>
          )}
          {!ended && (
            <button className="btn danger" onClick={cancel}>
              {t('Plan beenden')}
            </button>
          )}
        </>
      }
    >
      <Facts
        rows={[
          [t('Kontakt'), s.contact_id ? <Link to={`contacts/${s.contact_id}`}>{s.contact?.name || t('Kontakt öffnen')}</Link> : t('noch nicht zugeordnet')],
          [t('Produkt'), s.product_name],
          [t('Plan'), s.label],
          ['Status', <StatusBadge key="s" status={s.status} />],
          [t('Zugang'), ACCESS_LABEL[s.access] ?? s.access],
          [t('Bezahlt'), t('{paid_count} von {installments} Raten · {money} von {money2}', { paid_count: s.paid_count, installments: s.installments, money: money(s.paid_cents, s.currency), money2: money(s.total_cents, s.currency) })],
          [t('Offen'), money(s.open_cents, s.currency)],
          [t('Gestartet'), d(s.started_at)],
          [t('Abgeschlossen'), s.completed_at ? d(s.completed_at) : ''],
          [t('Fehlversuche'), s.failed_count ? `${s.failed_count} (zuletzt ${dt(s.last_failed_at)})` : ''],
          [t('Grund'), s.default_reason],
        ]}
      />
      <Progress value={s.paid_count} max={s.installments} label={t('Bezahlte Raten')} />
      <h4 style={{ margin: '18px 0 8px' }}>{t('Bezahlte Raten')}</h4>
      {s.payments.length ? (
        <div className="table-wrap">
          <table className="t">
            <thead>
              <tr>
                <th>{t('Rate')}</th>
                <th>{t('Betrag')}</th>
                <th>{t('Bezahlt am')}</th>
                <th>{t('Rechnung')}</th>
              </tr>
            </thead>
            <tbody>
              {s.payments.map((p: any) => (
                <tr key={p.id}>
                  <td>{p.number}</td>
                  <td>{money(p.amount_cents, s.currency)}</td>
                  <td>{dt(p.paid_at)}</td>
                  <td>{p.invoice_id ? <Link to={`invoices/${p.invoice_id}`}>{t('Beleg öffnen')}</Link> : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">{t('Noch keine Rate bezahlt.')}</p>
      )}
      {s.jobs.some((j: any) => j.status !== 'done') && (
        <Callout tone="warn">
          <strong>{t('Offene Aufgaben im Hintergrund')}</strong>
          <ul>
            {s.jobs
              .filter((j: any) => j.status !== 'done')
              .map((j: any, i: number) => (
                <li key={i}>
                  {j.kind === 'cancel_at' ? t('Ende nach der letzten Rate bei Stripe setzen') : j.kind} {t('– Versuch {attempts}, nächster {dt}', { attempts: j.attempts, dt: dt(j.next_at) })}
                  {j.error ? ` (${j.error})` : ''}
                </li>
              ))}
          </ul>
        </Callout>
      )}
    </Modal>
  );
}

export function PaymentPlans({ tab: tabParam }: { tab?: string }) {
  const t = useT('b6invoices');
  const [tab, setTab] = useState(tabParam === 'plans' ? 'plans' : 'purchases');
  const stripe = useLoad(() => api.get('/api/stripe'), []);
  const products = useLoad(() => api.get<any[]>('/api/products'), []);
  const plans = useLoad(() => api.get<any[]>('/api/payment-plans'), []);
  const [status, setStatus] = useState('');
  const subs = useLoad(() => api.get<any[]>(`/api/payment-plans/subscriptions${status ? `?status=${status}` : ''}`), [status]);
  const all = useLoad(() => api.get<any[]>('/api/payment-plans/subscriptions?limit=500'), []);
  const [editing, setEditing] = useState<{ plan?: any; productId?: string } | null>(null);
  const [open, setOpen] = useState('');
  const oneTime = (products.data ?? []).filter((p) => !p.recurring);
  const count = (s: string) => (all.data ?? []).filter((x) => x.status === s).length;
  const openCents = (all.data ?? []).filter((x) => x.status === 'active' || x.status === 'defaulted').reduce((a, x) => a + (x.open_cents || 0), 0);
  const refresh = () => {
    plans.reload();
    subs.reload();
    all.reload();
  };
  const remove = async (p: any) => {
    if (!confirmAsk(t('Den Plan „{n}“ löschen? Bestehende Käufe laufen mit ihren Bedingungen weiter.', { n: p.name || p.label }))) return;
    if (await act(() => api.del(`/api/payment-plans/${p.id}`), t('Plan gelöscht'))) refresh();
  };
  const byProduct = oneTime.map((p) => ({ product: p, plans: (plans.data ?? []).filter((x) => x.product_id === p.id) }));

  return (
    <div className="cr cr-plans">
      <PageHead title={t('Ratenzahlung')} sub={t('Kunden zahlen in Raten – Stripe zieht ein und hört nach der letzten Rate von selbst auf. Der Zugang folgt der Zahlung.')}>
        <button className="btn" data-tour="plans-new" disabled={!oneTime.length} onClick={() => setEditing({})}>
          <Icon name="repeat" /> {t('Neuer Ratenplan')}
        </button>
      </PageHead>
      {stripe.data && !stripe.data.connected && (
        <Callout tone="warn" tour="plans-stripe">
          <strong>{t('Stripe ist noch nicht verbunden.')}</strong> {t('Ratenzahlung läuft über Stripe-Abos – trage unter')} <Link to="settings/stripe">{t('Einstellungen → Stripe')}</Link> {t('deinen Schlüssel ein und richte den Webhook ein (siehe Anleitung).')}
        </Callout>
      )}
      <SortableGrid id="plans-stats" className="stats" data-tour="plans-stats">
        <Stat label={t('Laufende Käufe')} value={count('active')} />
        <Stat label={t('Ausgefallen')} value={count('defaulted')} sub={count('defaulted') ? t('Zahlung klären') : undefined} />
        <Stat label={t('Abgeschlossen')} value={count('completed')} />
        <Stat label={t('Noch offen (laufend + ausgefallen)')} value={money(openCents)} />
      </SortableGrid>
      <Tabs
        tabs={[
          ['purchases', t('Käufe{v}', { v: all.data ? ` (${all.data.length})` : '' })],
          ['plans', t('Pläne')],
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'purchases' && (
        <Panel title={t('Ratenkäufe')} sub={t('Wer zahlt wie weit? Ein Klick zeigt die bezahlten Raten.')} wide tour="plans-purchases" actions={<Select value={status} onChange={setStatus} aria="Status" options={FILTERS.map(([k, l]) => [k, t(l)] as [string, string])} />}>
          {subs.loading && !subs.data ? (
            <Spinner />
          ) : subs.data?.length ? (
            <div className="cr-list">
              {subs.data.map((s) => (
                <Item
                  key={s.id}
                  tone={s.status === 'defaulted' ? 'bad' : s.status === 'completed' ? 'ok' : undefined}
                  onClick={() => setOpen(s.id)}
                  side={
                    <>
                      <StatusBadge status={s.status} />
                      {s.access !== 'active' && <span className="badge yellow">{ACCESS_LABEL[s.access]}</span>}
                    </>
                  }
                >
                  <strong>{s.contact?.name || t('Kontakt noch offen')}</strong> · {s.product_name}
                  <div className="cr-sub">
                    {t('{label} · {paid_count} von {installments} Raten bezahlt ({money}) · seit {d}', { label: s.label, paid_count: s.paid_count, installments: s.installments, money: money(s.paid_cents, s.currency), d: d(s.started_at) })}
                  </div>
                  <Progress value={s.paid_count} max={s.installments} label={t('Bezahlte Raten')} />
                </Item>
              ))}
            </div>
          ) : (
            <Empty>{status ? t('Keine Käufe mit diesem Status.') : t('Noch kein Kauf mit Ratenzahlung. Lege einen Plan an – er erscheint dann auf der Kaufseite des Produkts.')}</Empty>
          )}
        </Panel>
      )}
      {tab === 'plans' && (
        <div className="cr-panels" data-tour="plans-list">
          {!oneTime.length && !products.loading && (
            <Panel title={t('Noch kein Einmal-Produkt')} wide>
              <Empty action={<Link to="products" className="btn">{t('Zu den Produkten')}</Link>}>{t('Ratenzahlung gibt es für Produkte mit Einmalpreis. Lege zuerst eines an.')}</Empty>
            </Panel>
          )}
          {byProduct.map(({ product, plans: list }) => (
            <Panel
              key={product.id}
              title={product.name}
              sub={t('Einmalpreis {money}{v}', { money: money(product.price_cents, product.currency), v: product.tax_rate ? ` + ${String(product.tax_rate).replace('.', ',')} % USt.` : '' })}
              actions={
                <button className="btn small secondary" onClick={() => setEditing({ productId: product.id })}>
                  {t('+ Plan')}
                </button>
              }
            >
              {list.length ? (
                <div className="cr-list">
                  {list.map((p) => (
                    <Item
                      key={p.id}
                      onClick={() => setEditing({ plan: p })}
                      side={
                        <>
                          {!p.active && <span className="badge gray">{t('aus')}</span>}
                          <button
                            className="btn small ghost danger-text"
                            onClick={(e) => {
                              e.stopPropagation();
                              void remove(p);
                            }}
                          >
                            {t('Löschen')}
                          </button>
                        </>
                      }
                    >
                      <strong>{p.name || p.label}</strong>
                      <div className="cr-sub">
                        {p.name ? `${p.label} · ` : ''}{t('insgesamt {money} · {running} laufend · {completed} abgeschlossen · {defaulted} ausgefallen', { money: money(p.total_cents, p.currency), running: p.running, completed: p.completed, defaulted: p.defaulted })}
                      </div>
                    </Item>
                  ))}
                </div>
              ) : (
                <p className="muted">{t('Noch kein Plan – Kunden zahlen einmalig.')}</p>
              )}
            </Panel>
          ))}
        </div>
      )}
      {editing && <PlanDialog plan={editing.plan} productId={editing.productId} products={oneTime} onClose={() => setEditing(null)} onSaved={refresh} />}
      {open && <PurchaseDialog id={open} onClose={() => setOpen('')} onChanged={refresh} />}
    </div>
  );
}
