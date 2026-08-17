"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import "./timeline.css";

interface ModalProps {
  /** id des Überschrift-Elements innerhalb von `children`. */
  titleId: string;
  onClose: () => void;
  children: ReactNode;
  maxWidthClass?: string;
}

/** Ausgang: deutlich schneller als der Eingang (220 ms) — Reagieren darf nie warten. */
const EXIT_MS = 150;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Gemeinsame Modal-Hülle: Backdrop, Escape, Fokus, Schließen-Knopf.
 * Wird von EntryDetailModal und ClusterListModal genutzt.
 *
 * Der Ausgang läuft über `data-state="closing"`: alle Schließwege gehen durch
 * `requestClose()`, die Animation läuft, danach meldet die Hülle nach oben.
 */
export default function Modal({
  titleId,
  onClose,
  children,
  maxWidthClass = "max-w-lg",
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  /** Fokus nach dem Schließen zurückgeben. */
  const previousFocus = useRef<Element | null>(null);
  const exitTimer = useRef<number | undefined>(undefined);
  /** Verhindert, dass ein zweiter Klick den Ausgang neu startet. */
  const closingRef = useRef(false);
  const [closing, setClosing] = useState(false);

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    exitTimer.current = window.setTimeout(
      onClose,
      prefersReducedMotion() ? 0 : EXIT_MS
    );
  }, [onClose]);

  // Fokus einmalig übernehmen und beim Abbau zurückgeben.
  useEffect(() => {
    previousFocus.current = document.activeElement;
    dialogRef.current?.focus();

    return () => {
      window.clearTimeout(exitTimer.current);
      const previous = previousFocus.current;
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        requestClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [requestClose]);

  const state = closing ? "closing" : "open";

  return (
    <div
      data-state={state}
      className="tl-backdrop fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-state={state}
        className={`tl-modal card relative max-h-[86dvh] w-full overflow-y-auto shadow-(--shadow-pop) outline-none ${maxWidthClass}`}
      >
        <button
          type="button"
          onClick={requestClose}
          aria-label="Schließen"
          className="tl-iconbtn absolute top-3 right-3 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-paper-line bg-paper-card/95 text-coal-soft shadow-(--shadow-card) hover:text-coal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fox"
        >
          <svg
            width="16"
            height="16"
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
        {children}
      </div>
    </div>
  );
}
