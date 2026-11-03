import { isSimple } from '../../../server/services/areas-model';

/**
 * Einstellungen and Agentur in the Einfach-Modus (pure – shared by web/src/areas/SettingsTabs.tsx and
 * tests/easy-settings.test.ts).
 *
 * The tab bar shows the sections a busy admin actually opens: the essential ones plus those of the chosen goals. Every
 * other section sits under "Weitere Einstellungen" (Agentur: "Weitere Bereiche") – grouped and searchable, one click
 * away. The section that is open always shows in the bar (links and tours into a folded section keep working). Profi
 * (or no goals) shows every tab as before. docs/theming.md#einfach-modus explains the behaviour.
 */

export interface TabGroup {
  id: string;
  tabs: readonly string[];
}

/** In the tab bar in Einfach-Modus whenever the login has them (Team/Sub-Accounts only for admins, Abo only with a plan). */
export const SETTINGS_ESSENTIAL = ['company', 'messaging', 'ai-providers', 'team', 'subscription', 'appearance', 'account'] as const;

/** Sections a goal adds to the tab bar (goal ids of server/services/areas-model.ts). */
export const SETTINGS_BY_GOAL: Readonly<Record<string, readonly string[]>> = {
  leads: ['channels', 'chat'],
  courses: ['billing', 'stripe'],
  agency: ['locations', 'channels'],
  office: ['billing', 'stripe'],
};

/** The groups of "Weitere Einstellungen" in display order (labels live in SettingsTabs.tsx, so they are translated). */
export const SETTINGS_GROUPS: readonly TabGroup[] = [
  { id: 'messages', tabs: ['messaging', 'deliverability', 'channels', 'more-channels', 'telephony', 'chat', 'inbox'] },
  { id: 'money', tabs: ['billing', 'stripe', 'reviews'] },
  { id: 'ai', tabs: ['ai-providers', 'ai', 'ai-tools', 'voice', 'memory'] },
  { id: 'service', tabs: ['helpdesk'] },
  { id: 'data', tabs: ['fields', 'custom-values', 'consent', 'api', 'import', 'umzug'] },
  { id: 'account', tabs: ['company', 'team', 'locations', 'subscription', 'appearance', 'account'] },
];

/** What people type when they look for a setting, beyond the section's (translated) label. */
export const SETTINGS_KEYWORDS: Readonly<Record<string, string>> = {
  company: 'Firma Logo Adresse Zeitzone Impressum Webseite Telefon company address logo timezone', // i18n-ignore
  messaging: 'SMTP Absender Postfach Gmail Outlook Tracking Öffnungen Klicks SMS Twilio Gateway Test eingehend sender mailbox', // i18n-ignore
  deliverability: 'SPF DKIM DMARC DNS Domain Zustellbarkeit Spam deliverability', // i18n-ignore
  channels: 'WhatsApp Facebook Instagram Messenger Meta', // i18n-ignore
  'more-channels': 'Telegram Discord Slack LinkedIn TikTok Google Business', // i18n-ignore
  telephony: 'Telefon Anrufe Nummer Voicemail Browser-Telefon Voice phone calls', // i18n-ignore
  billing: 'Rechnung Steuernummer USt-IdNr IBAN Bank Nummernkreis XRechnung ZUGFeRD Kleinunternehmer Zahlungsziel invoice tax', // i18n-ignore
  stripe: 'Stripe Zahlung PayPal Mollie bezahlen Checkout payments', // i18n-ignore
  reviews: 'Bewertung Google Rezension Sterne reviews', // i18n-ignore
  chat: 'Live-Chat Widget Website Einbau embed', // i18n-ignore
  ai: 'KI Assistent Antworten Bot assistant', // i18n-ignore
  'ai-tools': 'KI Werkzeuge MCP Tools', // i18n-ignore
  helpdesk: 'Service Tickets SLA Wissensdatenbank Kundenportal helpdesk', // i18n-ignore
  inbox: 'Team-Posteingang Zuweisung Round Robin SLA inbox', // i18n-ignore
  fields: 'Eigene Felder Tags Eigenschaften custom fields', // i18n-ignore
  'custom-values': 'Platzhalter Variablen Custom Values', // i18n-ignore
  consent: 'DSGVO Einwilligung Datenschutz Double-Opt-in Recht GDPR consent privacy', // i18n-ignore
  api: 'API-Schlüssel Webhooks Zapier Make n8n Signatur REST keys', // i18n-ignore
  'ai-providers': 'KI-Anbieter OpenAI Anthropic Claude Gemini Ollama OpenRouter Schlüssel BYOK Modell model key', // i18n-ignore
  voice: 'Stimme Sprachausgabe TTS ElevenLabs voice', // i18n-ignore
  memory: 'Gedächtnis Cognee Wissen memory', // i18n-ignore
  import: 'Import HubSpot GoHighLevel CSV', // i18n-ignore
  umzug: 'Umzug Wechsel Migration GoHighLevel move', // i18n-ignore
  team: 'Benutzer Mitarbeiter Rollen Rechte 2FA users roles', // i18n-ignore
  locations: 'Sub-Accounts Kunden Backups clients', // i18n-ignore
  subscription: 'Abo Tarif Cloud Plan subscription', // i18n-ignore
  appearance: 'Darstellung Theme Farbe Dunkel Einfach-Modus Profi Ziele Menü appearance dark', // i18n-ignore
  account: 'Passwort 2FA Geräte Sprache Kalender Push password devices language', // i18n-ignore
};

// --- Agentur ---------------------------------------------------------------------------------------------------------

/** The Agentur tabs an agency works with every week; the cross-project lists, API, logs and system sit under "Weitere Bereiche". */
export const AGENCY_ESSENTIAL = ['projects', 'clients', 'saas', 'cloud', 'snapshots', 'domains', 'branding'] as const;

