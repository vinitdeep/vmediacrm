import { useEffect, useState, type ReactNode } from 'react';
import { Icon, type IconName } from '../icons';
import { api, dt } from '../api';
import { Badge, Check, CodeBox, Field, Input, MergeHint, Spinner, Textarea, act, confirmAsk, useLoad } from '../ui';
import { SignupLink } from '../referrals';
import { MoreFields } from '../areas/fields';
import { useT } from '../i18n';
import { trData } from '../i18n/data';

/**
 * Einstellungen → Weitere Kanäle: Telegram, Discord, Slack (Team) and browser push to contacts,
 * plus the workflow step editors of these channels.
 */

type Result = { ok: boolean; info?: string; error?: string } | undefined;
const KEEP = '•••••• gespeichert – leer lassen zum Behalten';
const INBOX_CHANNELS: [string, string][] = trData('b5chan', [['email', 'E-Mail'], ['sms', 'SMS'], ['chat', 'Website-Chat'], ['whatsapp', 'WhatsApp'], ['messenger', 'Messenger'], ['instagram', 'Instagram'], ['telegram', 'Telegram'], ['discord', 'Discord']]);

function Line({ r }: { r: Result }) {
  if (!r) return null;
  return <div className={`meta-result ${r.ok ? 'ok' : 'err'}`}>{r.ok ? <><Icon name="ok" size={14} /> {r.info}</> : <><Icon name="fail" size={14} /> {r.error}</>}</div>;
}

function Head({ icon, title, on, label, children }: { icon: IconName; title: string; on: boolean; label?: string; children?: ReactNode }) {
  const t = useT('b5chan');
  return (
    <div className="chan-head">
      <h2>
        <Icon name={icon} size={18} className={`ico chan-${icon}`} /> {title}
      </h2>
      {on ? <Badge tone="green">{t('verbunden{v}', { v: label ? ` · ${label}` : '' })}</Badge> : <Badge>{t('nicht eingerichtet')}</Badge>}
      {children}
    </div>
  );
}

function Status({ at, error }: { at?: string | null; error?: string | null }) {
  const t = useT('b5chan');
  if (!at && !error) return null;
  return (
    <p className="muted small">
      {at && <>{t('Letzter Eingang: {v}.', { v: dt(at) })}</>}
      {error && <span style={{ color: 'var(--red)' }}>{error}</span>}
    </p>
  );
}

/** Runs a settings call and shows its answer under the card instead of a toast. */
async function attempt(fn: () => Promise<any>, set: (r: Result) => void, ok: (r: any) => string) {
  try {
    const r = await fn();
    set({ ok: true, info: ok(r) });
    return r;
  } catch (e) {
    set({ ok: false, error: (e as Error).message });
    return undefined;
  }
}

export function MoreChannelSettings() {
  const t = useT('b5chan');
  return (
    <div className="meta-settings" data-tour="more-channels">
      <p className="muted">{t('Weitere Kanäle für den Posteingang. Tokens werden verschlüsselt gespeichert und nie wieder angezeigt. Anleitung mit Kosten und Webhook-Adressen:')}{' '}<code>docs/channels.md</code>.
      </p>
      <TelegramCard />
      <DiscordCard />
      <SlackCard />
      <PushCard />
    </div>
  );
}

