import type { ReactNode } from 'react';
import { Link } from '../ui';
import './safety.css';
import { useT } from '../i18n';

/**
 * The "Sicherheitsnetz" in the UI: the badge row of a plugin version (static checks, self-tests, review, second
 * opinion, signature, model and Denkstufe), the notice for a model that is too weak for the Werkstatt, the signature
 * notice of an imported bundle and the small "Pro" mark. All facts come from the server; nothing is decided here.
 */

export interface VersionBadgesData {
  static: boolean;
  tests: boolean | null;
  tests_detail: string;
  review: { verdict: 'pass' | 'warn' | 'fail'; model: string } | null;
  second_opinion: { verdict: 'pass' | 'warn' | 'fail'; model: string } | null;
  signature: { state: string; label: string; gohigh: boolean } | null;
  model: string;
  effort: string;
  effort_note: string;
}
export interface DiffData {
  from: string;
  to: string;
  summary: string[];
}
export interface ModelGateData {
  enabled: boolean;
  ok: boolean;
  model: string;
  matched: string;
  message: string;
  link: string;
  via: string;
  stage1_normal: boolean;
  plan_model: string;
  plan_ok: boolean;
  families: { id: string; label: string; on: boolean }[];
  review: { model: string; ok: boolean; differs: boolean };
  effort: { requested: string; applied: string | null; label: string; note: string };
}
export interface SignatureData {
  state: 'signed' | 'untrusted' | 'invalid' | 'unsigned';
  key_id: string;
  label: string;
  gohigh: boolean;
  warning: string;
}

const VERDICT: Record<string, string> = { pass: 'bestanden', warn: 'mit Hinweisen', fail: 'durchgefallen' };
const tone = (v: string) => (v === 'pass' ? 'ok' : v === 'warn' ? 'warn' : 'bad');

export function Chip({ kind = '', title, children }: { kind?: 'ok' | 'warn' | 'bad' | 'muted' | ''; title?: string; children: ReactNode }) {
  return (
    <span className={`wk-chip ${kind}`} title={title}>
      {children}
    </span>
  );
}

export const ProMark = () => {
  const t = useT('b7werk');
  return (
  <span className="wk-pro" title={t('Pro-Funktion (Lizenz nötig)')}>
    {t('Pro')}
  </span>
);
};

/** static ✓ · Tests ✓ · Prüfung bestanden · Zweitmeinung … · von V Media CRM signiert · Modell · Denkstufe */
export function VersionBadges({ b }: { b?: VersionBadgesData }) {
  const t = useT('b7werk');
  if (!b) return null;
  return (
    <div className="wk-vbadges" data-tour="wk-version-badges">
      <Chip kind={b.static ? 'ok' : 'bad'} title={t('Statische Prüfung: verbotene Zugriffe, externe Adressen, Berechtigungen')}>
        {b.static ? '✓' : '✗'} {t('statisch')}
      </Chip>
      <Chip kind={b.tests === null ? 'muted' : b.tests ? 'ok' : 'bad'} title={b.tests_detail || t('Automatischer Selbsttest in der Sandbox')}>
        {b.tests === null ? '–' : b.tests ? '✓' : '✗'} {t('Tests')}
      </Chip>
      <Chip kind={b.review ? tone(b.review.verdict) : 'muted'} title={b.review ? t('Sicherheitsprüfung durch {model}', { model: b.review.model }) : t('Noch nicht geprüft (nur nötig vor dem Veröffentlichen)')}>
        {b.review ? (b.review.verdict === 'pass' ? '✓' : b.review.verdict === 'warn' ? '!' : '✗') : '–'} {t('Prüfung')}{b.review ? ` ${t(VERDICT[b.review.verdict])}` : ''}
      </Chip>
      {b.second_opinion && (
        <Chip kind={tone(b.second_opinion.verdict)} title={t('Zweitmeinung von {model}', { model: b.second_opinion.model })}>
          {b.second_opinion.verdict === 'pass' ? '✓' : b.second_opinion.verdict === 'warn' ? '!' : '✗'} {t('Zweitmeinung {v1}', { v1: t(VERDICT[b.second_opinion.verdict]) })}
        </Chip>
      )}
      {b.signature && (
        <Chip kind={b.signature.state === 'signed' ? 'ok' : b.signature.state === 'invalid' ? 'bad' : 'warn'} title={b.signature.label || undefined}>
          {b.signature.state === 'signed' ? (b.signature.gohigh ? t('✓ von V Media CRM signiert') : t('✓ signiert ({v1})', { v1: b.signature.label || t('bekannter Schlüssel') })) : t('ungeprüft')}
        </Chip>
      )}
      {b.model && (
        <Chip title={b.effort_note || undefined}>
          {b.model}
          {b.effort ? t(' · Denkstufe {effort}', { effort: b.effort }) : ''}
        </Chip>
      )}
    </div>
  );
}

