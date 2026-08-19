"use client";

import { useEffect, useMemo, useRef } from "react";
import { formatSmartDate, parseSmartDate } from "@/lib/dates";

interface SmartDateInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Erst nach einem Absende-Versuch die „Pflichtfeld“-Meldung zeigen. */
  showRequiredError?: boolean;
}

const FORMAT_HINT = "Bitte so eingeben: 1996 · 3.1996 · 12.3.1996";
const CALM_HINT = "Nur das Jahr reicht schon — Monat und Tag sind optional.";

function CheckIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="m4.6 10.4 3.4 3.4 7.4-7.6" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      className="h-4 w-4"
    >
      <circle cx="10" cy="10" r="7.6" />
      <path d="M10 6.1v4.6" />
      <path d="M10 13.6h.01" />
    </svg>
  );
}

/**
 * Ein einziges Textfeld für alle Datums-Genauigkeiten (Jahr / Monat / Tag).
 * Darunter läuft live mit, wie das Datum später auf dem Zeitstrahl steht.
 *
 * Alle vier Zustände der Hinweiszeile liegen übereinander in derselben
 * Rasterzelle (`.note-slot`): die Höhe steht damit von Anfang an fest und das
 * Formular zuckt beim Tippen nicht. Sichtbar ist die Zeile nur optisch — für
 * Screenreader läuft daneben eine schlanke Live-Region mit.
 */
export function SmartDateInput({
  id = "entry-date",
  value,
  onChange,
  disabled = false,
  showRequiredError = false,
}: SmartDateInputProps) {
  const trimmed = value.trim();
  const parsed = useMemo(() => parseSmartDate(value), [value]);
  const hasInput = trimmed.length > 0;
  const isInvalid = hasInput && parsed === null;
  const isMissing = !hasInput && showRequiredError;
  const isCalm = !parsed && !isInvalid && !isMissing;

  /*
   * Der zuletzt gültige Text bleibt stehen, während die Erfolgszeile
   * ausblendet — sonst wäre für 120 ms ein leerer grüner Kasten zu sehen.
   */
  const lastOk = useRef("");
  const okText = parsed ? formatSmartDate(parsed) : lastOk.current;
  useEffect(() => {
    if (parsed) lastOk.current = formatSmartDate(parsed);
  }, [parsed]);

  const statusText = parsed
    ? `Wird angezeigt als: ${formatSmartDate(parsed)}`
    : isInvalid
      ? FORMAT_HINT
      : isMissing
        ? `Bitte ein Jahr angeben. ${FORMAT_HINT}`
        : "";

  return (
    <div>
      <label className="label" htmlFor={id}>
        Wann? <span aria-hidden className="font-bold text-fox-deep">*</span>
        <span className="sr-only">(Pflichtfeld)</span>
      </label>

      <input
        id={id}
        name="entry-date"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className="input min-h-12"
        placeholder="z. B. 1996 oder 12.3.1996"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={isInvalid || isMissing}
        aria-describedby={`${id}-status ${id}-hint`}
      />

      {/* Nur für Screenreader: Status und dauerhafter Hinweis. */}
      <p id={`${id}-status`} aria-live="polite" className="sr-only">
        {statusText}
      </p>
      <p id={`${id}-hint`} className="sr-only">
        {CALM_HINT} {FORMAT_HINT}
      </p>

      {/* Optische Live-Interpretation. */}
      <div aria-hidden className="note-slot mt-1.5 text-xs font-semibold">
        <p className="note-line note-line--calm font-normal" data-on={isCalm}>
          {CALM_HINT}
        </p>
        <p className="note-line note-line--ok" data-on={Boolean(parsed)}>
          <CheckIcon />
          <span>
            Wird angezeigt als:{" "}
            <span className="font-bold">„{okText}“</span>
          </span>
        </p>
        <p className="note-line note-line--bad" data-on={isInvalid}>
          <AlertIcon />
          <span>{FORMAT_HINT}</span>
        </p>
        <p className="note-line note-line--bad" data-on={isMissing}>
          <AlertIcon />
          <span>Bitte ein Jahr angeben — {FORMAT_HINT}</span>
        </p>
      </div>
    </div>
  );
}
