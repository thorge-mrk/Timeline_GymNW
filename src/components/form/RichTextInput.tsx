"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { htmlToStored, storedToHtml } from "./richTextHtml";

/**
 * Schreibfeld für die Beschreibung — wie in einem Textprogramm.
 *
 * Man tippt und sieht die Formatierung sofort an Ort und Stelle: Fett ist
 * fett, eine Überschrift ist groß, eine Aufzählung hat Punkte. Keine
 * Sternchen, keine getrennte Vorschau.
 *
 * Gespeichert wird trotzdem weiterhin das schlichte Textformat aus
 * src/lib/richText.ts. Die Übersetzung in beide Richtungen macht
 * richTextHtml.ts — dort steht auch, warum das sicher ist.
 *
 * Der Feldinhalt gehört dem Browser (contentEditable), nicht React: React darf
 * ihn nicht bei jedem Tastendruck neu schreiben, sonst springt der Cursor.
 * Deshalb wird das HTML nur dann gesetzt, wenn der Text von außen kommt —
 * beim Öffnen, beim Bearbeiten eines Eintrags und nach dem Leeren.
 */

interface RichTextInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  placeholder?: string;
  disabled?: boolean;
}

type ToolKey = "h2" | "h3" | "bold" | "italic" | "ul";

type ToolState = Record<ToolKey, boolean>;

const NO_TOOLS: ToolState = {
  h2: false,
  h3: false,
  bold: false,
  italic: false,
  ul: false,
};

/** Überschriften-Ebenen, die der Renderer kennt. */
const BIG_HEADINGS = new Set(["H1", "H2"]);
const SMALL_HEADINGS = new Set(["H3", "H4", "H5", "H6"]);
const HEADINGS = new Set([...BIG_HEADINGS, ...SMALL_HEADINGS]);

/** Elemente, die im Feld eine eigene Zeile bilden. */
const BLOCK_TAGS = new Set([
  ...HEADINGS,
  "P",
  "DIV",
  "LI",
  "BLOCKQUOTE",
]);

/** Nächstliegender Block um einen Knoten — Überschrift, Absatz, Listenpunkt. */
function blockAround(root: HTMLElement, node: Node | null): HTMLElement | null {
  for (let step = node; step && step !== root; step = step.parentNode) {
    if (step.nodeType !== 1) continue;
    const el = step as HTMLElement;
    if (BLOCK_TAGS.has(el.nodeName.toUpperCase())) return el;
  }
  return null;
}

