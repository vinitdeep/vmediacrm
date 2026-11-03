import { useEffect, useState } from 'react';
import { dt } from '../api';
import { Badge, Modal, Spinner, act } from '../ui';
import { EXISTING_LABELS, JOB_STATUS, type Job, type ReportRow, type UmzugApi } from './umzug-format';
import { useT } from '../i18n';

/** Schritt 4 des Umzugs: Fortschritt, Bericht, Pausieren/Fortsetzen, Rückgängig – und die Liste der letzten Umzüge. */

export const isLive = (j?: Pick<Job, 'status'> | null) => j?.status === 'running' || j?.status === 'undoing';

export function ReportTable({ rows }: { rows: ReportRow[] }) {
  const t = useT('b7umzug');
  if (!rows.length) return <p className="muted">{t('Es gab nichts zu übernehmen.')}</p>;
  return (
    <div className="table-wrap" data-tour="um-report">
      <table className="t um-report">
        <thead>
          <tr>
            <th>{t('Was')}</th>
            <th className="num">{t('Neu')}</th>
            <th className="num">{t('Aktualisiert')}</th>
            <th className="num">{t('Übersprungen')}</th>
            <th className="num">{t('Fehler')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td>{r.label}</td>
              <td className="num">{r.created}</td>
              <td className="num">{r.updated}</td>
              <td className="num">{r.skipped}</td>
              <td className={`num${r.failed ? ' um-bad' : ''}`}>{r.failed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UndoModal({ job, onClose, onConfirm }: { job: Job; onClose: () => void; onConfirm: () => void }) {
  const t = useT('b7umzug');
  return (
    <Modal
      title={t('Umzug rückgängig machen?')}
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={onClose}>
            Abbrechen
          </button>
          <button className="btn danger" onClick={onConfirm} data-tour="um-undo-confirm">
            {t('Rückgängig machen')}
          </button>
        </>
      }
    >
      <p>
        {t('Alles, was der Umzug aus {source_label}', { source_label: job.source_label })} <strong>{t('neu angelegt')}</strong> {t('hat, wird wieder gelöscht. Kontakte, die es schon gab und die der Umzug nur ergänzt hat, bekommen ihre alten Werte zurück.')}
      </p>
      <p className="muted small">{t('Bleiben dürfen: Kontakte, an denen du nach dem Umzug selbst etwas geändert hast, Tags und Felder, die inzwischen anderswo benutzt werden, und aktivierte Automationen. Der Bericht danach nennt alles, was stehen blieb.')}</p>
    </Modal>
  );
}

export function UmzugRun({ api, jobId, first, onJob, onImport, onNew }: { api: UmzugApi; jobId: string; first?: Job; onJob: () => void; onImport: (dryRun: Job) => void; onNew: () => void }) {
  const t = useT('b7umzug');
  const [job, setJob] = useState<Job | undefined>(first);
  const [undo, setUndo] = useState(false);
  const [busy, setBusy] = useState(false);
  const live = isLive(job);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      const j = await api.get<Job>(`/api/umzug/jobs/${jobId}`).catch(() => null);
      if (!stop && j) {
        setJob(j);
        return j;
      }
    };
    void load();
    return () => {
      stop = true;
    };
  }, [jobId]);
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(async () => {
      const j = await api.get<Job>(`/api/umzug/jobs/${jobId}`).catch(() => null);
      if (j) {
        setJob(j);
        if (!isLive(j)) onJob();
      }
    }, 1500);
    return () => clearInterval(timer);
  }, [jobId, live]);

  if (!job) return <Spinner />;
  const run = async (path: string) => {
    setBusy(true);
    const r = await act(() => api.post<Job>(`/api/umzug/jobs/${jobId}/${path}`));
    setBusy(false);
    if (r) {
      setJob((cur) => (cur ? { ...cur, status: path === 'pause' ? cur.status : path === 'undo' ? 'undoing' : 'running' } : cur));
      onJob();
    }
  };
  const [statusText, tone] = JOB_STATUS[job.status] ?? [job.status, 'gray' as const];
  const dry = job.kind === 'dry_run';
  const undoing = job.status === 'undoing';

  return (
    <div className="um-run">
      <div className="card" data-tour="um-progress">
        <div className="um-run-head">
          <div>
            <h3>
              {t('{kind} aus {source}', { kind: dry ? t('Probelauf') : t('Umzug'), source: job.source_label })} <Badge tone={tone}>{undoing ? t('wird rückgängig gemacht') : t(statusText)}</Badge>
            </h3>
            <div className="muted small">
              {t('Gestartet {v1}', { v1: dt(job.created_at) })}
              {job.finished_at ? t(' · fertig {v1}', { v1: dt(job.finished_at) }) : ''}
            </div>
          </div>
          <div className="um-actions">
            {job.status === 'running' && (
              <button className="btn secondary" disabled={busy} onClick={() => void run('pause')} data-tour="um-pause">
                {t('Pausieren')}
              </button>
            )}
            {(job.status === 'interrupted' || (job.status === 'failed' && !job.undone_at)) && !job.undo && (
              <button className="btn" disabled={busy} onClick={() => void run('resume')} data-tour="um-resume">
                {t('Fortsetzen')}
              </button>
            )}
          </div>
        </div>
        {(live || job.status === 'interrupted') && (
          <>
            <div className="um-bar" role="progressbar" aria-valuenow={job.percent} aria-valuemin={0} aria-valuemax={100} aria-label={t('Fortschritt')}>
              <div style={{ width: `${Math.max(live ? 3 : 0, job.percent)}%` }} />
            </div>
            <p className="muted small">
              {undoing ? t('Das Angelegte wird wieder entfernt …') : job.step_label ? `${job.step_label}: ${job.processed}${job.total ? t(' von {total}', { total: job.total }) : ''}` : t('Startet …')}
            </p>
          </>
        )}
        {!undoing && job.steps.length > 0 && (
          <div className="um-chips">
            {job.steps.map((s) => (
              <span key={s.id} className={`um-chip${s.done ? ' done' : s.id === job.step && live ? ' now' : ''}`}>
                {s.done ? '✓ ' : ''}
                {s.label}
              </span>
            ))}
          </div>
        )}
        {job.error && <p className="um-err">{job.error}</p>}
        {job.status === 'interrupted' && <p className="muted small">{t('Pausiert – mit „Fortsetzen“ geht es an derselben Stelle weiter. Schon Übernommenes wird nicht doppelt angelegt.')}</p>}
      </div>

      {!live && (
        <div className="card">
          <h3>{dry ? t('So würde der Import aussehen') : t('Ergebnis')}</h3>
          {dry && <p className="muted small">{t('Im Probelauf wurde nichts geschrieben. Gelesen werden höchstens die ersten Datensätze jedes Teils, die Zahlen sind deshalb nur ein Ausschnitt.')}</p>}
          <ReportTable rows={job.report} />
          {job.undo && (
            <div className="um-undone">
              <h4>{t('Rückgängig gemacht')}</h4>
              <ul>
                {Object.entries(job.undo.deleted).map(([k, n]) => (
                  <li key={k}>
                    {t('{n} {v2} gelöscht', { n, v2: t(EXISTING_LABELS[k] ?? k) })}
                  </li>
                ))}
                {job.undo.restored > 0 && <li>{t('{restored} Kontakte auf den alten Stand zurückgesetzt', { restored: job.undo.restored })}</li>}
                {Object.entries(job.undo.kept).map(([k, n]) => (
                  <li key={k}>
                    {t('{n} {v2} bleiben stehen (inzwischen verändert oder in Benutzung)', { n, v2: t(EXISTING_LABELS[k] ?? k) })}
                  </li>
                ))}
                {job.undo.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="um-actions">
            {dry && job.status === 'done' && (
              <button className="btn" onClick={() => onImport(job)} data-tour="um-start">
                {t('Jetzt importieren')}
              </button>
            )}
            {!dry && ['done', 'failed', 'interrupted'].includes(job.status) && (
              <button className="btn secondary" disabled={busy} onClick={() => setUndo(true)} data-tour="um-undo">
                {t('Umzug rückgängig machen')}
              </button>
            )}
            <button className="btn ghost" onClick={onNew}>
              {t('Neuer Umzug')}
            </button>
          </div>
        </div>
      )}

      {!!job.warnings?.length && (
        <div className="card um-warn" data-tour="um-warnings">
          <h3>{t('Hinweise ({length})', { length: job.warnings.length })}</h3>
          <ul>
            {job.warnings.slice(0, 12).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
          {job.warnings.length > 12 && (
            <details>
              <summary>{t('Alle {length} Hinweise zeigen', { length: job.warnings.length })}</summary>
              <ul>
                {job.warnings.slice(12).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {!!job.log?.length && (
        <details className="um-log">
          <summary>{t('Protokoll ({length} Zeilen)', { length: job.log.length })}</summary>
          <pre>{job.log.join('\n')}</pre>
        </details>
      )}
      {undo && (
        <UndoModal
          job={job}
          onClose={() => setUndo(false)}
          onConfirm={() => {
            setUndo(false);
            void run('undo');
          }}
        />
      )}
    </div>
  );
}

export function UmzugHistory({ jobs, onOpen }: { jobs: Job[]; onOpen: (j: Job) => void }) {
  const t = useT('b7umzug');
  if (!jobs.length) return null;
  return (
    <div className="card" data-tour="um-history">
      <h3>{t('Letzte Umzüge')}</h3>
      <div className="table-wrap">
        <table className="t">
          <thead>
            <tr>
              <th>{t('Wann')}</th>
              <th>Quelle</th>
              <th>{t('Art')}</th>
              <th>Status</th>
              <th>{t('Ergebnis')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => {
              const [text, tone] = JOB_STATUS[j.status] ?? [j.status, 'gray' as const];
              const total = j.report.reduce((n, r) => n + r.created + r.updated, 0);
              return (
                <tr key={j.id}>
                  <td>{dt(j.created_at)}</td>
                  <td>{j.source_label}</td>
                  <td>{j.kind === 'dry_run' ? t('Probelauf') : j.origin === 'file' ? t('Import (Datei)') : t('Import')}</td>
                  <td>
                    <Badge tone={tone}>{t(text)}</Badge>
                  </td>
                  <td className="muted small">{j.report.length ? t('{total} Datensätze', { total }) : j.error ? t('Fehler') : '–'}</td>
                  <td>
                    <button className="btn small secondary" onClick={() => onOpen(j)}>
                      Öffnen
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
