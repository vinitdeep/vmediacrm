import { useState } from 'react';
import { api, ago, dt } from '../api';
import { Icon } from '../icons';
import { Empty, Modal, Spinner, confirmAsk, toastError, useLoad } from '../ui';
import { Mini, cellsOfSpec } from './Mini';
import type { BoardFull, BoardState, Catalogue, VersionItem } from './types';
import { useT } from '../i18n';

const VIA: Record<string, string> = { session: 'Editor', agent: 'V Media CRM Agent', mcp: 'MCP', api_key: 'API-Schlüssel', voice: 'Sprache' };
const KIND: Record<string, string> = { create: 'Angelegt', template: 'Aus Vorlage', edit: 'Bearbeitet', agent: 'Per Wunsch', undo: 'Rückgängig', redo: 'Wiederhergestellt', restore: 'Zurückgeholt' };

function Preview({ boardId, n, catalogue }: { boardId: string; n: number; catalogue: Catalogue | null }) {
  const t = useT('b4boards');
  const { data, error } = useLoad(() => api.get<{ state: BoardState }>(`/api/boards/${boardId}/versions/${n}`), [boardId, n]);
  if (error) return <p className="bd-hint bad">{error}</p>;
  if (!data) return <Spinner />;
  return (
    <div className="bd-hist-prev">
      <Mini cells={cellsOfSpec(data.state.spec.widgets)} accent={data.state.accent} catalogue={catalogue} />
      <p className="muted small">
        {data.state.name} · {data.state.spec.widgets.length} {t('Widgets')}
      </p>
    </div>
  );
}

/** Every change of the board as a version: who, when, what – look at it, go back to it. Restoring is itself a version, so nothing is ever lost. */
export function History({ board, catalogue, canEdit, onRestore, onClose }: { board: BoardFull; catalogue: Catalogue | null; canEdit: boolean; onRestore: (n: number) => Promise<unknown>; onClose: () => void }) {
  const t = useT('b4boards');
  const { data, error, loading, reload } = useLoad(() => api.get<{ versions: VersionItem[] }>(`/api/boards/${board.id}/versions?limit=100`), [board.id, board.version]);
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={t('Verlauf')} onClose={onClose} wide>
      <div className="bd-hist" data-tour="board-history">
        <p className="muted small">{t('Jede Änderung ist eine Version – auch die per Sprache oder durch den Agenten. Zurückholen legt den alten Stand als neue Version an.')}</p>
        {error && <p className="bd-error">{error}</p>}
        {loading && !data && <Spinner />}
        {data && !data.versions.length && <Empty>{t('Noch keine Änderungen.')}</Empty>}
        <ol className="bd-hist-list">
          {data?.versions.map((v) => (
            <li key={v.n} className={v.current ? 'current' : ''}>
              <div className="bd-hist-row">
                <span className="bd-hist-n">v{v.n}</span>
                <div className="bd-hist-main">
                  <b>{v.summary || t(KIND[v.kind] || v.kind)}</b>
                  {v.prompt && <q>{v.prompt}</q>}
                  <span className="muted small">
                    {t(KIND[v.kind] ?? v.kind)} · {v.actor}
                    {VIA[v.via] && v.via !== 'session' ? ` (${t(VIA[v.via])})` : ''} · <span title={dt(v.at)}>{ago(v.at)}</span> · {v.widgets} {t('Widgets')}
                  </span>
                </div>
                <span className="bd-hist-tools">
                  {v.current ? (
                    <span className="bd-badge tone-green">{t('Aktuell')}</span>
                  ) : (
                    <>
                      <button type="button" className="btn ghost small" onClick={() => setOpen(open === v.n ? null : v.n)} aria-expanded={open === v.n}>
                        <Icon name="eye" size={14} /> {open === v.n ? t('Verbergen') : t('Ansehen')}
                      </button>
                      {canEdit && (
                        <button
                          type="button"
                          className="btn secondary small"
                          disabled={busy}
                          onClick={async () => {
                            if (!confirmAsk(t('Das Board auf Version {n} zurücksetzen? Der jetzige Stand bleibt im Verlauf erhalten.', { n: v.n }))) return;
                            setBusy(true);
                            try {
                              await onRestore(v.n);
                              await reload();
                            } catch (e) {
                              toastError(e);
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          <Icon name="history" size={14} /> {t('Zurückholen')}
                        </button>
                      )}
                    </>
                  )}
                </span>
              </div>
              {open === v.n && <Preview boardId={board.id} n={v.n} catalogue={catalogue} />}
            </li>
          ))}
        </ol>
      </div>
    </Modal>
  );
}
