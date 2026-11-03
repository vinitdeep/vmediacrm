import type { Tour } from '../tour/types';
import { tr } from '../i18n';

/** Tour texts are read when a tour is shown (not when this file loads), so they follow the language and its catalog. */
function lazy<T extends object>(build: () => T): T {
  return new Proxy({} as T, {
    get: (_, k) => (build() as any)[k],
    has: (_, k) => k in build(),
    ownKeys: () => Reflect.ownKeys(build()),
    getOwnPropertyDescriptor: (_, k) => ({ enumerable: true, configurable: true, writable: true, value: (build() as any)[k] }),
  });
}

/** Academy tours: the V Media CRM Agent (panel, confirmations, custom agents) and KI-Anbieter (BYOK). */
export const AGENT_TOURS: Tour[] = [
  lazy(() => { const t = tr('b4agent'); return ({
    id: 'agent',
    title: t('Der KI-Agent'),
    summary: t('Ein KI-Mitarbeiter auf jeder Seite: sucht, fasst zusammen, legt an und erledigt Aufgaben – mit Bestätigung vor Änderungen.'),
    icon: 'bot',
    group: 'ai',
    minutes: 5,
    routes: ['agents'],
    keywords: t('ki agent chat assistent custom gpt mitarbeiter automatisch werkzeuge bestätigung strg j'),
    learned: [t('Den Agenten auf jeder Seite öffnen (Strg/⌘ + J)'), t('Wie Kontext, Werkzeug-Karten und Bestätigungen funktionieren'), t('Eigene Agenten aus Vorlagen anlegen'), t('Was die Sicherheitsmodi bedeuten')],
    docs: { label: t('KI-Agent'), file: 'agent' },
    steps: [
      { title: t('Der KI-Agent'), target: 'agent-button', kind: 'click', text: t('Hier öffnest du den Agenten – auf jeder Seite, auch mit **Strg + J** (Mac: ⌘ + J). Er arbeitet mit deinen Rechten im aktuellen Sub-Account.'), do: t('Klicke auf **KI-Agent**.') },
      { title: t('Was er gerade sieht'), target: 'agent-context', optional: true, text: t('Der Kontext zeigt, was du offen hast, z. B. „Kontakt: Max Mustermann“. Dann reicht „Fasse diesen Kontakt zusammen“. Ein Klick schaltet den Kontext ab.') },
      { title: t('Aufträge geben'), target: 'agent-input', text: t('Schreib ganz normal, was zu tun ist – oder nimm eine Startfrage. Dateien gehen auch: eine CSV importiert Kontakte, Bilder liest ein Modell mit Bild-Verständnis.') },
      { title: t('Modell wählen'), target: 'agent-model', text: t('Welches KI-Modell antwortet, legst du unter KI-Anbieter fest. Hier kannst du für diesen Chat wechseln – auch auf dein eigenes ChatGPT- oder Claude-Abo über die Bridge.') },
      { title: t('Werkzeug-Karten'), text: t('Jeder Schritt des Agenten erscheint als Karte: was er gesucht oder angelegt hat, aufklappbar mit allen Eingaben und Ergebnissen und mit Links zu den Datensätzen.') },
      { title: t('Wünsche bauen lassen'), target: 'agent-wk-card', optional: true, missing: t('Äußere im Chat einen Funktionswunsch („Ich hätte gern eine Ampel für Deals“) – dann erscheint hier der Plan als Karte.'), text: t('Bei einem Funktionswunsch plant der Agent und zeigt den Plan als Karte. Du bestätigst mit dem Knopf der Karte, siehst den Bau live und eine Vorschau – mit Öffnen, Ändern lassen und Verwerfen.') },
      { title: t('Erst fragen, dann ändern'), text: t('Im Modus **Vor Änderungen fragen** zeigt der Agent jede Änderung vorher mit allen Details – du klickst „Ausführen“ oder „Ablehnen“. Versenden, Löschen und Zahlungen fragt er immer.') },
      { title: t('Eigene Agenten'), route: 'agents', target: 'agents-list', text: t('Unter **KI-Agenten** legst du eigene KI-Mitarbeiter an – mit Rolle, Anweisungen, Werkzeugen, Wissen, Zeitplänen und Auto-Antwort im Posteingang.') },
      { title: t('Vorlagen'), target: 'tab-templates', kind: 'click', text: t('Die Vorlagen sind fertige Rollen: Vertrieb, Support, Social Media, Projekte, Rechnungen, Onboarding, Daten-Aufräumen und Lead-Recherche.'), do: t('Klicke auf **Vorlagen**.') },
      { title: t('Freigaben'), target: 'tab-approvals', text: t('Laufen Agenten automatisch (Workflow, Zeitplan, MCP), führen sie nichts aus, was eine Bestätigung braucht – es wartet hier auf dich.') },
    ],
  }); }),
  lazy(() => { const t = tr('b4agent'); return ({
    id: 'ai-providers',
    title: 'KI-Anbieter (BYOK)',
    summary: t('Jedes Modell mit deinem eigenen Schlüssel: OpenAI, Anthropic, Gemini, OpenRouter, Groq, lokale Modelle, fal.ai, kie.ai und mehr.'),
    icon: 'ai',
    group: 'ai',
    perm: 'settings',
    minutes: 4,
    routes: ['settings/ai-providers', 'agents/models'],
    keywords: t('byok schlüssel api key openai anthropic gemini openrouter groq ollama fal kie replicate modell anbieter'),
    learned: [t('Einen Anbieter mit eigenem Schlüssel verbinden'), t('Die Verbindung testen und ein Modell wählen (auch per Freitext)'), t('Festlegen, welches Modell wofür genutzt wird')],
    docs: { label: t('KI-Anbieter'), file: 'ai-providers' },
    steps: [
      { title: t('Mit deinem Abo'), route: 'settings/ai-providers', target: 'aisub', optional: true, text: t('Dein ChatGPT-Plan („Mit ChatGPT anmelden“) oder dein Claude-Abo (über Claude Code auf deinem Rechner) statt eines API-Schlüssels. Die Anmeldung gehört dir persönlich – nur du kannst sie nutzen, nie Workflows oder andere Personen.') },
      { title: t('Filter: EU-Hosting, günstig, schnell'), target: 'aig-filters', optional: true, text: t('Such einen Anbieter oder filtere nach „EU-Hosting“ (IONOS, STACKIT, OVHcloud, Scaleway, Mistral EU), günstig, schnell, lokal oder Abo-Anmeldung. Die Karte nennt den Verarbeitungsort laut Anbieter und führt über „Konto anlegen ↗“ zur Anmeldung.') },
      { title: t('KI-Anbieter'), route: 'settings/ai-providers', target: 'aic-presets', text: t('Hier verbindest du jedes KI-Modell mit deinem eigenen Schlüssel – Text-Modelle für Agent und Assistent, Bild-, Video- und Audio-Anbieter für Medien.') },
      { title: t('Anbieter wählen'), target: 'aic-presets', text: t('Klick auf einen Anbieter, trag den Schlüssel ein – fertig. Lokale Modelle (Ollama, LM Studio) und jeder OpenAI-kompatible Server gehen auch.') },
      { title: t('Verbunden'), target: 'aic-list', optional: true, text: t('Deine Verbindungen mit Fähigkeiten, Standard-Modellen, Prüf-Status und Kosten dieses Monats. Schlüssel werden nie wieder angezeigt.') },
      { title: t('Wofür welches Modell?'), target: 'aic-routing', text: t('Lege fest, welche Verbindung der KI-Agent, schnelle KI-Texte, Zusammenfassungen, Bilder, Videos oder Sprache nutzen. Ohne Angabe nimmt V Media CRM die erste passende.') },
      { title: t('Denkstufe'), target: 'aic-effort', text: t('Wie gründlich die Modelle nachdenken: ein Standard (maximal) und je Bereich eine eigene Stufe. Telefonagent und schnelle Texte dürfen niedriger sein; die Werkstatt fragt nie unter „hoch“ an.') },
      { title: t('Modell frei wählbar'), text: t('Die Modell-Liste lädt V Media CRM live vom Anbieter, wo es eine gibt. Du kannst aber immer jede Modell-ID selbst eintippen – auch ganz neue.') },
    ],
  }); }),
];
