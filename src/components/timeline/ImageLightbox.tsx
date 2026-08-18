"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
  type TouchEvent as ReactTouchEvent,
} from "react";
import "./timeline.css";

interface ImageLightboxProps {
  /** Öffentliche URLs aller Bilder in Anzeigereihenfolge (Titelbild zuerst). */
  images: string[];
  /** Index des gezeigten Bildes — der Zustand liegt beim Eintrag. */
  index: number;
  onIndexChange: (index: number) => void;
  /** Titel des Eintrags; steckt im Alternativtext jedes Bildes. */
  title: string;
  onClose: () => void;
  /** Bekommt den Fokus zurück, sobald das Vollbild schließt (das angeklickte Bild). */
  returnFocusRef?: RefObject<HTMLElement | null>;
}

/** Ausgang kürzer als der Eingang (200 ms) — Schließen darf nie warten. */
const EXIT_MS = 140;
/** Ab dieser Wischstrecke wird geblättert. */
const SWIPE_MIN = 48;
/** Darunter gilt eine Berührung noch als Tippen, nicht als Wischen. */
const SWIPE_SLOP = 10;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg width="22" height="22" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d={direction === "left" ? "M12.5 4.5 7 10l5.5 5.5" : "M7.5 4.5 13 10l-5.5 5.5"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Vollbild-Galerie über dem Eintrag.
 *
 * Bedienung: Pfeiltasten und die großen Pfeilflächen blättern, Wischen blättert
 * auf dem Tablet, `Esc` und das X schließen. `Esc` wird in der Capture-Phase
 * abgefangen und dort gestoppt — sonst würde das Eintrags-Modal darunter
 * gleich mit schließen.
 *
 * Der Ausgang läuft wie beim Modal über `data-state="closing"`: alle Schließwege
 * gehen durch `requestClose()`, danach meldet die Galerie nach oben.
 */
export default function ImageLightbox({
  images,
  index,
  onIndexChange,
  title,
  onClose,
  returnFocusRef,
}: ImageLightboxProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const exitTimer = useRef<number | undefined>(undefined);
  /** Verhindert, dass ein zweiter Klick den Ausgang neu startet. */
  const closingRef = useRef(false);
  const [closing, setClosing] = useState(false);

  /** Startpunkt der laufenden Wischgeste. */
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  /** Ein Wisch endet auch als Klick — der darf das Vollbild nicht schließen. */
  const swiped = useRef(false);
  const [dragX, setDragX] = useState(0);

  const count = images.length;
  const current = Math.min(Math.max(index, 0), Math.max(count - 1, 0));
  const hasPrev = current > 0;
  const hasNext = current < count - 1;

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    exitTimer.current = window.setTimeout(
      onClose,
      prefersReducedMotion() ? 0 : EXIT_MS
    );
  }, [onClose]);

  const go = useCallback(
    (delta: number) => {
      const next = current + delta;
      // Am Anfang und am Ende ist Schluss — kein Umlaufen.
      if (next < 0 || next >= count) return;
      setDragX(0);
      onIndexChange(next);
    },
    [count, current, onIndexChange]
  );

  // Fokus beim Öffnen hierher, beim Schließen zurück an das angeklickte Bild.
  useEffect(() => {
    const previous = document.activeElement;
    rootRef.current?.focus();

    return () => {
      window.clearTimeout(exitTimer.current);
      const back = returnFocusRef?.current ?? previous;
      if (back instanceof HTMLElement && back.isConnected) back.focus();
    };
    // Nur beim Auf- und Abbau — der Fokus wird genau einmal übernommen.
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // Capture + stopImmediatePropagation: das Modal darunter bleibt offen.
        event.preventDefault();
        event.stopImmediatePropagation();
        requestClose();
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        event.stopImmediatePropagation();
        go(event.key === "ArrowLeft" ? -1 : 1);
        return;
      }
      if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        event.stopImmediatePropagation();
        onIndexChange(event.key === "Home" ? 0 : count - 1);
        return;
      }
      if (event.key === "Tab") {
        // Kleine Fokusfalle: der Tabulator bleibt in der Galerie. Die Pfeile
        // gibt es zweimal (Rand bzw. Leiste) — nur die sichtbaren zählen.
        const root = rootRef.current;
        if (!root) return;
        const stops = Array.from(
          root.querySelectorAll<HTMLElement>("button:not([disabled])")
        ).filter((el) => el.getClientRects().length > 0);
        if (!stops.length) return;
        event.preventDefault();
        const active = document.activeElement;
        const at = active instanceof HTMLElement ? stops.indexOf(active) : -1;
        const step = event.shiftKey ? -1 : 1;
        const next =
          at === -1
            ? event.shiftKey
              ? stops.length - 1
              : 0
            : (at + step + stops.length) % stops.length;
        stops[next].focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [count, go, onIndexChange, requestClose]);

  // Nachbarbilder still im Hintergrund holen — Blättern soll sofort da sein.
  useEffect(() => {
    for (const url of [images[current + 1], images[current - 1]]) {
      if (!url) continue;
      const preload = new window.Image();
      preload.src = url;
    }
  }, [images, current]);

  /* ------------------------------------------------------------- Wischen */

  function handleTouchStart(event: ReactTouchEvent<HTMLDivElement>) {
    swiped.current = false;
    if (count < 2 || event.touches.length !== 1) {
      touchStart.current = null;
      return;
    }
    const touch = event.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleTouchMove(event: ReactTouchEvent<HTMLDivElement>) {
    const start = touchStart.current;
    if (!start) return;
    if (event.touches.length !== 1) {
      touchStart.current = null;
      setDragX(0);
      return;
    }
    const touch = event.touches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;

    // Eher hoch/runter als seitwärts? Dann ist es kein Blättern.
    if (Math.abs(dy) > Math.abs(dx) + 12) {
      touchStart.current = null;
      setDragX(0);
      return;
    }
    if (Math.abs(dx) > SWIPE_SLOP) swiped.current = true;

    // Am Anfang/Ende folgt das Bild nur gedämpft — die Grenze ist spürbar.
    const atEdge = (dx > 0 && !hasPrev) || (dx < 0 && !hasNext);
    setDragX(atEdge ? dx * 0.22 : dx);
  }

  function handleTouchEnd() {
    const started = touchStart.current !== null;
    touchStart.current = null;
    const travelled = dragX;
    setDragX(0);
    if (!started) return;
    if (travelled <= -SWIPE_MIN) go(1);
    else if (travelled >= SWIPE_MIN) go(-1);
  }

  if (!count) return null;

  const state = closing ? "closing" : "open";
  const dragging = dragX !== 0;

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Bildergalerie"
      tabIndex={-1}
      data-state={state}
      className="lb-root fixed inset-0 z-[60] flex flex-col bg-navy/90 backdrop-blur-sm outline-none"
    >
      {/* Gleiche Optik wie das X im Eintrag — nur etwas größer für den Finger. */}
      <button
        type="button"
        onClick={requestClose}
        aria-label="Galerie schließen"
        className="tl-iconbtn absolute top-4 right-4 z-20 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-paper-line bg-paper-card/95 text-coal-soft shadow-(--shadow-card) hover:text-coal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fox"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M3.5 3.5l9 9M12.5 3.5l-9 9"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {/* Bühne: Klick daneben schließt, Wischen blättert. */}
      <div
        className="lb-stage relative flex min-h-0 flex-1 items-center justify-center px-3 pt-16 pb-20 sm:px-24 sm:pb-16"
        onClick={(event) => {
          // Ein Wisch endet mit einem Klick — der darf nicht schließen.
          const wasSwipe = swiped.current;
          swiped.current = false;
          if (event.target !== event.currentTarget || wasSwipe) return;
          requestClose();
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <img
          key={current}
          src={images[current]}
          alt={`${title} — Bild ${current + 1} von ${count}`}
          loading="eager"
          draggable={false}
          data-dragging={dragging ? "true" : undefined}
          style={dragging ? { transform: `translateX(${dragX}px)` } : undefined}
          className="lb-img max-h-[min(85dvh,100%)] max-w-full rounded-lg object-contain shadow-(--shadow-pop)"
        />
      </div>

      {count > 1 && (
        <>
          {/* Große Pfeilflächen am Rand — ab sm, also auch auf dem iPad. */}
          <div className="pointer-events-none absolute inset-y-0 left-0 hidden items-center pl-3 sm:flex">
            <button
              type="button"
              onClick={() => go(-1)}
              disabled={!hasPrev}
              aria-label="Vorheriges Bild"
              className="lb-nav pointer-events-auto flex h-14 w-14 cursor-pointer items-center justify-center rounded-full border border-navy-line bg-navy-soft/80 text-paper backdrop-blur-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fox disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Chevron direction="left" />
            </button>
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden items-center pr-3 sm:flex">
            <button
              type="button"
              onClick={() => go(1)}
              disabled={!hasNext}
              aria-label="Nächstes Bild"
              className="lb-nav pointer-events-auto flex h-14 w-14 cursor-pointer items-center justify-center rounded-full border border-navy-line bg-navy-soft/80 text-paper backdrop-blur-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fox disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Chevron direction="right" />
            </button>
          </div>

          {/* Zähler unten mittig; auf dem Handy sitzen die Pfeile gleich daneben. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-4">
            <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-navy-line/80 bg-navy-soft/75 px-1.5 py-1.5 backdrop-blur-sm sm:px-3">
              <button
                type="button"
                onClick={() => go(-1)}
                disabled={!hasPrev}
                aria-label="Vorheriges Bild"
                className="lb-nav flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fox disabled:cursor-not-allowed disabled:opacity-30 sm:hidden"
              >
                <Chevron direction="left" />
              </button>

              <span className="px-2 text-xs font-semibold text-paper/85 tabular-nums">
                {current + 1} / {count}
              </span>

              <button
                type="button"
                onClick={() => go(1)}
                disabled={!hasNext}
                aria-label="Nächstes Bild"
                className="lb-nav flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fox disabled:cursor-not-allowed disabled:opacity-30 sm:hidden"
              >
                <Chevron direction="right" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
