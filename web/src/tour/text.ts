import { tr, useT } from '../i18n';
import type { Tour } from './types';

/**
 * Guided-tour data (titles, summaries, step texts …) is German in `tour/content/*.ts` and doubles as the message id.
 * The English lives in three catalogs (toursA, toursB, toursC – one per translation batch; the key is the exact German
 * string). `tourText(s)` returns the English if one of them has it, else the German text.
 * In components call `useTourText()` – it also makes sure the three catalogs are loaded; `tourText` is for event handlers
 * and generators that run after a component has done so.
 */
const NAMESPACES = ['toursA', 'toursB', 'toursC'] as const;

type Translator = (s: string) => string;
const pick = (s: string, translators: Translator[]): string => {
  if (!s) return s;
  for (const t of translators) {
    const r = t(s);
    if (r !== s) return r;
  }
  return s;
};

/** In a component: translates a tour string; waits (inside Suspense) until the tour catalogs are loaded. */
export function useTourText(): (s: string) => string {
  const ts: Translator[] = [useT('toursA'), useT('toursB'), useT('toursC')];
  return (s) => pick(s, ts);
}

/** Outside components: the same, with the language active at call time. */
export function tourText(s: string): string {
  return pick(s, NAMESPACES.map((n) => tr(n)));
}

/** Everything of a tour a search should match – the German texts and their English. */
export function tourSearchText(t: Tour): string {
  const ts: Translator[] = NAMESPACES.map((n) => tr(n));
  return [t.title, t.summary, t.keywords ?? '', ...t.steps.map((s) => s.title)]
    .map((p) => (p ? `${p} ${pick(p, ts)}` : ''))
    .join(' ');
}
