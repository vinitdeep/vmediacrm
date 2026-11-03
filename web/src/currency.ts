/**
 * The account's currency (Settings → Company → Currency). New products, invoices, deals, tickets … start in it, and
 * amounts that carry no currency of their own are shown in it. Set from /api/me when the app starts or the
 * sub-account changes; V Media CRM defaults to Indian rupees.
 */
export const DEFAULT_CURRENCY = 'INR';
/** The currencies offered in the pickers (same list as the server's CURRENCIES in server/core/util.ts). */
export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD', 'CHF', 'JPY'];
export const CURRENCY_NAMES: Record<string, string> = {
  INR: 'Indian rupee (₹)',
  USD: 'US dollar ($)',
  EUR: 'Euro (€)',
  GBP: 'British pound (£)',
  AED: 'UAE dirham (AED)',
  SGD: 'Singapore dollar (S$)',
  AUD: 'Australian dollar (A$)',
  CAD: 'Canadian dollar (C$)',
  CHF: 'Swiss franc (CHF)',
  JPY: 'Japanese yen (¥)',
};

let current = DEFAULT_CURRENCY;
const valid = (c: unknown): c is string => typeof c === 'string' && /^[A-Z]{3}$/.test(c);

/** The signed-in sub-account's currency. */
export const accountCurrency = () => current;
export function setAccountCurrency(c: unknown) {
  current = valid(c) ? c : DEFAULT_CURRENCY;
}
/** A record's currency, else the account's. */
export const currencyOr = (c: unknown) => (valid(c) ? c : current);
/** Picker options: the list, plus a record's own currency when it is not in it. */
export const currencyOptions = (own?: string | null) => [...new Set([...CURRENCIES, ...(valid(own) ? [own] : [])])];
/** Intl locale for an amount: rupees in Indian grouping (₹1,23,456.00), others in the UI's locale. */
export const moneyLocaleFor = (currency: string, uiLocale: string) => (currency === 'INR' ? 'en-IN' : uiLocale);

const symbols = new Map<string, string>();
/** "₹" / "€" / "$" – the account currency's narrow symbol (English labels write ¤ where it goes: "Price (¤)"). */
export function currencySymbol(c = current): string {
  let s = symbols.get(c);
  if (s === undefined) {
    try {
      s = new Intl.NumberFormat('en-IN', { style: 'currency', currency: c, currencyDisplay: 'narrowSymbol' }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? c;
    } catch {
      s = c;
    }
    symbols.set(c, s);
  }
  return s;
}
