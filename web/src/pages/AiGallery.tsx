import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { Badge, Modal, Spinner, act } from '../ui';
import { SignupLink } from '../referrals';
import { FILTERS, PINNED, SUB_PRESETS, filterPresets } from './ai-gallery-filter';
import './AiGallery.css';
import { useT } from '../i18n';

/**
 * The provider gallery of Einstellungen → KI-Anbieter: search, filters (EU-Hosting, günstig, schnell, lokal, Abo-Anmeldung) and the
 * kind of provider, a card per preset with "Konto anlegen ↗" (the partner-link mechanism of modules/referrals.ts), an "EU-Hosting"
 * badge where the provider's own documentation says where data is processed, and the live model list with prices per million tokens.
 */

const KINDS: [string, string][] = [
  ['', 'Alle'],
  ['text', 'Text-Modelle'],
  ['local', 'Lokal & Proxy'],
  ['media', 'Bild, Video & Audio'],
  ['voice', 'Sprache'],
  ['custom', 'Eigene'],
];
const usd = (v?: number) => (v === undefined || v === null ? '–' : `$${v.toLocaleString('de-DE', { minimumFractionDigits: v < 1 ? 2 : 2, maximumFractionDigits: 4 })}`);
const tokens = (n?: number) => (n ? (n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Mio.` : `${Math.round(n / 1000).toLocaleString('de-DE')} Tsd.`) : '–');

export function Gallery({ presets, capLabels, onPick, onSubscription }: { presets: any[]; capLabels: Record<string, string>; onPick: (p: any) => void; onSubscription: (kind: 'chatgpt' | 'claude') => void }) {
  const t = useT('b4ai');
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const shown = useMemo(() => filterPresets(presets, { q, kind, tags }), [presets, q, kind, tags]);
  const toggle = (t: string) => setTags((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]));
  const subCards = (!kind || kind === 'text') && tags.every((t) => t === 'sub') && !q.trim();
  return (
    <>
      <div className="aig-toolbar" data-tour="aig-filters">
        <input type="search" className="aig-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Anbieter suchen …')} aria-label={t('Anbieter suchen')} />
      </div>
      <div className="aig-chips" role="group" aria-label={t('Filter')}>
        <span className="lbl">{t('Filter')}</span>
        {FILTERS.map(([k, l]) => (
          <button key={k} type="button" className={`aig-chip${k === 'eu' ? ' eu' : ''}`} aria-pressed={tags.includes(k)} onClick={() => toggle(k)} data-tour={k === 'eu' ? 'aig-eu' : undefined}>
            {t(l)}
          </button>
        ))}
      </div>
      <div className="aig-chips" role="group" aria-label={t('Art des Anbieters')}>
        <span className="lbl">{t('Art')}</span>
        {KINDS.map(([k, l]) => (
          <button key={k} type="button" className="aig-chip" aria-pressed={kind === k} onClick={() => setKind(k)}>
            {t(l)}
          </button>
        ))}
      </div>
      <div className="aig-count" aria-live="polite">
        {shown.length} {t('von')} {presets.length} {t('Anbietern')}
      </div>
      <div className="aig-grid" data-tour="aic-presets">
        {subCards && (
          <>
            <div className="aig-card pinned">
              <button type="button" className="aig-main" onClick={() => onSubscription('chatgpt')}>
                <span className="aig-name">
                  {t('Mit ChatGPT anmelden')}
                  <span className="aig-badges">
                    <span className="aig-badge sub">{t('Abo-Anmeldung')}</span>
                  </span>
                </span>
                <span className="aig-meta">{t('Dein ChatGPT-Plan statt API-Schlüssel – persönlich, für deinen Agenten, Assistenten und die Werkstatt.')}</span>
              </button>
            </div>
            <div className="aig-card pinned">
              <button type="button" className="aig-main" onClick={() => onSubscription('claude')}>
                <span className="aig-name">
                  {t('Mit Claude verbinden')}
                  <span className="aig-badges">
                    <span className="aig-badge sub">{t('Abo-Anmeldung')}</span>
                  </span>
                </span>
                <span className="aig-meta">{t('Claude Code auf deinem Rechner mit deinem Pro- oder Max-Abo (Bridge).')}</span>
              </button>
            </div>
          </>
        )}
        {shown.map((p) => (
          <div key={p.id} className={`aig-card${PINNED.includes(p.id) ? ' pinned' : ''}`}>
            <button type="button" className="aig-main" onClick={() => onPick(p)}>
              <span className="aig-name">
                {p.label}
                <span className="aig-badges">
                  {PINNED.includes(p.id) && <span className="aig-badge pin">{t('Empfohlen')}</span>}
                  {p.eu && (
                    <span className="aig-badge eu" title={t('{note} Quelle: {source}', { note: p.eu.note, source: p.eu.source })} data-tour="aig-eu-badge">
                      {t('EU-Hosting ·')} {p.eu.region}
                    </span>
                  )}
                  {SUB_PRESETS.has(p.id) && <span className="aig-badge sub">{t('Abo möglich')}</span>}
                  {p.local && <span className="aig-badge">{t('lokal')}</span>}
                  {(p.tags ?? []).includes('cheap') && <span className="aig-badge">{t('günstig')}</span>}
                  {(p.tags ?? []).includes('fast') && <span className="aig-badge">{t('schnell')}</span>}
                  {(p.tags ?? []).includes('gateway') && <span className="aig-badge">{t('Gateway')}</span>}
                  {(p.realtime?.audio_tts || p.realtime?.stt) && <span className="aig-badge">{t('Live')}</span>}
                </span>
              </span>
              <span className="aic-caps">
                {p.capabilities.map((c: string) => (
                  <span key={c} className="aic-cap">
                    {capLabels[c] ?? c}
                  </span>
                ))}
              </span>
              <span className="aig-meta">
                {p.group === 'text' || p.group === 'local' ? t('Richtwert ≈ {input} / {output} je 1 Mio. Tokens · ', { input: usd(p.price.input), output: usd(p.price.output) }) : ''}
                {p.key_required ? p.key_hint : t('Schlüssel optional')}
              </span>
            </button>
            <div className="aig-foot">
              <SignupLink id={p.referral || p.id} />
              {p.docs && (
                <a href={p.docs} target="_blank" rel="noopener noreferrer">
                  {t('Doku ↗')}
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
      {!shown.length && !subCards && <div className="aig-empty">{t('Kein Anbieter passt zu dieser Suche. Jede OpenAI-kompatible Adresse geht auch mit „Benutzerdefiniert“.')}</div>}
    </>
  );
}

/** Live model list of a connection with context size and prices per million tokens (where the provider's list has them). */
export function ModelsModal({ conn, preset, onClose, onChanged }: { conn: any; preset: any; onClose: () => void; onChanged: () => void }) {
  const t = useT('b4ai');
  const [q, setQ] = useState('');
  const [r, setR] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const load = async (refresh = false, text = q) => {
    setLoading(true);
    try {
      setR(await api.get(`/api/ai-connections/${conn.id}/models?${refresh ? 'refresh=1&' : ''}q=${encodeURIComponent(text)}`));
    } catch (e) {
      setR({ models: [], details: [], total: 0, live: false, error: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    const t = setTimeout(() => void load(false, q), q ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  const rows: any[] = r ? (r.details?.length ? r.details : (r.models ?? []).map((id: string) => ({ id }))) : [];
  const priced = rows.some((m) => m.in !== undefined);
  const current = conn.models?.text;
  const use = async (id: string) => {
    if (await act(() => api.patch(`/api/ai-connections/${conn.id}`, { models: { ...conn.models, text: id } }), t('„{id}“ ist jetzt das Standard-Modell', { id }))) onChanged();
  };
  return (
    <Modal title={t('Modelle von {provider}', { provider: conn.label || preset?.label || conn.provider })} onClose={onClose} wide>
      <div className="aim-bar">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Modell suchen …')} aria-label={t('Modell suchen')} />
        <button className="btn secondary aisub-btn" onClick={() => void load(true)} disabled={loading}>
          {loading ? t('Lade …') : t('Neu laden')}
        </button>
      </div>
      {r?.error && <p className="aisub-err">{t('Liste nicht verfügbar:')} {r.error}</p>}
      {r && !r.live && !r.error && <p className="aisub-note">{t('Dieser Anbieter hat keine Modell-Liste per Schnittstelle – hier stehen Vorschläge. Jede Modell-ID kannst du im Verbindungsformular selbst eintippen.')}</p>}
      {r?.live && !priced && <p className="aisub-note">{t('Dieser Anbieter nennt in seiner Liste keine Preise. Eigene Preise (für die Kostenschätzung) trägst du im Formular unter „Erweitert“ ein.')}</p>}
      {!r ? (
        <Spinner />
      ) : (
        <>
          <div className="aim-wrap">
            <table className="aim-table">
              <thead>
                <tr>
                  <th>{t('Modell')}</th>
                  <th className="num">{t('Kontext')}</th>
                  <th className="num">{t('Eingabe je 1 Mio.')}</th>
                  <th className="num">{t('Ausgabe je 1 Mio.')}</th>
                  <th>{t('Merkmale')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id}>
                    <td className="id aim-id">
                      {m.id}
                      {m.name && m.name !== m.id && <div className="aisub-note">{m.name}</div>}
                    </td>
                    <td className="num">{tokens(m.context)}</td>
                    <td className="num">{m.free ? t('kostenlos') : usd(m.in)}</td>
                    <td className="num">{m.free ? t('kostenlos') : usd(m.out)}</td>
                    <td>
                      {m.vision && <Badge tone="blue">{t('Bilder')}</Badge>} {m.tools && <Badge tone="green">{t('Werkzeuge')}</Badge>}
                    </td>
                    <td className="num">
                      {conn.editable && (m.id === current ? <Badge tone="green">{t('Standard')}</Badge> : <button className="btn secondary aisub-btn" onClick={() => void use(m.id)}>{t('Als Standard')}</button>)}
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={6} className="muted">
                      {t('Keine Treffer.')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="aisub-note" style={{ marginTop: 8 }}>
            {r.total > rows.length ? t('{length} von {total} Modellen – oben suchen, um die Liste einzugrenzen. ', { length: rows.length, total: r.total }) : t('{length} Modelle. ', { length: rows.length })}
            {t('Preise in US-Dollar je eine Million Tokens, wie der Anbieter sie nennt; die Kostenschätzung in V Media CRM nutzt sie, solange du keine eigenen einträgst.')}
          </p>
        </>
      )}
    </Modal>
  );
}

