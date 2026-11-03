import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { startTestApp } from './helpers.js';
import { centsToMoney, cleanCurrency, currencyOf, moneyLocale } from '../server/core/util.js';
import { accountCurrency, currencyOptions, currencySymbol, setAccountCurrency } from '../web/src/currency.js';

describe('currency helpers', () => {
  it('formats rupees in Indian grouping, other currencies as before', () => {
    expect(moneyLocale('INR')).toBe('en-IN');
    expect(centsToMoney(12345600, 'INR')).toBe('₹1,23,456.00');
    expect(centsToMoney(123456, 'EUR')).toBe('1.234,56 €');
  });

  it('cleans codes and reads the account setting', () => {
    expect(cleanCurrency(' inr ')).toBe('INR');
    expect(cleanCurrency('xx', 'USD')).toBe('USD');
    expect(currencyOf({ settings: { currency: 'GBP' } })).toBe('GBP');
  });

  it('V Media CRM defaults to INR when PGHL_CURRENCY is not set', async () => {
    vi.resetModules();
    vi.stubEnv('PGHL_CURRENCY', '');
    try {
      const util = await import('../server/core/util.js');
      expect(util.DEFAULT_CURRENCY).toBe('INR');
      expect(util.currencyOf({ settings: {} })).toBe('INR');
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });

  it('web: account currency, picker options and symbol', () => {
    setAccountCurrency(undefined);
    expect(accountCurrency()).toBe('INR');
    expect(currencySymbol()).toBe('₹');
    expect(currencyOptions()[0]).toBe('INR');
    expect(currencyOptions('NOK')).toContain('NOK');
    setAccountCurrency('USD');
    expect(currencySymbol()).toBe('$');
    setAccountCurrency('INR');
  });
});

describe('Currency setting (Settings → Company)', () => {
  let t: Awaited<ReturnType<typeof startTestApp>>;
  beforeAll(async () => {
    t = await startTestApp();
    await t.setup();
  });
  afterAll(() => t.close());

  it('is validated, saved and reported in /api/me', async () => {
    expect((await t.api.patch('/api/location', { settings: { currency: 'XYZ' } })).status).toBe(400);
    const r = await t.api.patch('/api/location', { settings: { currency: 'inr' } });
    expect(r.status).toBe(200);
    expect(r.data.settings.currency).toBe('INR');
    expect((await t.api.get('/api/me')).data.locations[0].currency).toBe('INR');
  });

  it('new products, invoices, deals and ticket events start in the account currency', async () => {
    const product = (await t.api.post('/api/products', { name: 'Wedding film', price_cents: 5000000 })).data;
    expect(product.currency).toBe('INR');

    const invoice = (await t.api.post('/api/invoices', { title: 'Shoot', items: [{ name: 'Day rate', qty: 1, price_cents: 2500000 }] })).data;
    expect(invoice.currency).toBe('INR');

    const pipe = (await t.api.get('/api/pipelines')).data[0];
    const deal = (await t.api.post('/api/opportunities', { pipeline_id: pipe.id, contact: { email: 'client@example.in', first_name: 'Asha' }, value: 150000 })).data;
    expect(deal.currency).toBe('INR');

    const ev = (await t.api.post('/api/ticket-events', { name: 'Film workshop', starts_at: '2027-01-15T10:00:00.000Z' })).data;
    expect(ev.currency).toBe('INR');
  });

  it('an explicit currency still wins', async () => {
    const product = (await t.api.post('/api/products', { name: 'Export licence', price_cents: 10000, currency: 'USD' })).data;
    expect(product.currency).toBe('USD');
  });

  it('switching the setting changes what new records get', async () => {
    await t.api.patch('/api/location', { settings: { currency: 'AED' } });
    const product = (await t.api.post('/api/products', { name: 'Dubai shoot', price_cents: 10000 })).data;
    expect(product.currency).toBe('AED');
    await t.api.patch('/api/location', { settings: { currency: 'INR' } });
  });
});
