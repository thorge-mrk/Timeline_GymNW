"use client";

import { useEffect } from "react";
import type { Entry } from "@/lib/types";

interface RealtimeToastProps {
  entry: Entry;
  /** „Anzeigen" — fliegt zum neuen Eintrag. */
  onShow: () => void;
  onDismiss: () => void;
}

/** Wie lange der Hinweis stehen bleibt. */
const VISIBLE_MS = 8000;

/**
 * Dezenter Hinweis auf einen frisch eingetroffenen Eintrag. Erscheint nur, wenn
 * gerade jemand am Zeitstrahl arbeitet — sonst fliegt die Kamera direkt hin.
 */
export default function RealtimeToast({
  entry,
  onShow,
  onDismiss,
}: RealtimeToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [entry.id, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-fade-up pointer-events-none absolute bottom-16 left-1/2 z-30 w-[min(24rem,calc(100%-2rem))] -translate-x-1/2"
    >
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-navy px-4 py-3 text-paper shadow-(--shadow-card-lg)">
        <p className="min-w-0 flex-1 text-sm leading-snug">
          Neuer Eintrag: „<span className="font-semibold">{entry.title}</span>“ (
          {entry.year})
        </p>
        <button
          type="button"
          onClick={onShow}
          className="btn-accent shrink-0 px-3 py-1.5 text-xs"
        >
          Anzeigen
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Hinweis schließen"
          className="shrink-0 cursor-pointer rounded-full p-1 text-paper/70 transition-colors hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fox"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M3.5 3.5l9 9M12.5 3.5l-9 9"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
