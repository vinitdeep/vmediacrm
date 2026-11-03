import type { ReactNode } from 'react';
import type { Branding } from '../session';
import './login.css';

/**
 * The split layout of the sign-in screens (pages/Login.tsx): brand panel left, the form card right, one column on phones.
 * A chunk of its own with its stylesheet – signed-in visits never need it, and the first download stays within its budget
 * (tests/bundle-budget.test.ts). Login.tsx starts loading it with the app and passes in every text (i18n namespace "login").
 */

export interface BrandCopy {
  eyebrow: string;
  headline: string;
  lede: string;
  points: [kind: string, title: string, text: string][];
}

/** The decorative art of the brand panel: a lens with its aperture rings and a film strip running through the glow. */
function BrandArt() {
  const holes = Array.from({ length: 14 }, (_, i) => i);
  return (
    <svg className="login-art" viewBox="0 0 600 600" aria-hidden="true" focusable="false">
      <g className="login-art-lens" fill="none">
        <circle cx="430" cy="170" r="150" />
        <circle cx="430" cy="170" r="112" />
        <circle cx="430" cy="170" r="74" />
        <path d="M430 96 L494 133 L494 207 L430 244 L366 207 L366 133 Z" />
        <path d="M418 140 L456 170 L418 200 Z" className="login-art-play" />
      </g>
      <g className="login-art-strip" transform="rotate(-14 300 470)">
        <rect x="-60" y="420" width="760" height="96" rx="6" />
        {holes.map((i) => (
          <g key={i}>
            <rect x={-40 + i * 54} y="430" width="22" height="14" rx="3" className="login-art-hole" />
            <rect x={-40 + i * 54} y="492" width="22" height="14" rx="3" className="login-art-hole" />
          </g>
        ))}
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x={-20 + i * 150} y="452" width="132" height="32" rx="3" className="login-art-frame" />
        ))}
      </g>
    </svg>
  );
}

function PointIcon({ kind }: { kind: string }) {
  const p = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (kind === 'pipeline')
    return (
      <svg {...p}>
        <path d="M3 3v18h18" />
        <path d="m7 15 4-4 3 3 6-6" />
      </svg>
    );
  if (kind === 'production')
    return (
      <svg {...p}>
        <rect x="2" y="6" width="14" height="12" rx="2" />
        <path d="m16 10 6-3v10l-6-3" />
      </svg>
    );
  return (
    <svg {...p}>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** `mark`: the square icon shown when there is no wide logo (Login.tsx picks it – never an initial). */
export function Split({ branding, mark, copy, wide, children }: { branding: Branding; mark: string; copy: BrandCopy; wide?: boolean; children: ReactNode }) {
  // The panel is always dark: take the logo made for dark surfaces when there is one.
  const logo = branding.logo_dark_url || branding.logo_url;
  return (
    <div className="login login-split">
      <aside className="login-brand">
        <BrandArt />
        <div className="login-brand-top">
          {logo ? (
            <img src={logo} alt={branding.name} className="login-brand-logo" />
          ) : (
            <span className="login-brand-id">
              <img src={mark} alt="" className="login-icon" width={40} height={40} />
              {branding.show_name !== 'no' && <span className="login-brand-name">{branding.name}</span>}
            </span>
          )}
        </div>
        <div className="login-brand-body">
          <p className="login-eyebrow">{copy.eyebrow}</p>
          <h2 className="login-headline">{copy.headline}</h2>
          <p className="login-lede">{copy.lede}</p>
          <ul className="login-points">
            {copy.points.map(([k, title, text]) => (
              <li key={k} data-point={k}>
                <span className="login-point-ico" aria-hidden="true">
                  <PointIcon kind={k} />
                </span>
                <span>
                  <strong>{title}</strong>
                  <span>{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="login-brand-foot">
          © {new Date().getFullYear()} {branding.name}
        </p>
      </aside>
      <main className="login-main">
        <div className={`card login-card${wide ? ' login-card-wide' : ''}`}>{children}</div>
      </main>
    </div>
  );
}
