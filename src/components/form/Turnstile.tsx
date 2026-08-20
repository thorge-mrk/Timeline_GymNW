"use client";

import { useEffect, useRef } from "react";

/**
 * Cloudflare Turnstile — die Sicherheitsprüfung vor der Anmeldung.
 *
 * Warum überhaupt? Die Anmeldeseite ist öffentlich erreichbar; bei einer
 * statischen Website lässt sich das nicht ändern. Ohne Prüfung könnte jemand
 * Passwörter durchprobieren, bis eines passt. Mit Prüfung weist Supabase jeden
 * Versuch ohne gültiges Merkmal ab — noch bevor das Passwort geprüft wird.
 *
 * Wichtig dabei: Das Merkmal wird SERVERSEITIG von Supabase geprüft (Auth →
 * Bot and Abuse Protection). Was hier im Browser passiert, ist nur das Holen
 * des Merkmals; wer das Widget wegräumt, kommt trotzdem nicht durch.
 *
 * Für Menschen ist es unsichtbar: kein Bilderrätsel, keine Ampeln, meist nur
 * ein kurzer Moment mit einem Haken.
 *
 * Ohne gesetzten Site-Key rendert die Komponente NICHTS und meldet das dem
 * Formular. Die Anmeldung darf nicht davon abhängen, dass jemand vorher etwas
 * konfiguriert hat — solange der Schlüssel fehlt, läuft alles wie vorher.
 */

export const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";

/** Ist die Prüfung überhaupt eingerichtet? */
export const turnstileAktiv = TURNSTILE_SITE_KEY.length > 0;

const SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback: (token: string) => void;
      "error-callback"?: () => void;
      "expired-callback"?: () => void;
      "timeout-callback"?: () => void;
      theme?: "light" | "dark" | "auto";
      language?: string;
      action?: string;
    }
  ) => string;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/** Lädt das Skript genau einmal, auch wenn mehrere Widgets danach fragen. */
let scriptPromise: Promise<void> | null = null;

function ladeSkript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const vorhanden = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_URL}"]`
    );
    const script = vorhanden ?? document.createElement("script");
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () => reject(new Error("turnstile")));
    if (!vorhanden) {
      script.src = SCRIPT_URL;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });
  // Ein gescheiterter Ladeversuch darf nicht für immer hängen bleiben.
  scriptPromise.catch(() => {
    scriptPromise = null;
  });
  return scriptPromise;
}

export interface TurnstileProps {
  /** Frisches Merkmal (oder null, wenn es abgelaufen bzw. fehlgeschlagen ist). */
  onToken: (token: string | null) => void;
  /**
   * Hochzählen, um ein neues Merkmal anzufordern. Ein Merkmal gilt nur EINMAL;
   * nach einem Fehlversuch muss das Widget zurückgesetzt werden, sonst
   * scheitert der zweite Versuch mit einer irreführenden Meldung.
   */
  resetSignal: number;
  /** Die Prüfung konnte nicht geladen werden (kein Netz, Skript blockiert). */
  onUnavailable?: () => void;
}

export function Turnstile({
  onToken,
  resetSignal,
  onUnavailable,
}: TurnstileProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<string | null>(null);
  /* Callbacks über Refs: Das Widget wird genau einmal gebaut, nicht bei
     jedem Tastendruck im Passwortfeld neu. */
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;
  const onUnavailableRef = useRef(onUnavailable);
  onUnavailableRef.current = onUnavailable;

  useEffect(() => {
    if (!turnstileAktiv) return;
    let abgebrochen = false;

    void ladeSkript()
      .then(() => {
        if (abgebrochen || !hostRef.current || !window.turnstile) return;
        if (widgetRef.current !== null) return; // StrictMode: nur einmal bauen
        widgetRef.current = window.turnstile.render(hostRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          action: "anmelden",
          language: "de",
          theme: "light",
          callback: (token) => onTokenRef.current(token),
          "error-callback": () => onTokenRef.current(null),
          "expired-callback": () => onTokenRef.current(null),
          "timeout-callback": () => onTokenRef.current(null),
        });
      })
      .catch(() => {
        if (!abgebrochen) onUnavailableRef.current?.();
      });

    return () => {
      abgebrochen = true;
      const id = widgetRef.current;
      widgetRef.current = null;
      if (id !== null) {
        try {
          window.turnstile?.remove(id);
        } catch {
          /* Widget war schon weg — dann gibt es nichts abzuräumen. */
        }
      }
    };
  }, []);

  // Neues Merkmal anfordern (nach einem Fehlversuch).
  useEffect(() => {
    if (resetSignal === 0 || widgetRef.current === null) return;
    onTokenRef.current(null);
    try {
      window.turnstile?.reset(widgetRef.current);
    } catch {
      /* Kein Widget da — dann bleibt es beim fehlenden Merkmal. */
    }
  }, [resetSignal]);

  if (!turnstileAktiv) return null;
  return <div ref={hostRef} className="min-h-[65px]" />;
}
