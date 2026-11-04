import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FONT_FAMILIES, PREF_DEFAULTS, cleanPrefs, effectivePrefs } from '../server/services/appearance-model';
import { fontFamilyCss } from '../web/src/theme/typography';
import { startTestApp } from './helpers';

describe('font family preferences', () => {
  it('keeps existing accounts on their design typography and preserves text size independently', () => {
    expect(effectivePrefs({}, { font: 'large' }, {}, false)).toMatchObject({ font: 'large', font_family: '' });
    expect(PREF_DEFAULTS.font_family).toBe('');
    expect(fontFamilyCss('')).toBe('');
  });

  it('allows ten distinct families and refuses arbitrary CSS or unknown fonts', () => {
    expect(new Set(FONT_FAMILIES).size).toBe(10);
    for (const family of FONT_FAMILIES) expect(cleanPrefs({ font_family: family })).toEqual({ font_family: family });
    for (const value of ['comic-sans', 'Inter; color:red', 1]) expect(() => cleanPrefs({ font_family: value })).toThrow();
    expect(fontFamilyCss("inter']{color:red}")).toBe('');
    expect(fontFamilyCss('manrope')).toContain('--studio-display:var(--font-sans)');
  });

  it('honors the agency typography lock and still permits admin overrides', () => {
    const defaults = { font_family: 'inter' as const };
    const own = { font_family: 'manrope' as const };
    expect(effectivePrefs(defaults, own, { density: true }, false).font_family).toBe('inter');
    expect(effectivePrefs(defaults, own, { density: true }, true).font_family).toBe('manrope');
  });
});

describe('saved font selection API', () => {
  let t: Awaited<ReturnType<typeof startTestApp>>;
  beforeAll(async () => { t = await startTestApp(); await t.setup(); });
  afterAll(() => t?.close());

  it('persists every choice independently of font size and supports restoring the default', async () => {
    await t.api.patch('/api/appearance', { font: 'large' });
    for (const family of FONT_FAMILIES) {
      const saved = await t.api.patch('/api/appearance', { font_family: family });
      expect(saved.status).toBe(200);
      expect((await t.api.get('/api/appearance')).data.effective).toMatchObject({ font_family: family, font: 'large' });
    }
    const reset = await t.api.patch('/api/appearance', { font_family: '' });
    expect(reset.status).toBe(200);
    expect(reset.data.effective.font_family).toBe('');
    expect((await t.api.patch('/api/appearance', { font_family: 'not-a-font' })).status).toBe(400);
  });
});
