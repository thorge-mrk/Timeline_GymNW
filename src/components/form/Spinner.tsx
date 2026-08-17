"use client";

interface SpinnerProps {
  /** Optionaler Text neben dem Spinner (wird auch von Screenreadern gelesen). */
  label?: string;
  className?: string;
}

/** Dezenter Lade-Indikator im Papier-/Navy-Look. */
export function Spinner({ label, className = "" }: SpinnerProps) {
  return (
    <span
      className={`inline-flex items-center gap-2 text-sm text-coal-soft ${className}`}
      role="status"
    >
      <span
        aria-hidden
        className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-paper-line border-t-fox [animation-duration:0.72s]"
      />
      {label ? <span>{label}</span> : <span className="sr-only">Lädt …</span>}
    </span>
  );
}

/** Ganzseitiger Ladezustand (Guard auf /eintragen, Suspense-Fallback). */
export function PageSpinner({ label = "Einen Moment …" }: { label?: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Spinner label={label} />
    </div>
  );
}
