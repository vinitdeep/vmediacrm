import { useEffect, useMemo, useRef, useState } from 'react';
import { ago, api } from '../api';
import { Icon } from '../icons';
import { Badge, Check, Copy, Empty, Field, Input, Modal, PageHead, Select, Spinner, Tabs, Textarea, act, confirmAsk, navigate, toast, useLoad } from '../ui';
import { ACTIVE, ByokNotice, ResultPreview, STATUS_LABEL, STATUS_TONE, connsFor, costText, modelsFor, uploadInput, type Capability, type GenJob, type GenMeta } from './GenMediaKit';
import { useT } from '../i18n';

/**
 * KI-Studio (Marketing): images, videos, music, text-to-speech and transcription with the
 * sub-account's own provider keys (BYOK) – any model of fal.ai, kie.ai, Replicate, OpenAI, Gemini,
 * Stability, ElevenLabs, Runway, Luma, or any other service via an HTTP template ("Eigene Anbieter").
 */

type Tab = 'bild' | 'video' | 'audio' | 'sprache' | 'anbieter';
const TAB_CAP: Record<Exclude<Tab, 'anbieter' | 'sprache'>, Capability> = { bild: 'image', video: 'video', audio: 'audio_music' };
const PLACEHOLDER: Record<Capability, string> = {
  image: 'z. B. Produktfoto einer Kaffeetasse auf Holztisch, Morgenlicht, geringe Schärfentiefe',
  video: 'z. B. Langsame Kamerafahrt über ein Café am Morgen, Dampf steigt aus der Tasse, warmes Licht',
  audio_music: 'z. B. Fröhliche Akustik-Gitarre, 100 BPM, für ein Werbevideo, ohne Gesang',
  audio_tts: 'Der Text, der gesprochen werden soll …',
  stt: 'Optional: Fachbegriffe oder Namen, die vorkommen',
};

export function KiStudio({ tab: initial }: { tab?: string }) {
  const tx = useT('b6studio');
  const [tab, setTab] = useState<Tab>((['bild', 'video', 'audio', 'sprache', 'anbieter'].includes(initial ?? '') ? initial : 'bild') as Tab);
  const [speech, setSpeech] = useState<'audio_tts' | 'stt'>('audio_tts');
  const meta = useLoad(() => api.get<GenMeta>('/api/genmedia/meta'), []);
  const cap: Capability | null = tab === 'anbieter' ? null : tab === 'sprache' ? speech : TAB_CAP[tab];
  const go = (t: string) => {
    setTab(t as Tab);
    navigate(`ki-studio/${t}`);
  };
  return (
    <div className="gm-page">
      <PageHead title={tx('KI-Studio')} sub={tx('Bilder, Videos, Musik und Sprache – mit deinem eigenen KI-Anbieter und jedem Modell, das er anbietet.')} />
      <Tabs
        value={tab}
        onChange={go}
        tabs={[
          ['bild', tx('Bild')],
          ['video', tx('Video')],
          ['audio', tx('Audio')],
          ['sprache', tx('Sprache')],
          ['anbieter', tx('Eigene Anbieter')],
        ]}
      />
      {meta.loading && !meta.data ? (
        <Spinner />
      ) : tab === 'anbieter' ? (
        <Templates meta={meta.data} onChange={meta.reload} />
      ) : (
        <>
          {tab === 'sprache' && (
            <div className="actions" style={{ marginBottom: 12 }} data-tour="gm-speech-mode">
              <button type="button" className={`chip${speech === 'audio_tts' ? ' on' : ''}`} onClick={() => setSpeech('audio_tts')}>
                <Icon name="audio" size={14} /> {tx('Text in Sprache')}
              </button>
              <button type="button" className={`chip${speech === 'stt' ? ' on' : ''}`} onClick={() => setSpeech('stt')}>
                <Icon name="text" size={14} /> {tx('Sprache in Text')}
              </button>
            </div>
          )}
          <Studio key={cap} cap={cap!} meta={meta.data} />
        </>
      )}
    </div>
  );
}

