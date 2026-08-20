"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Der öffentliche Schlüssel des Turnstile-Widgets.
 *
 * Er steht hier im Klartext, und das ist richtig so: Der Site Key ist der
 * öffentliche Teil des Paares — er wird ohnehin in jede Seite ausgeliefert
 * und ist bei Cloudflare an unsere Domain gebunden. Anderswo eingesetzt taugt
 * er nichts. Der geheime Gegenpart liegt allein bei Supabase und kommt in
 * diesem Verzeichnis nirgends vor.
 *
 * Eine Umgebungsvariable hat trotzdem Vorrang — für den Fall, dass die Schule
 * den Schlüssel einmal tauscht, ohne den Code anzufassen. Genau darauf haben
 * wir uns zuerst verlassen, und es ging schief: Beim Bauen auf Cloudflare
 * Pages kam die Variable nicht an, der Schlüssel fehlte im ausgelieferten
 * Bündel, und auf der Anmeldeseite stand nur „Sicherheitsprüfung konnte nicht
 * geladen werden“. Ein fest hinterlegter Rückfall macht die Seite von dieser
 * Einstellung unabhängig.
 */
const FALLBACK_SITE_KEY = "0x4AAAAAAEWftVQyn1lB7dkV";
const SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || FALLBACK_SITE_KEY;

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
      "error-callback": (code?: string) => void;
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

/**
 * Warten, bis Cloudflare sich wirklich eingerichtet hat.
 *
 * `script.onload` heißt nur, dass die Datei da ist — `window.turnstile` wird
 * einen Wimpernschlag später gesetzt. Wer sofort danach greift, findet nichts
 * und baut still kein Widget: kein Fehler, kein Kästchen, keine Erklärung.
 * Genau dieser Wettlauf ist uns passiert.
 */
function waitForApi(timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (window.turnstile) return resolve();
      if (Date.now() - start > timeoutMs) {
        return reject(new Error("Turnstile hat sich nicht gemeldet."));
      }
      window.setTimeout(tick, 50);
    };
    tick();
  });
}

function loadScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    if (window.turnstile) return resolve();

    // Ein bereits eingehängtes Skript nicht ein zweites Mal laden.
    const vorhanden = document.querySelector<HTMLScriptElement>(
      'script[data-turnstile="1"]'
    );
    if (vorhanden) {
      waitForApi().then(resolve, reject);
      return;
    }

    const el = document.createElement("script");
    el.src = SCRIPT_SRC;
    el.async = true;
    el.defer = true;
    el.dataset.turnstile = "1";
    el.onload = () => waitForApi().then(resolve, reject);
    el.onerror = () =>
      reject(new Error("Turnstile konnte nicht geladen werden."));
    document.head.appendChild(el);
  });
  return scriptPromise;
}

/**
 * Cloudflares Fehlernummern in Klartext — jedenfalls die, die man sich selbst
 * einhandelt. Alles andere bleibt eine Nummer, aber eine sichtbare: Ohne sie
 * steht man vor „geht nicht" und kann nichts nachsehen.
 */
function describeTurnstileError(code: string): string {
  if (code.startsWith("110200")) {
    return "Diese Adresse ist für den Schlüssel nicht freigegeben. In Cloudflare muss die Domain beim Widget eingetragen sein.";
  }
  if (code.startsWith("1101") || code.startsWith("110100")) {
    return "Der Schlüssel wird von Cloudflare nicht erkannt.";
  }
  if (code.startsWith("300") || code.startsWith("600")) {
    return "Cloudflare meldet einen vorübergehenden Fehler.";
  }
  return "Cloudflare hat die Prüfung abgelehnt.";
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
  const [failed, setFailed] = useState<string | null>(null);

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
          "error-callback": (code) => {
            setFailed(
              code
                ? `${describeTurnstileError(code)} (Cloudflare-Code ${code})`
                : "Cloudflare hat die Prüfung abgelehnt."
            );
            onTokenRef.current(null);
            onUnavailableRef.current?.();
          },
          "expired-callback": () => onTokenRef.current(null),
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setFailed(
          err instanceof Error && err.message.includes("nicht gemeldet")
            ? "Cloudflare antwortet nicht — vermutlich blockiert etwas die Verbindung."
            : "Die Sicherheitsprüfung konnte nicht geladen werden."
        );
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
        <p className="hint mt-2 text-center leading-relaxed">
          {failed}
          <br />
          Die Anmeldung wird trotzdem versucht.
        </p>
      )}
    </div>
  );
}
