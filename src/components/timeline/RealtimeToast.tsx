"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Entry } from "@/lib/types";
import "./timeline.css";

interface RealtimeToastProps {
  entry: Entry;
  /** „Anzeigen" — fliegt zum neuen Eintrag. */
  onShow: () => void;
  onDismiss: () => void;
}

/** Wie lange der Hinweis stehen bleibt. */
const VISIBLE_MS = 8000;
/** Ausgang: schneller als der Eingang (320 ms) und in dieselbe Richtung zurück. */
const EXIT_MS = 200;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Der Hinweis auf einen frisch eingetroffenen Eintrag — am Aktionstag der
 * Moment, in dem der Zeitstrahl lebendig wirkt. Deshalb bekommt er eine
 * eigene Navy-Karte mit Fuchs-Kante statt einer grauen Sprechblase.
 *
 * Er kommt von unten herein und geht nach unten wieder hinaus: dieselbe
 * Richtung, also räumlich stimmig.
 */
export default function RealtimeToast({
  entry,
  onShow,
  onDismiss,
}: RealtimeToastProps) {
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const exitTimer = useRef<number | undefined>(undefined);

  const beginClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    exitTimer.current = window.setTimeout(
      onDismiss,
      prefersReducedMotion() ? 0 : EXIT_MS
    );
  }, [onDismiss]);

  // Jeder neue Eintrag setzt die Anzeige zurück (die Hülle bleibt montiert).
  useEffect(() => {
    closingRef.current = false;
    setClosing(false);
    const hideTimer = window.setTimeout(beginClose, VISIBLE_MS);
    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(exitTimer.current);
    };
  }, [entry.id, beginClose]);

  return (
    // Die Zentrierung sitzt außen, die Animation innen — sonst würde das
    // `transform` der Keyframes das `-translate-x-1/2` überschreiben.
    <div className="pointer-events-none absolute inset-x-0 bottom-20 z-30 flex justify-center px-4">
      <div
        role="status"
        aria-live="polite"
        data-state={closing ? "closing" : "open"}
        className="tl-toast pointer-events-auto w-full max-w-sm overflow-hidden rounded-2xl border border-navy-line bg-navy text-paper shadow-(--shadow-pop)"
      >
        <div className="flex items-stretch">
          <span aria-hidden="true" className="w-[3px] shrink-0 bg-fox" />

          <div className="flex min-w-0 flex-1 items-center gap-2.5 py-2.5 pr-2 pl-3.5">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.12em] text-fox uppercase">
                <span
                  aria-hidden="true"
                  className="animate-pulse-ring h-1.5 w-1.5 rounded-full bg-fox"
                />
                Neuer Eintrag
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-paper">
                {entry.title}{" "}
                <span className="font-normal text-paper/55 tabular-nums">
                  · {entry.year}
                </span>
              </p>
            </div>

            <button
              type="button"
              onClick={onShow}
              className="btn-accent shrink-0 px-3 py-1.5 text-xs"
            >
              Anzeigen
            </button>

            <button
              type="button"
              onClick={beginClose}
              aria-label="Hinweis schließen"
              className="tl-iconbtn shrink-0 cursor-pointer rounded-full p-1.5 text-paper/60 hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fox"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
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
      </div>
    </div>
  );
}
