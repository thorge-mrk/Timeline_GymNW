"use client";

/**
 * Die allererste Frage: Was für ein Beitrag ist das überhaupt?
 *
 * Vorher hat das Formular jeden Beitrag gleich behandelt und irgendwann nach
 * einem Datum gefragt. Für „Sommerkonzert am 15. Juni 2026“ ist das genau
 * richtig — für „Pausen mit Freunden“ ist es eine Frage, auf die es keine
 * Antwort gibt. Wer sie trotzdem gestellt bekommt, denkt, er habe etwas falsch
 * gemacht. Deshalb steht die Weiche ganz vorne.
 *
 * Sie stand hier auch schon einmal — nur zu breit: zwei Karten mit Zeichen,
 * Überschrift, Erklärsatz, Trennlinie und je vier Beispielen. Das war ein
 * halber Bildschirm für eine Frage mit zwei Antworten, und auf dem Handy
 * musste man scrollen, bevor man überhaupt angefangen hatte.
 *
 * Jetzt steht da, was man wissen muss, und sonst nichts: ein Name und ein
 * Beispiel. „Zeitstrahl-Eintrag“ und „Moment an der Schule“ sagen schon durch
 * ihre Namen, wohin der Beitrag geht — die Erklärung dazu wäre nur eine
 * Wiederholung mit mehr Wörtern.
 *
 * Die Trennlinie in einem Satz: Steht ein Tag oder ein Monat dabei, ist es ein
 * Zeitstrahl-Eintrag. Ist es eine Erinnerung ohne Datum, ist es ein Moment.
 */

export type EntryKind = "ereignis" | "moment";

interface Option {
  id: EntryKind;
  title: string;
  /** Ein einziges echtes Beispiel — kein Regelwerk, ein Wiedererkennungswert. */
  example: string;
}

const OPTIONS: readonly Option[] = [
  {
    id: "ereignis",
    title: "Zeitstrahl-Eintrag",
    example: "Sommerkonzert am 15. Juni",
  },
  {
    id: "moment",
    title: "Moment an der Schule",
    example: "Pausen mit Freunden",
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
      /*
       * Nebeneinander auch auf dem Handy. Die Karten tragen jetzt nur noch
       * zwei kurze Zeilen — untereinander wären sie hier bloß zwei Balken,
       * zwischen denen man scrollen muss, um sie zu vergleichen.
       */
      className="grid grid-cols-2 gap-2.5"
    >
      {OPTIONS.map((option) => {
        const active = value === option.id;
        return (
          <label
            key={option.id}
            data-on={active}
            data-missing={missing}
            className={`kind-card flex min-h-[4.5rem] items-center gap-2.5 rounded-xl border px-3 py-3
              has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2
              has-[:focus-visible]:outline-fox sm:px-4 ${
                disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
              }`}
          >
            <input
              type="radio"
              name="entry-kind"
              value={option.id}
              className="h-5 w-5 shrink-0 accent-fox"
              checked={active}
              disabled={disabled}
              onChange={() => onChange(option.id)}
            />
            <span className="min-w-0">
              <span className="block text-[13px] leading-tight font-bold text-balance text-coal sm:text-sm">
                {option.title}
              </span>
              {/* Das Beispiel steht klein darunter — es erklärt nicht, es zeigt. */}
              <span className="mt-1 block text-[11px] leading-snug text-coal-faint sm:text-[12px]">
                {option.example}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
