"use client";

/**
 * Die Bestätigung nach dem Speichern.
 *
 * Bewusst dieselbe Karte für beide Wege: für einen ganzen neuen Eintrag ebenso
 * wie für eine Erinnerung, die jemand an ein bestehendes Thema anhängt. Wer
 * etwas beiträgt, hat dasselbe geleistet — das soll sich auch gleich anfühlen.
 */

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
      className="h-7 w-7"
    >
      <path d="m4.6 10.4 3.4 3.4 7.4-7.6" />
    </svg>
  );
}

interface SuccessCardProps {
  title: string;
  text: string;
  /** Die Knöpfe darunter — jede Situation braucht andere. */
  children: React.ReactNode;
}

export function SuccessCard({ title, text, children }: SuccessCardProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="card animate-pop-in border-moss/30 bg-moss/8 p-7 text-center shadow-(--shadow-card-lg) sm:p-9"
    >
      <span
        aria-hidden
        className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-moss text-paper shadow-(--shadow-card)"
      >
        <CheckIcon />
      </span>
      <p className="mt-5 text-xl font-bold tracking-tight text-coal">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-coal-soft">
        {text}
      </p>
      <div className="mt-7 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
        {children}
      </div>
    </div>
  );
}