function TelegramCard() {
  const t = useT('b5chan');
  const s = useLoad(() => api.get('/api/settings/channels/telegram'), []);
  const [f, setF] = useState({ bot_token: '', welcome: '', start_tags: '' });
  const [campaign, setCampaign] = useState('');
  const [res, setRes] = useState<Result>();
  useEffect(() => {
    if (s.data) setF({ bot_token: '', welcome: s.data.welcome ?? '', start_tags: (s.data.start_tags ?? []).join(', ') });
  }, [s.data]);
  if (!s.data) return <div className="card"><Spinner /></div>;
  const d = s.data;
  const save = async () => {
    const r = await act(() => api.put('/api/settings/channels/telegram', { ...f, bot_token: f.bot_token || undefined }), t('Gespeichert'));
    if (r) (s.setData({ ...r, webhook_url: d.webhook_url }), setF((x) => ({ ...x, bot_token: '' })));
  };
  const link = d.bot ? `https://t.me/${d.bot.username}${/^[A-Za-z0-9_-]{1,64}$/.test(campaign) ? `?start=${campaign}` : ''}` : '';
  return (
    <div className="card" data-tour="channels-telegram">
      <Head icon="telegram" title="Telegram" on={d.configured} label={d.bot ? `@${d.bot.username}` : undefined}>
        {d.configured && !d.webhook_set && <Badge tone="yellow">{t('Webhook fehlt')}</Badge>}
        <SignupLink id="telegram" />
      </Head>
      <p className="muted small">{t('Bot bei')}{' '}<b>{t('@BotFather')}</b>{' '}{t('anlegen (')}<code>/newbot</code>{t('), Token hier eintragen, speichern, dann')}{' '}<b>{t('„Webhook setzen“')}</b>{t('. Kostenlos. Private Chats landen in den Konversationen.')}</p>
      <Field label={t('Bot-Token')} tour="telegram-token">
        <Input type="password" autoComplete="new-password" value={f.bot_token} onChange={(v) => setF({ ...f, bot_token: v })} placeholder={d.token_set ? t(KEEP) : t('123456789:AA…')} />
      </Field>
      {d.bot && (
        <div className="grid2" data-tour="telegram-deeplink">
          <Field label={t('Kampagnen-Link (Quelle für neue Leads)')} hint={t('Wer den Link öffnet und „Start“ drückt, wird Kontakt mit Quelle telegram / bot / Kampagne – Auslöser „Telegram-Bot gestartet“.')}>
            <Input value={campaign} onChange={setCampaign} placeholder={t('z. B. messe-2026')} maxLength={64} />
          </Field>
          <Field label={t('Link')}>
            <CodeBox text={link} />
          </Field>
        </div>
      )}
      <MoreFields id="channels-telegram" values={[d.start_tags, d.welcome]}>
        <Field label={t('Tags beim Start (Komma)')}>
          <Input value={f.start_tags} onChange={(v) => setF({ ...f, start_tags: v })} placeholder="telegram-lead" />
        </Field>
        <Field label={t('Begrüßung nach /start (optional)')} hint={<MergeHint />}>
          <Textarea value={f.welcome} onChange={(v) => setF({ ...f, welcome: v })} rows={2} placeholder={t('Hallo {{contact.first_name|}}, danke für deine Nachricht! Wir melden uns gleich.')} />
        </Field>
        <Field label={t('Webhook-Adresse (setzt „Webhook setzen“ automatisch)')}>
          <CodeBox text={d.webhook_url} />
        </Field>
      </MoreFields>
      <div className="row" data-tour="telegram-actions">
        <button className="btn" onClick={save}>{t('Speichern')}</button>
        <button className="btn secondary" disabled={!d.configured} onClick={async () => (await attempt(() => api.post('/api/settings/channels/telegram/webhook'), setRes, () => t('Webhook gesetzt – Nachrichten kommen jetzt an'))) && s.reload()}>{t('Webhook setzen')}</button>
        <button className="btn secondary" disabled={!d.configured} onClick={() => attempt(() => api.post('/api/settings/channels/telegram/test'), setRes, (r) => r.info)}>{t('Verbindung testen')}</button>
        {d.token_set && (
          <button className="btn ghost danger-text" onClick={async () => confirmAsk(t('Telegram trennen? Bisherige Nachrichten bleiben erhalten.')) && (await act(() => api.del('/api/settings/channels/telegram'), t('Getrennt'))) && s.reload()}>{t('Trennen')}</button>
        )}
      </div>
      <Line r={res} />
      <Status at={d.last_webhook_at} error={d.last_error} />
    </div>
  );
}