function sameTools(a: ToolState, b: ToolState): boolean {
  return (
    a.h2 === b.h2 &&
    a.h3 === b.h3 &&
    a.bold === b.bold &&
    a.italic === b.italic &&
    a.ul === b.ul
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

/** Welche Auszeichnungen liegen an der Cursorposition an? */
function toolStateAt(root: HTMLElement, node: Node | null): ToolState {
  const state: ToolState = { ...NO_TOOLS };

  for (let step = node; step && step !== root; step = step.parentNode) {
    if (step.nodeType !== 1) continue;
    const tag = (step as Element).nodeName.toUpperCase();
    if (BIG_HEADINGS.has(tag)) state.h2 = true;
    else if (SMALL_HEADINGS.has(tag)) state.h3 = true;
    else if (tag === "UL" || tag === "OL") state.ul = true;
  }

  // Fett und kursiv beantwortet der Browser selbst — er weiß auch, was beim
  // nächsten Zeichen gilt, wenn gerade nichts markiert ist.
  try {
    state.bold = document.queryCommandState("bold");
    state.italic = document.queryCommandState("italic");
  } catch {
    /* Nicht überall verfügbar — dann bleiben die Knöpfe eben ruhig. */
  }
  return state;
}

export function RichTextInput({
  id,
  label,
  value,
  onChange,
  maxLength,
  placeholder = "",
  disabled = false,
}: RichTextInputProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  /** Zuletzt aus dem Feld gemeldeter Text — verhindert Schreiben im Kreis. */
  const emittedRef = useRef<string | null>(null);
  /** Letzte Auswahl im Feld, damit Werkzeuge auch per Tastatur greifen. */
  const rangeRef = useRef<Range | null>(null);

  const labelId = useId();
  const hintId = useId();
  const [tools, setTools] = useState<ToolState>(NO_TOOLS);
  const [atLimit, setAtLimit] = useState(false);

  const empty = value.trim().length === 0;
  const left = maxLength - value.length;

  /* --- Text von außen ins Feld schreiben (öffnen, laden, leeren) --- */
  useEffect(() => {
    const el = editorRef.current;
    if (!el || value === emittedRef.current) return;
    emittedRef.current = value;
    el.innerHTML = storedToHtml(value);
  }, [value]);

  // Absätze statt <div> und echte <b>/<i> statt Stil-Attribute: beides macht
  // das Feld für die Rückübersetzung berechenbarer. Ältere Browser kennen die
  // Schalter nicht — dann greift die Positivliste in richTextHtml.ts.
  useEffect(() => {
    try {
      document.execCommand("defaultParagraphSeparator", false, "p");
      document.execCommand("styleWithCSS", false, "false");
    } catch {
      /* egal */
    }
  }, []);

  /** Aktuellen Feldinhalt als gespeicherten Text melden. */
  const emit = useCallback(() => {
    const el = editorRef.current;
    if (!el) return "";
    const stored = htmlToStored(el);
    emittedRef.current = stored;
    onChange(stored);
    return stored;
  }, [onChange]);

  /** Knopfzustände und Auswahl nachführen. */
  const syncTools = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!el.contains(range.commonAncestorContainer)) return;
    rangeRef.current = range.cloneRange();
    // Der Cursor bewegt sich bei jedem Zeichen — neu gezeichnet wird nur,
    // wenn sich an den Knöpfen wirklich etwas ändert.
    const next = toolStateAt(el, range.startContainer);
    setTools((current) => (sameTools(current, next) ? current : next));
  }, []);

  // Der Cursor bewegt sich auch ohne Tastendruck (Maus, Auswahl per Tastatur).
  useEffect(() => {
    document.addEventListener("selectionchange", syncTools);
    return () => document.removeEventListener("selectionchange", syncTools);
  }, [syncTools]);

  /** Cursor zurück ins Feld holen — ohne das geht execCommand ins Leere. */
  const focusEditor = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    if (document.activeElement === el) return;
    el.focus();
    const range = rangeRef.current;
    const selection = window.getSelection();
    if (range && selection && el.contains(range.commonAncestorContainer)) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }, []);

  /**
   * Ein Werkzeug ausführen. document.execCommand ist offiziell veraltet, aber
   * für genau diesen Zweck immer noch überall zuverlässig — und es bringt die
   * Rückgängig-Funktion des Browsers gleich mit.
   */
  const run = useCallback(
    (command: string, argument?: string) => {
      if (disabled) return;
      focusEditor();
      try {
        document.execCommand(command, false, argument);
      } catch {
        return;
      }
      const stored = emit();
      setAtLimit(stored.length > maxLength);
      syncTools();
    },
    [disabled, emit, focusEditor, maxLength, syncTools]
  );

  const toggleHeading = useCallback(
    (level: "h2" | "h3", active: boolean) => {
      run("formatBlock", active ? "<p>" : `<${level}>`);
    },
    [run]
  );

  /** Text einsetzen — immer als reiner Text, Zeile für Zeile als Absatz. */
  const insertPlain = useCallback(
    (raw: string) => {
      const el = editorRef.current;
      if (!el || disabled) return;

      const room = maxLength - htmlToStored(el).length;
      const parts = raw
        .replace(/\r\n?/g, "\n")
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean);
      if (!parts.length) return;
      if (room <= 0) {
        setAtLimit(true);
        return;
      }

      focusEditor();
      let budget = room;
      let clipped = false;
      for (const [index, part] of parts.entries()) {
        if (budget <= 0) {
          clipped = true;
          break;
        }
        const piece = part.slice(0, budget);
        if (piece.length < part.length) clipped = true;
        budget -= piece.length + 2; // zwei Zeichen für den Absatzwechsel
        try {
          if (index > 0) document.execCommand("insertParagraph");
          document.execCommand("insertText", false, piece);
        } catch {
          break;
        }
      }
      emit();
      setAtLimit(clipped);
      syncTools();
    },
    [disabled, emit, focusEditor, maxLength, syncTools]
  );

  /*
   * Einfügen aus der Zwischenablage: Wir nehmen ausschließlich text/plain und
   * setzen es selbst ein. Fremdes HTML aus Word oder von Webseiten kommt so
   * gar nicht erst ins Feld — der sicherste und einfachste Weg.
   */
  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    e.preventDefault();
    insertPlain(e.clipboardData.getData("text/plain"));
  }

  /*
   * Hineingezogene Inhalte (Text, Bilder, Dateien) bringen ebenfalls fremdes
   * Markup mit und landen an einer Stelle, die niemand bewusst gewählt hat.
   * Deshalb: freundlich abweisen statt raten.
   */
  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
  }

  /**
   * Enter am Ende einer Überschrift schreibt normal weiter — sonst würde der
   * ganze folgende Text ungewollt zur Überschrift.
   */
  function leaveHeadingOnEnter(): boolean {
    const el = editorRef.current;
    const selection = window.getSelection();
    if (!el || !selection?.isCollapsed || selection.rangeCount === 0) return false;

    const range = selection.getRangeAt(0);
    const block = blockAround(el, range.startContainer);
    if (!block || !HEADINGS.has(block.nodeName.toUpperCase())) return false;

    // Steht der Cursor mittendrin, bleibt es beim normalen Teilen.
    const rest = range.cloneRange();
    rest.selectNodeContents(block);
    rest.setStart(range.endContainer, range.endOffset);
    if (rest.toString().trim() !== "") return false;

    try {
      document.execCommand("insertParagraph");
      document.execCommand("formatBlock", false, "<p>");
    } catch {
      return false;
    }
    emit();
    syncTools();
    return true;
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    // Die Prüfung liest den Cursor direkt aus dem Feld, nicht aus dem
    // Knopfzustand — der könnte einen Tastendruck hinterherhinken.
    if (e.key === "Enter" && !e.shiftKey) {
      if (leaveHeadingOnEnter()) e.preventDefault();
      return;
    }
    if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === "b") {
      e.preventDefault();
      run("bold");
    } else if (key === "i") {
      e.preventDefault();
      run("italic");
    }
  }

  /*
   * Zeichengrenze. Gezählt wird der gespeicherte Text, nicht das HTML. Statt
   * Getipptes nachträglich wegzunehmen, wird am Limit einfach nichts mehr
   * eingefügt — dabei geht nie etwas verloren.
   */
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;

    const guard = (event: Event) => {
      const input = event as InputEvent;
      if (!input.inputType?.startsWith("insert")) return;
      if (htmlToStored(el).length < maxLength) return;
      const selection = window.getSelection();
      // Eine markierte Stelle wird ersetzt — das macht den Text nicht länger.
      if (selection && !selection.isCollapsed) return;
      event.preventDefault();
      setAtLimit(true);
    };

    el.addEventListener("beforeinput", guard);
    return () => el.removeEventListener("beforeinput", guard);
  }, [maxLength]);

  // Sobald wieder Platz ist, verschwindet der Hinweis von selbst.
  useEffect(() => {
    if (value.length < maxLength) setAtLimit(false);
  }, [value, maxLength]);

  const buttons: {
    key: ToolKey;
    label: string;
    aria: string;
    /** Nur als Tooltip — im aria-label würde das Kürzel beim Vorlesen stören. */
    tip?: string;
    glyph: React.ReactNode;
    press: () => void;
  }[] = [
    {
      key: "h2",
      label: "Überschrift",
      aria: "Überschrift",
      glyph: <span className="text-[13px] leading-none font-bold">H</span>,
      press: () => toggleHeading("h2", tools.h2),
    },
    {
      key: "h3",
      label: "Kleinere",
      aria: "Kleinere Überschrift",
      glyph: <span className="text-[11px] leading-none font-bold">H</span>,
      press: () => toggleHeading("h3", tools.h3),
    },
    {
      key: "bold",
      label: "Fett",
      aria: "Fett",
      tip: "Fett (Strg/Cmd + B)",
      glyph: <span className="text-[13px] leading-none font-extrabold">F</span>,
      press: () => run("bold"),
    },
    {
      key: "italic",
      label: "Kursiv",
      aria: "Kursiv",
      tip: "Kursiv (Strg/Cmd + I)",
      glyph: (
        <span className="text-[13px] leading-none font-semibold italic">K</span>
      ),
      press: () => run("italic"),
    },
    {
      key: "ul",
      label: "Aufzählung",
      aria: "Aufzählung",
      glyph: <ListIcon />,
      press: () => run("insertUnorderedList"),
    },
  ];

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span
          className="label"
          id={labelId}
          onClick={() => editorRef.current?.focus()}
        >
          {label}
        </span>
        <span
          aria-hidden
          className={`hint tabular-nums ${
            left <= 0 ? "font-semibold text-ink-bad" : ""
          }`}
        >
          noch {left}
        </span>
      </div>

      <div className="editor-shell" data-disabled={disabled || undefined}>
        {/*
          Bewusst role="group" statt role="toolbar": eine echte Werkzeugleiste
          müsste sich mit den Pfeiltasten durchlaufen lassen. So bleibt jeder
          Knopf ganz normal per Tab erreichbar — verlässlicher und erwartbar.
        */}
        <div
          role="group"
          aria-label="Textwerkzeuge"
          aria-controls={id}
          className="editor-bar"
        >
          {buttons.map((button) => (
            <button
              key={button.key}
              type="button"
              className="tool-btn min-h-11 gap-1.5 px-2.5 text-xs font-semibold"
              aria-label={button.aria}
              aria-pressed={tools[button.key]}
              title={button.tip ?? button.aria}
              disabled={disabled}
              data-on={tools[button.key] ? "true" : undefined}
              // Der Cursor bleibt im Text stehen, statt zum Knopf zu wandern.
              onMouseDown={(e) => e.preventDefault()}
              onClick={button.press}
            >
              {button.glyph}
              <span>{button.label}</span>
            </button>
          ))}
        </div>

        <div
          id={id}
          ref={editorRef}
          className="editor-area"
          contentEditable={!disabled}
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-labelledby={labelId}
          aria-describedby={hintId}
          data-empty={empty || undefined}
          data-placeholder={placeholder}
          spellCheck
          onInput={() => {
            emit();
            syncTools();
          }}
          onBlur={() => emit()}
          onKeyDown={handleKeyDown}
          onKeyUp={syncTools}
          onMouseUp={syncTools}
          onFocus={syncTools}
          onPaste={handlePaste}
          onDrop={handleDrop}
        />
      </div>

      {atLimit && (
        <p
          role="alert"
          className="note-enter mt-1.5 text-xs font-semibold text-ink-bad"
        >
          Mehr als {maxLength} Zeichen passen nicht in einen Eintrag — bitte
          erst etwas kürzen.
        </p>
      )}

      <p id={hintId} className="hint mt-1.5 leading-relaxed">
        Schreib einfach los. Mit den Knöpfen machst du Überschriften,
        Aufzählungen und <strong className="font-bold">fetten</strong> oder{" "}
        <em className="italic">kursiven</em> Text — du siehst es sofort im Feld.
      </p>
    </div>
  );
}
