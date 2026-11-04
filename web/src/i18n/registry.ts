/**
 * Languages and translation namespaces of the app – the one list the runtime (./index.ts) and `npm run i18n:check`
 * (scripts/i18n-check.mjs) share. How to translate or add a language: docs/translating.md.
 *
 * German is the source language: the texts in the code are German and double as the message ids (`t('Speichern')`).
 * A catalog maps them to another language (`en/core.ts`: `Speichern: 'Save'`). A text missing from a catalog shows in
 * German – never as a raw key. Each catalog is a chunk of its own, loaded when the language is in use, so German users
 * download no catalog at all.
 */

/** Plural forms of one text (Intl.PluralRules categories, `zero` = an explicit text for 0). `other` is required. */
export interface PluralForms {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}
export type Catalog = Record<string, string | PluralForms>;

/** `intl`: the formatting locale when the browser asks for no regional variant of the language. */
export const LOCALES = {
  de: { name: 'Deutsch', intl: 'de-DE' },
  en: { name: 'English', intl: 'en-IN' },
} as const;
export type Locale = keyof typeof LOCALES;
export const SOURCE_LOCALE = 'de' satisfies Locale;
/** The UI language when the browser asks for none we have (V Media CRM: an Indian agency – English, German stays selectable). */
export const FALLBACK_LOCALE = 'en' satisfies Locale;
/** V Media CRM runs in English only: every person, every device, no language switch. German stays the source text. */
export const ENGLISH_ONLY = true;

/**
 * Namespaces: the texts of a group of files (paths relative to web/src). `complete: true` means every text in those files
 * is translated into every language – `npm run i18n:check` fails on a missing one. `server: true` holds messages the
 * server sends (its error texts), which the check finds in server/ instead of web/src.
 * The metadata is read by the check only; the app itself uses CATALOGS below.
 */
