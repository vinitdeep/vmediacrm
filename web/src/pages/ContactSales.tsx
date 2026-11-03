import { useState } from 'react';
import { api, d } from '../api';
import { Badge, act, confirmAsk, useLoad } from '../ui';
import { ContactDupes } from './SalesDupes';
import { EnrollContact } from './SalesSequences';
import './sales.css';
import { useT } from '../i18n';
import { trData } from '../i18n/data';

/**
 * What the contact page gets from sales (docs/sales.md): the duplicate hint on top and the person's sequences next to the other
 * actions. Loaded as its own chunk; without the area „Opportunities“ the sequence box simply stays away.
 */

export function ContactDupeBanner({ contactId }: { contactId: string }) {
  return <ContactDupes contactId={contactId} />;
}

const TONE: Record<string, 'green' | 'blue' | 'gray' | 'yellow'> = { active: 'blue', paused: 'yellow', finished: 'green', stopped: 'gray' };
const LABEL: Record<string, string> = trData('b5conn', { active: 'läuft', paused: 'pausiert', finished: 'durchlaufen', stopped: 'beendet' });

export function ContactSequences({ contactId }: { contactId: string }) {
  const t = useT('b5conn');
  const list = useLoad(() => api.get<any[]>(`/api/sequence-enrollments?contact_id=${contactId}`).catch(() => null), [contactId]);
  const [enroll, setEnroll] = useState(false);
  if (!list.data) return null;
  const rows = list.data;
  return (
    <div className="contact-seq" data-tour="contact-sequences">
      <div className="muted small" style={{ marginBottom: 4 }}>{t('Sequenzen')}</div>
      {rows.slice(0, 5).map((e) => (
        <div className="deal-row" key={e.id}>
          <div className="grow">
            <b>{e.sequence_name}</b>
            <div className="muted small">{t('{v} · {sent} gesendet', { v: e.status === 'active' ? t('Schritt {v}{v2}', { v: e.step_index + 1, v2: e.next_at ? t(' · weiter am {v}', { v: d(e.next_at) }) : '' }) : e.stop_label || t('seit {v}', { v: d(e.enrolled_at) }), sent: e.sent })}</div>
          </div>
          <Badge tone={TONE[e.status] ?? 'gray'}>{LABEL[e.status] ?? e.status}</Badge>
          {(e.status === 'active' || e.status === 'paused') && (
            <button className="icon-btn" aria-label={t('Sequenz für diese Person beenden')} title={t('Beenden')} onClick={async () => confirmAsk(t('Sequenz für diese Person beenden?')) && (await act(() => api.post(`/api/sequence-enrollments/${e.id}/stop`, {}), t('Beendet'))) && list.reload()}>
              ✕
            </button>
          )}
        </div>
      ))}
      <button className="btn small secondary" onClick={() => setEnroll(true)}>{t('In Sequenz aufnehmen')}</button>
      {enroll && <EnrollContact contactId={contactId} onClose={() => setEnroll(false)} onDone={() => (setEnroll(false), list.reload())} />}
    </div>
  );
}
