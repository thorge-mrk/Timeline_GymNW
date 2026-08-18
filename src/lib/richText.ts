/**
 * Kleines, sicheres Textformat für Eintragstexte.
 *
 * Gespeichert wird ganz normaler Text mit wenigen Markierungen — so bleibt der
 * Inhalt auch ohne die App lesbar und es kann kein fremdes HTML eingeschleust
 * werden (wir bauen die Darstellung aus React-Elementen, nie aus rohem HTML):
 *
 *   ## Überschrift          → große Zwischenüberschrift
 *   ### Kleine Überschrift  → kleinere Zwischenüberschrift
 *   - Punkt                 → Aufzählung
 *   **fett**  *kursiv*      → Auszeichnung im Fließtext
 *   Leerzeile               → neuer Absatz
 */

export type InlineSpan =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "italic"; text: string }
  | { kind: "boldItalic"; text: string };

export type RichBlock =
  | { type: "h2"; spans: InlineSpan[] }
  | { type: "h3"; spans: InlineSpan[] }
  | { type: "p"; spans: InlineSpan[] }
  | { type: "ul"; items: InlineSpan[][] };

/** Zerlegt eine Zeile in normale, fette und kursive Abschnitte. */
export function parseInline(line: string): InlineSpan[] {
  const spans: InlineSpan[] = [];
  // Reihenfolge ist entscheidend: ***beides*** vor **fett** vor *kursiv*,
  // sonst bleiben einzelne Sternchen als Zeichen im Text stehen.
  const pattern = /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(line)) !== null) {
    if (match.index > last) {
      spans.push({ kind: "text", text: line.slice(last, match.index) });
    }
    const token = match[0];
    if (token.startsWith("***")) {
      spans.push({ kind: "boldItalic", text: token.slice(3, -3) });
    } else if (token.startsWith("**")) {
      spans.push({ kind: "bold", text: token.slice(2, -2) });
    } else {
      spans.push({ kind: "italic", text: token.slice(1, -1) });
    }
    last = match.index + token.length;
  }
  if (last < line.length) {
    spans.push({ kind: "text", text: line.slice(last) });
  }
  return spans.length ? spans : [{ kind: "text", text: "" }];
}

/** Wandelt den gespeicherten Text in eine Liste darstellbarer Blöcke um. */
export function parseRichText(raw: string | null | undefined): RichBlock[] {
  if (!raw) return [];
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  const blocks: RichBlock[] = [];
  let paragraph: string[] = [];
  let list: InlineSpan[][] | null = null;

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: "p", spans: parseInline(paragraph.join(" ").trim()) });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list && list.length) blocks.push({ type: "ul", items: list });
    list = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }
    if (trimmed.startsWith("### ")) {
      flushParagraph();
      flushList();
      blocks.push({ type: "h3", spans: parseInline(trimmed.slice(4).trim()) });
      continue;
    }
    if (trimmed.startsWith("## ")) {
      flushParagraph();
      flushList();
      blocks.push({ type: "h2", spans: parseInline(trimmed.slice(3).trim()) });
      continue;
    }
    if (/^[-•*]\s+/.test(trimmed)) {
      flushParagraph();
      list ??= [];
      list.push(parseInline(trimmed.replace(/^[-•*]\s+/, "")));
      continue;
    }
    flushList();
    paragraph.push(trimmed);
  }
  flushParagraph();
  flushList();
  return blocks;
}

/** Reiner Text ohne Markierungen — für Vorschauen und Kurzfassungen. */
export function richTextToPlain(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) =>
      line
        .replace(/^\s*#{2,3}\s+/, "")
        .replace(/^\s*[-•*]\s+/, "• ")
        .replace(/\*\*\*([^*]+)\*\*\*/g, "$1")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/\*([^*]+)\*/g, "$1")
        .trim()
    )
    .filter(Boolean)
    .join(" ");
}
