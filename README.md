# V Media CRM

The CRM and client-operations platform of **[V Media Production](https://vmediaproduction.com)** – video production,
digital marketing and AI automation from Odisha, for clients all over India. One self-hosted app for contacts and
companies, pipelines and deals, a shared inbox (e-mail, SMS, WhatsApp, social), calendars and bookings, funnels and
websites, invoices, projects and time tracking, helpdesk, courses and communities – plus 140+ triggers and 130+ actions
for automations and 340+ MCP tools so AI agents (Claude, ChatGPT, Codex) can work in the CRM with the same permissions
and audit log as a person.

Defaults for a new install: product name **V Media CRM**, brand colour crimson `#c8191f`, English interface (German
stays selectable per person), time zone `Asia/Kolkata`.

## Quick start

Requirements: Node.js 22.13 or newer. Data lives in SQLite under `./data` (set `PGHL_DATA_DIR` to change it).

```bash
cp .env.example .env      # optional – company name, time zone, mail/SMS providers, base URL …
npm ci && npm run build
npm start                 # → http://localhost:4700
```

The first visit shows the setup page: create the admin login and the first sub-account. For development with hot
reload run `npm run dev` (API and Vite dev server together). `npm test` runs the test suite, `npm run typecheck` the
type check.

## Demo data

To look around with a filled CRM, seed an empty data folder with fictional demo data and start on it:

```bash
npm run demo:seed -- --data-dir ./demo-data
PGHL_DATA_DIR=./demo-data npm start
```

The seed prints the demo login. `--reset` wipes and re-seeds the folder.

## Deploy

Docker image, Docker Compose with Caddy (automatic HTTPS), Coolify and other hosts are described in
[docs/deploy](docs/deploy/README.md); configuration, backups and updates in [Self-hosting](docs/self-hosting.md).
Set `PGHL_BASE_URL` to the public address – every link the CRM sends (bookings, invoices, unsubscribe) uses it.

## At a glance

| Area | What you get |
|---|---|
| CRM | Contacts, companies, custom objects, pipelines and deals, tasks, notes, smart lists, imports ([docs](docs/objects.md)) |
| Inbox & channels | Shared team inbox for e-mail, SMS, WhatsApp, Facebook and Instagram, live chat, telephony ([docs](docs/team-inbox.md)) |
| Marketing | Funnels and websites, forms, e-mail builder and campaigns, social planner, ads manager ([docs](docs/sites.md)) |
| Automation | Workflows with 140+ triggers and 130+ actions, AI steps, webhooks and REST hooks ([docs](docs/workflow-actions.md)) |
| AI | Built-in AI agent, bring-your-own AI providers, 340+ MCP tools for Claude, ChatGPT and Codex ([docs](docs/ai-tools.md)) |
| Switching over (Umzug) | Import from Mailchimp, ActiveCampaign, Kit (ConvertKit), Kajabi, Teachable, Keap, Pipedrive, systeme.io, Klaviyo, Brevo, KlickTipp, ManyChat, Zendesk, Intercom, Salesforce, Zoho CRM, monday.com, ClickUp, Notion, Airtable, Typeform, Calendly, Lexware Office and sevDesk – plus GoHighLevel and HubSpot ([docs](docs/umzug.md)) |
| Agency | Unlimited sub-accounts and users, white label (name, logo, colour, own domain), snapshots ([docs](docs/saas.md)) |

## Documentation

<details>
<summary>All documentation pages</summary>

- [Academy – guided tours](docs/academy.md)
- [Ads manager (Meta & Google Ads)](docs/ads-manager.md)
- [HyperLevel Agent (KI-Agent)](docs/agent.md)
- [AI assistant (Conversation AI)](docs/ai-assistant.md)
- [AI providers (BYOK): bring your own key for any model](docs/ai-providers.md)
- [AI Studio](docs/ai-studio.md)
- [AI tools: Codex, Claude Code, Cursor, ChatGPT and Claude.ai](docs/ai-tools.md)
- [Android app “HyperLevel”](docs/android-app.md)
- [API](docs/api.md)
- [Installing the app & push notifications](docs/app.md)
- [Apps: gray-label app, own-brand apps, push relay](docs/apps.md)
- [Structure](docs/architecture.md)
- [Sign-in, SSO & passkeys](docs/auth.md)
- [Back-Office: bookkeeping (light), stock and HR](docs/backoffice.md)
- [Backups, uptime and the status page](docs/backups.md)
- [Booking rules (limits, special days, reminders, follow-up)](docs/booking.md)
- [Bug reports & wishes](docs/bug-reports.md)
- [Canvas – infinite boards for drawing, planning and design](docs/canvas.md)
- [Channels & providers](docs/channels.md)
- [Hosted cloud version (PGHL_CLOUD_MODE=1)](docs/cloud.md)
- [Knowledge memory (Cognee)](docs/cognee.md)
- [Live collaboration everywhere](docs/collaboration.md)
- [Comment to DM (Kommentar-zu-DM)](docs/comment-to-dm.md)
- [Community](docs/community.md)
- [Company playbook: running your company on HyperLevel](docs/company-playbook.md)
- [Connectors: Composio (250+ apps), Nango, external MCP servers and native connectors](docs/connectors.md)
- [Consent & legal: provable opt-ins, cookie banner, legal texts, checkout rules](docs/consent.md)
- [Courses in depth (video, discussion, paths, cohorts)](docs/courses.md)
- [Custom Values](docs/custom-values.md)
- [E-Mail-Zustellung prüfen (deliverability)](docs/deliverability.md)
- [Demo mode](docs/demo-mode.md)
- [Dunning (Mahnwesen) and the billing page](docs/dunning.md)
- [Email designer (drag & drop)](docs/email-builder.md)
- [E-mail marketing: tests, segments, templates and deliverability](docs/email-marketing.md)
- [E-mail tracking you can trust (opens and clicks)](docs/email-tracking.md)
- [Forms in depth (Typeform-style)](docs/forms.md)
- [AI media generation (KI-Studio)](docs/genmedia.md)
- [Gewinnrechner (profit calculator)](docs/gewinnrechner.md)
- [Growth: attribution, affiliates & ad reports](docs/growth.md)
- [Service: tickets, SLAs, knowledge base, surveys & health score](docs/helpdesk.md)
- [Incident runbook](docs/incident-runbook.md)
- [Integrations: Zapier, Make, n8n, REST hooks, inbound webhooks, HubSpot migration, Lexware Office/sevDesk](docs/integrations.md)
- [Invoicing: GoBD finalising, Storno, credit notes and the e-invoice](docs/invoicing.md)
- [iPhone, iPad and foldables: the installable web app](docs/ios-web-app.md)
- [Kurs: Deine Firma mit HyperLevel führen](docs/kurs-firma-fuehren.md)
- [Landing page (PGHL_LANDING=1)](docs/landing.md)
- [Living Boards (Genius-Modulbaukasten)](docs/living-boards.md)
- [Mailbox sync: Gmail and Outlook / Microsoft 365](docs/mailbox-sync.md)
- [External MCP servers (MCP client)](docs/mcp-client.md)
- [WhatsApp, Messenger & Instagram](docs/meta-channels.md)
- [Nango: connectors with your own OAuth apps](docs/nango.md)
- [Companies, custom objects, associations & lead scoring](docs/objects.md)
- [Office – documents, spreadsheets, presentations and PDF](docs/office.md)
- [Partner program](docs/partner-program.md)
- [Payment plans (Ratenzahlung)](docs/payment-plans.md)
- [Payment providers: Stripe, PayPal and Mollie](docs/payment-providers.md)
- [Performance and sizing](docs/performance.md)
- [Project planning & time tracking](docs/projects.md)
- [Quizzes, assignments and certificates](docs/quizzes-certificates.md)
- [Provider sign-up links and partner links](docs/referrals.md)
- [Reports & dashboards](docs/reports.md)
- [Reputation: reviews from many platforms](docs/reputation.md)
- [Roadmap](docs/roadmap.md)
- [SaaS mode: selling sub-accounts to your own customers](docs/saas.md)
- [Vertrieb (sales)](docs/sales.md)
- [Security review – October 2026](docs/security-review-2026-10.md)
- [Security](docs/security.md)
- [Self-hosting](docs/self-hosting.md)
- [SEPA direct debit and transfer files (without Stripe)](docs/sepa.md)
- [Funnel & Website AI](docs/site-ai.md)
- [Website builder: editor, templates, content, accessibility & analytics](docs/sites.md)
- [Social comments in the inbox](docs/social-comments.md)
- [Social Planner: client approval and evergreen categories](docs/social-planner.md)
- [Online store and gift cards](docs/store.md)
- [Stripe payments](docs/stripe.md)
- [Team calendars: round robin, collective, classes, questions, payment and video links](docs/team-calendars.md)
- [Team-Chat – talk to your team inside HyperLevel](docs/team-chat.md)
- [Team inbox: assignment, status, notes and answer deadlines](docs/team-inbox.md)
- [Telephony: menus, queues, numbers, power dialer and call intelligence](docs/telephony.md)
- [Appearance: themes, accent, department colours, sidebar, icons, logos](docs/theming.md)
- [Todoist sync](docs/todoist.md)
- [Translating HyperLevel](docs/translating.md)
- [Umzug (switch-over importers)](docs/umzug.md)
- [Undo, history and trash](docs/undo.md)
- [Video studio (OpenShorts)](docs/video-studio.md)
- [Voice (Stimme): bring your own speech providers](docs/voice.md)
- [Webinare (automated webinars)](docs/webinars.md)
- [Werkstatt, plugins and Marktplatz](docs/werkstatt.md)
- [Wiki – team knowledge next to the CRM](docs/wiki.md)
- [Workflow actions and triggers](docs/workflow-actions.md)
- [AI workflow builder (KI-Workflow-Builder)](docs/workflow-ai.md)
- [XR: Raum-Modus, Arbeitsfläche and boards in the headset](docs/xr.md)
- [Handbuch (German handbook)](docs/handbuch.md)
- [Documentation index](docs/README.md)

</details>

## License and credits

Copyright © 2026 **V Media Production**. All modifications and additions.

V Media CRM is based on **[GoHyperLevel](https://github.com/BAISESYSTEMS/GoHyperLevel)** and, like it, licensed under
the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0-only); see [NOTICE](NOTICE) for the attribution and
third-party notices. Because it is AGPL software that people use over a network, everyone who uses this instance must
be offered the complete corresponding source code of the version that runs (including our changes) – keep the in-app
source link working and publish every modification.
