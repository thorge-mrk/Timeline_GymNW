"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Einstellungen, die pro Gerät gelten und dort gespeichert bleiben.
 *
 * Absichtlich winzig gehalten und ohne Zustandsbibliothek: Ein Ereignis auf
 * `window` hält mehrere Nutzer des Hooks im selben Tab synchron, `storage`
 * übernimmt weitere Tabs desselben Geräts.
 */
export interface Settings {
  /**
   * Neue Einträge live empfangen — Standard: AUS.
   *
   * Ein Zeitstrahl, der sich von selbst bewegt, ist auf dem Beamer in der Aula
   * ein Fest und am Handy in der Pause eine Störung. Deshalb muss man ihn
   * ausdrücklich einschalten: Wer den Effekt haben will, weiß, dass er ihn
   * will. Alle anderen bekommen eine Seite, die stillhält.
   */
  realtime: boolean;
  /**
   * Mehr Platz: Fußzeile weg, der Inhalt bekommt ihre Höhe.
   *
   * Heißt im Code weiter `fullscreen`, macht aber kein Geräte-Vollbild mehr —
   * das hat der Browser des Smartboards in der Aula nicht sauber bedient.
   * Übrig ist reines Layout, und das kann kein Gerät ablehnen.
   */
  fullscreen: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  realtime: false,
  fullscreen: false,
};

const STORAGE_KEY = "zeitstrahl.settings";
const CHANGE_EVENT = "zeitstrahl:settings";

function read(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      realtime:
        typeof parsed.realtime === "boolean"
          ? parsed.realtime
          : DEFAULT_SETTINGS.realtime,
      /*
       * „Mehr Platz“ überlebt das Neuladen bewusst NICHT.
       *
       * In der Fußzeile stehen Impressum, Datenschutz und
       * Nutzungsbedingungen. Eine gespeicherte Einstellung würde diese Links
       * auf dem Gerät dauerhaft entfernen — für eine Schulseite ist das der
       * falsche Standard. Jeder frische Aufruf beginnt deshalb mit
       * sichtbarer Fußzeile; wer den Platz braucht, schaltet einmal um.
       */
      fullscreen: false,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function write(next: Settings) {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ realtime: next.realtime })
    );
  } catch {
    /* Privater Modus o. Ä. — dann gilt die Einstellung eben nur für diese Sitzung. */
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: next }));
}

export function useSettings() {
  // Erst nach dem Mounten aus dem Speicher lesen, sonst weicht der erste
  // Frame vom vorgerenderten HTML ab (statischer Export!).
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    setSettings(read());

    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<Settings>).detail;
      if (detail) setSettings(detail);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setSettings(read());
    };

    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      write(next);
      return next;
    });
  }, []);

  return { settings, update };
}
