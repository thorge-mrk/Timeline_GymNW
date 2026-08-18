/**
 * Übersetzung zwischen dem gespeicherten Textformat und dem HTML im Schreibfeld.
 *
 * In der Datenbank steht weiterhin ausschließlich das Format aus
 * src/lib/richText.ts — ganz normaler Text mit wenigen Markierungen:
 *
 *   ## Überschrift · ### Kleinere Überschrift · - Aufzählung
 *   **fett** · *kursiv* · ***beides*** · Leerzeile = neuer Absatz
 *
 * Das Schreibfeld ist ein contentEditable-Bereich und arbeitet deshalb mit
 * HTML. Diese Datei ist die Schleuse dazwischen — und zwar in beide Richtungen:
 *
 *   storedToHtml()  gespeicherter Text → HTML fürs Schreibfeld
 *   htmlToStored()  Inhalt des Schreibfelds → gespeicherter Text
 *
 * Sicherheit: In die eine Richtung wird das HTML aus dem geparsten Text neu
 * gebaut (jedes Zeichen wird maskiert) — es kann also nichts durchrutschen, was
 * nicht vorher schon als reiner Text dastand. In die andere Richtung gilt eine
 * Positivliste: Nur h1–h6, ul/ol/li, p/div, strong/b, em/i und br bekommen eine
 * Bedeutung. Alles andere — eingefügtes Fremd-HTML, <script>, <style>, Bilder,
 * Tabellen, Stile — wird zu reinem Text abgeflacht oder ganz verworfen. Das
 * Ergebnis ist immer reiner Text; Markup kann die Datenbank nie erreichen.
 */

import { parseInline, parseRichText, type InlineSpan } from "@/lib/richText";

/** Ein leeres Feld braucht einen Absatz, sonst hat der Cursor keinen Platz. */
export const EMPTY_HTML = "<p><br></p>";

/* ------------------------------------------------------------------ *
 * Gespeicherter Text → HTML fürs Schreibfeld
 * ------------------------------------------------------------------ */

/**
 * Auszeichnungen als HTML. Der Schlüssel ist die Art aus richText.ts; steht
 * eine Art nicht in der Tabelle, bleibt der Abschnitt einfach normaler Text.
 */
const WRAP: Record<string, [string, string] | undefined> = {
  bold: ["<strong>", "</strong>"],
  italic: ["<em>", "</em>"],
  boldItalic: ["<strong><em>", "</em></strong>"],
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function spansToHtml(spans: InlineSpan[]): string {
  const html = spans
    .map((span) => {
      const text = escapeHtml(span.text);
      if (!text) return "";
      const wrap = WRAP[span.kind];
      return wrap ? wrap[0] + text + wrap[1] : text;
    })
    .join("");
  // Ein leerer Block ohne <br> lässt sich weder anklicken noch beschreiben.
  return html || "<br>";
}

/** Baut aus dem gespeicherten Text das HTML für das Schreibfeld. */
export function storedToHtml(stored: string | null | undefined): string {
  const blocks = parseRichText(stored);
  if (!blocks.length) return EMPTY_HTML;

  return blocks
    .map((block) => {
      if (block.type === "ul") {
        const items = block.items
          .map((item) => `<li>${spansToHtml(item)}</li>`)
          .join("");
        return `<ul>${items}</ul>`;
      }
      if (block.type === "h2") return `<h2>${spansToHtml(block.spans)}</h2>`;
      if (block.type === "h3") return `<h3>${spansToHtml(block.spans)}</h3>`;
      return `<p>${spansToHtml(block.spans)}</p>`;
    })
    .join("");
}

/* ------------------------------------------------------------------ *
 * HTML aus dem Schreibfeld → gespeicherter Text
 * ------------------------------------------------------------------ */

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

/** Elemente, deren Inhalt komplett verworfen wird. */
const DROPPED = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "TEMPLATE",
  "IFRAME",
  "FRAME",
  "OBJECT",
  "EMBED",
  "APPLET",
  "SVG",
  "MATH",
  "CANVAS",
  "IMG",
  "PICTURE",
  "VIDEO",
  "AUDIO",
  "SOURCE",
  "TRACK",
  "INPUT",
  "SELECT",
  "OPTION",
  "TEXTAREA",
  "BUTTON",
  "LABEL",
  "FORM",
  "LINK",
  "META",
  "BASE",
  "HEAD",
  "TITLE",
]);

