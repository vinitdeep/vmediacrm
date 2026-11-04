import { FONT_FAMILIES, type FontFamily } from '../../../server/services/appearance-model';

export const FONT_NAMES: Record<FontFamily, string> = {
  inter: 'Inter',
  'plus-jakarta-sans': 'Plus Jakarta Sans',
  manrope: 'Manrope',
  'dm-sans': 'DM Sans',
  'source-sans-3': 'Source Sans 3',
  'public-sans': 'Public Sans',
  'nunito-sans': 'Nunito Sans',
  'work-sans': 'Work Sans',
  roboto: 'Roboto',
  'open-sans': 'Open Sans',
};

export const fontStack = (id: FontFamily) => `"${FONT_NAMES[id]} Variable", "Inter Variable", system-ui, sans-serif`;

/** Only allowlisted names reach generated CSS; an unset choice preserves the design's typography. */
export function fontFamilyCss(id: string | undefined): string {
  if (!FONT_FAMILIES.includes(id as FontFamily)) return '';
  return `@media screen{:root[data-font-family='${id}']{--font-sans:${fontStack(id as FontFamily)};--font-display:var(--font-sans);--studio-display:var(--font-sans)}}`;
}

const loaders: Partial<Record<FontFamily, () => Promise<unknown>>> = {
  manrope: () => import('@fontsource-variable/manrope/wght.css'),
  'dm-sans': () => import('@fontsource-variable/dm-sans/wght.css'),
  'source-sans-3': () => import('@fontsource-variable/source-sans-3/wght.css'),
  'public-sans': () => import('@fontsource-variable/public-sans/wght.css'),
  'nunito-sans': () => import('@fontsource-variable/nunito-sans/wght.css'),
  'work-sans': () => import('@fontsource-variable/work-sans/wght.css'),
  roboto: () => import('@fontsource-variable/roboto/wght.css'),
  'open-sans': () => import('@fontsource-variable/open-sans/wght.css'),
};
const pending = new Map<string, Promise<unknown>>();

/** Inter and Jakarta are already bundled. Other font files load only when selected or previewed. */
export function loadFontFamily(id: string | undefined): Promise<unknown> {
  const load = loaders[id as FontFamily];
  if (!load) return Promise.resolve();
  if (!pending.has(id!)) pending.set(id!, load().catch((error) => { pending.delete(id!); throw error; }));
  return pending.get(id!)!;
}