function DiscordCard() {
  const t = useT('b5chan');
  const s = useLoad(() => api.get('/api/settings/channels/discord'), []);
  const [f, setF] = useState({ bot_token: '', channel_ids: '', reply_in_channel: false, command_reply: '' });
  const [res, setRes] = useState<Result>();
  useEffect(() => {
    if (s.data) setF({ bot_token: '', channel_ids: (s.data.channel_ids ?? []).join(', '), reply_in_channel: !!s.data.reply_in_channel, command_reply: s.data.command_reply ?? '' });
  }, [s.data]);
  if (!s.data) return <div className="card"><Spinner /></div>;
  const d = s.data;
  const gw = d.gateway?.status;
  const save = async () => {
    const r = await act(() => api.put('/api/settings/channels/discord', { ...f, bot_token: f.bot_token || undefined }), t('Gespeichert'));
    if (r) (s.setData(r), setF((x) => ({ ...x, bot_token: '' })));
  };
  return (
    <div className="card" data-tour="channels-discord">
      <Head icon="discord" title="Discord" on={d.configured} label={d.bot?.name}>
        {d.configured && <Badge tone={gw === 'ready' ? 'green' : gw === 'error' ? 'red' : 'yellow'}>{gw === 'ready' ? t('Gateway verbunden') : gw === 'error' ? t('Gateway-Fehler') : t('Gateway verbindet …')}</Badge>}
        <SignupLink id="discord" />
      </Head>
      <p className="muted small">{t('Im')}{' '}<b>{t('Discord Developer Portal')}</b>{' '}{t('eine App mit Bot anlegen, unter')}{' '}<b>{t('Bot')}</b>{' '}{t('den')}{' '}<b>{t('Message Content Intent')}</b>{' '}{t('einschalten, Token kopieren. Direktnachrichten an den Bot und Nachrichten in den gewählten Kanälen werden Konversationen. Kostenlos.')}</p>
      <div className="grid2">
        <Field label={t('Bot-Token')} tour="discord-token">
          <Input type="password" autoComplete="new-password" value={f.bot_token} onChange={(v) => setF({ ...f, bot_token: v })} placeholder={d.token_set ? t(KEEP) : t('MTIz…')} />
        </Field>
        <Field label={t('Kanal-IDs, die mitgelesen werden (Komma)')} hint={t('Rechtsklick auf den Kanal → ID kopieren (Entwicklermodus). Leer = nur Direktnachrichten.')}>
          <Input value={f.channel_ids} onChange={(v) => setF({ ...f, channel_ids: v })} placeholder="1234567890123456789" />
        </Field>
      </div>
      {d.invite_url && (
        <p className="small">
          <a href={d.invite_url} target="_blank" rel="noreferrer">
            <Icon name="external" size={13} />{' '}{t('Bot auf deinen Server einladen')}</a>
        </p>
      )}
      <MoreFields id="channels-discord" values={[d.reply_in_channel, d.command_reply]}>
        <Check checked={f.reply_in_channel} onChange={(v) => setF({ ...f, reply_in_channel: v })} label={t('Auf Kanal-Nachrichten im Kanal antworten (sonst per Direktnachricht)')} />
        <Field label={t('Antwort auf /support (nur für die Person sichtbar)')}>
          <Input value={f.command_reply} onChange={(v) => setF({ ...f, command_reply: v })} placeholder={t('Danke! Wir antworten dir per Direktnachricht.')} />
        </Field>
        <Field label={t('Interactions Endpoint URL (Developer Portal → General Information, für /support)')}>
          <CodeBox text={d.interactions_url} />
        </Field>
      </MoreFields>
      <div className="row" data-tour="discord-actions">
        <button className="btn" onClick={save}>{t('Speichern')}</button>
        <button className="btn secondary" disabled={!d.configured} onClick={() => attempt(() => api.post('/api/settings/channels/discord/test'), setRes, (r) => r.info).then(() => s.reload())}>{t('Verbindung testen')}</button>
        <button className="btn secondary" disabled={!d.configured} onClick={() => attempt(() => api.post('/api/settings/channels/discord/commands'), setRes, () => t('Befehl /support registriert (erscheint nach einigen Minuten)'))}>{t('/support registrieren')}</button>
        {d.token_set && (
          <button className="btn ghost danger-text" onClick={async () => confirmAsk(t('Discord trennen? Bisherige Nachrichten bleiben erhalten.')) && (await act(() => api.del('/api/settings/channels/discord'), t('Getrennt'))) && s.reload()}>{t('Trennen')}</button>
        )}
      </div>
      <Line r={res} />
      <Status at={d.last_webhook_at} error={d.gateway?.error || d.last_error} />
    </div>
  );
}