type BlockKind = "p" | "h2" | "h3" | "li";

/**
 * Elemente, die einen eigenen Block eröffnen. Alles, was hier nicht steht und
 * nicht verworfen wird (span, b, em, ul, table …), gilt als durchsichtig: sein
 * Inhalt läuft weiter in den Block, in dem es steht.
 */
const BLOCKS: Record<string, BlockKind | undefined> = {
  P: "p",
  DIV: "p",
  SECTION: "p",
  ARTICLE: "p",
  MAIN: "p",
  HEADER: "p",
  FOOTER: "p",
  ASIDE: "p",
  NAV: "p",
  ADDRESS: "p",
  BLOCKQUOTE: "p",
  PRE: "p",
  FIGURE: "p",
  FIGCAPTION: "p",
  DT: "p",
  DD: "p",
  TR: "p",
  TD: "p",
  TH: "p",
  CAPTION: "p",
  // Der Renderer kennt nur zwei Größen — h1/h2 groß, alles Kleinere klein.
  H1: "h2",
  H2: "h2",
  H3: "h3",
  H4: "h3",
  H5: "h3",
  H6: "h3",
  LI: "li",
};

interface Marks {
  bold: boolean;
  italic: boolean;
}

interface Run extends Marks {
  text: string;
}

interface Block {
  kind: BlockKind;
  runs: Run[];
}

const PLAIN: Marks = { bold: false, italic: false };

const PREFIX: Record<BlockKind, string> = {
  p: "",
  h2: "## ",
  h3: "### ",
  li: "- ",
};

/**
 * Kennt das gespeicherte Format „fett und kursiv“ als ***beides***? Wird einmal
 * beim Laden geprüft, damit hier nichts geschrieben wird, was der Renderer
 * hinterher nicht wieder auseinandernehmen kann.
 */
const BOTH_MARKER = (() => {
  const spans = parseInline("***x***");
  return spans.length === 1 && spans[0].text === "x" ? "***" : "**";
})();

/** Auszeichnung eines Elements — als Tag (b/strong/i/em) oder als Stil. */
function marksOf(el: Element, inherited: Marks): Marks {
  const tag = el.nodeName.toUpperCase();
  let bold = inherited.bold;
  let italic = inherited.italic;

  if (tag === "B" || tag === "STRONG") bold = true;
  if (tag === "I" || tag === "EM") italic = true;

  // Manche Browser schreiben die Auszeichnung als Stil statt als Element —
  // und heben sie genauso wieder auf. Beide Richtungen zählen, damit im Feld
  // und im fertigen Eintrag dasselbe fett und kursiv ist.
  const style: CSSStyleDeclaration | undefined = (el as HTMLElement).style;
  const weight = style?.fontWeight;
  if (weight) {
    const numeric = Number.parseInt(weight, 10);
    if (weight === "bold" || weight === "bolder" || numeric >= 600) bold = true;
    else if (weight === "normal" || numeric < 600) bold = false;
  }
  const slant = style?.fontStyle;
  if (slant === "italic" || slant === "oblique") italic = true;
  else if (slant === "normal") italic = false;

  return { bold, italic };
}

