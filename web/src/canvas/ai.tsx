import { useState } from 'react';
import { api } from '../api';
import { act, toast } from '../ui';
import { Icon } from '../icons';
import type { EditorApi } from './Editor';
import { useT } from '../i18n';

/** „KI zeichnen lassen“: prompt → diagram/mind map/wireframe; with a selection: explain, tasks, tidy up. */

const KINDS: [string, string][] = [
  ['auto', 'Automatisch'],
  ['flowchart', 'Flussdiagramm'],
  ['mindmap', 'Mindmap'],
  ['orgchart', 'Organigramm'],
  ['diagram', 'Diagramm'],
  ['wireframe', 'Wireframe'],
];

const IDEAS = ['Vertriebsprozess vom Lead bis zum Abschluss', 'Mindmap: Marketing-Ideen für den Herbst', 'Wireframe einer Landingpage für ein Webinar', 'Onboarding neuer Kunden als Flussdiagramm', 'Organigramm einer kleinen Agentur'];

export function AiBar({ api: ed, open, setOpen }: { api: EditorApi; open: boolean; setOpen: (v: boolean) => void }) {
  const t = useT('b4canvas');
  const [prompt, setPrompt] = useState('');
  const [kind, setKind] = useState('auto');
  const [busy, setBusy] = useState('');
  if (ed.readOnly) return null;
  const sel = ed.selection;
  const run = async (mode: 'draw' | 'explain' | 'tasks' | 'tidy') => {
    if (mode === 'draw' && !prompt.trim()) return;
    setBusy(mode === 'draw' ? 'KI zeichnet …' : mode === 'explain' ? 'KI liest …' : mode === 'tasks' ? 'KI legt Aufgaben an …' : t('Räumt auf …'));
    await ed.store.flush();
    const r = await act(() => api.post(`/api/canvas/${ed.board.id}/ai`, { mode, prompt: prompt.trim() || undefined, kind, ids: sel, clientId: ed.store.clientId, sketch: !!ed.defaults.sketch }));
    setBusy('');
    if (!r) return;
    if (mode === 'tidy') await ed.store.catchUp();
    else await ed.catchUpCreated();
    if (r.summary) toast(r.summary);
    if (mode === 'draw') {
      setPrompt('');
      setTimeout(() => ed.zoomTo(r.created), 50);
    }
  };
  return (
    <div className={`cv-ai cv-panel${open ? ' open' : ''}`} data-tour="canvas-ai">
      {!open ? (
        <button className="cv-ai-btn" onClick={() => setOpen(true)}>
          <Icon name="ai" /> {t('KI zeichnen lassen')}
        </button>
      ) : (
        <>
          <div className="cv-ai-row">
            <Icon name="ai" />
            <input
              autoFocus
              value={prompt}
              placeholder={sel.length ? t('Was soll mit der Auswahl passieren? Oder neu zeichnen …') : t('Was soll ich zeichnen? z. B. „Kundenreise für unseren Onlinekurs“')}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') void run('draw');
                if (e.key === 'Escape') setOpen(false);
              }}
              disabled={!!busy}
              data-tour="canvas-ai-input"
            />
            <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label={t('Art')} disabled={!!busy}>
              {KINDS.map(([k, l]) => (
                <option key={k} value={k}>
                  {t(l)}
                </option>
              ))}
            </select>
            <button className="btn small" onClick={() => void run('draw')} disabled={!!busy || !prompt.trim()}>
              {busy || t('Zeichnen')}
            </button>
            <button className="icon-btn" onClick={() => setOpen(false)} aria-label={t('Schließen')}>
              ✕
            </button>
          </div>
          <div className="cv-ai-chips">
            {sel.length > 0 ? (
              <>
                <span className="muted small">{sel.length} {t('ausgewählt:')}</span>
                <button className="cv-chip" onClick={() => void run('explain')} disabled={!!busy}>
                  {t('Auswahl erklären')}
                </button>
                <button className="cv-chip" onClick={() => void run('tasks')} disabled={!!busy}>
                  {t('In Aufgaben verwandeln')}
                </button>
                <button className="cv-chip" onClick={() => void run('tidy')} disabled={!!busy}>
                  {t('Layout aufräumen')}
                </button>
              </>
            ) : (
              <>
                {IDEAS.slice(0, 3).map((i) => (
                  <button key={i} className="cv-chip" onClick={() => setPrompt(t(i))} disabled={!!busy}>
                    {t(i)}
                  </button>
                ))}
                <button className="cv-chip" onClick={() => void run('tidy')} disabled={!!busy} title={t('Ordnet verbundene Formen automatisch an')}>
                  {t('Layout aufräumen')}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
