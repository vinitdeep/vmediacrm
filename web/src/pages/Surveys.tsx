import { useState } from 'react';
import { api, d, dt, name } from '../api';
import { act, Badge, confirmAsk, Empty, Field, Input, Link, Modal, navigate, PageHead, pressable, Select, Spinner, Stat, Tabs, TagInput, Textarea, useLoad } from '../ui';
import { useTags } from '../tags';
import { MoreFields } from '../areas/fields';
import { SortableGrid } from '../sortable/Sortable';
import { useT } from '../i18n';

/** Umfragen: CSAT answers after solved tickets and NPS campaigns. */

const FACES = ['😞', '🙁', '😐', '🙂', '😄'];

function Csat() {
  const t = useT('b7misc');
  const [days, setDays] = useState('90');
  const [score, setScore] = useState('');
  const { data } = useLoad(() => api.get(`/api/surveys/csat?days=${days}&score=${score}`), [days, score]);
  if (!data) return <Spinner />;
  const s = data.summary;
  const max = Math.max(1, ...s.distribution);
  return (
    <>
      <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 10 }}>
        <div style={{ width: 170 }}>
          <Select value={score} onChange={setScore} placeholder={t('Alle Bewertungen')} options={[5, 4, 3, 2, 1].map((n) => [String(n), t('{v1} {n} von 5', { v1: FACES[n - 1], n })])} />
        </div>
        <div style={{ width: 170 }}>
          <Select value={days} onChange={setDays} aria={t('Zeitraum')} options={[['30', 'Letzte 30 Tage'], ['90', 'Letzte 90 Tage'], ['365', t('Letztes Jahr')]]} />
        </div>
      </div>
      <div className="grid2" style={{ gap: 14, alignItems: 'start' }}>
        <SortableGrid id="csat-stats" className="stats" style={{ marginBottom: 0 }} data-tour="csat-stats">
          <Stat label={t('Ø Zufriedenheit')} value={s.avg !== null ? `${String(s.avg).replace('.', ',')} / 5` : '–'} sub={t('{count} Bewertungen', { count: s.count })} />
          <Stat label={t('Zufrieden (4–5)')} value={s.satisfied_pct !== null ? `${s.satisfied_pct} %` : '–'} />
          <Stat label={t('Antwortquote')} value={s.response_rate !== null ? `${s.response_rate} %` : '–'} sub={t('{sent} Umfragen gesendet', { sent: s.sent })} />
        </SortableGrid>
        <div className="card" data-tour="csat-dist">
          <h2>{t('Verteilung')}</h2>
          {[5, 4, 3, 2, 1].map((n) => (
            <div key={n} className="row" style={{ alignItems: 'center', flexWrap: 'nowrap', marginBottom: 6 }} title={t('{n} von 5: {v2}', { n, v2: s.distribution[n - 1] })}>
              <span style={{ width: 54 }}>
                {FACES[n - 1]} {n}
              </span>
              <div className="bar grow">
                <div style={{ width: `${(s.distribution[n - 1] / max) * 100}%` }} />
              </div>
              <span className="muted" style={{ width: 30, textAlign: 'right' }}>
                {s.distribution[n - 1]}
              </span>
            </div>
          ))}
        </div>
      </div>
      {data.responses.length ? (
        <div className="table-wrap" style={{ marginTop: 14 }} data-tour="csat-list">
          <table className="t">
            <thead>
              <tr>
                <th>{t('Bewertung')}</th>
                <th>{t('Ticket')}</th>
                <th>{t('Kontakt')}</th>
                <th>{t('Zuständig')}</th>
                <th>{t('Datum')}</th>
              </tr>
            </thead>
            <tbody>
              {data.responses.map((r: any) => (
                <tr key={r.id} className="click" {...pressable(() => navigate(`tickets/${r.id}`))}>
                  <td>
                    <span style={{ fontSize: 20 }}>{FACES[r.csat_score - 1]}</span> {r.csat_score}/5
                    {r.csat_comment && <div className="small">„{r.csat_comment}“</div>}
                  </td>
                  <td>
                    #{r.number} {r.subject}
                  </td>
                  <td>{r.contact_id ? name(r) : '–'}</td>
                  <td className="muted">{r.owner_name || '–'}</td>
                  <td className="muted small">{dt(r.csat_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>{t('Noch keine Bewertungen. Nach dem Lösen eines Tickets bekommt der Kontakt automatisch einen Link (Einstellungen → Service → Zufriedenheit).')}</Empty>
      )}
    </>
  );
}

const NPS_QUESTION = 'Wie wahrscheinlich ist es, dass du uns Freunden oder Kollegen empfiehlst?';

function CampaignModal({ c, onClose, onSaved }: { c?: any; onClose: () => void; onSaved: () => void }) {
  const t = useT('b7misc');
  const tags = useTags();
  const lists = useLoad(() => api.get<any[]>('/api/smart-lists'), []);
  const [f, setF] = useState<any>(
    c ?? {
      name: '',
      channel: 'email',
      tags: [],
      question: t(NPS_QUESTION),
      subject: t('Kurze Frage: Würdest du uns weiterempfehlen?'),
      body: t('Hallo {{contact.first_name|}},\n\nwie wahrscheinlich ist es, dass du uns weiterempfiehlst? Eine Antwort dauert 10 Sekunden:\n\n{{nps_link}}\n\nDanke!\n{{location.name}}'),
    },
  );
  const save = async () => {
    const body = { name: f.name, question: f.question, channel: f.channel, subject: f.subject, body: f.body, tags: f.tags, smart_list_id: f.smart_list_id || '' };
    if (await act(() => (c ? api.patch(`/api/surveys/nps/${c.id}`, body) : api.post('/api/surveys/nps', body)), 'Gespeichert')) onSaved();
  };
  return (
    <Modal title={c ? t('NPS-Umfrage bearbeiten') : t('Neue NPS-Umfrage')} onClose={onClose} wide footer={<button className="btn" onClick={save}>{t('Speichern')}</button>}>
      <div className="grid2">
        <Field label={t('Name (intern)')}>
          <Input value={f.name} onChange={(v) => setF({ ...f, name: v })} placeholder={t('NPS Herbst')} autoFocus />
        </Field>
        <Field label={t('Kanal')}>
          <Select value={f.channel} onChange={(v) => setF({ ...f, channel: v })} options={[['email', 'E-Mail'], ['sms', 'SMS']]} />
        </Field>
      </div>
      <Field label={t('An Kontakte mit einem dieser Tags')}>
        <TagInput value={f.tags ?? []} onChange={(v) => setF({ ...f, tags: v })} suggestions={tags} />
      </Field>
      {f.channel === 'email' && (
        <Field label={t('Betreff')}>
          <Input value={f.subject} onChange={(v) => setF({ ...f, subject: v })} />
        </Field>
      )}
      <Field label={t('Nachricht')} hint="{{nps_link}} becomes the personal survey link; also {{contact.first_name}}, {{location.name}}. Contacts with “Do not disturb” get nothing.">
        <Textarea value={f.body} onChange={(v) => setF({ ...f, body: v })} rows={7} />
      </Field>
      <MoreFields id="nps-campaign" values={[f.question !== t(NPS_QUESTION) && f.question, f.smart_list_id]}>
        <Field label={t('Frage (auf der Umfrage-Seite)')}>
          <Input value={f.question} onChange={(v) => setF({ ...f, question: v })} />
        </Field>
        <Field label={t('…oder aus Smart List')}>
          <Select value={f.smart_list_id} onChange={(v) => setF({ ...f, smart_list_id: v })} placeholder={t('– keine –')} options={(lists.data ?? []).map((l) => [l.id, l.name])} />
        </Field>
      </MoreFields>
    </Modal>
  );
}

function Responses({ c, onClose }: { c: any; onClose: () => void }) {
  const t = useT('b7misc');
  const { data } = useLoad(() => api.get<any[]>(`/api/surveys/nps/${c.id}/responses`), [c.id]);
  return (
    <Modal title={t('Antworten: {name}', { name: c.name })} onClose={onClose} wide>
      {!data ? (
        <Spinner />
      ) : data.length ? (
        <table className="t">
          <tbody>
            {data.map((r) => (
              <tr key={r.id}>
                <td style={{ width: 70 }}>
                  <Badge tone={r.score >= 9 ? 'green' : r.score >= 7 ? 'gray' : 'red'}>{r.score}/10</Badge>
                </td>
                <td>
                  <Link to={`contacts/${r.contact_id}`}>{name(r)}</Link>
                  {r.comment && <div className="small">„{r.comment}“</div>}
                </td>
                <td className="muted small">{d(r.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="muted">{t('Noch keine Antworten.')}</p>
      )}
    </Modal>
  );
}

function Nps() {
  const t = useT('b7misc');
  const list = useLoad(() => api.get<any[]>('/api/surveys/nps'), []);
  const [modal, setModal] = useState<{ kind: 'edit'; c?: any } | { kind: 'resp'; c: any } | null>(null);
  const send = async (c: any) => {
    if (!confirmAsk(t('Umfrage „{name}“ jetzt an alle passenden Kontakte senden? Wer sie schon bekommen hat, bekommt sie nicht noch einmal.', { name: c.name }))) return;
    const r = await act(() => api.post(`/api/surveys/nps/${c.id}/send`));
    if (r) {
      alert(t('{queued} Kontakte werden angeschrieben ({audience} in der Zielgruppe).', { queued: r.queued, audience: r.audience }));
      list.reload();
    }
  };
  return (
    <>
      <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 10 }}>
        <button className="btn" onClick={() => setModal({ kind: 'edit' })}>
          {t('+ NPS-Umfrage')}
        </button>
      </div>
      {!list.data ? (
        <Spinner />
      ) : list.data.length ? (
        <SortableGrid id="nps-list" className="nps-grid" data-tour="nps-list">
          {list.data.map((c) => (
            <div key={c.id} className="card">
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ margin: 0 }}>{c.name}</h2>
                  <div className="muted small">
                    {c.channel === 'sms' ? 'SMS' : 'E-Mail'} · {c.tags.length ? t('Tags: {v1}', { v1: c.tags.join(', ') }) : c.smart_list_id ? t('Smart List') : t('keine Zielgruppe')}
                  </div>
                </div>
                <Badge tone={c.status === 'sent' ? 'green' : c.status === 'sending' ? 'blue' : 'gray'}>{c.status === 'sent' ? 'gesendet' : c.status === 'sending' ? t('wird gesendet') : 'Entwurf'}</Badge>
              </div>
              <div className="nps-score">
                <div className="big">{c.stats.score ?? '–'}</div>
                <div className="muted small">{t('NPS')}</div>
              </div>
              <div className="nps-split" aria-label={t('Promotoren {promoters}, Passive {passives}, Kritiker {detractors}', { promoters: c.stats.promoters, passives: c.stats.passives, detractors: c.stats.detractors })}>
                {c.stats.count > 0 && (
                  <>
                    <i className="pro" style={{ flex: c.stats.promoters }} />
                    <i className="pas" style={{ flex: c.stats.passives }} />
                    <i className="det" style={{ flex: c.stats.detractors }} />
                  </>
                )}
              </div>
              <div className="muted small">
                {t('{promoters} Promotoren (9–10) · {passives} Passive · {detractors} Kritiker (0–6) · {count} von {v5} geantwortet', { promoters: c.stats.promoters, passives: c.stats.passives, detractors: c.stats.detractors, count: c.stats.count, v5: c.sends?.total ?? 0 })}
              </div>
              <div className="actions" style={{ marginTop: 10 }}>
                <button className="btn small" onClick={() => send(c)}>
                  {c.status === 'draft' ? 'Senden' : t('Neue Kontakte anschreiben')}
                </button>
                <button className="btn small secondary" onClick={() => setModal({ kind: 'resp', c })}>
                  {t('Antworten')}
                </button>
                <button className="btn small secondary" onClick={() => setModal({ kind: 'edit', c })}>
                  {t('Bearbeiten')}
                </button>
                <button className="btn small ghost" onClick={async () => confirmAsk(t('„{name}“ samt Antworten löschen?', { name: c.name })) && (await act(() => api.del(`/api/surveys/nps/${c.id}`))) && list.reload()}>
                  {t('Löschen')}
                </button>
              </div>
            </div>
          ))}
        </SortableGrid>
      ) : (
        <Empty action={<button className="btn" onClick={() => setModal({ kind: 'edit' })}>{t('Erste NPS-Umfrage anlegen')}</button>}>{t('Net Promoter Score: frag deine Kunden per E-Mail oder SMS, wie wahrscheinlich sie dich weiterempfehlen.')}</Empty>
      )}
      {modal?.kind === 'edit' && <CampaignModal c={modal.c} onClose={() => setModal(null)} onSaved={() => (setModal(null), list.reload())} />}
      {modal?.kind === 'resp' && <Responses c={modal.c} onClose={() => setModal(null)} />}
    </>
  );
}

export function Surveys({ tab }: { tab?: string }) {
  const t = useT('b7misc');
  const cur = tab === 'nps' ? 'nps' : 'csat';
  return (
    <>
      <PageHead title={t('Umfragen')} sub={t('Zufriedenheit nach gelösten Tickets (CSAT) und Weiterempfehlung (NPS)')} />
      <Tabs tabs={[['csat', 'Zufriedenheit (CSAT)'], ['nps', 'Weiterempfehlung (NPS)']]} value={cur} onChange={(v) => navigate(`surveys/${v}`)} />
      <div style={{ marginTop: 14 }}>{cur === 'csat' ? <Csat /> : <Nps />}</div>
    </>
  );
}
