import { useEffect, useState } from 'react';
import { Icon } from '../icons';
import { api } from '../api';
import { Badge, Field, Input, Modal, Select, Spinner, act, toast, useLoad } from '../ui';
import { CallNotes } from './CallsNotes';
import './calls.css';
import { useT } from '../i18n';

/**
 * In the browser phone during a call: notes (they stay with the call and land in the contact's notes) and handing the call over to a
 * colleague or a number – at once ("kalt") or with an announcement (the call waits on hold, the colleague hears who it is and presses 1).
 * Docs: docs/telephony.md.
 */

/** Notes and hand-over buttons under the call controls. */
export function CallTools({ callId, open, onTransfer }: { callId: string; open: boolean; onTransfer: () => void }) {
  const tx = useT('b6phone');
  const [notes, setNotes] = useState(false);
  return (
    <div className="phone-tools">
      <div className="phone-controls">
        <button className={`phone-ctl${notes ? ' on' : ''}`} onClick={() => setNotes(!notes)} aria-pressed={notes} title={tx('Notiz zum Gespräch')}>
          <Icon name="note" size={18} />
          <span>{tx('Notiz')}</span>
        </button>
        <button className="phone-ctl" onClick={onTransfer} disabled={!open || !callId} title={callId ? tx('An eine Kollegin, einen Kollegen oder eine Nummer übergeben') : tx('Übergeben geht, sobald der Anruf verbunden ist')}>
          <Icon name="callOut" size={18} />
          <span>{tx('Übergeben')}</span>
        </button>
      </div>
      {notes && (callId ? <CallNotes callId={callId} compact /> : <p className="muted small">{tx('Notizen gehen, sobald der Anruf verbunden ist.')}</p>)}
    </div>
  );
}

const STATE_TEXT: Record<string, string> = {
  ringing: 'Es klingelt …',
  accepted: 'Übergeben – du kannst auflegen.',
  declined: 'Nicht angenommen (keine 1 gedrückt).',
  failed: 'Nicht möglich',
  done: 'Übergeben.',
};

/** The hand-over dialog. `held`: the call already waits on hold (needed for the version with announcement). */
export function TransferModal({ callId, held, name, ensureHold, onAccepted, onClose }: { callId: string; held: boolean; name: string; ensureHold: () => Promise<boolean>; onAccepted: () => void; onClose: () => void }) {
  const tx = useT('b6phone');
  const people = useLoad(() => api.get<any[]>('/api/phone/colleagues').catch(() => []), []);
  const [to, setTo] = useState('');
  const [number, setNumber] = useState('');
  const [mode, setMode] = useState(held ? 'warm' : 'cold');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<any>(null);

  // Ringing: ask until the colleague has answered or it failed.
  useEffect(() => {
    if (status?.status !== 'ringing') return;
    const t = setInterval(async () => {
      const r = await api.get(`/api/phone/calls/${encodeURIComponent(callId)}/transfer`).catch(() => null);
      if (r && r.id) {
        setStatus(r);
        if (r.status === 'accepted' || r.status === 'done') onAccepted();
      }
    }, 2000);
    return () => clearInterval(t);
  }, [status?.status, callId]);

  const target = to ? { type: 'user', id: to } : { type: 'number', id: number };
  const go = async () => {
    setBusy(true);
    if (mode === 'warm' && !held && !(await ensureHold())) {
      setBusy(false);
      return toast(tx('Der Anruf ließ sich nicht halten.'));
    }
    const r = await act(() => api.post(`/api/phone/calls/${encodeURIComponent(callId)}/transfer`, { to: target, mode, note }));
    setBusy(false);
    if (r) {
      setStatus(r);
      if (r.mode === 'cold') onAccepted();
    }
  };
  const ready = to || number.trim();
  return (
    <Modal
      title={tx('Übergeben: {name}', { name })}
      onClose={onClose}
      footer={
        status ? (
          <button className="btn" onClick={onClose}>
            {tx('Schließen')}
          </button>
        ) : (
          <button className="btn" disabled={busy || !ready} onClick={go}>
            {mode === 'cold' ? tx('Jetzt weiterleiten') : tx('Übergabe starten')}
          </button>
        )
      }
    >
      {status ? (
        <div className="phone-transfer-state" role="status">
          <strong>{status.target_label}</strong>: {status.mode === 'cold' && status.status === 'ringing' ? tx('Der Anrufer wird weitergeleitet.') : tx(STATE_TEXT[status.status] ?? status.status)}
          {status.error && <div className="muted">{status.error}</div>}
          {status.status === 'ringing' && <Spinner />}
          {(status.status === 'declined' || status.status === 'failed') && <p className="small">{tx('Der Anrufer wartet weiter mit Musik. Unter „Fortsetzen“ kannst du das Gespräch wieder aufnehmen.')}</p>}
        </div>
      ) : (
        <>
          <Field label={tx('An wen?')}>
            <Select
              value={to}
              onChange={(v) => (setTo(v), v && setNumber(''))}
              placeholder={tx('Eine Nummer eingeben …')}
              options={(people.data ?? []).map((u) => [u.id, `${u.name}${u.online ? '' : tx(' (nicht erreichbar)')}`])}
            />
          </Field>
          {!to && (
            <Field label={tx('Nummer')} hint={tx('Mit Ländervorwahl, z. B. +49151…')}>
              <Input value={number} onChange={setNumber} placeholder="+49…" inputMode="tel" />
            </Field>
          )}
          <Field label={tx('Wie?')}>
            <Select
              value={mode}
              onChange={setMode}
              options={[
                ['cold', tx('Sofort weiterleiten – der Anrufer klingelt direkt dort')],
                ['warm', tx('Mit Ansage – der Anrufer wartet mit Musik, die andere Person erfährt, wer anruft, und nimmt per Taste 1 an')],
              ]}
            />
          </Field>
          {mode === 'warm' && (
            <>
              <Field label={tx('Hinweis für die andere Person (wird vorgelesen)')}>
                <Input value={note} onChange={setNote} maxLength={300} placeholder={tx('z. B. Frage zur Rechnung')} />
              </Field>
              {!held && <p className="muted small">{tx('Das Gespräch wird dafür gehalten.')}</p>}
            </>
          )}
          {people.data?.some((u) => !u.online) && <Badge>{tx('Kollegen mit geschlossenem Browser-Telefon sind nicht erreichbar.')}</Badge>}
        </>
      )}
    </Modal>
  );
}
