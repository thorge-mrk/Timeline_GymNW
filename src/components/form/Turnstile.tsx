"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Der öffentliche Schlüssel des Turnstile-Widgets.
 *
 * Er steht bewusst in einer Umgebungsvariablen und nicht im Code: Fehlt er,
 * wird gar kein Widget geladen und die Anmeldung läuft wie bisher. So bricht
 * nichts, solange die Schule den Schutz in Supabase noch nicht eingeschaltet
 * hat — und sobald sie ihn einschaltet, genügt es, den Schlüssel zu setzen.
 */
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

/** Ist der Schutz überhaupt eingerichtet? */
export const turnstileEnabled = SITE_KEY.length > 0;

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** Nur das, was wir wirklich aufrufen — Cloudflare liefert deutlich mehr. */
interface TurnstileApi {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback: (token: string) => void;
      "error-callback": () => void;
      "expired-callback": () => void;
      theme?: "light" | "dark" | "auto";
      language?: string;
      action?: string;
    }
  ) => string;
  remove: (id: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/** Das Skript nur einmal laden, auch wenn mehrere Widgets danach fragen. */
let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    if (window.turnstile) return resolve();
    const el = document.createElement("script");
    el.src = SCRIPT_SRC;
    el.async = true;
    el.defer = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error("Turnstile konnte nicht geladen werden."));
    document.head.appendChild(el);
  });
  return scriptPromise;
}

interface TurnstileProps {
  /** Liefert den frischen Token — oder `null`, wenn er verfallen ist. */
  onToken: (token: string | null) => void;
  /**
   * Das Widget kam gar nicht erst zustande (kein Netz, Cloudflare gesperrt).
   * Die Anmeldeseite lässt es dann trotzdem versuchen, statt selbst zuzumachen.
   */
  onUnavailable?: () => void;
}

/**
 * Der Anmelde-Schutz von Cloudflare.
 *
 * Turnstile ist ein Häkchen, das meistens gar keins ist: In aller Regel prüft
 * es im Hintergrund und gibt still frei. Nur wenn etwas verdächtig aussieht,
 * bekommt der Mensch überhaupt etwas zu tun. Für eine Anmeldeseite, an der
 * Schülerinnen und Schüler stehen, ist das die richtige Sorte Schutz — sie
 * merken im Normalfall nichts davon.
 *
 * Fehlt der Schlüssel, gibt die Komponente `null` zurück und meldet einen
 * leeren Token. Die Anmeldung funktioniert dann genau wie vorher.
 */
export function Turnstile({ onToken, onUnavailable }: TurnstileProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  // Die Rückmeldung über eine Ref, damit ein neuer Render das Widget nicht
  // abreißt und neu aufbaut — das würde den Token verwerfen.
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;
  const onUnavailableRef = useRef(onUnavailable);
  onUnavailableRef.current = onUnavailable;

  useEffect(() => {
    if (!turnstileEnabled) return;
    const host = hostRef.current;
    if (!host) return;

    let widgetId: string | null = null;
    let cancelled = false;

    void loadScript()
      .then(() => {
        if (cancelled || !window.turnstile) return;
        widgetId = window.turnstile.render(host, {
          sitekey: SITE_KEY,
          theme: "light",
          language: "de",
          action: "anmelden",
          callback: (token) => onTokenRef.current(token),
          // Beides heißt: Der Token taugt nicht mehr. Lieber ehrlich `null`
          // melden, als mit einem alten Token in eine Fehlermeldung laufen.
          "error-callback": () => {
            setFailed(true);
            onTokenRef.current(null);
            onUnavailableRef.current?.();
          },
          "expired-callback": () => onTokenRef.current(null),
        });
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        onUnavailableRef.current?.();
      });

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) {
        try {
          window.turnstile.remove(widgetId);
        } catch {
          /* Widget war schon weg — dann gibt es nichts abzuräumen. */
        }
      }
    };
  }, []);

  if (!turnstileEnabled) return null;

  return (
    <div>
      <div ref={hostRef} className="flex justify-center" />
      {failed && (
        <p className="hint mt-2 text-center">
          Die Sicherheitsprüfung konnte nicht geladen werden. Bitte die Seite
          neu laden.
        </p>
      )}
    </div>
  );
}