function SlackCard() {
  const t = useT('b5chan');
  const s = useLoad(() => api.get('/api/settings/channels/slack'), []);
  const [f, setF] = useState({ mode: 'bot', bot_token: '', signing_secret: '', channel: '', webhook_url: '', channels: [] as string[] });
  const [res, setRes] = useState<Result>();
  useEffect(() => {
    if (s.data) setF({ mode: s.data.mode, bot_token: '', signing_secret: '', webhook_url: '', channel: s.data.channel ?? '', channels: s.data.channels ?? [] });
  }, [s.data]);
  if (!s.data) return <div className="card"><Spinner /></div>;
  const d = s.data;
  const save = async () => {
    const body: Record<string, any> = { mode: f.mode, channel: f.channel, channels: f.channels };
    for (const k of ['bot_token', 'signing_secret', 'webhook_url'] as const) if (f[k]) body[k] = f[k];
    const r = await act(() => api.put('/api/settings/channels/slack', body), t('Gespeichert'));
    if (r) s.setData(r);
  };
  const toggle = (ch: string, on: boolean) => setF({ ...f, channels: on ? [...f.channels, ch] : f.channels.filter((x) => x !== ch) });
  return (
    <div className="card" data-tour="channels-slack">
      <Head icon="slack" title={t('Slack (Team)')} on={d.configured} label={d.team || (d.mode === 'webhook' ? 'Webhook' : undefined)}>
        {d.configured && d.mode === 'bot' && !d.replies && <Badge tone="yellow">{t('nur Benachrichtigungen')}</Badge>}
        <SignupLink id="slack" />
      </Head>
      <p className="muted small">{t('Neue Kundennachrichten erscheinen als Thread in einem Slack-Kanal. Wer im Thread antwortet, schreibt dem Kunden über seinen Kanal (E-Mail, SMS, WhatsApp, Telegram …). Nachrichten mit')}{' '}<code>//</code>{' '}{t('am Anfang bleiben intern.')}</p>
      <div className="seg" role="group" aria-label={t('Art')} style={{ marginBottom: 10 }}>
        <button type="button" className={f.mode === 'bot' ? 'on' : ''} onClick={() => setF({ ...f, mode: 'bot' })}>{t('Slack-App (mit Antworten)')}</button>
        <button type="button" className={f.mode === 'webhook' ? 'on' : ''} onClick={() => setF({ ...f, mode: 'webhook' })}>{t('Nur Incoming Webhook')}</button>
      </div>
      {f.mode === 'bot' ? (
        <>
          <div className="grid2">
            <Field label={t('Bot User OAuth Token')} tour="slack-token">
              <Input type="password" autoComplete="new-password" value={f.bot_token} onChange={(v) => setF({ ...f, bot_token: v })} placeholder={d.bot_token_set ? t(KEEP) : 'xoxb-…'} />
            </Field>
            <Field label={t('Kanal-ID')} hint={t('Kanal → Details → ganz unten; Bot mit /invite in den Kanal holen')}>
              <Input value={f.channel} onChange={(v) => setF({ ...f, channel: v })} placeholder={t('C0123ABCD')} />
            </Field>
          </div>
          <MoreFields id="channels-slack-replies" label={t('Antworten aus Slack')} values={[d.signing_secret_set]}>
            <Field label={t('Signing Secret (für Antworten aus Slack)')}>
              <Input type="password" autoComplete="new-password" value={f.signing_secret} onChange={(v) => setF({ ...f, signing_secret: v })} placeholder={d.signing_secret_set ? t(KEEP) : t('Basic Information → App Credentials')} />
            </Field>
            <Field label={t('Request URL für Event Subscriptions (Bot-Events message.channels, message.groups)')}>
              <CodeBox text={d.events_url} />
            </Field>
          </MoreFields>
        </>
      ) : (
        <Field label={t('Incoming-Webhook-Adresse')}>
          <Input type="password" autoComplete="new-password" value={f.webhook_url} onChange={(v) => setF({ ...f, webhook_url: v })} placeholder={d.webhook_url_set ? t(KEEP) : 'https://hooks.slack.com/services/…'} />
        </Field>
      )}
      <MoreFields id="channels-slack-filter" values={[d.channels]}>
        <div className="field">
          <span>{t('Welche Kanäle weiterleiten? (nichts gewählt = alle)')}</span>
          <div className="chan-checks">
            {INBOX_CHANNELS.map(([k, l]) => (
              <Check key={k} checked={f.channels.includes(k)} onChange={(v) => toggle(k, v)} label={l} />
            ))}
          </div>
        </div>
      </MoreFields>
      <div className="row" data-tour="slack-actions">
        <button className="btn" onClick={save}>{t('Speichern')}</button>
        <button className="btn secondary" disabled={!d.configured} onClick={() => attempt(() => api.post('/api/settings/channels/slack/test'), setRes, (r) => r.info)}>{t('Testnachricht')}</button>
        {d.configured && (
          <button className="btn ghost danger-text" onClick={async () => confirmAsk(t('Slack trennen?')) && (await act(() => api.del('/api/settings/channels/slack'), t('Getrennt'))) && s.reload()}>{t('Trennen')}</button>
        )}
      </div>
      <Line r={res} />
      <Status at={d.last_webhook_at} error={d.last_error} />
    </div>
  );
}