/** Zerlegt den Feldinhalt in eine flache Liste von Blöcken. */
function collectBlocks(root: Node): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;

  const flush = () => {
    if (current) blocks.push(current);
    current = null;
  };
  const open = (kind: BlockKind) => {
    flush();
    current = { kind, runs: [] };
  };
  const push = (text: string, marks: Marks) => {
    if (!text) return;
    // Text ohne eigenen Block (kommt vor, wenn der Browser nicht umschließt)
    // landet in einem stillschweigend eröffneten Absatz.
    current ??= { kind: "p", runs: [] };
    current.runs.push({ text, bold: marks.bold, italic: marks.italic });
  };

  const walk = (node: Node, marks: Marks, top: boolean) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === TEXT_NODE) {
        push(child.nodeValue ?? "", marks);
        continue;
      }
      if (child.nodeType !== ELEMENT_NODE) continue;

      const el = child as Element;
      const tag = el.nodeName.toUpperCase();
      if (DROPPED.has(tag)) continue;

      if (tag === "BR") {
        // Ganz außen trennt ein Umbruch zwei Absätze. Innerhalb eines Blocks
        // ist er nur ein weicher Umbruch — und den kennt das gespeicherte
        // Format nicht, dort wird daraus ein Leerzeichen.
        if (top) flush();
        else push(" ", marks);
        continue;
      }

      const kind = BLOCKS[tag];
      if (kind) {
        open(kind);
        walk(el, marksOf(el, marks), false);
        flush();
        continue;
      }

      // Durchsichtiges Element: nur die Auszeichnung wird übernommen.
      walk(el, marksOf(el, marks), top);
    }
  };

  walk(root, PLAIN, true);
  flush();
  return blocks;
}

/** Weiche Umbrüche, Tabulatoren und geschützte Leerzeichen werden zu Leerzeichen. */
function normalizeSpace(text: string): string {
  return text.replace(/[\s\u00a0]+/g, " ");
}

/** Setzt die Sternchen um einen Abschnitt — Randleerzeichen bleiben außen. */
function markUp(run: Run): string {
  const marker = run.bold && run.italic ? BOTH_MARKER : run.bold ? "**" : run.italic ? "*" : "";
  if (!marker) return run.text;

  const core = run.text.trim();
  // Ein Sternchen im Text würde die Auszeichnung zerreißen (der Renderer sucht
  // nach Paaren) — dann bleibt der Abschnitt lieber unausgezeichnet stehen.
  if (!core || core.includes("*")) return run.text;

  const lead = run.text.startsWith(" ") ? " " : "";
  const tail = run.text.endsWith(" ") ? " " : "";
  return `${lead}${marker}${core}${marker}${tail}`;
}

/** Baut aus den Abschnitten eines Blocks genau eine gespeicherte Zeile. */
function runsToLine(runs: Run[]): string {
  const merged: Run[] = [];
  for (const run of runs) {
    const text = normalizeSpace(run.text);
    if (!text) continue;
    const last = merged[merged.length - 1];
    // Gleich ausgezeichnete Nachbarn werden zusammengefasst — sonst entstünde
    // „**a****b**“, und das kann der Renderer nicht mehr lesen.
    if (last && last.bold === run.bold && last.italic === run.italic) {
      last.text += text;
    } else {
      merged.push({ text, bold: run.bold, italic: run.italic });
    }
  }
  return merged.map(markUp).join("").replace(/ {2,}/g, " ").trim();
}

/**
 * Wandelt den Inhalt des Schreibfelds in den gespeicherten Text um.
 * Ergebnis ist immer reiner Text — nie HTML.
 */
export function htmlToStored(root: Node | null | undefined): string {
  if (!root) return "";

  let out = "";
  let previous: BlockKind | null = null;

  for (const block of collectBlocks(root)) {
    const line = runsToLine(block.runs);
    if (!line) continue;
    if (previous !== null) {
      // Aufzählungspunkte gehören zusammen: nur ein Umbruch, keine Leerzeile.
      out += previous === "li" && block.kind === "li" ? "\n" : "\n\n";
    }
    out += PREFIX[block.kind] + line;
    previous = block.kind;
  }

  return out;
}
