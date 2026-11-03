import { useState } from 'react';
import { ago, api } from '../api';
import { Badge, Check, CodeBox, Field, Input, Spinner, act, useLoad } from '../ui';
import { SignupLink } from '../referrals';
import { useT } from '../i18n';

/** Agency → Integrationen: one-way mirror of the CRM into Supabase. */
export function SupabaseMirror() {
  const t = useT('b7misc');
  const s = useLoad(() => api.get<any>('/api/agency/supabase'), []);
  const [url, setUrl] = useState<string | null>(null);
  const [key, setKey] = useState('');
  const [showSql, setShowSql] = useState(false);
  if (!s.data) return <Spinner />;
  const v = s.data;
  const st = v.state ?? {};
  const save = async (patch: any) => (await act(() => api.patch('/api/agency/supabase', patch), 'Gespeichert')) && (setKey(''), setUrl(null), s.reload());
  return (
    <div className="card" data-tour="supabase">
      <h2>{t('Supabase-Spiegel')} <SignupLink id="supabase" /></h2>
      <p className="muted small">
        {t('Projekte, Kontakte, Deals, Aufgaben, Rechnungen und Dokumente laufend in deine Supabase (Tabellen')} <code>{t('ghl_*')}</code>{t('), damit andere Projekte und der Supabase-MCP darauf zugreifen. Alle 10 Minuten Änderungen, nachts alles inkl. Löschungen.')}
      </p>
      <div className="grid2">
        <Field label={t('Supabase-Adresse')}>
          <Input value={url ?? v.url} onChange={setUrl} placeholder="https://db.deine-domain.de" />
        </Field>
        <Field label={t('Service-Role-Key')} hint={t('Supabase → Einstellungen → API (bleibt verschlüsselt hier)')}>
          <Input type="password" value={key} onChange={setKey} placeholder={v.key_set ? t('•••••••• (gespeichert)') : ''} autoComplete="off" />
        </Field>
      </div>
      <Check checked={v.enabled} onChange={(enabled) => save({ enabled })} label={t('Spiegel aktiv')} />
      <p className="actions">
        <button className="btn" onClick={() => save({ url: url ?? v.url, ...(key ? { service_key: key } : {}), enabled: true })}>
          {t('Speichern & testen')}
        </button>
        <button className="btn secondary" disabled={!v.enabled} onClick={async () => (await act(() => api.post('/api/agency/supabase/sync', { full: true }), t('Synchronisiert'))) && s.reload()}>
          {t('Jetzt komplett abgleichen')}
        </button>
        <button className="btn ghost" onClick={() => setShowSql(!showSql)}>
          {showSql ? t('SQL ausblenden') : t('SQL für die Tabellen')}
        </button>
      </p>
      {st.last_run && (
        <p className="small">
          {st.last_error ? <Badge tone="red">{t('Fehler')}</Badge> : <Badge tone="green">ok</Badge>} {t('Letzter Abgleich {v1}', { v1: ago(st.last_run) })}
          {st.last_full ? t(' · komplett {v1}', { v1: ago(st.last_full) }) : ''}
          {st.last_error ? <span style={{ color: 'var(--red)' }}> · {st.last_error}</span> : ''}
          {st.counts && !st.last_error && (
            <span className="muted">
              {' · '}
              {Object.entries(st.counts)
                .map(([k, n]) => `${String(k).replace('ghl_', '')} ${n}`)
                .join(', ')}
            </span>
          )}
        </p>
      )}
      {showSql && (
        <>
          <p className="muted small">{t('Einmal im Supabase-SQL-Editor ausführen (oder per Supabase-MCP „apply_migration“):')}</p>
          <CodeBox text={v.sql} />
        </>
      )}
    </div>
  );
}