function PushCard() {
  const t = useT('b5chan');
  const s = useLoad(() => api.get('/api/settings/channels/push'), []);
  const [f, setF] = useState({ enabled: false, button: '', title: '', text: '' });
  useEffect(() => {
    if (s.data) setF({ enabled: s.data.enabled, button: s.data.button, title: s.data.title, text: s.data.text });
  }, [s.data]);
  if (!s.data) return <div className="card"><Spinner /></div>;
  const d = s.data;
  return (
    <div className="card" data-tour="channels-push">
      <Head icon="push" title={t('Push an Kontakte')} on={d.enabled} label={t('{subscribers} Anmeldungen', { subscribers: d.subscribers })} />
      <p className="muted small">{t('Besucher deiner Funnels und Websites können Browser-Benachrichtigungen erlauben (Glocke unten links). Sobald sie ein Formular ausfüllen, gehört die Anmeldung zum Kontakt – dann sendet die Workflow-Aktion')}{' '}<b>{t('„Push an Kontakt“')}</b>{t('. Kostenlos, ohne Fremddienst.')}</p>
      <Check checked={f.enabled} onChange={(v) => setF({ ...f, enabled: v })} label={t('Glocke auf Funnels und Websites zeigen')} tour="push-enabled" />
      <div className="grid2">
        <Field label={t('Text der Glocke')}>
          <Input value={f.button} onChange={(v) => setF({ ...f, button: v })} maxLength={40} />
        </Field>
        <Field label={t('Überschrift im Fenster')}>
          <Input value={f.title} onChange={(v) => setF({ ...f, title: v })} maxLength={80} />
        </Field>
      </div>
      <Field label={t('Erklärung im Fenster')}>
        <Textarea value={f.text} onChange={(v) => setF({ ...f, text: v })} rows={2} maxLength={400} />
      </Field>
      <Field label={t('Anmelde-Link (auch für E-Mails oder fremde Websites)')} hint={t('{linked} von {subscribers} Anmeldungen gehören schon zu einem Kontakt.', { linked: d.linked, subscribers: d.subscribers })}>
        <CodeBox text={d.subscribe_url} />
      </Field>
      <button className="btn" onClick={async () => { const r = await act(() => api.put('/api/settings/channels/push', f), t('Gespeichert')); if (r) s.setData(r); }}>{t('Speichern')}</button>
    </div>
  );
}

// --- workflow steps -----------------------------------------------------------------------------

export function TelegramStep({ step, set }: { step: any; set: (p: any) => void }) {
  const t = useT('b5chan');
  return (
    <>
      <Field label={t('Text')}>
        <Textarea value={step.body} onChange={(v) => set({ body: v })} rows={4} />
      </Field>
      <Field label={t('Datei-Link (optional)')} hint={t('https-Link zu Bild, PDF, Audio oder Video – der Text wird zur Bildunterschrift (max. 1024 Zeichen).')}>
        <Input value={step.media_url} onChange={(v) => set({ media_url: v })} placeholder="https://…" />
      </Field>
      <MergeHint />
      <p className="muted small">{t('Geht nur an Kontakte, die den Telegram-Bot gestartet haben.')}</p>
    </>
  );
}

export function DiscordStep({ step, set }: { step: any; set: (p: any) => void }) {
  const t = useT('b5chan');
  return (
    <>
      <Field label={t('Text (max. 2000 Zeichen)')}>
        <Textarea value={step.body} onChange={(v) => set({ body: v })} rows={4} />
      </Field>
      <MergeHint />
      <p className="muted small">{t('Geht nur an Kontakte, die schon über Discord geschrieben haben (Direktnachricht).')}</p>
    </>
  );
}

export function PushStep({ step, set }: { step: any; set: (p: any) => void }) {
  const t = useT('b5chan');
  return (
    <>
      <Field label={t('Titel (leer = Firmenname)')}>
        <Input value={step.title} onChange={(v) => set({ title: v })} />
      </Field>
      <Field label={t('Text (max. 300 Zeichen)')}>
        <Textarea value={step.body} onChange={(v) => set({ body: v })} rows={3} />
      </Field>
      <Field label={t('Link beim Antippen (optional)')}>
        <Input value={step.url} onChange={(v) => set({ url: v })} placeholder="https://…" />
      </Field>
      <MergeHint />
      <p className="muted small">{t('Geht an alle Geräte, auf denen der Kontakt Benachrichtigungen erlaubt hat (Einstellungen → Weitere Kanäle → Push).')}</p>
    </>
  );
}

export function TelegramTriggerFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useT('b5chan');
  return (
    <Field label={t('Nur Kampagne (leer = jede)')} hint={t('Der Teil nach ?start= im Link t.me/<bot>?start=…')}>
      <Input value={value} onChange={onChange} placeholder="messe-2026" />
    </Field>
  );
}
