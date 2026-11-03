import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import { Icon } from '../icons';
import { useSession } from '../session';
import { navigate, useRoute } from '../ui';
import { journeyStatus, toursForPath, tourById } from './catalog';
import { accessOf, startTour } from './engine';
import { FIRST_TOUR } from './learn';
import { useAcademy } from './progress';
import { useTourText } from './text';
import type { Tour } from './types';

/** „?“ in the top bar: the tours for the page you are on, „Weitermachen“ and the way to the academy. */
export function HelpButton() {
  const t = useT('b3tour');
  const tt = useTourText();
  const session = useSession();
  const route = useRoute();
  const academy = useAcademy();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const access = accessOf(session);
  const path = route.join('/') || (session.user.role === 'admin' ? 'agency' : 'dashboard');
  const tours = toursForPath(path, access).slice(0, 5);
  const progress = academy?.tours ?? {};
  const active = academy?.active ? tourById(academy.active.tour) : undefined;
  const journey = journeyStatus(progress, access);
  // „In 10 Minuten startklar“ until the first tour is done (unless the page offers it anyway).
  const first = !progress[FIRST_TOUR]?.done && !tours.some((t) => t.id === FIRST_TOUR) ? tourById(FIRST_TOUR) : undefined;

  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', off);
    window.addEventListener('keydown', esc);
    return () => (document.removeEventListener('mousedown', off), window.removeEventListener('keydown', esc));
  }, [open]);

  const begin = (t: Tour, step = 0) => {
    setOpen(false);
    startTour(t.id, step);
  };
  const resumeStep = (t: Tour) => {
    const p = progress[t.id];
    return p && !p.done && p.step > 0 && p.step < p.total - 1 ? p.step : 0;
  };

  return (
    <div className="help-wrap" ref={ref}>
      <button className="btn secondary small help-btn" data-tour="help" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={t('Hilfe und Touren')} title={t('Hilfe: geführte Tour für diese Seite')}>
        <Icon name="help" size={16} />
      </button>
      {open && (
        <div className="help-pop" role="dialog" aria-label={t('Hilfe')}>
          <div className="help-head">
            <strong>{t('Hilfe zu dieser Seite')}</strong>
            <button className="icon-btn" onClick={() => setOpen(false)} aria-label={t('Schließen')}>
              ✕
            </button>
          </div>
          {active && (
            <button className="help-row resume" onClick={() => begin(active, academy!.active!.step)}>
              <Icon name="play" size={15} />
              <span className="grow">
                {t('Weitermachen: {title}', { title: tt(active.title) })}
                <small>{t('Schritt {n}', { n: academy!.active!.step + 1 })}</small>
              </span>
            </button>
          )}
          {first && (
            <button className="help-row" onClick={() => begin(first, resumeStep(first))} data-tour="help-first-tour">
              <Icon name="academy" size={15} />
              <span className="grow">
                {t('Lernen: In 10 Minuten startklar')}
                <small>{t('Geführte Tour „{title}“ · ca. {n} Min.', { title: tt(first.title), n: first.minutes })}</small>
              </span>
              <Icon name="play" size={14} className="ico muted" />
            </button>
          )}
          {tours.length ? (
            tours.map((tr) => (
              <button key={tr.id} className="help-row" onClick={() => begin(tr, resumeStep(tr))}>
                <Icon name={tr.icon} size={15} />
                <span className="grow">
                  {tt(tr.title)}
                  <small>
                    {t('{steps} Schritte · ca. {n} Min.', { steps: tr.steps.length, n: tr.minutes })}
                    {progress[tr.id]?.done ? ` · ${t('✓ erledigt')}` : resumeStep(tr) ? ` · ${t('angefangen')}` : ''}
                  </small>
                </span>
                <Icon name="play" size={14} className="ico muted" />
              </button>
            ))
          ) : (
            <p className="muted small" style={{ margin: '6px 10px' }}>
              {t('Für diese Seite gibt es keine eigene Tour – in der Akademie findest du alle.')}
            </p>
          )}
          {journey.next && (
            <button className="help-row" onClick={() => begin(journey.next!, resumeStep(journey.next!))}>
              <Icon name="trophy" size={15} />
              <span className="grow">
                {t('Gesamt-Guide „Firma übernehmen“')}
                <small>{t('{done}/{total} Kapitel · weiter mit {title}', { done: journey.done, total: journey.total, title: tt(journey.next.title) })}</small>
              </span>
            </button>
          )}
          <a
            className="help-all"
            href="/app/academy"
            onClick={(e) => {
              e.preventDefault();
              setOpen(false);
              navigate('academy');
            }}
          >
            {t('Alle Touren in der Akademie →')}
          </a>
        </div>
      )}
    </div>
  );
}

/** A clear hint while you are in the practice sub-account. */
export function SandboxBanner() {
  const t = useT('b3tour');
  const session = useSession();
  const academy = useAcademy();
  if (!academy?.sandbox || academy.sandbox.id !== session.locationId) return null;
  return (
    <div className="sandbox-banner" data-tour="sandbox-banner">
      <Icon name="academy" size={16} />
      <span className="grow">
        <strong>{t('Übungs-Firma:')}</strong> {t('Hier ist alles erfunden – probier ruhig alles aus.')}<span className="sb-more"> {t('E-Mails und SMS werden nur gespeichert, nie verschickt.')}</span>
      </span>
      <a
        href="/app/academy"
        onClick={(e) => {
          e.preventDefault();
          navigate('academy');
        }}
      >
        {t('Zur Akademie')}
      </a>
    </div>
  );
}