export const NAMESPACES = {
  // + the "Aufs Canvas" button of record pages and editors (contact, company, deal pipeline, ticket, workflow), the
  // opened/clicked note of e-mails (contact timeline, inbox, campaigns) and the sortable tiles (sortable/Sortable.tsx)
  core: { complete: true, files: ['ui.tsx', 'api.ts', 'boot.tsx', 'lazy.tsx', 'i18n/LanguageMenu.tsx', 'canvas/pin.tsx', 'pages/MailEngagement.tsx', 'QrCode.tsx', 'qr.ts', 'charts/core.tsx', 'charts/BarChart.tsx', 'charts/LineChart.tsx', 'charts/Shapes.tsx', 'charts/ReportView.tsx', 'referrals.tsx', 'pages/ContentKit.tsx', 'sortable/Sortable.tsx'] },
  errors: { complete: false, server: true, files: [] },
  shell: {
    complete: true,
    // `file#A,B` = only those components of a file (the top-bar buttons of areas that are not translated yet)
    files: ['main.tsx', 'nav.tsx', 'theme/Sidebar.tsx', 'ios/TabBar.tsx', 'ios/tabs.ts', 'ios/MasterDetail.tsx', 'pages/PmGlobal.tsx', 'demo.tsx', 'undo/Undo.tsx#ToastView,HistoryButton', 'agent/Panel.tsx#AgentButton', 'pages/Feedback.tsx#FeedbackButton'],
  },
  login: { complete: true, files: ['pages/Login.tsx', 'webauthn.ts'] },
  dashboard: { complete: true, files: ['pages/Dashboard.tsx'] },
  contacts: {
    complete: true,
    // the list's filters and badges that live in their areas' files
    files: ['pages/Contacts.tsx', 'pages/ObjectKit.tsx#CompanyFilter', 'pages/LeadScoring.tsx#LeadScoreFilter', 'pages/HealthScore.tsx#HealthBadge,HealthFilter', 'pages/Attribution.tsx#AttributionFilter'],
  },
  deals: { complete: true, files: ['pages/Opportunities.tsx', 'pages/DealBoard.tsx', 'pages/deal-kit.ts', 'pages/DealList.tsx'] },
  inbox: { complete: true, files: ['pages/Conversations.tsx', 'pages/MsgDrafts.tsx', 'pages/TeamInboxKit.tsx', 'pages/MetaInbox.tsx#ChannelFilter', 'pages/Tickets.tsx#TicketFromConversation'] },
  calendar: { complete: true, files: ['pages/Calendars.tsx', 'pages/OAuthConnect.tsx#CalendarConnectionInfo'] },
  // the calendar view (day/week/month/team/agenda, drawer, booking from a slot, series) and the chat bot's "Termin buchen" settings
  calview: { complete: true, files: ['pages/CalendarView.tsx', 'pages/CalendarGrid.tsx', 'pages/CalendarDrawer.tsx', 'pages/AiBookingSettings.tsx', 'pages/calview-model.ts'] },
  settings: {
    complete: true,
    // Mein Konto's panels from other files (sign-in methods, push, app devices, iPhone app, calendar connections)
    files: ['pages/Settings.tsx', 'pages/SignInMethods.tsx', 'pages/PushSettings.tsx', 'ios/push-flow.ts', 'pages/MobileApp.tsx#AppDevices', 'ios/IosAppCard.tsx', 'ios/install.ts', 'pages/OAuthConnect.tsx#CalendarConnections,ConnectionCard'],
  },
  invoices: { complete: true, files: ['pages/Payments.tsx', 'pages/InvoiceLegal.tsx#StateBadge', 'pages/Stripe.tsx#StripeStatusBadge,StripePaidBadge'] },
  // Live-Zusammenarbeit überall (top bar, sidebar avatars, banners, the Canvas header's people)
  presence: { complete: true, files: ['presence/Presence.tsx', 'presence/canvas.tsx'] },
  // phase 2 – automations: list, editor (builder, trigger and step settings, action picker, conditions), runs, test run, versions, import, AI builder
  workflows: { complete: true, files: ['pages/Workflows.tsx', 'pages/WorkflowTools.tsx', 'pages/WorkflowRuns.tsx', 'pages/WorkflowAi.tsx', 'pages/WorkflowErrors.tsx'] },
  // the visual workflow canvas (a lazy chunk) and the builder tools both editors share: copy/paste, move, pause, validation
  wfcanvas: { complete: true, files: ['workflow-canvas/WorkflowCanvas.tsx', 'workflow-canvas/WorkflowCanvasParts.tsx', 'workflow-canvas/tools.tsx', 'workflow-canvas/clipboard.ts', 'workflow-canvas/issues.ts', 'workflow-canvas/layout.ts'] },
  // the drag-and-drop email designer (campaigns, templates, the workflow step "E-Mail senden") – a chunk of its own
  email: { complete: true, files: ['pages/EmailBuilder.tsx'] },
  // e-mail marketing: campaigns with A/B tests, reminders, send time and speed, segments, template gallery, templates,
  // deliverability (reputation, warm-up, hygiene, address checks), trigger links
  campaigns: {
    complete: true,
    files: ['pages/Campaigns.tsx', 'pages/CampaignAb.tsx', 'pages/CampaignExtras.tsx', 'pages/CampaignThrottle.tsx', 'campaign-throttle.ts', 'pages/UmzugMailBanner.tsx', 'pages/Segments.tsx', 'pages/EmailGallery.tsx', 'pages/Deliverability.tsx', 'pages/DeliverabilityTools.tsx', 'pages/MarketingKit.tsx'],
  },
  // funnels and websites: list, page builder (structure, blocks, inspector), design, CMS collections, redirects, statistics,
  // accessibility check, template gallery, blog, A/B tests of pages
  sites: {
    complete: true,
    files: ['pages/Funnels.tsx', 'pages/site/Editor.tsx', 'pages/site/Inspector.tsx', 'pages/site/Tree.tsx', 'pages/site/Fields.tsx', 'pages/site/blocks.ts', 'pages/site/model.ts', 'pages/site/Design.tsx', 'pages/site/Cms.tsx', 'pages/site/Redirects.tsx', 'pages/site/A11y.tsx', 'pages/site/Analytics.tsx', 'pages/site/Templates.tsx', 'pages/Blog.tsx', 'pages/AbTests.tsx'],
  },
  // forms & surveys: list, builder (field types, options, jumps, conditions), design & flow, scoring, security, analytics,
  // submissions, template gallery, consent setting
  forms: { complete: true, files: ['pages/Forms.tsx', 'pages/FormFields.tsx', 'pages/FormDesign.tsx', 'pages/FormConsent.tsx'] },
  // a form field into a company, deal or custom-object field (docs/forms.md#field-mapping)
  formmap: { complete: true, files: ['pages/FormMapping.tsx'] },
  // tasks and project planning: my tasks, projects (list, board, calendar, Gantt, workload), task details, settings and
  // automations, the planner's workflow steps, time tracking, budgets and profitability
  pm: {
    complete: true,
    files: ['pages/Tasks.tsx', 'pages/TaskDetail.tsx', 'pages/pm-format.ts', 'pages/Pm.tsx', 'pages/PmKit.tsx', 'pages/PmBoard.tsx', 'pages/PmList.tsx', 'pages/PmCalendar.tsx', 'pages/PmGantt.tsx', 'pages/PmWorkload.tsx', 'pages/PmTask.tsx', 'pages/PmTaskParts.tsx', 'pages/PmSettings.tsx', 'pages/PmWorkflow.tsx', 'pages/PmTime.tsx', 'pages/PmBudget.tsx', 'pages/PmProfit.tsx'],
  },
  // reports: dashboards, the report builder, schedules, and the labels of the report sources and results
  reports: { complete: true, files: ['pages/Reports.tsx', 'pages/ReportBuilder.tsx', 'pages/ReportDashboard.tsx', 'pages/ReportKit.tsx'] },
  // wiki and team chat (and their shared CollabKit: emoji menu, embeds, record picker)
  collab: { complete: true, files: ['pages/Wiki.tsx', 'pages/WikiEditor.tsx', 'pages/WikiDialogs.tsx', 'pages/TeamChat.tsx', 'pages/ChatParts.tsx', 'pages/ChatDialogs.tsx', 'pages/CollabKit.tsx'] },
  // Office: file list, file view (versions, comments, links, AI box) and the editor bridge
  office: { complete: true, files: ['pages/Office.tsx', 'pages/OfficeParts.tsx', 'pages/OfficeFile.tsx', 'pages/OfficeEditor.tsx', 'pages/office-kit.ts'] },
  // courses: list, editor (content, lessons, videos, members, settings), discussion, reviews, cohorts, analytics, learning
  // paths, the members' area settings, the course workflow step and trigger filter, a contact's courses
  courses: { complete: true, files: ['pages/Courses.tsx', 'pages/CourseTabs.tsx', 'pages/CourseVideo.tsx', 'pages/CoursePaths.tsx'] },
  // social planner: calendar, list, composer, statistics, connecting channels
  social: { complete: true, files: ['pages/Social.tsx'] },
  // helpdesk: tickets (list, board, dashboard, workload, detail with timeline and replies), helpdesk settings, the ticket
  // workflow step and trigger filter, tickets from forms and calls (TicketFromConversation belongs to inbox)
  helpdesk: {
    complete: true,
    files: [
      'pages/Tickets.tsx#PRIORITY,KIND_TONE,CHANNELS,PriorityBadge,StatusBadge,useNow,dur,slaInfo,SlaChip,useTicketMeta,ContactPicker,NewTicket,FILTER_KEYS,loadLayout,BulkBar,TicketKanban,TicketList,fmtMin,TrendChart,Bars,HelpdeskDashboard,Workload,Tickets,EVENT_ICON,FACES,eventLine,Timeline,ReplyBox,MergeModal,TicketDetail,TicketFromCall',
      'pages/HelpdeskSettings.tsx',
    ],
  },
  // AI builders: Funnel & Website AI ("Mit KI erstellen", the builder's AI side panel, the draft banner, the AI writer for blog
  // and e-mail text blocks) and "KI-Agent mit KI erstellen"
  siteai: { complete: true, files: ['pages/site/AiCreate.tsx', 'pages/site/AiPanel.tsx', 'pages/site/AiWriter.tsx', 'pages/site/ai-kit.tsx', 'agent/AgentAiCreate.tsx'] },
  // Settings → Custom Values: global placeholders {{custom_values.key}}, folders, form targets, preview
  customvalues: { complete: true, files: ['pages/CustomValues.tsx'] },
  // tag colours and categories (settings card, the shared chip component)
  tags: { complete: true, files: ['pages/TagMeta.tsx', 'tag-chip.tsx', 'color-pick.tsx'] },
  // the shared list-view building block: smart-list tabs, column picker, filter rows, table with selection, bulk bar, pager
  lists: { complete: true, files: ['pages/ListKit.tsx'] },
  // mark as spam and block sender (conversation header)
  spam: { complete: true, files: ['pages/InboxSpam.tsx'] },
  // call scripts: the panel in the browser phone and power dialer, the editor under Anrufe → Leitfäden
  callscripts: { complete: true, files: ['pages/CallScripts.tsx'] },
  // better notes: the contact's notes tab and the fields of the workflow step "Notiz"
  notes: { complete: true, files: ['pages/NotesPlus.tsx'] },
  // built-in templates on the agency's Snapshots tab ("Software- & SaaS-Firma (HQ)" – docs/company-playbook.md)
  templates: { complete: true, files: ['pages/SnapshotTemplates.tsx'] },
  // reviews from other platforms on the Bewertungen page (Trustpilot, Facebook, ProvenExpert, Yelp, Tripadvisor, import)
  reviewsources: { complete: true, files: ['pages/ReviewSources.tsx'] },
  // social comments in the inbox (reply, hide, AI suggestion) and which platforms are read
  socialcomments: { complete: true, files: ['pages/SocialComments.tsx'] },
  aistudio: { complete: true, files: ['pages/AiStudio.tsx', 'pages/AiStudioPublish.tsx'] },
  // several Facebook pages / Instagram accounts under Einstellungen → Kanäle
  metapages: { complete: true, files: ['pages/MetaPages.tsx'] },
  // outbound AI calls under the KI-Telefonagent
  voiceout: { complete: true, files: ['pages/VoiceOutbound.tsx'] },
  // own numbers as caller ID under Einstellungen → Telefonie
  callerids: { complete: true, files: ['pages/CallerIds.tsx'] },
  // the project's stored files on the Projekt-Steckbrief (slot "project.files")
  projectfiles: { complete: true, files: ['pages/ProjectFiles.tsx'] },
  // Einfach-Modus: goal setup and banner, the "Mehr" panel of the adaptive sidebar, area descriptions and quick actions
  simple: { complete: true, files: ['areas/GoalSetup.tsx', 'areas/MorePanel.tsx', 'areas/info.ts', 'areas/QuickMenu.tsx', 'areas/fields.tsx', 'areas/SettingsTabs.tsx', 'areas/SetupChecklist.tsx'] },
  // operations under Agentur → System (health, alerts, off-site backup, status page incidents) and abuse handling under Agentur → Cloud
  ops: { complete: true, files: ['pages/OpsPanel.tsx', 'pages/CloudAbuse.tsx'] },
  // online store (orders, products, collections, shipping), gift cards and the PayPal/Mollie settings (docs/store.md, docs/payment-providers.md)
  store: { complete: true, files: ['pages/Shop.tsx', 'pages/GiftCards.tsx', 'pages/PayProviders.tsx'] },
  // HighLevel parity panels: several signers of a contract (slot "contract.signers"), … (docs/sales.md, docs/booking.md, docs/forms.md, docs/store.md)
  parity: { complete: true, files: ['pages/ContractSigners.tsx', 'pages/ServiceMenus.tsx', 'pages/Loyalty.tsx', 'pages/ShopAbandoned.tsx'] },
  // Fokus-Modus: the entry at the top left, the round menu button, the prompt with voice, the answer and its tiles (docs/living-boards.md#fokus-modus)
  focus: { complete: true, files: ['focus/FocusEnter.tsx', 'focus/FocusPage.tsx', 'focus/FocusPrompt.tsx', 'focus/FocusTiles.tsx'] },
  // …mit Companion: the edge button and check-in card on every page, the settings, the agent's run and the briefing in focus mode, the wake word's messages
  companion: { complete: true, files: ['companion/CompanionLayer.tsx', 'companion/CompanionSettings.tsx', 'companion/AgentRun.tsx', 'companion/Briefing.tsx', 'companion/wake.ts', 'companion/Proactive.tsx', 'companion/Growth.tsx'] },
  // HighLevel-parity gaps (CRM, inbox, automation): tags in bulk, inbox filters & message search, bulk owner, field clean-up
  crmgaps: { complete: true, files: ['pages/TagBulk.tsx', 'pages/InboxFilters.tsx', 'pages/ContactBulkOwner.tsx', 'pages/FieldCleanup.tsx', 'pages/ContactDocuments.tsx', 'pages/WorkflowFolders.tsx', 'pages/DealSmartTags.tsx', 'pages/DealForecast.tsx'] },
  // Smart Lists 2.0 on the contacts page: quick switch, save/rename/share/delete, columns with custom fields, sortable heads
  smartlists: { complete: true, files: ['pages/SmartLists.tsx'] },
  // event tickets with ticket types under Kalender → Events & Tickets (docs/booking.md#ticket-types)
  tickets: { complete: true, files: ['pages/TicketEvents.tsx'] },
  // Kalender → Vermietung: items with a quantity booked by date range (docs/booking.md#rentals)
  rentals: { complete: true, files: ['pages/Rentals.tsx'] },
  // HighLevel parity (wave 10): SEO & access and own fonts of a website, client approval and evergreen categories in the social planner,
  // agency announcements, own roles, video testimonials and prompt tests (docs/sites.md, social-planner.md, saas.md, security.md, …)
  // files in the customer portal: the share toggle on a contact's documents and the upload rules (docs/sales.md)
  portalfiles: { complete: true, files: ['pages/PortalFiles.tsx'] },
  gaps: { complete: true, files: ['pages/SiteSeo.tsx', 'pages/SocialExtras.tsx', 'pages/AgencyBanners.tsx', 'pages/RoleTemplates.tsx', 'pages/VideoTestimonials.tsx', 'pages/PromptLab.tsx', 'pages/GoogleLeads.tsx', 'pages/SystemMails.tsx', 'pages/WordPressPlugin.tsx', 'pages/ReviewBulk.tsx', 'pages/CourseAi.tsx'] },
  // batch 1: guided-tour helpers and tour content (content data is looked up by the tour engine in toursA, not wrapped in t())
  b1tour: { complete: true, files: ['tour/catalog.ts'] },
  toursA: { complete: false, files: ['tour/content/ads.ts', 'tour/content/agency.ts', 'tour/content/ai.ts', 'tour/content/backoffice.ts', 'tour/content/boards.ts', 'tour/content/calc.ts', 'tour/content/calls.ts', 'tour/content/company.ts', 'tour/content/connect.ts', 'tour/content/creator.ts', 'tour/content/crm.ts'] },

  // guided-tour data of batch 2 (tour/content/*.ts): keys are the German tour strings, looked up by the tour engine
  toursB: { complete: false, files: ['tour/content/data.ts', 'tour/content/feedback.ts', 'tour/content/genmedia.ts', 'tour/content/journey.ts', 'tour/content/mailbox.ts', 'tour/content/marketing.ts', 'tour/content/memory.ts', 'tour/content/pm.ts', 'tour/content/revenue.ts'] },

  // guided tours (batch 3 wiring): the tour data catalogs (toursA/B/C, keys = the exact German strings, merged from three agents; read via tour/text.ts) and the UI of the tour layer
  // complete:false = nothing is enforced; the files are listed only so the check sees the German strings as "used" (the catalog's keys)
  toursC: { complete: false, files: ['tour/content/sales.ts', 'tour/content/sepa.ts', 'tour/content/service.ts', 'tour/content/settings.ts', 'tour/content/sites.ts', 'tour/content/start.ts', 'tour/content/teamtools.ts', 'tour/content/umzug.ts', 'tour/content/undo.ts', 'tour/content/voice.ts', 'tour/content/webinars.ts', 'tour/content/workflow-tools.ts', 'tour/content/xr.ts', 'tour/catalog.ts', 'werkstatt/tour.ts'] },
  b3tour: { complete: true, files: ['tour/engine.tsx', 'tour/learn.tsx', 'tour/welcome.tsx', 'tour/help.tsx', 'tour/docs.tsx'] },
  b3tourbook: { complete: true, files: ['tour/handbook.ts'] },
  b3tourhandover: { complete: true, files: ['tour/handover.tsx'] },

  // b4: batch 4 (agent, areas, boards, canvas, companion, pages A..Calc)
  b4agency: { complete: true, files: ['pages/Agency.tsx', 'pages/AgencyLists.tsx', 'pages/AgencyPlatform.tsx', 'areas/settings-nav.ts'] },
  b4agent: { complete: true, files: ['agent/AgentEditor.tsx', 'agent/AgentsPage.tsx', 'agent/context.ts', 'agent/Panel.tsx#MODE_LABEL,isMac,store,applyEvent,StatusIcon,STATUS_TEXT,argSummary,ToolCardView,prettyResult,ConfirmCard,AgentPanel,TypingDots', 'agent/stream.ts', 'agent/tour.ts', 'agent/voice.ts', 'agent/WorkflowStep.tsx', 'companion/realtime.ts', 'companion/spoken.ts', 'companion/vad.ts', 'companion/voice-plan.ts'] },
  b4ai: { complete: true, files: ['pages/AiAssistant.tsx', 'pages/ai-gallery-filter.ts', 'pages/AiConnections.tsx', 'pages/AiGallery.tsx', 'pages/AiProvider.tsx', 'pages/AiSubscriptions.tsx', 'pages/AiTools.tsx'] },
  b4acct: { complete: true, files: ['pages/Accounting.tsx', 'pages/AccountingMore.tsx', 'pages/BooksSync.tsx', 'pages/boCommon.tsx', 'pages/BuyOffers.tsx'] },
  b4ads: { complete: true, files: ['pages/Ads.tsx', 'pages/AdsAudiences.tsx', 'pages/AdsConnect.tsx', 'pages/AdsConversions.tsx', 'pages/AdsKit.tsx', 'pages/AdsManager.tsx', 'pages/AdsRules.tsx', 'pages/AdsWizard.tsx'] },
  b4boards: { complete: true, files: ['boards/Actions.tsx', 'boards/BoardList.tsx', 'boards/BoardSettings.tsx', 'boards/BoardView.tsx', 'boards/EmbedHosts.tsx', 'boards/Grid.tsx', 'boards/History.tsx', 'boards/PatchCard.tsx', 'boards/Picker.tsx', 'boards/PromptBar.tsx', 'boards/Settings.tsx', 'boards/store.ts', 'boards/Templates.tsx', 'boards/TemplateSave.tsx', 'boards/WidgetCard.tsx'] },
  b4canvas: { complete: true, files: ['canvas/ai.tsx', 'canvas/CanvasPage.tsx', 'canvas/comments.tsx', 'canvas/dialogs-crm.tsx', 'canvas/dialogs-help.tsx', 'canvas/dialogs-insert.tsx', 'canvas/dialogs-share.tsx', 'canvas/Editor.tsx', 'canvas/media.ts', 'canvas/panels.tsx', 'canvas/tour.ts'] },
  b4misc: { complete: true, files: ['ios/InstallSheet.tsx', 'ios/shortcuts.ts', 'pages/Academy.tsx', 'pages/Affiliates.tsx', 'pages/Attribution.tsx#srcLabel,KIND,GROUPS,MODELS,Attribution,Report,TrackingSettings,ContactAttribution,attrQs,pickAttr', 'pages/BookingExtras.tsx'] },
  b4calc: { complete: true, files: ['pages/Calc.tsx', 'pages/CalcCharts.tsx', 'pages/CalcInputs.tsx', 'pages/CalcResults.tsx'] },
  // end b4

  b7theme: { complete: true, files: ['theme/Appearance.tsx', 'theme/BrandingLook.tsx', 'theme/depts.ts', 'theme/Profiles.tsx', 'theme/themes.ts', 'theme/FontPicker.tsx'] },
  b7undo: { complete: true, files: ['undo/shared.ts', 'undo/Undo.tsx#ConflictDialog,Changes,Row,HistoryPanel,UndoLayer'] },
  b7team: { complete: true, files: ['pages/TeamCalendarEditor.tsx', 'pages/TeamCalendarKit.tsx', 'pages/TeamInboxSettings.tsx'] },
  b7video: { complete: true, files: ['pages/VideoStudio.tsx', 'pages/VideoRecycle.tsx'] },
  b7umzug: { complete: true, files: ['pages/umzug-format.ts', 'pages/UmzugAssistent.tsx', 'pages/UmzugConnect.tsx', 'pages/UmzugMapping.tsx', 'pages/UmzugPointer.tsx', 'pages/UmzugRun.tsx', 'pages/UmzugZustellung.tsx'] },
  b7werk: { complete: true, files: ['werkstatt/Admin.tsx', 'werkstatt/badges.tsx', 'werkstatt/Build.tsx', 'werkstatt/ChatCards.tsx', 'werkstatt/Marktplatz.tsx', 'werkstatt/PluginFrame.tsx', 'werkstatt/Plugins.tsx', 'werkstatt/scopes.tsx', 'werkstatt/Werkstatt.tsx'] },
  b7xr: { complete: true, files: ['xr/engine/board-scene.ts', 'xr/engine/canvas-scene.ts', 'xr/engine/runtime.ts', 'xr/engine/textures.ts', 'xr/install.ts', 'xr/SpatialCard.tsx', 'xr/SpatialSuggest.tsx', 'xr/Workspace.tsx', 'xr/XrButton.tsx', 'xr/XrViewer.tsx'] },
  b7misc: { complete: true, files: ['pages/Stripe.tsx#stripeStatus,useStripe,EVENTS,SUB_EVENTS,CodeList,StripeSettings,useStripePayments,StripeInvoiceBox,useProductLinks,ProductBuyLink,ProductTriggerField', 'pages/SupabaseMirror.tsx', 'pages/Surveys.tsx', 'pages/SystemHealth.tsx', 'pages/TodoistSync.tsx', 'pages/Trash.tsx', 'pwa.tsx'] },
  b7voice: { complete: true, files: ['pages/Voice.tsx', 'pages/VoiceAi.tsx'] },
  b7webinar: { complete: true, files: ['pages/WebinarEditor.tsx', 'pages/WebinarRoomTab.tsx', 'pages/Webinars.tsx', 'pages/WebinarStats.tsx', 'pages/WebinarTabs.tsx', 'pages/Wishes.tsx'] },

  // batch 6 (i18n-b6): objects, sales, mail, invoices extras, inventory, HR, SaaS, reviews, phone, integrations, studios
  b6objects: { complete: true, files: ['pages/Objects.tsx', 'pages/ObjectKit.tsx#TYPE_LABELS,LIFECYCLE,objIcon,usersCache,usersLoc,useUsers,eur,PropValue,toLocalInput,PropInput,ViewsBar,RecordTable,Pager,CsvImportModal,typesCache,useAssocTypes,refreshAssocTypes,AssociationsPanel,useLabels,AssocAdd,AssocEdit,Timeline,Notes,PropertyCard,COMPANY_FILTERS,companyQs,pickCompany,DealProperties', 'pages/Properties.tsx'] },
  b6sales: { complete: true, files: ['pages/SalesAccess.tsx', 'pages/SalesDeal.tsx', 'pages/SalesDupes.tsx', 'pages/SalesKit.tsx', 'pages/SalesQuotas.tsx', 'pages/SalesQuotes.tsx', 'pages/SalesSequences.tsx', 'pages/LeadScoring.tsx#OPS,CONTACT_FIELDS,COMPANY_FIELDS,ATTR_FIELDS,newId,useMeta,RuleRow,ModelEditor,LeadScoring,ScoreBadge,ContactLeadScore,modelsCache,usePrimaryModel,useLeadScores,scoreQs,pickScore,LeadScoreTriggerFilter', 'pages/HealthScore.tsx#BAND,useHealthScores,FACES,ContactService', 'pages/HubSpotImport.tsx'] },
  b6mail: { complete: true, files: ['pages/Mailboxes.tsx', 'pages/MetaInbox.tsx#META_CHANNELS,CHANNEL_LABELS,ChannelIcon,FILTERS,MessageMedia,useMetaComposer,left,WindowState,fill,TemplatePreview,TemplateSlots,MetaComposerPanel', 'pages/MetaChannels.tsx', 'pages/KnowledgeBase.tsx', 'pages/Project.tsx'] },
  b6invoices: { complete: true, files: ['pages/InvoiceLegal.tsx#toCents,fromCents,loc,ymd,STATE_LABEL,TYPE_LABEL,useInvoiceSettings,LockBar,FinaliseModal,StornoModal,CreditNoteModal,PaymentModal,PaymentsBox,LegalFields,DocsBox,AuditBox,ACTIONS,numberLabel', 'pages/InvoiceSettings.tsx', 'pages/PaymentPlans.tsx', 'pages/QuoteApproval.tsx', 'pages/Sepa.tsx', 'pages/SepaRuns.tsx'] },
  b6inventory: { complete: true, files: ['pages/Inventory.tsx'] },
  b6hr: { complete: true, files: ['pages/Hr.tsx', 'pages/HrAdmin.tsx'] },
  b6saas: { complete: true, files: ['pages/Saas.tsx', 'pages/SaasBilling.tsx', 'pages/PartnerLinks.tsx'] },
  b6reviews: { complete: true, files: ['pages/GoogleReviews.tsx', 'pages/GoogleBusiness.tsx', 'pages/Reviews.tsx', 'pages/ReviewReplies.tsx', 'pages/QuizReviews.tsx', 'pages/Quizzes.tsx', 'pages/FeedbackAdmin.tsx'] },
  b6phone: { complete: true, files: ['pages/Phone.tsx', 'pages/PhoneTools.tsx', 'pages/MobileApp.tsx#mb,ApkUpload'] },
  b6integ: { complete: true, files: ['pages/Integrations.tsx', 'pages/InboundWebhook.tsx', 'pages/Nango.tsx', 'pages/McpServers.tsx', 'pages/OAuthConnect.tsx#LABEL,CAL_LABEL,useOAuthReturn,startOAuth,OAuthApps', 'pages/OAuthConsent.tsx', 'pages/RestHooks.tsx', 'pages/LoginSettings.tsx'] },
  b6studio: { complete: true, files: ['pages/KiStudio.tsx', 'pages/GenMediaKit.tsx'] },

  // batch 5: calls, channels, cloud, cognee, community, connectors, consent, dunning, feedback
  b5calls: { complete: true, files: ['pages/Calls.tsx', 'pages/CallsDialer.tsx', 'pages/CallsNotes.tsx', 'pages/CallsNumbers.tsx'] },
  b5callsx: { complete: true, files: ['pages/CallsFlows.tsx', 'pages/CallsIntel.tsx', 'pages/CallsRouting.tsx', 'pages/CallsScorecards.tsx'] },
  b5chan: { complete: true, files: ['pages/Certificates.tsx', 'pages/ChannelInbox.tsx', 'pages/ChannelProviders.tsx', 'pages/ChannelSettings.tsx'] },
  b5cloud: { complete: true, files: ['pages/Cloud.tsx', 'pages/CloudConsole.tsx', 'pages/CloudData.tsx', 'pages/CloudKit.tsx', 'pages/CloudSettings.tsx', 'pages/CloudTeam.tsx', 'pages/CloudWaitlist.tsx'] },
  b5cognee: { complete: true, files: ['pages/CogneeAgency.tsx', 'pages/CogneeKit.tsx', 'pages/CogneeSettings.tsx', 'pages/collab-badge.tsx', 'pages/collab-tour.ts', 'pages/CommentDm.tsx'] },
  b5comm: { complete: true, files: ['pages/Community.tsx', 'pages/CommunityEngage.tsx'] },
  b5comm2: { complete: true, files: ['pages/CommunityGrowth.tsx', 'pages/CommunityImport.tsx', 'pages/CommunityJoin.tsx', 'pages/CommunityMessages.tsx', 'pages/CommunityStats.tsx'] },
  b5conn: { complete: true, files: ['pages/Companies.tsx', 'pages/Composio.tsx', 'pages/Connectors.tsx', 'pages/ContactSales.tsx', 'pages/Contracts.tsx', 'pages/CreatorKit.tsx', 'pages/Docs.tsx'] },
  b5consent: { complete: true, files: ['pages/Consent.tsx', 'pages/ConsentCheckout.tsx', 'pages/ConsentCmp.tsx', 'pages/ConsentContact.tsx', 'pages/ConsentKit.tsx', 'pages/ConsentLegal.tsx'] },
  b5misc: { complete: true, files: ['pages/Dunning.tsx', 'pages/Feedback.tsx#meCache,listeners,refreshFeedback,useFeedbackMe,KIND,StatusPill,openReport,loadImage,fileToDataUrl,sizeOf,shrink,drawScaled,canCaptureScreen,captureScreen,ScreenshotPicker,DIAG_LABEL,diagPayload,DiagnosticsView,ReportModal,MenuRow,Prefs,MyReports,Thread,Shots,ReplyBox,DiagnosticsDetails,ReportDetail,FeedbackPage'] },
} as const satisfies Record<string, { complete: boolean; server?: boolean; files: readonly string[] }>;
export type Namespace = keyof typeof NAMESPACES;

