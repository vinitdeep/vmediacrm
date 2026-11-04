import { useRef, useState } from 'react';
import { ArrowDown, ArrowRight, ChevronRight, Clock3, CloudUpload, FileStack, FolderOpen, MessageSquare, Grid2X2, HardDrive, LayoutList, Plus, Search, ShieldCheck, Sparkles, Upload, X } from 'lucide-react';
import './office.css';
import { ago, api } from '../api';
import { useT } from '../i18n';
import { Badge, Empty, Field, Input, Modal, Spinner, act, navigate, pressable, toastError, useLoad } from '../ui';
import { ACCEPT, MIME, OFFICE_KINDS, postBytes, sizeLabel, type OfficeFileRow, type OfficeKind, type OfficeStatus } from './office-kit';
import { Faces, KindIcon, SetupNote, kindLabels, useOpenBy } from './OfficeParts';
import { OfficeFile } from './OfficeFile';

/**
 * Office: documents, spreadsheets, presentations and PDFs of the sub-account – list with filters, new and upload; one file opens in
 * OfficeFile.tsx (editor, versions, comments, AI). Server contract and setup: docs/office.md.
 */

function NewDialog({ kind, onClose }: { kind: OfficeKind; onClose: () => void }) {
  const t = useT('office');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const title = { docx: t('Neues Dokument'), xlsx: t('Neue Tabelle'), pptx: t('Neue Präsentation'), pdf: t('Neues PDF') }[kind];
  const create = async () => {
    setBusy(true);
    const f = await act(() => api.post<OfficeFileRow>('/api/office/files', { kind, name: name.trim() || undefined }), t('Angelegt'));
    setBusy(false);
    if (f) {
      onClose();
      navigate(`office/${f.id}`);
    }
  };
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={onClose}>
            {t('Abbrechen')}
          </button>
          <button className="btn" disabled={busy} onClick={create} data-tour="office-create">
            {t('Anlegen')}
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <Field label={t('Name')}>
          <Input value={name} onChange={setName} autoFocus placeholder={title} maxLength={150} />
        </Field>
      </form>
    </Modal>
  );
}

