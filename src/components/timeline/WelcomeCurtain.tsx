"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SchoolMark from "@/components/SchoolMark";
import "./welcome.css";

/**
 * Wie lange die Begrüßung stehen bleibt, wenn niemand etwas tut.
 *
 * Sieben Sekunden klingen lang — vor einer Tafel in der Aula sind sie es
 * nicht. Man kommt näher, richtet den Blick, liest zwei Sätze. Wer schneller
 * ist, klickt oder scrollt und ist sofort drin.
 */
const VISIBLE_MS = 7000;

/** Dauer des Ausblendens; muss zur CSS-Angabe passen. */
const FADE_MS = 620;

/**
 * Merker im Browser: Wer schon einmal hier war, wird nicht noch einmal
 * begrüßt. Bewusst `localStorage` und kein Cookie — es geht niemanden etwas
 * an, ob jemand die Seite schon kannte, und ein Cookie würde diese Auskunft
 * bei jedem Aufruf mitschicken. Der Merker verlässt das Gerät nie.
 */
const SEEN_KEY = "zeitstrahl.welcome-seen";

/**
 * Stand der Dinge auf DIESEM Gerät. Steht der Merker nicht, war noch niemand
 * da — dann wird begrüßt. Kein Zugriff auf `localStorage` heißt: lieber
 * begrüßen als schweigen.
 */
function alreadySeen(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberSeen(): void {
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* Privater Modus o. Ä. — dann grüßt die Seite eben wieder. */
  }
}

interface WelcomeCurtainProps {
  /** Erst zeigen, wenn der Zeitstrahl wirklich steht — sonst begrüßt man ins Leere. */
  ready: boolean;
}

/**
 * Die Begrüßung.
 *
 * Der Zeitstrahl hängt am Aktionstag auf einem Beamer in der Aula, und die
 * meisten Menschen sehen ihn zum ersten Mal. Bevor sie Punkte und Jahreszahlen
 * deuten müssen, sollen sie einen Satz lesen, der sagt, was das hier ist und
 * von wem es kommt.
 *
 * Sie legt sich einmal über die Seite und geht dann von selbst — bei der
 * ersten Berührung sofort. Bewusst KEIN Fenster mit Knopf: Wer eine Tafel
 * ansieht, soll nichts wegklicken müssen, und auf dem Beamer soll niemand
 * hinlaufen, um eine Meldung zu schließen.
 *
 * Und sie kommt nur EINMAL je Gerät. Wer die Seite schon kennt, braucht die
 * Erklärung nicht noch einmal — auf dem Handy in der Pause wäre sie beim
 * zweiten Aufruf schlicht im Weg. Gemerkt wird das im Browser des Geräts,
 * nicht bei uns.
 */
export default function WelcomeCurtain({ ready }: WelcomeCurtainProps) {
  const [state, setState] = useState<"warten" | "offen" | "geht" | "weg">(
    "warten"
  );
  const timerRef = useRef<number | null>(null);

  const dismiss = useCallback(() => {
    setState((current) => (current === "offen" ? "geht" : current));
  }, []);

  // Aufziehen, sobald die Daten da sind — aber nur beim ersten Besuch.
  useEffect(() => {
    if (!ready || state !== "warten") return;
    if (alreadySeen()) {
      setState("weg");
      return;
    }
    rememberSeen();
    setState("offen");
  }, [ready, state]);

  // Von selbst gehen — und bei der ersten Berührung sofort.
  useEffect(() => {
    if (state !== "offen") return;

    timerRef.current = window.setTimeout(dismiss, VISIBLE_MS);
    const events: (keyof WindowEventMap)[] = [
      "pointerdown",
      "wheel",
      "touchstart",
      "keydown",
    ];
    for (const name of events) {
      window.addEventListener(name, dismiss, { passive: true, once: true });
    }

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      for (const name of events) window.removeEventListener(name, dismiss);
    };
  }, [state, dismiss]);

  // Nach dem Ausblenden restlos verschwinden — nichts liegt mehr im Weg.
  useEffect(() => {
    if (state !== "geht") return;
    const timer = window.setTimeout(() => setState("weg"), FADE_MS);
    return () => window.clearTimeout(timer);
  }, [state]);

  if (state === "warten" || state === "weg") return null;

  return (
    <div
      // `status` statt `dialog`: Das hier hält niemanden auf, es begrüßt nur.
      role="status"
      aria-live="polite"
      data-state={state}
      className="wc-curtain fixed inset-0 z-50 flex items-center justify-center p-6"
    >
      <div className="wc-card max-w-xl text-center">
        <span
          aria-hidden="true"
          className="wc-mark mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-fox-soft"
        >
          <SchoolMark className="h-11 w-auto text-fox" />
        </span>

        <h2 className="wc-line-1 mt-7 text-[26px] leading-tight font-bold tracking-tight text-navy sm:text-[32px]">
          Willkommen beim Gedächtnis der Zeit
        </h2>

        <p className="wc-line-2 mt-2 text-[15px] font-semibold text-fox-deep sm:text-base">
          Zeitstrahl des Gymnasiums Neu Wulmstorf
        </p>

        <p className="wc-line-3 mt-5 text-[15px] leading-relaxed text-coal-soft sm:text-base">
          Hier finden Sie Erinnerungen von Schülerinnen und Schülern,
          Lehrkräften und Ehemaligen an das Gymnasium Neu Wulmstorf.
        </p>

        <span
          aria-hidden="true"
          className="wc-rule mx-auto mt-7 block h-[2px] w-12 rounded-full bg-fox"
        />
      </div>
    </div>
  );
}
