"use client";

/**
 * Fortschrittsanzeige des geführten Ablaufs.
 *
 * Zwei Dinge muss man am Aktionstag auf einen Blick sehen: wo man gerade ist
 * und wie viel noch kommt. Deshalb eine Zahl in Worten („Schritt 2 von 5“),
 * eine ruhige Leiste und fünf antippbare Punkte — 44 px, damit auch ein Daumen
 * auf dem Schul-iPad trifft.
 *
 * Die Leiste wächst über `transform: scaleX()` statt über die Breite: So
 * bewegt der Browser nur Pixel und rechnet kein Layout neu.
 */

export interface StepDef {
  key: string;
  title: string;
  /** Ein Satz darüber, was in diesem Schritt gefragt ist. */
  lead: string;
}

function CheckIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="m4.6 10.4 3.4 3.4 7.4-7.6" />
    </svg>
  );
}

interface StepProgressProps {
  steps: readonly StepDef[];
  current: number;
  /** Schon besuchte Schritte — die dürfen direkt angesprungen werden. */
  visited: ReadonlySet<number>;
  onGo: (index: number) => void;
  disabled?: boolean;
}

export function StepProgress({
  steps,
  current,
  visited,
  onGo,
  disabled = false,
}: StepProgressProps) {
  const total = steps.length;
  const filled = (current + 1) / total;

  return (
    <div className="border-b border-paper-line pb-4">
      {/* Nur Optik — vorgelesen wird die Live-Region weiter unten. */}
      <div aria-hidden className="step-bar">
        <span className="step-bar__fill" style={{ transform: `scaleX(${filled})` }} />
      </div>

      {/*
        Zähler und Punkte teilen sich eine Zeile. Früher standen darüber noch
        „Schritt 3 von 4“ und der Titel des Schritts — der Titel steht als
        Überschrift ohnehin gleich darunter, und jede Zeile hier fehlt unten
        beim Eingabefeld.
      */}
      <div className="mt-3 flex items-center gap-2">
        {steps.map((step, index) => {
          const done = index < current;
          const here = index === current;
          const reachable = visited.has(index) || index <= current;
          return (
            <button
              key={step.key}
              type="button"
              className="step-dot"
              data-state={here ? "here" : done ? "done" : "open"}
              data-reachable={reachable}
              disabled={disabled}
              aria-current={here ? "step" : undefined}
              aria-label={`Schritt ${index + 1} von ${total}: ${step.title}`}
              onClick={() => onGo(index)}
            >
              {done ? <CheckIcon /> : <span aria-hidden>{index + 1}</span>}
            </button>
          );
        })}
        <p className="ml-auto text-[11px] font-bold tracking-wider text-coal-faint uppercase">
          <span className="tabular-nums">
            Schritt {current + 1} von {total}
          </span>
        </p>
      </div>
    </div>
  );
}