function Studio({ cap, meta }: { cap: Capability; meta: GenMeta | undefined }) {
  const tx = useT('b6studio');
  const jobs = useLoad(() => api.get<GenJob[]>(`/api/genmedia/jobs?capability=${cap}&limit=40`), [cap]);
  const [prefill, setPrefill] = useState<GenJob | null>(null);
  // Refresh while something is running.
  const active = (jobs.data ?? []).some((j) => ACTIVE.includes(j.status));
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => void jobs.reload(), 3000);
    return () => clearTimeout(t);
  }, [active, jobs.data]);
  const conns = connsFor(meta, cap);
  return (
    <div className="gm-layout">
      <div className="card gm-form" data-tour="gm-form">
        {conns.length ? <Generator cap={cap} meta={meta!} prefill={prefill} onStarted={(j) => jobs.setData([j, ...(jobs.data ?? [])])} /> : <ByokNotice message={meta?.message} />}
      </div>
      <div className="gm-gallery" data-tour="gm-gallery">
        {jobs.loading && !jobs.data ? (
          <Spinner />
        ) : !(jobs.data ?? []).length ? (
          <Empty>{tx('Noch nichts erzeugt. Links beschreiben, was du brauchst – das Ergebnis erscheint hier und bleibt gespeichert.')}</Empty>
        ) : (
          <div className="gm-grid">
            {(jobs.data ?? []).map((j) => (
              <JobCard key={j.id} job={j} onChange={jobs.reload} onPrefill={() => setPrefill({ ...j })} onAdd={(nj) => jobs.setData([nj, ...(jobs.data ?? [])])} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Generator({ cap, meta, prefill, onStarted }: { cap: Capability; meta: GenMeta; prefill: GenJob | null; onStarted: (j: GenJob) => void }) {
  const tx = useT('b6studio');
  const conns = connsFor(meta, cap);
  const [connId, setConnId] = useState(conns[0]?.id ?? '');
  const conn = conns.find((c) => c.id === connId) ?? conns[0];
  const [f, setF] = useState<Record<string, any>>({ aspect_ratio: cap === 'video' ? '16:9' : cap === 'image' ? '1:1' : '' });
  const [ref, setRef] = useState<{ file: string; name: string; url: string; mime: string } | null>(null);
  const [kieTask, setKieTask] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const set = (p: Record<string, any>) => setF((x) => ({ ...x, ...p }));
  const listId = useRef(`gm-m-${Math.random().toString(36).slice(2)}`).current;
  const voiceList = useRef(`gm-v-${Math.random().toString(36).slice(2)}`).current;
  const models = modelsFor(meta, conn, cap);
  const voices = useLoad(() => (cap === 'audio_tts' && conn ? api.get<{ voices: { id: string; name: string; preview?: string }[] }>(`/api/genmedia/voices?connection_id=${encodeURIComponent(conn.id)}`).catch(() => ({ voices: [] })) : Promise.resolve({ voices: [] })), [cap, conn?.id]);
  const templates = meta.templates.filter((x) => x.capability === cap);
  const isKie = conn?.provider === 'kie';
  const isCustom = conn && !meta.providers.some((p) => p.id === conn.provider && p.id !== 'custom_http');

  useEffect(() => {
    if (!prefill) return;
    const i = prefill.input ?? {};
    if (conns.some((c) => c.id === prefill.connection_id)) setConnId(prefill.connection_id);
    setF({ model: prefill.model, prompt: i.prompt, negative_prompt: i.negative_prompt, aspect_ratio: i.aspect_ratio, duration: i.duration ?? '', seed: i.seed ?? '', voice: i.voice, language: i.language, params: i.params ? JSON.stringify(i.params, null, 2) : '', template_id: i.template_id ?? '' });
    toast(tx('Einstellungen übernommen – anpassen und neu generieren'));
  }, [prefill]);

  const pick = async (file: File) => {
    setUploading(true);
    const u = await uploadInput(file);
    setUploading(false);
    if (u) setRef(u);
  };
  const submit = async () => {
    let params: any;
    if (String(f.params ?? '').trim()) {
      try {
        params = JSON.parse(f.params);
      } catch {
        return void act(() => Promise.reject(new Error(tx('Erweiterte Parameter: kein gültiges JSON'))));
      }
    }
    let kie_task: any;
    if (isKie && kieTask) {
      try {
        kie_task = { endpoint: f.kie_endpoint, body: f.kie_body ? JSON.parse(f.kie_body) : {}, poll_path: f.kie_poll || undefined };
      } catch {
        return void act(() => Promise.reject(new Error(tx('Kie-Task: Body ist kein gültiges JSON'))));
      }
    }
    const refKey = cap === 'stt' ? 'audio_file' : 'image_file';
    const body = {
      capability: cap,
      connection_id: conn?.id,
      model: f.model || undefined,
      prompt: f.prompt,
      negative_prompt: f.negative_prompt || undefined,
      aspect_ratio: f.aspect_ratio || undefined,
      duration: f.duration || undefined,
      seed: f.seed === '' || f.seed === undefined ? undefined : Number(f.seed),
      voice: f.voice || undefined,
      language: f.language || undefined,
      params,
      kie_task,
      template_id: isCustom ? f.template_id || undefined : undefined,
      ...(ref ? { [refKey]: ref.file } : {}),
    };
    setBusy(true);
    const j = await act(() => api.post<GenJob>('/api/genmedia/jobs', body), tx('Auftrag gestartet'));
    setBusy(false);
    if (j) onStarted(j);
  };
  const needsPrompt = cap !== 'stt' && !kieTask;
  return (
    <>
      <div className="grid2">
        <Field label={tx('Anbieter')} tour="gm-connection">
          <Select value={conn?.id ?? ''} onChange={(v) => (setConnId(v), set({ model: '' }))} options={conns.map((c) => [c.id, `${c.label} (${c.provider})`])} />
        </Field>
        <Field label={tx('Modell')} tour="gm-model" hint={tx('Vorschlag oder jede Modell-ID des Anbieters')}>
          <input list={listId} value={f.model ?? ''} onChange={(e) => set({ model: e.target.value })} placeholder={models[0]?.id ?? conn?.model ?? tx('Modell-ID')} />
          <datalist id={listId}>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </datalist>
        </Field>
      </div>
      {isCustom && (
        <Field label={tx('HTTP-Vorlage')} tour="gm-template" hint={templates.length ? undefined : tx('Noch keine Vorlage – unter „Eigene Anbieter“ anlegen')}>
          <Select value={f.template_id ?? ''} onChange={(v) => set({ template_id: v })} placeholder={tx('Neueste Vorlage')} options={templates.map((x) => [x.id, x.name])} />
        </Field>
      )}
      {isKie && <Check checked={kieTask} onChange={setKieTask} label={tx('Kie-Task: eigenen Endpunkt mit JSON aufrufen')} tour="gm-kie-task" />}
      {isKie && kieTask && (
        <>
          <Field label={tx('Endpunkt')} hint={tx('z. B. /api/v1/veo/generate oder /api/v1/jobs/createTask')}>
            <Input value={f.kie_endpoint} onChange={(v) => set({ kie_endpoint: v })} placeholder={tx('/api/v1/jobs/createTask')} />
          </Field>
          <Field label={tx('JSON-Body')} hint={tx('callBackUrl setzt V Media CRM selbst')}>
            <Textarea className="mono" rows={5} value={f.kie_body} onChange={(v) => set({ kie_body: v })} placeholder={tx('{\n  "model": "google/nano-banana",\n  "input": { "prompt": "…" }\n}')} />
          </Field>
          <Field label={tx('Abfrage-Pfad (optional)')} hint={tx('Standard: /api/v1/jobs/recordInfo bzw. …/record-info')}>
            <Input value={f.kie_poll} onChange={(v) => set({ kie_poll: v })} />
          </Field>
        </>
      )}
      {cap === 'stt' ? (
        <Field label={tx('Aufnahme (Audio oder Video, max. 25 MB)')} tour="gm-audio">
          <div className="gm-ref">
            {ref ? (
              <>
                <audio src={ref.url} controls preload="none" />
                <button type="button" className="btn small ghost" onClick={() => setRef(null)}>
                  {tx('Entfernen')}
                </button>
              </>
            ) : (
              <label className="btn secondary small">
                {uploading ? tx('Lädt hoch…') : tx('Datei wählen')}
                <input type="file" hidden accept="audio/*,video/mp4,video/webm,video/quicktime" onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />
              </label>
            )}
          </div>
        </Field>
      ) : null}
      {!kieTask && (
        <Field label={cap === 'audio_tts' ? tx('Text') : cap === 'stt' ? tx('Hinweis (optional)') : tx('Beschreibung (Prompt)')} tour="gm-prompt">
          <Textarea value={f.prompt} onChange={(v) => set({ prompt: v })} rows={cap === 'audio_tts' ? 6 : 4} placeholder={tx(PLACEHOLDER[cap])} />
        </Field>
      )}
      {(cap === 'image' || cap === 'video') && !kieTask && (
        <>
          <Field label={tx('Negativ-Prompt (optional)')}>
            <Input value={f.negative_prompt} onChange={(v) => set({ negative_prompt: v })} placeholder={tx('z. B. Text, Wasserzeichen, unscharf')} />
          </Field>
          <div className="grid3">
            <Field label={tx('Seitenverhältnis')} tour="gm-aspect">
              <Select value={f.aspect_ratio ?? ''} onChange={(v) => set({ aspect_ratio: v })} options={[['', tx('Standard')], ...meta.aspects.map((a) => [a, a] as [string, string])]} />
            </Field>
            {cap === 'video' ? (
              <Field label={tx('Dauer (s)')} tour="gm-duration">
                <Input type="number" min={1} max={60} value={f.duration} onChange={(v) => set({ duration: v })} placeholder="5" />
              </Field>
            ) : (
              <div />
            )}
            <Field label={tx('Seed')}>
              <Input type="number" min={0} value={f.seed} onChange={(v) => set({ seed: v })} placeholder={tx('zufällig')} />
            </Field>
          </div>
          <Field label={cap === 'video' ? tx('Startbild (Bild zu Video)') : tx('Referenzbild (Bild bearbeiten)')} tour="gm-reference">
            <div className="gm-ref">
              {ref ? (
                <>
                  <img src={ref.url} alt="" />
                  <button type="button" className="btn small ghost" onClick={() => setRef(null)}>
                    {tx('Entfernen')}
                  </button>
                </>
              ) : (
                <label className="btn secondary small">
                  {uploading ? tx('Lädt hoch…') : tx('Bild wählen')}
                  <input type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />
                </label>
              )}
              {models.some((m) => m.ref) && <span className="muted small">{tx('Modelle mit Referenz:')} {models.filter((m) => m.ref).map((m) => m.id).join(', ')}</span>}
            </div>
          </Field>
        </>
      )}
      {cap === 'audio_music' && (
        <Field label={tx('Dauer (Sekunden, optional)')} tour="gm-duration">
          <Input type="number" min={1} max={600} value={f.duration} onChange={(v) => set({ duration: v })} placeholder="30" />
        </Field>
      )}
      {cap === 'audio_tts' && (
        <div className="grid2">
          <Field label={tx('Stimme')} tour="gm-voice" hint={tx('Liste oder eigene Voice-ID')}>
            <input list={voiceList} value={f.voice ?? ''} onChange={(e) => set({ voice: e.target.value })} placeholder={voices.data?.voices[0]?.id ?? tx('Standardstimme')} />
            <datalist id={voiceList}>
              {(voices.data?.voices ?? []).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </datalist>
          </Field>
          <Field label={tx('Sprache (optional)')}>
            <Input value={f.language} onChange={(v) => set({ language: v })} placeholder="de" />
          </Field>
        </div>
      )}
      {cap === 'stt' && (
        <Field label={tx('Sprache (optional)')}>
          <Input value={f.language} onChange={(v) => set({ language: v })} placeholder="de" />
        </Field>
      )}
      <details className="gm-advanced" data-tour="gm-params">
        <summary>{tx('Erweiterte Parameter (JSON)')}</summary>
        <Textarea className="mono" rows={5} value={f.params} onChange={(v) => set({ params: v })} placeholder={tx('{\n  "num_inference_steps": 28,\n  "guidance_scale": 3.5\n}')} />
        <small className="muted">{tx('Werden 1:1 an den Anbieter übergeben und überschreiben die Felder oben – so geht jede Option, die das Modell kennt.')}</small>
      </details>
      <div className="actions" style={{ marginTop: 14 }}>
        <button className="btn" disabled={busy || uploading || (needsPrompt && !String(f.prompt ?? '').trim()) || (cap === 'stt' && !ref)} onClick={submit} data-tour="gm-generate">
          <Icon name="sparkles" size={15} /> {cap === 'stt' ? tx('Transkribieren') : tx('Generieren')}
        </button>
        <span className="muted small">{tx('Kosten laufen über dein Konto beim Anbieter.')}</span>
      </div>
    </>
  );
}

function JobCard({ job: initial, onChange, onPrefill, onAdd }: { job: GenJob; onChange: () => void; onPrefill: () => void; onAdd: (j: GenJob) => void }) {
  const tx = useT('b6studio');
  const job = initial;
  const [social, setSocial] = useState(false);
  const running = ACTIVE.includes(job.status);
  const media = job.capability === 'image' || job.capability === 'video';
  const rerun = async (variation: boolean) => {
    const j = await act(() => api.post<GenJob>(`/api/genmedia/jobs/${job.id}/rerun`, { variation }), variation ? tx('Variation gestartet') : tx('Neu gestartet'));
    if (j) onAdd(j);
  };
  const library = async () => {
    const r = await act(() => api.post<{ uploads: { url: string }[] }>(`/api/genmedia/jobs/${job.id}/library`, {}), tx('In der Mediathek gespeichert'));
    if (r) onChange();
    return r;
  };
  const insert = async () => {
    const r = await library();
    const url = r?.uploads[0]?.url;
    if (!url) return;
    await navigator.clipboard?.writeText(url).catch(() => {});
    toast(tx('Link kopiert – im E-Mail- oder Funnel-Editor unter „Bild“ einfügen oder aus den Uploads wählen'));
  };
  return (
    <div className={`card gm-card s-${job.status}`} data-tour="gm-card">
      <div className="gm-media">
        {job.status === 'succeeded' && job.results.length ? (
          job.results.slice(0, 4).map((r) => <ResultPreview key={r.url} r={r} alt={job.prompt} />)
        ) : job.status === 'succeeded' && job.text !== null ? (
          <div className="gm-text">{job.text}</div>
        ) : running ? (
          <div className="gm-wait">
            <span className="gm-dot" /> {tx(STATUS_LABEL[job.status])}
            {job.progress ? ` · ${job.progress} %` : ''}
          </div>
        ) : (
          <div className="gm-wait err">{job.error || tx(STATUS_LABEL[job.status])}</div>
        )}
      </div>
      <div className="gm-meta">
        <div className="actions" style={{ justifyContent: 'space-between' }}>
          <Badge tone={STATUS_TONE[job.status]}>{tx(STATUS_LABEL[job.status])}</Badge>
          <span className="muted small">{ago(job.created_at)}</span>
        </div>
        <p className="gm-prompt" title={job.prompt}>
          {job.prompt || <span className="muted">{job.capability_label}</span>}
        </p>
        <p className="muted small" style={{ margin: 0 }}>
          {job.provider_label} · <span className="mono">{job.model || tx('Standard')}</span>
          {costText(job.cost) ? ` · ${costText(job.cost)}` : ''}
        </p>
        {job.target_result && <p className="muted small" style={{ margin: '4px 0 0' }}>{job.target_result}</p>}
        <div className="actions gm-actions" data-tour="gm-card-actions">
          {job.status === 'succeeded' && job.results[0] && (
            <a className="btn small secondary" href={job.results[0].download_url} title={tx('Herunterladen')}>
              <Icon name="download" size={13} /> {tx('Download')}
            </a>
          )}
          {job.status === 'succeeded' && job.results.length > 0 && (
            <button type="button" className="btn small secondary" onClick={library} disabled={job.results.every((r) => r.upload_id)}>
              <Icon name="library" size={13} /> {job.results.every((r) => r.upload_id) ? tx('In Mediathek ✓') : tx('In Mediathek')}
            </button>
          )}
          {job.status === 'succeeded' && media && (
            <button type="button" className="btn small secondary" onClick={() => setSocial(true)}>
              <Icon name="social" size={13} /> {tx('Social-Post')}
            </button>
          )}
          {job.status === 'succeeded' && job.capability === 'image' && (
            <button type="button" className="btn small secondary" onClick={insert} title={tx('In Mediathek speichern und Link kopieren')}>
              <Icon name="email" size={13} /> {tx('In E-Mail/Funnel')}
            </button>
          )}
          {job.status === 'succeeded' && job.text !== null && <Copy text={job.text} label={tx('Text kopieren')} />}
          {!running && job.capability !== 'stt' && (
            <button type="button" className="btn small ghost" onClick={() => rerun(false)} title={tx('Mit gleichen Einstellungen neu erzeugen')}>
              <Icon name="refresh" size={13} /> {tx('Neu')}
            </button>
          )}
          {!running && media && (
            <button type="button" className="btn small ghost" onClick={() => rerun(true)} title={tx('Gleicher Prompt, neuer Seed')}>
              <Icon name="shapes" size={13} /> {tx('Variation')}
            </button>
          )}
          {!running && (
            <button type="button" className="btn small ghost" onClick={onPrefill} title={tx('Einstellungen ins Formular übernehmen')}>
              <Icon name="edit" size={13} />
            </button>
          )}
          {running ? (
            <button type="button" className="btn small ghost" onClick={async () => (await act(() => api.post(`/api/genmedia/jobs/${job.id}/cancel`, {}), tx('Abgebrochen'))) && onChange()}>
              {tx('Abbrechen')}
            </button>
          ) : (
            <button type="button" className="btn small ghost" aria-label={tx('Löschen')} onClick={async () => confirmAsk(tx('Ergebnis löschen? Kopien in der Mediathek bleiben erhalten.')) && (await act(() => api.del(`/api/genmedia/jobs/${job.id}`))) && onChange()}>
              <Icon name="trash" size={13} />
            </button>
          )}
        </div>
      </div>
      {social && <SocialModal job={job} onClose={() => setSocial(false)} onDone={onChange} />}
    </div>
  );
}

function SocialModal({ job, onClose, onDone }: { job: GenJob; onClose: () => void; onDone: () => void }) {
  const tx = useT('b6studio');
  const s = useLoad(() => api.get<any>('/api/social'), []);
  const video = job.capability === 'video';
  const channels = (s.data?.channels ?? []).filter((c: any) => (video ? c.video : c.supported) && !c.disabled);
  const [sel, setSel] = useState<string[]>([]);
  const [text, setText] = useState(job.prompt.slice(0, 280));
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const r = await act(() => api.post(`/api/genmedia/jobs/${job.id}/social`, { integration_ids: sel, content: text, type: 'draft' }), tx('Als Entwurf im Social Planner angelegt'));
    setBusy(false);
    if (r) {
      onDone();
      onClose();
    }
  };
  return (
    <Modal
      title={tx('Für Social-Post verwenden')}
      onClose={onClose}
      footer={
        <button className="btn" disabled={busy || !sel.length || !text.trim()} onClick={submit}>
          {tx('Als Entwurf anlegen')}
        </button>
      }
    >
      {s.loading && !s.data ? (
        <Spinner />
      ) : !s.data?.configured ? (
        <p className="muted">{tx('Der Social Planner ist noch nicht verbunden (Agentur → Integrationen).')}</p>
      ) : (
        <>
          <Field label={tx('Kanäle')}>
            <div className="social-pick">
              {channels.map((c: any) => {
                const on = sel.includes(c.id);
                return (
                  <button key={c.id} type="button" className={`chip${on ? ' on' : ''}`} onClick={() => setSel(on ? sel.filter((x) => x !== c.id) : [...sel, c.id])}>
                    {c.name}
                  </button>
                );
              })}
              {!channels.length && <span className="muted small">{tx('Keine passenden Kanäle verbunden.')}</span>}
            </div>
          </Field>
          <Field label={tx('Text')}>
            <Textarea value={text} onChange={setText} rows={5} />
          </Field>
          <p className="muted small">{tx('Das')} {video ? tx('Video') : tx('Bild')} {tx('wird in der Mediathek gespeichert und als Entwurf eingeplant – freigeben im Social Planner.')}</p>
        </>
      )}
    </Modal>
  );
}

// --- custom HTTP templates ------------------------------------------------------------------------

const EXAMPLE = {
  name: 'Beispiel: Bild-API mit Auftrag + Abfrage',
  capability: 'image',
  config: {
    url: 'https://api.example.com/v1/generate',
    method: 'POST',
    headers: {},
    body: '{\n  "model": "{{model}}",\n  "input": {\n    "prompt": "{{prompt}}",\n    "aspect_ratio": "{{aspect_ratio}}",\n    "seed": "{{seed}}"\n  }\n}',
    result_path: 'output[*]',
    poll: { url: 'https://api.example.com/v1/tasks/{{response.id}}', method: 'GET', done_path: 'status', done_values: ['succeeded', 'completed'], fail_path: 'status', fail_values: ['failed'], error_path: 'error', interval_s: 5 },
  },
};

function Templates({ meta, onChange }: { meta: GenMeta | undefined; onChange: () => void }) {
  const tx = useT('b6studio');
  const list = useLoad(() => api.get<any[]>('/api/genmedia/templates'), []);
  const [edit, setEdit] = useState<any | null>(null);
  const custom = (meta?.connections ?? []).filter((c) => !meta?.providers.some((p) => p.id === c.provider && p.id !== 'custom_http'));
  return (
    <div className="gm-templates" data-tour="gm-templates">
      <div className="card">
        <h2>{tx('Jeder andere Anbieter – ohne Code')}</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          {tx('Eine HTTP-Vorlage beschreibt, wie V Media CRM einen Dienst aufruft: Adresse, Kopfzeilen und ein JSON-Body mit Platzhaltern wie')} <code>{'{{prompt}}'}</code>, <code>{'{{aspect_ratio}}'}</code>, <code>{'{{image_url}}'}</code> {tx('oder')} <code>{'{{params.x}}'}</code>{tx(', wo die Datei-URL in der Antwort steht und – bei asynchronen Diensten – wie der Status abgefragt wird. Den Schlüssel trägst du als Verbindung „Eigener Anbieter (HTTP)“ unter Einstellungen → KI-Anbieter (BYOK) ein.')}
        </p>
        {!custom.length && <p className="muted small">{tx('Noch keine Verbindung vom Typ „Eigener Anbieter“ – Vorlagen kannst du trotzdem schon anlegen.')}</p>}
        <div className="actions">
          <button className="btn" onClick={() => setEdit({ name: '', capability: 'image', config: { method: 'POST', headers: {} } })} data-tour="gm-template-new">
            {tx('+ Vorlage')}
          </button>
          <button className="btn secondary" onClick={() => setEdit({ ...JSON.parse(JSON.stringify(EXAMPLE)), name: tx(EXAMPLE.name) })}>
            {tx('Beispiel öffnen')}
          </button>
        </div>
      </div>
      {list.loading && !list.data ? (
        <Spinner />
      ) : (list.data ?? []).length ? (
        <div className="table-wrap" style={{ marginTop: 14 }}>
          <table className="t">
            <thead>
              <tr>
                <th>Name</th>
                <th>{tx('Art')}</th>
                <th>{tx('Adresse')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(list.data ?? []).map((x) => (
                <tr key={x.id}>
                  <td>{x.name}</td>
                  <td>{meta?.capabilities?.find((c) => c.id === x.capability)?.label ?? x.capability}</td>
                  <td className="mono small">{x.config.url}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn small secondary" onClick={() => setEdit(x)}>
                      {tx('Bearbeiten')}
                    </button>{' '}
                    <button className="btn small ghost" aria-label={tx('Löschen')} onClick={async () => confirmAsk(tx('Vorlage „{name}“ löschen?', { name: x.name })) && (await act(() => api.del(`/api/genmedia/templates/${x.id}`))) && (list.reload(), onChange())}>
                      <Icon name="trash" size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {edit && (
        <TemplateEditor
          tpl={edit}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            list.reload();
            onChange();
          }}
        />
      )}
    </div>
  );
}

function TemplateEditor({ tpl, onClose, onSaved }: { tpl: any; onClose: () => void; onSaved: () => void }) {
  const tx = useT('b6studio');
  const [t, setT] = useState<any>(() => ({ ...tpl, config: { ...tpl.config, headers_text: JSON.stringify(tpl.config.headers ?? {}, null, 2), poll: tpl.config.poll ? { ...tpl.config.poll, done_values: (tpl.config.poll.done_values ?? []).join(', '), fail_values: (tpl.config.poll.fail_values ?? []).join(', ') } : null } }));
  const c = t.config;
  const setC = (p: any) => setT({ ...t, config: { ...c, ...p } });
  const setP = (p: any) => setC({ poll: { ...(c.poll ?? {}), ...p } });
  const caps: [string, string][] = [['image', tx('Bild')], ['video', tx('Video')], ['audio_tts', tx('Text in Sprache')], ['audio_music', tx('Musik & Sound')], ['stt', tx('Sprache in Text')]];
  const save = async () => {
    let headers: any = {};
    try {
      headers = c.headers_text?.trim() ? JSON.parse(c.headers_text) : {};
    } catch {
      return void act(() => Promise.reject(new Error(tx('Kopfzeilen: kein gültiges JSON'))));
    }
    const { headers_text: _h, ...rest } = c;
    const config = { ...rest, headers, poll: c.poll?.url ? c.poll : undefined };
    const body = { name: t.name, capability: t.capability, config };
    const r = await act(() => (t.id ? api.put(`/api/genmedia/templates/${t.id}`, body) : api.post('/api/genmedia/templates', body)), tx('Vorlage gespeichert'));
    if (r) onSaved();
  };
  const polling = useMemo(() => !!c.poll, [c.poll]);
  return (
    <Modal title={t.id ? tx('Vorlage bearbeiten') : tx('Neue HTTP-Vorlage')} onClose={onClose} wide footer={<button className="btn" onClick={save}>{tx('Speichern')}</button>}>
      <div className="grid2">
        <Field label="Name">
          <Input value={t.name} onChange={(v) => setT({ ...t, name: v })} placeholder={tx('z. B. ComfyUI im Büro')} />
        </Field>
        <Field label={tx('Art')}>
          <Select value={t.capability} onChange={(v) => setT({ ...t, capability: v })} options={caps} />
        </Field>
      </div>
      <div className="grid2">
        <Field label={tx('Adresse')} hint={tx('https://… oder /pfad (ab Basis-Adresse der Verbindung); {{api_key}} erlaubt')}>
          <Input value={c.url} onChange={(v) => setC({ url: v })} placeholder="https://api.example.com/v1/generate" />
        </Field>
        <Field label={tx('Methode')}>
          <Select value={c.method ?? 'POST'} onChange={(v) => setC({ method: v })} options={['POST', 'GET', 'PUT']} />
        </Field>
      </div>
      <Field label={tx('Kopfzeilen (JSON)')} hint={tx('Der Schlüssel kommt aus der Verbindung; hier nur Zusätzliches')}>
        <Textarea className="mono" rows={3} value={c.headers_text} onChange={(v) => setC({ headers_text: v })} />
      </Field>
      <Field label={tx('JSON-Body')} hint={tx('Platzhalter: {{prompt}} {{negative_prompt}} {{aspect_ratio}} {{duration}} {{seed}} {{voice}} {{language}} {{model}} {{image_url}} {{audio_url}} {{params.feld}}')}>
        <Textarea className="mono" rows={7} value={c.body} onChange={(v) => setC({ body: v })} placeholder={tx('{ "prompt": "{{prompt}}" }')} />
      </Field>
      <div className="grid3">
        <Field label={tx('Ergebnis-Pfad')} hint={tx('z. B. images[0].url oder output[*]')}>
          <Input value={c.result_path} onChange={(v) => setC({ result_path: v })} />
        </Field>
        <Field label={tx('Ergebnis ist')}>
          <Select value={c.result_type ?? 'url'} onChange={(v) => setC({ result_type: v })} options={[['url', tx('eine URL')], ['base64', 'Base64-Daten']]} />
        </Field>
        <Field label={tx('Text-Pfad (Transkription)')}>
          <Input value={c.text_path} onChange={(v) => setC({ text_path: v })} placeholder="text" />
        </Field>
      </div>
      <Check checked={polling} onChange={(v) => setC({ poll: v ? { method: 'GET', interval_s: 5, done_values: 'succeeded' } : null })} label={tx('Asynchron: Status abfragen, bis das Ergebnis fertig ist')} />
      {c.poll && (
        <div className="gm-poll">
          <Field label={tx('Abfrage-Adresse')} hint={tx('mit Werten aus der ersten Antwort, z. B. https://api.example.com/v1/tasks/{{response.id}}')}>
            <Input value={c.poll.url} onChange={(v) => setP({ url: v })} />
          </Field>
          <div className="grid3">
            <Field label={tx('Status-Pfad')}>
              <Input value={c.poll.done_path} onChange={(v) => setP({ done_path: v })} placeholder="status" />
            </Field>
            <Field label={tx('Fertig, wenn …')} hint={tx('Werte mit Komma')}>
              <Input value={c.poll.done_values} onChange={(v) => setP({ done_values: v })} placeholder={tx('succeeded, completed')} />
            </Field>
            <Field label={tx('Intervall (s)')}>
              <Input type="number" min={2} max={120} value={c.poll.interval_s} onChange={(v) => setP({ interval_s: Number(v) })} />
            </Field>
            <Field label={tx('Fehler-Pfad')}>
              <Input value={c.poll.fail_path} onChange={(v) => setP({ fail_path: v })} placeholder="status" />
            </Field>
            <Field label={tx('Fehler, wenn …')}>
              <Input value={c.poll.fail_values} onChange={(v) => setP({ fail_values: v })} placeholder="failed" />
            </Field>
            <Field label={tx('Fehlermeldung-Pfad')}>
              <Input value={c.poll.error_path} onChange={(v) => setP({ error_path: v })} placeholder="error" />
            </Field>
          </div>
          <Field label={tx('Ergebnis-Pfad in der Abfrage (optional)')}>
            <Input value={c.poll.result_path} onChange={(v) => setP({ result_path: v })} placeholder={tx('wie oben')} />
          </Field>
        </div>
      )}
    </Modal>
  );
}
