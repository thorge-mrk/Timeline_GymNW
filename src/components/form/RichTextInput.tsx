"use client";

import { useEffect, useId, useRef, useState } from "react";
import RichText from "@/components/RichText";

/**
 * Schreibfeld für die Beschreibung.
 *
 * Gespeichert wird ganz normaler Text — die Werkzeugleiste setzt nur die
 * Markierungen aus src/lib/richText.ts an die richtige Stelle:
 *
 *   ## Überschrift · ### Kleinere Überschrift · - Aufzählung
 *   **fett** · *kursiv* · Leerzeile = neuer Absatz
 *
 * Darunter läuft die Vorschau mit derselben Komponente, die den Text später
 * im Eintrag darstellt — man sieht also sofort das Ergebnis.
 */

interface RichTextInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
}

/** Markierung am Zeilenanfang (Überschrift oder Aufzählungspunkt). */
const LINE_MARK = /^\s*(?:#{2,3}\s+|[-•*]\s+)/;

type BlockKind = "h2" | "h3" | "ul";

const BLOCK_PREFIX: Record<BlockKind, string> = {
  h2: "## ",
  h3: "### ",
  ul: "- ",
};

interface Edit {
  text: string;
  start: number;
  end: number;
}

/** Anfang der Zeile, in der `pos` steht. */
function lineStartAt(text: string, pos: number): number {
  return pos === 0 ? 0 : text.lastIndexOf("\n", pos - 1) + 1;
}

/** Ende der Zeile, in der `pos` steht (ohne Zeilenumbruch). */
function lineEndAt(text: string, pos: number): number {
  const next = text.indexOf("\n", pos);
  return next === -1 ? text.length : next;
}

/**
 * Setzt eine Zeilenmarkierung auf alle berührten Zeilen — oder nimmt sie
 * wieder weg, wenn schon alle sie tragen. Andere Markierungen werden ersetzt,
 * damit aus „## “ direkt „- “ wird und nicht „- ## “.
 */
function toggleLineMark(text: string, start: number, end: number, prefix: string): Edit {
  const from = lineStartAt(text, start);
  const to = lineEndAt(text, end);
  const block = text.slice(from, to);
  const lines = block.split("\n");
  const bare = lines.map((line) => line.replace(LINE_MARK, ""));

  const filled = lines.filter((line) => line.trim().length > 0);
  const allMarked =
    filled.length > 0 &&
    filled.every((line) => line.trimStart().startsWith(prefix));

  const next = lines.map((_, i) => {
    // Leerzeilen zwischen zwei Absätzen bleiben leer.
    if (lines.length > 1 && !bare[i].trim()) return bare[i];
    return allMarked ? bare[i] : prefix + bare[i];
  });

  const nextBlock = next.join("\n");
  const firstDelta = next[0].length - lines[0].length;
  const totalDelta = nextBlock.length - block.length;
  const nextStart = Math.max(from, start + firstDelta);

  return {
    text: text.slice(0, from) + nextBlock + text.slice(to),
    start: nextStart,
    end: Math.max(nextStart, end + totalDelta),
  };
}

/** Trägt die Auswahl schon genau diese Auszeichnung? */
function isWrapped(selected: string, marker: string): boolean {
  if (selected.length < marker.length * 2 + 1) return false;
  if (!selected.startsWith(marker) || !selected.endsWith(marker)) return false;
  // **fett** darf nicht als *kursiv* durchgehen.
  if (marker === "*" && (selected.startsWith("**") || selected.endsWith("**"))) {
    return false;
  }
  return true;
}

/**
 * Umschließt die Auswahl mit `**` bzw. `*` — oder nimmt die Sternchen wieder
 * weg. Ohne Auswahl werden nur die beiden Marker gesetzt und der Cursor
 * dazwischen geparkt, sodass man direkt lostippen kann.
 */
function toggleWrap(text: string, start: number, end: number, marker: string): Edit {
  const selected = text.slice(start, end);

  if (!selected) {
    const caret = start + marker.length;
    return {
      text: text.slice(0, start) + marker + marker + text.slice(start),
      start: caret,
      end: caret,
    };
  }

  if (isWrapped(selected, marker)) {
    const inner = selected.slice(marker.length, selected.length - marker.length);
    return {
      text: text.slice(0, start) + inner + text.slice(end),
      start,
      end: start + inner.length,
    };
  }

  // Leerzeichen am Rand bleiben außerhalb der Sternchen — „**wort** “ statt „**wort **“.
  const lead = selected.length - selected.trimStart().length;
  const tail = selected.length - selected.trimEnd().length;
  const core = selected.slice(lead, selected.length - tail);
  if (!core) return { text, start, end };

  const wrapped =
    selected.slice(0, lead) +
    marker +
    core +
    marker +
    selected.slice(selected.length - tail);

  return {
    text: text.slice(0, start) + wrapped + text.slice(end),
    // Die fertige Auszeichnung bleibt markiert — noch ein Klick nimmt sie zurück.
    start: start + lead,
    end: start + lead + marker.length * 2 + core.length,
  };
}

/** Welche Zeilenmarkierung trägt die Zeile, in der der Cursor steht? */
function blockKindAt(text: string, pos: number): BlockKind | null {
  const line = text
    .slice(lineStartAt(text, pos), lineEndAt(text, pos))
    .trimStart();
  if (line.startsWith("### ")) return "h3";
  if (line.startsWith("## ")) return "h2";
  if (/^[-•*]\s/.test(line)) return "ul";
  return null;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="chev h-4 w-4"
      data-open={open}
    >
      <path d="m5.5 7.75 4.5 4.5 4.5-4.5" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      className="h-4 w-4"
    >
      <path d="M7.5 5.5h8M7.5 10h8M7.5 14.5h8" />
      <circle cx="4.2" cy="5.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="4.2" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="4.2" cy="14.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function RichTextInput({
  id,
  label,
  value,
  onChange,
  maxLength,
  placeholder,
  disabled = false,
  rows = 7,
}: RichTextInputProps) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  /** Auswahl, die nach dem nächsten Rendern wiederhergestellt wird. */
  const pending = useRef<[number, number] | null>(null);

  const previewId = useId();
  const [showPreview, setShowPreview] = useState(true);
  const [block, setBlock] = useState<BlockKind | null>(null);
  const [atLimit, setAtLimit] = useState(false);

  // Nach einem Klick auf ein Werkzeug: Cursor zurück ins Textfeld setzen.
  useEffect(() => {
    const sel = pending.current;
    const el = areaRef.current;
    if (!sel || !el) return;
    pending.current = null;
    el.focus();
    el.setSelectionRange(sel[0], sel[1]);
    setBlock(blockKindAt(el.value, sel[0]));
  });

  function syncBlock() {
    const el = areaRef.current;
    if (!el) return;
    setBlock(blockKindAt(el.value, el.selectionStart ?? 0));
  }

  function runEdit(make: (text: string, start: number, end: number) => Edit) {
    const el = areaRef.current;
    if (!el || disabled) return;

    const next = make(el.value, el.selectionStart ?? 0, el.selectionEnd ?? 0);
    if (next.text === el.value) {
      el.focus();
      return;
    }
    if (next.text.length > maxLength) {
      setAtLimit(true);
      el.focus();
      return;
    }
    setAtLimit(false);
    pending.current = [next.start, next.end];
    onChange(next.text);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === "b") {
      e.preventDefault();
      runEdit((t, s, x) => toggleWrap(t, s, x, "**"));
    } else if (key === "i") {
      e.preventDefault();
      runEdit((t, s, x) => toggleWrap(t, s, x, "*"));
    }
  }

  const tools: {
    key: string;
    label: string;
    aria: string;
    glyph: React.ReactNode;
    on?: boolean;
    run: () => void;
  }[] = [
    {
      key: "h2",
      label: "Überschrift",
      aria: "Überschrift",
      glyph: <span className="text-[13px] leading-none font-bold">H</span>,
      on: block === "h2",
      run: () => runEdit((t, s, x) => toggleLineMark(t, s, x, BLOCK_PREFIX.h2)),
    },
    {
      key: "h3",
      label: "Kleinere",
      aria: "Kleinere Überschrift",
      glyph: <span className="text-[11px] leading-none font-bold">H</span>,
      on: block === "h3",
      run: () => runEdit((t, s, x) => toggleLineMark(t, s, x, BLOCK_PREFIX.h3)),
    },
    {
      key: "bold",
      label: "Fett",
      aria: "Fett",
      glyph: <span className="text-[13px] leading-none font-extrabold">F</span>,
      run: () => runEdit((t, s, x) => toggleWrap(t, s, x, "**")),
    },
    {
      key: "italic",
      label: "Kursiv",
      aria: "Kursiv",
      glyph: (
        <span className="text-[13px] leading-none font-semibold italic">K</span>
      ),
      run: () => runEdit((t, s, x) => toggleWrap(t, s, x, "*")),
    },
    {
      key: "ul",
      label: "Aufzählung",
      aria: "Aufzählung",
      glyph: <ListIcon />,
      on: block === "ul",
      run: () => runEdit((t, s, x) => toggleLineMark(t, s, x, BLOCK_PREFIX.ul)),
    },
  ];

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label className="label" htmlFor={id}>
          {label}
        </label>
        <span aria-hidden className="hint tabular-nums">
          noch {maxLength - value.length}
        </span>
      </div>

      {/*
        Bewusst role="group" statt role="toolbar": eine echte Werkzeugleiste
        müsste sich mit den Pfeiltasten durchlaufen lassen. So bleibt jeder
        Knopf ganz normal per Tab erreichbar — verlässlicher und erwartbar.
      */}
      <div
        role="group"
        aria-label="Textwerkzeuge"
        aria-controls={id}
        className="mb-2 flex flex-wrap gap-1.5"
      >
        {tools.map((tool) => (
          <button
            key={tool.key}
            type="button"
            className="tool-btn min-h-11 gap-1.5 px-2.5 text-xs font-semibold"
            aria-label={tool.aria}
            aria-pressed={tool.on}
            title={tool.aria}
            disabled={disabled}
            data-on={tool.on ? "true" : undefined}
            onClick={tool.run}
          >
            {tool.glyph}
            <span>{tool.label}</span>
          </button>
        ))}
      </div>

      <textarea
        id={id}
        ref={areaRef}
        rows={rows}
        className="input resize-y leading-relaxed"
        placeholder={placeholder}
        maxLength={maxLength}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          setAtLimit(false);
          onChange(e.target.value);
        }}
        onKeyDown={handleKeyDown}
        onKeyUp={syncBlock}
        onSelect={syncBlock}
        onClick={syncBlock}
        onFocus={syncBlock}
      />

      {atLimit && (
        <p role="alert" className="note-enter mt-1.5 text-xs font-semibold text-ink-bad">
          Der Text ist am Limit von {maxLength} Zeichen — bitte erst etwas
          kürzen.
        </p>
      )}

      <p className="hint mt-1.5 leading-relaxed">
        Mit den Knöpfen machst du Überschriften, Aufzählungen und
        <strong className="font-bold"> fetten</strong> oder
        <em className="italic"> kursiven</em> Text. Eine Leerzeile beginnt einen
        neuen Absatz.
      </p>

      <div className="mt-3 overflow-hidden rounded-xl border border-paper-line bg-paper-sunk">
        <button
          type="button"
          className="preview-toggle flex min-h-11 w-full items-center justify-between gap-2 px-3.5 text-left"
          aria-expanded={showPreview}
          aria-controls={previewId}
          onClick={() => setShowPreview((open) => !open)}
        >
          <span className="text-[11px] font-bold tracking-wider text-coal-faint uppercase">
            Vorschau
          </span>
          <span className="hint inline-flex items-center gap-1.5">
            {showPreview ? "ausblenden" : "anzeigen"}
            <ChevronIcon open={showPreview} />
          </span>
        </button>

        <div
          id={previewId}
          hidden={!showPreview}
          className="border-t border-paper-line bg-paper-card px-3.5 py-3.5"
        >
          <div key={showPreview ? "offen" : "zu"} className="animate-fade-up">
            {value.trim() ? (
              <RichText text={value} className="text-coal-soft" />
            ) : (
              <p className="hint">
                Hier siehst du gleich, wie dein Text später im Eintrag aussieht.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
