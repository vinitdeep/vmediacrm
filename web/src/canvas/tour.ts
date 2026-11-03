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

/** Academy tour: the Canvas (boards, tools, live CRM cards, AI drawing, sharing and export). */
export const CANVAS_TOURS: Tour[] = [
  lazy(() => { const t = tr('b4canvas'); return ({
    id: 'canvas',
    title: 'Canvas: zeichnen, planen, gestalten',
    summary: t('Unendliche Boards mit Formen, Pfeilen, Notizen und Designs – mit Live-Karten aus dem CRM, KI-Zeichnen und gemeinsamer Arbeit.'),
    icon: 'canvas',
    group: 'marketing',
    perm: 'canvas',
    minutes: 8,
    routes: ['canvas'],
    practice: true,
    keywords: 'canvas whiteboard zeichnen design mindmap flussdiagramm board miro excalidraw figma skizze wireframe notiz agent ki',
    learned: [t('Ein Board anlegen – leer, aus einer Vorlage oder von der KI gezeichnet'), t('Zeichnen, Pfeile an Formen heften und Rahmen für Designs nutzen'), t('Live-Karten aus dem CRM aufs Board legen und Notizen zu Aufgaben machen'), t('Zusammenarbeiten, kommentieren und das Board exportieren oder teilen')],
    docs: { label: 'Canvas', file: 'canvas' },
    steps: [
      { title: 'Canvas', route: 'canvas', target: 'page-head', text: t('Unendliche Boards zum Zeichnen, Planen und Gestalten: Ideen, Abläufe, Entwürfe – und Live-Daten aus dem CRM, alles an einem Ort. Jedes Board gehört zu diesem Sub-Account.') },
      { title: t('Von der KI zeichnen lassen'), target: 'canvas-ai-new', text: t('Beschreibe in einem Satz, was du brauchst, z. B. „Kundenreise für unseren Onlinekurs“. Die KI legt ein neues Board mit Flussdiagramm, Mindmap oder Wireframe an.') },
      { title: t('Neues Board'), target: 'canvas-new', kind: 'click', text: t('Oder starte selbst: leer oder mit einer Vorlage wie Mindmap, Flussdiagramm, SWOT, Kanban, Wireframe oder Social-Post.'), do: t('Klicke auf **Neues Board**.') },
      { title: t('Name und Vorlage'), target: 'canvas-new-name', kind: 'fill', text: t('Gib dem Board einen Namen. Darunter wählst du eine Vorlage, daneben stellst du ein, wer im Projekt es sehen oder bearbeiten darf.'), do: t('Tippe einen Namen, z. B. „Herbst-Kampagne“.'), demo: { fill: t('Herbst-Kampagne (Übung)') } },
      { title: t('Anlegen'), target: 'canvas-new-create', kind: 'wait', wait: { appear: 'canvas-tools' }, text: t('„Board anlegen“ öffnet die leere, unendliche Fläche.'), do: t('Klicke auf **Board anlegen**.') },
      { title: t('Die Fläche'), target: 'canvas-stage', placement: 'top', text: t('Mausrad oder zwei Finger verschieben, Strg + Mausrad oder Spreizen zoomt, Leertaste + Ziehen greift die Fläche. Doppelklick schreibt Text, Rechtsklick öffnet das Menü.') },
      { title: t('Die Werkzeuge'), target: 'canvas-tools', text: t('Auswählen, Formen, Pfeile, Stift, Text, Notizen, Rahmen, Bilder, Icons, Tabellen und Diagramme. Pfeile bleiben an Formen haften und folgen, wenn du sie verschiebst. Die Taste **?** zeigt alle Kürzel.') },
      { title: t('Vorlagen'), target: 'canvas-tool-templates', text: t('Fertige Startpunkte: Mindmap, Flussdiagramm, Customer Journey, Funnel-Plan, Vertriebsprozess, Organigramm, SWOT, Kanban, Wireframe-Kit und Social-Post-Layouts.') },
      { title: t('Live-Karten aus dem CRM'), target: 'canvas-tool-crm', text: t('Kontakte, Firmen, Deals, Aufgaben, Tickets, Termine, Berichte und ganze Pipelines als Karte – immer mit dem aktuellen Stand. Ein Doppelklick öffnet den Datensatz.') },
      { title: 'KI zeichnen lassen', target: 'canvas-ai', text: t('Hier entstehen Diagramme, Mindmaps und Wireframes aus einer Beschreibung. Mit Auswahl: **Auswahl erklären**, **In Aufgaben verwandeln** und **Layout aufräumen**.') },
      { title: t('Stil und Umwandeln'), target: 'canvas-inspector', text: t('Farbe, Linie, Schrift, Ecken – und „Handgezeichnet“ für den Skizzen-Look. Bei einer Notiz legst du hier mit einem Klick eine Aufgabe oder einen Deal im CRM an.') },
      { title: t('Zusammen arbeiten'), target: 'canvas-people', text: t('Wer gerade am Board ist, siehst du hier und auf der Fläche mit Cursor. Auch KI-Agenten (der V Media CRM-Agent, Claude, ChatGPT) zeichnen live mit – mit eigenem, beschriftetem Cursor.') },
      { title: t('Exportieren und verwenden'), target: 'canvas-export', text: t('PNG, SVG oder PDF – ganzes Board, Auswahl oder ein Rahmen. Oder direkt als Social-Post, E-Mail-Entwurf oder Funnel-Bild weiterverwenden.') },
      { title: t('Teilen'), target: 'canvas-share', text: t('Team-Zugriff, einzelne Personen und ein öffentlicher Link zum Ansehen – ohne Anmeldung, ohne Live-Daten, jederzeit widerrufbar.') },
      { title: t('Versionen'), target: 'canvas-history', text: t('Das Board sichert sich selbst Versionen. Du kannst eigene anlegen und eine ältere zurückholen – der aktuelle Stand wird vorher gesichert.') },
    ],
  }); }),
];