export function DiffList({ d }: { d?: DiffData | null }) {
  const t = useT('b7werk');
  if (!d?.summary?.length) return null;
  return (
    <ul className="wk-diff" aria-label={t('Änderungen von {from} zu {to}', { from: d.from, to: d.to })}>
      {d.summary.map((s) => (
        <li key={s}>{s}</li>
      ))}
    </ul>
  );
}

/** The model that serves the Werkstatt, and – when it is too weak – the plain German refusal with the link. */
export function ModelGateNotice({ gate, compact }: { gate?: ModelGateData; compact?: boolean }) {
  const t = useT('b7werk');
  if (!gate) return null;
  if (gate.ok) {
    return compact ? null : (
      <p className="wk-ai" data-tour="wk-model">
        {t('Modell: {model}', { model: gate.model })}
        {gate.matched && gate.enabled ? ` (${gate.matched})` : ''} {t('· Denkstufe')} {gate.effort.label || t('nicht gesendet')}
        {gate.effort.note ? ` – ${gate.effort.note}` : ''}
      </p>
    );
  }
  // The server message ends with the path of the settings page in brackets; here it is a button instead.
  const text = gate.message.replace(/\s*\(\/app\/[^)]*\)/, '');
  return (
    <div className="card wk-gate" role="alert" data-tour="wk-model">
      <strong>{text}</strong>
      <div className="actions">
        <Link to={gate.link.replace(/^\/app\//, '')} className="btn secondary small">
          {t('Zu den KI-Anbietern')}
        </Link>
      </div>
      {gate.stage1_normal && <p className="muted small" style={{ margin: '6px 0 0' }}>{t('Einrichtungen (Stufe 1, ohne Code) lassen sich trotzdem planen und bauen.')}</p>}
    </div>
  );
}

/** "Modell · Denkstufe" of a build or version, with the note when the level was lowered. */
export function AiLine({ ai }: { ai?: { model?: string; label?: string; note?: string } | null }) {
  const t = useT('b7werk');
  if (!ai?.model) return null;
  return (
    <p className="wk-ai">
      {t('KI: {model}', { model: ai.model })}
      {ai.label ? t(' · Denkstufe {label}', { label: ai.label }) : ''}
      {ai.note ? ` (${ai.note})` : ''}
    </p>
  );
}

/** Signature of an imported bundle: signed, unknown signer, forged or none ("ungeprüft"). */
export function SignatureNotice({ sig, proRequired }: { sig?: SignatureData; proRequired?: boolean }) {
  const t = useT('b7werk');
  if (!sig) return null;
  const good = sig.state === 'signed';
  return (
    <div className={`wk-sig ${good ? 'good' : sig.state === 'invalid' ? 'bad' : 'warn'}`} role={good ? 'status' : 'alert'} data-tour="wk-signature">
      {good ? (
        <>
          <strong>{sig.gohigh ? t('✓ Von V Media CRM signiert') : t('✓ Signiert von {v1}', { v1: sig.label || sig.key_id })}</strong>
          <div className="muted small">{t('Die Signatur stimmt mit dem Inhalt überein.')}{sig.gohigh ? t(' Installieren signierter Plugins ist eine Pro-Funktion.') : ''}{proRequired ? t(' – Dafür ist eine Pro-Lizenz nötig, sie fehlt hier.') : ''}</div>
        </>
      ) : (
        <>
          <strong>{sig.state === 'invalid' ? t('Signatur ungültig') : t('Ungeprüft')}</strong>
          <div className="small">{sig.warning}</div>
        </>
      )}
    </div>
  );
}
