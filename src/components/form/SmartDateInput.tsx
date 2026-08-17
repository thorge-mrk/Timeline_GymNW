"use client";

import { useMemo } from "react";
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

/**
 * Ein einziges Textfeld für alle Datums-Genauigkeiten (Jahr / Monat / Tag).
 * Darunter läuft live mit, wie das Datum später auf dem Zeitstrahl steht.
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

  return (
    <div>
      <label className="label" htmlFor={id}>
        Wann? <span aria-hidden className="text-fox">*</span>
        <span className="sr-only">(Pflichtfeld)</span>
      </label>

      <input
        id={id}
        name="entry-date"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className="input min-h-12"
        placeholder="z. B. 1996 oder 12.3.1996"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={isInvalid || isMissing}
        aria-describedby={`${id}-status ${id}-hint`}
      />

      {/* Live-Region: existiert dauerhaft, damit Screenreader Änderungen mitbekommen. */}
      <div
        id={`${id}-status`}
        aria-live="polite"
        className="mt-1.5 min-h-5 text-xs"
      >
        {parsed && (
          <p className="font-semibold text-[#3f7a45]">
            ✓ Wird angezeigt als: „{formatSmartDate(parsed)}“
          </p>
        )}
        {isInvalid && (
          <p className="font-semibold text-[#b3402a]">{FORMAT_HINT}</p>
        )}
        {isMissing && (
          <p className="font-semibold text-[#b3402a]">
            Bitte ein Jahr angeben — {FORMAT_HINT}
          </p>
        )}
      </div>

      <p id={`${id}-hint`} className="hint mt-1">
        Nur das Jahr reicht schon — Monat und Tag sind optional.
      </p>
    </div>
  );
}
