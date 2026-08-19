"use client";

import { SmartDateInput } from "./SmartDateInput";

/**
 * Der Schritt „Wann war das?“ — mit einer ausdrücklich gleichwertigen Antwort
 * für alle, die es nicht mehr wissen.
 *
 * Am Aktionstag ist „irgendwann in der 8.“ die häufigste Antwort überhaupt.
 * Deshalb stehen hier zwei gleich große, gleich aussehende Möglichkeiten
 * untereinander — nicht ein Pflichtfeld mit einem kleinen Auswegkästchen
 * daneben. Eine Erinnerung ohne Jahreszahl ist keine schlechtere Erinnerung,
 * und das Formular soll das auch zeigen.
 *
 * Was ohne Datum passiert, steht offen dabei: Der Eintrag landet in der
 * Erinnerungs-Wolke statt auf der Achse. Niemand soll sich hinterher wundern.
 *
 * Das Datumsfeld steht bewusst NEBEN dem Auswahlknopf, nicht in dessen
 * <label> — zwei Bedienelemente in einer Beschriftung wären ungültiges HTML
 * und würden sich beim Antippen gegenseitig in die Quere kommen.
 */

export type DateMode = "known" | "unknown";

function CloudIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0 text-petrol"
    >
      <path d="M7.2 18.5h9.6a3.8 3.8 0 0 0 .5-7.57 5.2 5.2 0 0 0-9.86-1.6A3.9 3.9 0 0 0 7.2 18.5Z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0 text-fox"
    >
      <rect x="3.6" y="5.2" width="16.8" height="15.2" rx="2.4" />
      <path d="M3.6 10h16.8M8.4 3.6v3.2M15.6 3.6v3.2" />
    </svg>
  );
}

interface DateChoiceProps {
  mode: DateMode;
  onModeChange: (mode: DateMode) => void;
  value: string;
  onChange: (value: string) => void;
  inputId: string;
  disabled?: boolean;
  /** Erst nach einem „Weiter“-Versuch die Pflichtmeldung zeigen. */
  showRequiredError?: boolean;
}

/** Gemeinsame Optik beider Möglichkeiten — bewusst identisch. */
const ROW =
  "choice-row rounded-xl border p-3.5 has-[:focus-visible]:outline-2 " +
  "has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-fox";

export function DateChoice({
  mode,
  onModeChange,
  value,
  onChange,
  inputId,
  disabled = false,
  showRequiredError = false,
}: DateChoiceProps) {
  // Einzeilige Zeilen werden mittig gesetzt, mehrzeilige oben — sonst hängt
  // der Auswahlknopf in einer 44-px-Zeile sichtbar zu weit oben.
  const rowLabel = (multiline: boolean) =>
    `flex min-h-11 gap-3 ${multiline ? "items-start" : "items-center"} ${
      disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
    }`;

  return (
    <div
      role="radiogroup"
      aria-label="Ist das Datum bekannt?"
      className="space-y-2.5"
    >
      <div className={ROW} data-on={mode === "known"}>
        <label className={rowLabel(false)}>
          <input
            type="radio"
            name="entry-date-mode"
            value="known"
            className="h-5 w-5 shrink-0 accent-fox"
            checked={mode === "known"}
            disabled={disabled}
            onChange={() => onModeChange("known")}
          />
          <span className="flex items-center gap-1.5 text-sm font-semibold text-coal">
            <CalendarIcon />
            Ich weiß ungefähr, wann das war
          </span>
        </label>

        {mode === "known" && (
          <div className="animate-fade-up mt-3.5 sm:pl-8">
            <SmartDateInput
              id={inputId}
              value={value}
              onChange={onChange}
              disabled={disabled}
              showRequiredError={showRequiredError}
            />
          </div>
        )}
      </div>

      <div className={ROW} data-on={mode === "unknown"}>
        <label className={rowLabel(true)}>
          <input
            type="radio"
            name="entry-date-mode"
            value="unknown"
            className="mt-0.5 h-5 w-5 shrink-0 accent-fox"
            checked={mode === "unknown"}
            disabled={disabled}
            onChange={() => onModeChange("unknown")}
          />
          <span className="min-w-0 text-sm">
            <span className="flex items-center gap-1.5 font-semibold text-coal">
              <CloudIcon />
              Weiß ich nicht mehr
            </span>
            <span className="hint mt-0.5 block leading-relaxed">
              Völlig in Ordnung. Der Eintrag steht dann nicht auf der Zeitachse,
              sondern in der Erinnerungs-Wolke — gefunden wird er trotzdem.
            </span>
          </span>
        </label>
      </div>
    </div>
  );
}