function OfficeList() {
  const t = useT('office');
  const labels = kindLabels(t);
  const [kind, setKind] = useState<'' | OfficeKind>('');
  const [q, setQ] = useState('');
  const [newKind, setNewKind] = useState<OfficeKind | null>(null);
  const [uploading, setUploading] = useState(false);
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [sort, setSort] = useState('recent');
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const status = useLoad<OfficeStatus>(() => api.get('/api/office/status'), []);
  const overview = useLoad<OfficeFileRow[]>(() => api.get('/api/office/files?limit=200'), []);
  const list = useLoad<OfficeFileRow[]>(() => api.get(`/api/office/files?${new URLSearchParams({ ...(kind ? { kind } : {}), ...(q.trim() ? { q: q.trim() } : {}), limit: '200' })}`), [kind, q]);
  const open = useOpenBy();

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    let last: OfficeFileRow | undefined;
    for (const f of [...files]) {
      const ext = f.name.toLowerCase().split('.').pop() as OfficeKind;
      if (!OFFICE_KINDS.includes(ext)) {
        toastError(new Error(t('„{name}“: nur .docx, .xlsx, .pptx oder .pdf', { name: f.name })));
        continue;
      }
      try {
        last = await postBytes<OfficeFileRow>('/api/office/files', f, { name: f.name, kind: ext, mime: f.type || MIME[ext] });
      } catch (e) {
        toastError(e);
      }
    }
    setUploading(false);
    if (fileInput.current) fileInput.current.value = '';
    void list.reload();
    void overview.reload();
    if (last && files.length === 1) navigate(`office/${last.id}`);
  };

  const all = overview.data ?? [];
  const rows = [...(list.data ?? [])].sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : Date.parse(b.updated_at) - Date.parse(a.updated_at));
  const recent = [...all].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)).slice(0, 3);
  const descriptions = { docx: t('Worte werden Ideen.'), xlsx: t('Zahlen mit Überblick.'), pptx: t('Ideen, die überzeugen.'), pdf: t('Alles im richtigen Format.') };
  const singular = { docx: t('Dokument'), xlsx: t('Tabelle'), pptx: t('Präsentation'), pdf: t('PDF') };
  const used = status.data?.limits.used_bytes ?? 0;
  const quota = status.data?.limits.quota_bytes;
  const storagePercent = quota ? Math.min(100, used / quota * 100) : 0;
  const fileCard = (f: OfficeFileRow) => (
    <button key={f.id} className={`of-file-card of-tone-${f.kind}`} onClick={() => navigate(`office/${f.id}`)} aria-label={t('{name} öffnen', { name: f.name })}>
      <div className="of-preview"><FileArtwork kind={f.kind} /><span className="of-format">{f.kind.toUpperCase()}</span><span className="of-preview-open"><ArrowRight size={18} /></span></div>
      <div className="of-card-info"><span className="of-card-title"><KindIcon kind={f.kind} /><strong>{f.name}</strong></span><span className="of-card-meta">{ago(f.updated_at)}<span>·</span>{sizeLabel(f.size)}<span className="of-card-version">v{f.version}</span></span></div>
    </button>
  );
  return (
    <div className="of-page of-dashboard" onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragging(true); } }} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }} onDrop={(e) => { e.preventDefault(); setDragging(false); if (!uploading) void upload(e.dataTransfer.files); }}>
      {dragging && <div className="of-drop-overlay"><CloudUpload size={48} /><strong>{t('Dateien hier ablegen')}</strong><span>{t('DOCX · XLSX · PPTX · PDF')}</span></div>}
      <header className="of-topline">
        <div>
          <span className="of-eyebrow"><span className="of-brand-mark"><FolderOpen size={15} /></span>{t('DEIN KREATIVER ARBEITSPLATZ')}</span>
          <h1>{t('Platz für deine nächste große Idee.')}<span className="of-title-dot">.</span></h1>
          <p>{t('Gute Ideen verdienen einen eigenen Platz.')}</p>
        </div>
        <div className="of-topline-actions">
          <button className="btn secondary of-upload-btn" disabled={uploading} onClick={() => fileInput.current?.click()} data-tour="office-upload"><Upload size={16} />{uploading ? t('Lädt hoch …') : t('Hochladen')}</button>
          <button className="btn" onClick={() => setNewKind('docx')}><Plus size={16} />{t('Neues Dokument')}</button>
        </div>
      </header>
      <input ref={fileInput} type="file" accept={ACCEPT} multiple hidden onChange={(e) => void upload(e.target.files)} aria-label={t('Dateien hochladen')} />
      <div className="of-hero-layout">
        <section className="of-hero" aria-labelledby="of-hero-title">
          <div className="of-hero-copy">
            <span className="of-hero-label"><Sparkles size={13} />{t('WENIGER SUCHEN. MEHR SCHAFFEN.')}</span>
            <h2 id="of-hero-title">{t('Vom ersten Entwurf')}<br />{t('bis zur letzten Präsentation.')}</h2>
            <p>{t('Raum für die nächste große Idee')}</p>
            <button className="btn" onClick={() => setNewKind('docx')}>{t('Neues Dokument')}<ArrowRight size={14} /></button>
          </div>
          <div className="of-hero-art" aria-hidden="true"><img src="/studio/workspace-art.png" alt="" /></div>
        </section>
        <aside className="of-workspace-summary" aria-label={t('Dein Arbeitsbereich')}>
          <h2>{t('Dein Arbeitsbereich')}</h2>
          <div className="of-summary-tiles">
            <div><FileStack /><strong>{overview.loading ? '—' : all.length}</strong><span>{t('Alle Dateien')}</span></div>
            <div><MessageSquare /><strong>{overview.loading ? '—' : all.reduce((sum, f) => sum + (f.open_comments ?? 0), 0)}</strong><span>{t('Kommentare')}</span></div>
            <div><Clock3 /><strong>{overview.loading ? '—' : all.filter((f) => !!f.lock).length}</strong><span>{t('In Bearbeitung')}</span></div>
          </div>
          <div className="of-summary-storage"><strong>{t('Speicherplatz')}</strong><span>{status.data ? t('Speicher: {used} von {quota}', { used: sizeLabel(used), quota: quota ? sizeLabel(quota) : t('unbegrenzt') }) : '—'}</span><div className="of-storage-meter" role="meter" aria-label={t('Speicherplatz')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={storagePercent}><span style={{ width: `${Math.max(storagePercent, 1)}%` }} /></div></div>
        </aside>
      </div>
      <section className="of-create-section" aria-labelledby="of-create-title" data-tour="office-new"><div className="of-section-heading"><h2 id="of-create-title">{t('Etwas Neues beginnt hier')}</h2><span>{t('Ein Klick. Unendlich viele Möglichkeiten.')}</span></div><div className="of-create-grid">{OFFICE_KINDS.map((k, i) => <button key={k} className={`of-create-card of-tone-${k}`} style={{ animationDelay: `${i * 55}ms` }} onClick={() => k === 'pdf' ? fileInput.current?.click() : setNewKind(k)}><span className="of-create-icon"><KindIcon kind={k} size={25} /></span><span><strong>{singular[k]}</strong><small>{descriptions[k]}</small></span><Plus className="of-create-plus" size={17} /></button>)}</div></section>
      {!!recent.length && <section className="of-recent-section" aria-labelledby="of-recent-title"><div className="of-section-heading"><h2 id="of-recent-title"><Clock3 size={16} />{t('Zuletzt bearbeitet')}</h2><span>{t('Mach dort weiter, wo du aufgehört hast.')}</span></div><div className="of-recent-grid">{recent.map(fileCard)}{recent.length < 3 && <button className="of-upload-card" disabled={uploading} onClick={() => fileInput.current?.click()}><span className="of-upload-cloud"><CloudUpload size={29} /></span><strong>{uploading ? t('Lädt hoch …') : t('Platz für dein nächstes Projekt')}</strong><span>{t('Dateien ablegen oder zum Hochladen klicken')}</span><small>{t('DOCX · XLSX · PPTX · PDF')}{status.data ? ' · ' + t('höchstens {max} je Datei', { max: sizeLabel(status.data.limits.max_bytes) }) : ''}</small></button>}</div></section>}
      <section className="of-library" aria-labelledby="of-library-title"><div className="of-section-heading"><h2 id="of-library-title">{t('Alle Dateien')}<span className="of-count">{all.length}</span></h2><div className="of-library-actions"><label className="of-sort"><ArrowDown size={13} /><select value={sort} onChange={(e) => setSort(e.target.value)} aria-label={t('Dateien sortieren')}><option value="recent">{t('Zuletzt geändert')}</option><option value="name">{t('Name')}</option></select></label><div className="of-view-toggle"><button aria-label={t('Listenansicht')} aria-pressed={view === 'list'} onClick={() => setView('list')}><LayoutList size={16} /></button><button aria-label={t('Rasteransicht')} aria-pressed={view === 'grid'} onClick={() => setView('grid')}><Grid2X2 size={16} /></button></div></div></div>
        <div className="of-library-toolbar"><div className="of-kind-tabs" role="group" aria-label={t('Dateityp')} >{(['', ...OFFICE_KINDS] as const).map((k) => <button key={k} aria-pressed={kind === k} onClick={() => setKind(k)}>{k ? <KindIcon kind={k} size={14} /> : <FolderOpen size={14} />}{k ? labels[k] : t('Alle')}<span>{k ? all.filter((f) => f.kind === k).length : all.length}</span></button>)}</div><label className="of-search-wrap"><Search size={15} /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Dateien suchen …')} aria-label={t('Dateien suchen')} />{q && <button onClick={() => setQ('')} aria-label={t('Suche löschen')}><X size={13} /></button>}</label></div>
        {list.error ? <div className="of-load-error" role="alert"><p>{list.error}</p><button className="btn secondary" onClick={() => void list.reload()}>{t('Erneut versuchen')}</button></div> : list.loading && !list.data ? <Spinner /> : !rows.length ? <Empty tour="office-empty" action={<button className="btn" onClick={() => q || kind ? (setQ(''), setKind('')) : setNewKind('docx')}>{q || kind ? t('Filter zurücksetzen') : t('Neues Dokument')}</button>}>{q || kind ? t('Keine passenden Dateien.') : t('Noch keine Dateien – lege ein Dokument an oder lade eine Datei hoch.')}</Empty> : view === 'grid' ? <div className="of-files-grid">{rows.map(fileCard)}</div> : <div className="table-wrap"><table className="t of-table"><thead><tr><th>{t('Name')}</th><th>{t('Verknüpft mit')}</th><th>{t('Geändert')}</th><th>{t('Status')}</th><th><span className="of-sr-only">{t('Version')}</span></th></tr></thead><tbody>{rows.map((f) => {
          const here = open.filter((p) => p.page === `/office/${f.id}`);
          return <tr key={f.id} className="click" {...pressable(() => navigate(`office/${f.id}`))} aria-label={t('{name} öffnen', { name: f.name })}><td><span className={`of-name of-tone-${f.kind}`}><span className="of-row-icon"><KindIcon kind={f.kind} size={20} /></span><span><strong>{f.name}</strong><small>{f.kind.toUpperCase()}<span>·</span>{sizeLabel(f.size)}</small></span></span></td><td className="muted">{[f.contact_name, f.deal_name].filter(Boolean).join(' · ') || '—'}</td><td><span className="of-updated">{ago(f.updated_at)}<small>{f.updated_by_name}</small></span></td><td>{f.lock ? <Badge tone="yellow">{t('{name} bearbeitet', { name: f.lock.user_name })}</Badge> : <span className="of-ready"><span />{t('Bereit')}</span>}{!!f.open_comments && <Badge tone="blue">{t.plural(f.open_comments, { one: '{n} Kommentar', other: '{n} Kommentare' })}</Badge>}<Faces list={here} label={t('Gerade geöffnet von {names}', { names: here.map((p) => p.name).join(', ') })} /></td><td><span className="of-row-end">v{f.version}<ChevronRight size={16} /></span></td></tr>;
        })}</tbody></table></div>}
        <footer className="of-library-footer"><span><ShieldCheck size={13} />{t('Versionen und Kommentare bleiben bei jeder Datei.')}</span><span>{t.plural(rows.length, { one: '{n} Datei', other: '{n} Dateien' })}</span></footer>
      </section>
      <div className="of-bottom"><div className="of-storage"><HardDrive size={17} /><div><strong>{t('Speicherplatz')}</strong><span>{status.data ? t('Speicher: {used} von {quota}', { used: sizeLabel(used), quota: quota ? sizeLabel(quota) : t('unbegrenzt') }) : '—'}</span></div><div className="of-storage-meter" role="meter" aria-label={t('Speicherplatz')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={storagePercent}><span style={{ width: `${Math.max(storagePercent, 1)}%` }} /></div></div><span className="of-bottom-note"><Sparkles size={14} />{t('Für Ideen gemacht. Für Teams gedacht.')}</span></div>
      {status.data && <details className="of-setup-details"><summary>{t('Editor-Verfügbarkeit')}<ChevronRight size={13} /></summary><SetupNote status={status.data} /></details>}
      {newKind && <NewDialog kind={newKind} onClose={() => setNewKind(null)} />}
    </div>
  );
}

/** Decorative, deliberately abstract file illustrations; never presented as file contents. */
function FileArtwork({ kind }: { kind: OfficeKind }) {
  return <div className={`of-paper of-paper-${kind}`} aria-hidden="true"><span className="of-paper-logo"><KindIcon kind={kind} size={17} /></span><div className="of-paper-heading" /><div className="of-paper-subheading" />{kind === 'xlsx' ? <div className="of-paper-cells">{Array.from({ length: 24 }, (_, i) => <i key={i} />)}</div> : kind === 'pptx' ? <div className="of-paper-chart">{[40, 65, 48, 85, 100].map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</div> : <><div className="of-paper-feature" /><div className="of-paper-lines"><i /><i /><i /><i /></div></>}<span className="of-paper-footer" /></div>;
}

export function Office({ id }: { id?: string }) {
  return id ? <OfficeFile id={id} /> : <OfficeList />;
}
