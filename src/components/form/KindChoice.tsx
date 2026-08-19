"use client";

/**
 * Die allererste Frage: Was für ein Beitrag ist das überhaupt?
 *
 * Vorher hat das Formular jeden Beitrag gleich behandelt und irgendwann nach
 * einem Datum gefragt. Für „Sommerkonzert am 15. Juni 2026“ ist das genau
 * richtig — für „Pausen mit meinen Freunden“ ist es eine Frage, auf die es
 * keine Antwort gibt. Wer sie trotzdem gestellt bekommt, denkt, er habe etwas
 * falsch gemacht.
 *
 * Deshalb steht die Weiche jetzt ganz vorne, ausdrücklich und in zwei gleich
 * großen Karten: ein Ereignis für die Zeitachse oder ein Moment für die
 * Erinnerungs-Wolke. Keine der beiden Karten ist die Hauptsache und die andere
 * der Sonderfall — beides sind Schulgeschichte, nur an verschiedenen Orten.
 *
 * Die Beispiele stehen bewusst mit dabei. „Ereignis“ und „Moment“ sind Wörter,
 * unter denen sich jeder etwas anderes vorstellt; „Berlinfahrt im April 2026“
 * dagegen ist eindeutig.
 */

export type EntryKind = "ereignis" | "moment";

/** Ein Punkt auf einer Linie — das Zeichen für die Zeitachse. */
function TimelineIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 shrink-0 text-fox"
    >
      <path d="M3.4 12h4.2M16.4 12h4.2" />
      <circle cx="12" cy="12" r="3.4" />
      <path d="M12 4.2v2M12 17.8v2" />
    </svg>
  );
}

/** Eine Wolke — dasselbe Zeichen wie beim „Weiß ich nicht mehr“ im Datumsschritt. */
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
      className="h-5 w-5 shrink-0 text-petrol"
    >
      <path d="M7.2 18.5h9.6a3.8 3.8 0 0 0 .5-7.57 5.2 5.2 0 0 0-9.86-1.6A3.9 3.9 0 0 0 7.2 18.5Z" />
    </svg>
  );
}

interface Option {
  id: EntryKind;
  title: string;
  lead: string;
  examples: readonly string[];
  icon: React.ReactNode;
}

const OPTIONS: readonly Option[] = [
  {
    id: "ereignis",
    title: "Ereignis für den Zeitstrahl",
    lead: "Etwas, das an einem bestimmten Zeitpunkt passiert ist und zur Schulgeschichte gehört.",
    examples: [
      "Sommerkonzert am 15. Juni 2026",
      "Fußballturnier des 7. Jahrgangs",
      "Berlinfahrt im April 2026",
      "Beginn der Bienen-AG",
    ],
    icon: <TimelineIcon />,
  },
  {
    id: "moment",
    title: "Bester Moment / Erlebnis",
    lead: "Eine persönliche Erinnerung — schön, auch ohne Datum. Landet in der Erinnerungs-Wolke.",
    examples: [
      "Meine Einschulung",
      "Bläserklasse",
      "Pausen mit meinen Freunden",
      "Der Amerika-Austausch",
    ],
    icon: <CloudIcon />,
  },
] as const;

export interface KindChoiceProps {
  /**
   * `null` heißt: noch nicht gewählt. Es gibt bewusst keine Vorauswahl — sonst
   * wäre eine der beiden Karten die Normalform und die andere der Sonderfall,
   * und man könnte die Frage mit einem Klick auf „Weiter“ überspringen, ohne
   * sie gelesen zu haben.
   */
  value: EntryKind | null;
  onChange: (kind: EntryKind) => void;
  disabled?: boolean;
  /** Erst nach einem „Weiter“-Versuch sichtbar machen, dass hier noch etwas fehlt. */
  showRequiredError?: boolean;
}

export function KindChoice({
  value,
  onChange,
  disabled = false,
  showRequiredError = false,
}: KindChoiceProps) {
  const missing = showRequiredError && value === null;

  return (
    <div
      role="radiogroup"
      aria-label="Was für ein Beitrag ist das?"
      aria-required="true"
      /* Nebeneinander erst ab 40rem: Auf 390 px wäre die zweite Karte sonst
         nur noch halb so breit wie die Beispiele darin lang sind. */
      className="grid gap-3 sm:grid-cols-2"
    >
      {OPTIONS.map((option) => {
        const active = value === option.id;
        return (
          <label
            key={option.id}
            data-on={active}
            data-missing={missing}
            className={`kind-card flex flex-col gap-2.5 rounded-2xl border p-4
              has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2
              has-[:focus-visible]:outline-fox ${
                disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
              }`}
          >
            <span className="flex min-h-11 items-start gap-3">
              <input
                type="radio"
                name="entry-kind"
                value={option.id}
                className="mt-0.5 h-5 w-5 shrink-0 accent-fox"
                checked={active}
                disabled={disabled}
                onChange={() => onChange(option.id)}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-start gap-1.5 text-sm font-bold text-coal sm:text-base">
                  {option.icon}
                  {option.title}
                </span>
                <span className="hint mt-1 block leading-relaxed">{option.lead}</span>
              </span>
            </span>

            {/* Beispiele: keine Anweisung, sondern vier echte Fälle zum Wiedererkennen. */}
            <span className="block border-t border-paper-line pt-2.5 pl-8">
              <span className="text-[11px] font-bold tracking-wider text-coal-faint uppercase">
                Zum Beispiel
              </span>
              <span className="mt-1.5 flex flex-wrap gap-1.5">
                {option.examples.map((example) => (
                  <span
                    key={example}
                    className="rounded-full border border-paper-line bg-paper-card px-2.5 py-1
                      text-[11px] leading-snug text-coal-soft"
                  >
                    {example}
                  </span>
                ))}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