type Loader = () => Promise<{ default: Catalog }>;

/** The catalog chunks per language (the source language has none). A namespace without a catalog falls back to German. */
export const CATALOGS: { [L in Exclude<Locale, typeof SOURCE_LOCALE>]: Partial<Record<Namespace, Loader>> } = {
  en: {
    core: () => import('./en/core'),
    errors: () => import('./en/errors'),
    shell: () => import('./en/shell'),
    login: () => import('./en/login'),
    dashboard: () => import('./en/dashboard'),
    contacts: () => import('./en/contacts'),
    deals: () => import('./en/deals'),
    inbox: () => import('./en/inbox'),
    calendar: () => import('./en/calendar'),
    calview: () => import('./en/calview'),
    settings: () => import('./en/settings'),
    invoices: () => import('./en/invoices'),
    presence: () => import('./en/presence'),
    workflows: () => import('./en/workflows'),
    wfcanvas: () => import('./en/wfcanvas'),
    email: () => import('./en/email'),
    campaigns: () => import('./en/campaigns'),
    sites: () => import('./en/sites'),
    forms: () => import('./en/forms'),
    formmap: () => import('./en/formmap'),
    pm: () => import('./en/pm'),
    reports: () => import('./en/reports'),
    helpdesk: () => import('./en/helpdesk'),
    social: () => import('./en/social'),
    collab: () => import('./en/collab'),
    courses: () => import('./en/courses'),
    office: () => import('./en/office'),
    customvalues: () => import('./en/customvalues'),
    siteai: () => import('./en/siteai'),
    tags: () => import('./en/tags'),
    lists: () => import('./en/lists'),
    spam: () => import('./en/spam'),
    callscripts: () => import('./en/callscripts'),
    notes: () => import('./en/notes'),
    templates: () => import('./en/templates'),
    reviewsources: () => import('./en/reviewsources'),
    socialcomments: () => import('./en/socialcomments'),
    aistudio: () => import('./en/aistudio'),
    metapages: () => import('./en/metapages'),
    voiceout: () => import('./en/voiceout'),
    callerids: () => import('./en/callerids'),
    projectfiles: () => import('./en/projectfiles'),
    simple: () => import('./en/simple'),
    ops: () => import('./en/ops'),
    store: () => import('./en/store'),
    parity: () => import('./en/parity'),
    focus: () => import('./en/focus'),
    companion: () => import('./en/companion'),
    crmgaps: () => import('./en/crmgaps'),
    smartlists: () => import('./en/smartlists'),
    tickets: () => import('./en/tickets'),
    rentals: () => import('./en/rentals'),
    gaps: () => import('./en/gaps'),
    portalfiles: () => import('./en/portalfiles'),
    b1tour: () => import('./en/b1tour'),
    toursA: () => import('./en/toursA'),

    toursB: () => import('./en/toursB'),

    toursC: () => import('./en/toursC'),
    b3tour: () => import('./en/b3tour'),
    b3tourbook: () => import('./en/b3tourbook'),
    b3tourhandover: () => import('./en/b3tourhandover'),

    // b4 catalogs
    b4agency: () => import('./en/b4agency'),
    b4agent: () => import('./en/b4agent'),
    b4ai: () => import('./en/b4ai'),
    b4acct: () => import('./en/b4acct'),
    b4ads: () => import('./en/b4ads'),
    b4boards: () => import('./en/b4boards'),
    b4canvas: () => import('./en/b4canvas'),
    b4misc: () => import('./en/b4misc'),
    b4calc: () => import('./en/b4calc'),
    // end b4

    b7theme: () => import('./en/b7theme'),
    b7undo: () => import('./en/b7undo'),
    b7team: () => import('./en/b7team'),
    b7video: () => import('./en/b7video'),
    b7umzug: () => import('./en/b7umzug'),
    b7werk: () => import('./en/b7werk'),
    b7xr: () => import('./en/b7xr'),
    b7misc: () => import('./en/b7misc'),
    b7voice: () => import('./en/b7voice'),
    b7webinar: () => import('./en/b7webinar'),

    b6objects: () => import('./en/b6objects'),
    b6sales: () => import('./en/b6sales'),
    b6mail: () => import('./en/b6mail'),
    b6invoices: () => import('./en/b6invoices'),
    b6inventory: () => import('./en/b6inventory'),
    b6hr: () => import('./en/b6hr'),
    b6saas: () => import('./en/b6saas'),
    b6reviews: () => import('./en/b6reviews'),
    b6phone: () => import('./en/b6phone'),
    b6integ: () => import('./en/b6integ'),
    b6studio: () => import('./en/b6studio'),

    b5calls: () => import('./en/b5calls'),
    b5callsx: () => import('./en/b5callsx'),
    b5chan: () => import('./en/b5chan'),
    b5cloud: () => import('./en/b5cloud'),
    b5cognee: () => import('./en/b5cognee'),
    b5comm: () => import('./en/b5comm'),
    b5comm2: () => import('./en/b5comm2'),
    b5conn: () => import('./en/b5conn'),
    b5consent: () => import('./en/b5consent'),
    b5misc: () => import('./en/b5misc'),
  },
};