export const AGENCY_GROUPS: readonly TabGroup[] = [
  { id: 'overview', tabs: ['projects', 'contacts', 'deals', 'tasks', 'docs'] },
  { id: 'clients', tabs: ['clients', 'saas', 'cloud', 'snapshots', 'umzug'] },
  { id: 'brand', tabs: ['domains', 'branding', 'login'] },
  { id: 'connect', tabs: ['integrations', 'partner-links', 'api', 'mcp-servers', 'ai-tools', 'ai-providers'] },
  { id: 'system', tabs: ['feedback', 'audit', 'system'] },
];

export const AGENCY_KEYWORDS: Readonly<Record<string, string>> = {
  projects: 'Projekte Sub-Accounts Übersicht projects', // i18n-ignore
  contacts: 'Alle Kontakte contacts', // i18n-ignore
  deals: 'Alle Deals Opportunities', // i18n-ignore
  tasks: 'Alle Aufgaben tasks', // i18n-ignore
  docs: 'Dokumente Artefakte docs', // i18n-ignore
  clients: 'Kunden Sub-Account anlegen Branding clients', // i18n-ignore
  saas: 'SaaS Tarife Abo Preise Rebilling plans', // i18n-ignore
  cloud: 'Cloud Konsole', // i18n-ignore
  snapshots: 'Snapshots Vorlagen Startpaket templates', // i18n-ignore
  umzug: 'Umzug Migration GoHighLevel', // i18n-ignore
  domains: 'Domains DNS SSL HTTPS', // i18n-ignore
  branding: 'White-Label Logo Farbe Login-Seite Favicon branding', // i18n-ignore
  login: 'Anmeldung SSO OIDC Google Microsoft Passkey 2FA login', // i18n-ignore
  integrations: 'Integrationen Postiz Google Microsoft OAuth Supabase Todoist Nango Composio', // i18n-ignore
  'partner-links': 'Partner-Links Affiliate', // i18n-ignore
  api: 'API MCP Schlüssel keys', // i18n-ignore
  'mcp-servers': 'MCP-Server Werkzeuge', // i18n-ignore
  'ai-tools': 'KI-Werkzeuge tools', // i18n-ignore
  'ai-providers': 'KI-Anbieter OpenAI Anthropic Claude Gemini Ollama BYOK Schlüssel', // i18n-ignore
  feedback: 'Fehler Wünsche Feedback bugs', // i18n-ignore
  audit: 'Protokoll Audit Log', // i18n-ignore
  system: 'System Gesundheit Backups Updates health', // i18n-ignore
};

// --- shared rules ------------------------------------------------------------------------------------------------------

/** The sections in the settings tab bar for these goals (essential + the goals' extras); null outside Einfach-Modus (= all). */
export function essentialSettings(goals: readonly string[]): string[] | null {
  if (!isSimple(goals)) return null;
  const out: string[] = [...SETTINGS_ESSENTIAL];
  for (const g of goals) for (const k of SETTINGS_BY_GOAL[g] ?? []) if (!out.includes(k)) out.push(k);
  return out;
}

/**
 * Splits tabs (keys in display order) into the tab bar and the folded rest. `essential` null = Profi: all in the bar.
 * The open tab always stays in the bar; the bar never ends up empty.
 */
export function splitTabs(keys: readonly string[], essential: readonly string[] | null, current?: string): { main: string[]; more: string[] } {
  if (!essential) return { main: [...keys], more: [] };
  const keep = new Set([...essential, ...(current ? [current] : [])]);
  const main = keys.filter((k) => keep.has(k));
  if (!main.length) return { main: [...keys], more: [] };
  return { main, more: keys.filter((k) => !keep.has(k)) };
}

/** Einstellungen: tab bar and "Weitere Einstellungen". */
export const splitSettingsTabs = (keys: readonly string[], opts: { goals: readonly string[]; current?: string }) => splitTabs(keys, essentialSettings(opts.goals), opts.current);

/** Agentur: tab bar and "Weitere Bereiche". */
export const splitAgencyTabs = (keys: readonly string[], opts: { goals: readonly string[]; current?: string }) => splitTabs(keys, isSimple(opts.goals) ? AGENCY_ESSENTIAL : null, opts.current);

/** The given tabs in their groups (group order, then tab order); tabs in no group come last under "other". */
export function groupTabs(keys: readonly string[], groups: readonly TabGroup[]): { id: string; tabs: string[] }[] {
  const seen = new Set<string>();
  const out: { id: string; tabs: string[] }[] = [];
  for (const g of groups) {
    const tabs = g.tabs.filter((k) => keys.includes(k) && !seen.has(k));
    tabs.forEach((k) => seen.add(k));
    if (tabs.length) out.push({ id: g.id, tabs });
  }
  const rest = keys.filter((k) => !seen.has(k));
  if (rest.length) out.push({ id: 'other', tabs: rest });
  return out;
}

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss');

export const groupSettings = (keys: readonly string[]) => groupTabs(keys, SETTINGS_GROUPS);

/** The tabs matching a search (every word must appear in the label, the key or the search words); empty query = all. */
export function searchTabs(query: string, tabs: readonly (readonly [string, string])[], keywords: Readonly<Record<string, string>>): string[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return tabs.map(([k]) => k);
  return tabs.filter(([k, label]) => {
    const hay = fold(`${label} ${k} ${keywords[k] ?? ''}`);
    return words.every((w) => hay.includes(w));
  }).map(([k]) => k);
}

export const searchSettings = (query: string, tabs: readonly (readonly [string, string])[]) => searchTabs(query, tabs, SETTINGS_KEYWORDS);
