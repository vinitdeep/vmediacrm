import { useEffect, useRef, useState } from 'react';
import { FONT_FAMILIES, type FontFamily, type Prefs } from '../../../server/services/appearance-model';
import { useT } from '../i18n';
import { toastError } from '../ui';
import { update } from './store';
import { FONT_NAMES, fontStack, loadFontFamily } from './typography';
import './font-picker.css';

export function FontPicker({ value, locked }: { value: Prefs['font_family']; locked: boolean }) {
  const t = useT('b7theme');
  const [busy, setBusy] = useState(false);
  const grid = useRef<HTMLDivElement>(null);
  const focusChoice = useRef<FontFamily | null>(null);
  useEffect(() => {
    if (!busy && focusChoice.current) {
      grid.current?.querySelectorAll<HTMLButtonElement>('[role=radio]')[FONT_FAMILIES.indexOf(focusChoice.current)]?.focus();
      focusChoice.current = null;
    }
  }, [busy]);
  useEffect(() => {
    // This component is on the lazy Appearance page. Preview faces do not burden other routes.
    for (const id of FONT_FAMILIES) void loadFontFamily(id).catch(() => {});
  }, []);
  const choose = async (id: FontFamily | '', keepFocus = false) => {
    if (locked || busy) return;
    if (keepFocus && id) focusChoice.current = id;
    setBusy(true);
    try {
      await loadFontFamily(id);
      await update({ font_family: id });
    } catch (error) {
      toastError(error);
    } finally {
      setBusy(false);

    }
  };
  return (
    <>
      <div className="ap-font-toolbar">
        <span className="muted small">{t('Aktuell: {name}', { name: value ? FONT_NAMES[value] : t('Design-Standard') })}</span>
        <button type="button" className="btn secondary small" disabled={locked || busy || !value} onClick={() => void choose('')}>{t('Design-Schrift wiederherstellen')}</button>
      </div>
      <div ref={grid} className="ap-font-grid" role="radiogroup" aria-label={t('Schriftart')} aria-busy={busy}>
        {FONT_FAMILIES.map((id, index) => (
          <button
            type="button"
            key={id}
            className={`ap-font-card${value === id ? ' on' : ''}`}
            style={{ fontFamily: fontStack(id) }}
            role="radio"
            aria-label={FONT_NAMES[id]}
            aria-checked={value === id}
            disabled={locked || busy}
            tabIndex={value === id || (!value && index === 0) ? 0 : -1}
            onClick={() => void choose(id)}
            onKeyDown={(e) => {
              const step = ['ArrowRight', 'ArrowDown'].includes(e.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(e.key) ? -1 : 0; // i18n-ignore: keyboard event codes
              if (!step && !['Home', 'End'].includes(e.key)) return; // i18n-ignore: keyboard event codes
              e.preventDefault();
              const next = e.key === 'Home' ? 0 : e.key === 'End' ? FONT_FAMILIES.length - 1 : (index + step + FONT_FAMILIES.length) % FONT_FAMILIES.length;
              e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
              void choose(FONT_FAMILIES[next], true);
            }}
          >
            <span className="ap-font-card-head"><strong>{FONT_NAMES[id]}</strong><span className="ap-font-dot" aria-hidden="true">{value === id ? '✓' : ''}</span></span>
            <span className="ap-font-specimen" aria-hidden="true">{t('Aa')}</span>
            <span className="ap-font-sample">{t('Kontakte · Aufgaben · Umsatz')}</span>
            <span className="ap-font-numbers" aria-hidden="true">0123456789 · ₹ $ €</span>
          </button>
        ))}
      </div>
    </>
  );
}
