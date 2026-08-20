"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useSettings } from "@/hooks/useSettings";
import "./site.css";

/** Der Ausgang ist kürzer als der Eingang (200 ms) — Reagieren darf nie warten. */
const EXIT_MS = 140;

/** Alles, was im Menü Fokus bekommen kann. */
const ITEM_SELECTOR = '[role="menuitemcheckbox"], [role="menuitem"]';

/**
 * Zahnrad, acht Zähne, gerechnet statt gezeichnet: Zahnkopf r = 9,2 und
 * Zahnfuß r = 6,9 um den Mittelpunkt 12/12 im 24er-Raster.
 */
const GEAR_PATH =
  "M10.4 2.9A9.2 9.2 0 0 1 13.6 2.9L13.6 5.3A6.9 6.9 0 0 1 15.7 6.1L17.3 4.5A9.2 9.2 0 0 1 19.5 6.7L17.9 8.3A6.9 6.9 0 0 1 18.7 10.4L21.1 10.4A9.2 9.2 0 0 1 21.1 13.6L18.7 13.6A6.9 6.9 0 0 1 17.9 15.7L19.5 17.3A9.2 9.2 0 0 1 17.3 19.5L15.7 17.9A6.9 6.9 0 0 1 13.6 18.7L13.6 21.1A9.2 9.2 0 0 1 10.4 21.1L10.4 18.7A6.9 6.9 0 0 1 8.3 17.9L6.7 19.5A9.2 9.2 0 0 1 4.5 17.3L6.1 15.7A6.9 6.9 0 0 1 5.3 13.6L2.9 13.6A9.2 9.2 0 0 1 2.9 10.4L5.3 10.4A6.9 6.9 0 0 1 6.1 8.3L4.5 6.7A9.2 9.2 0 0 1 6.7 4.5L8.3 6.1A6.9 6.9 0 0 1 10.4 5.3Z";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/* -------------------------------------------------------------------------- *
 * Eine Menüzeile mit echtem Schalter
 * -------------------------------------------------------------------------- */

interface ToggleItemProps {
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}

function ToggleItem({ label, description, checked, onToggle }: ToggleItemProps) {
  const id = useId();
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      /* Name = nur die Überschrift, Erklärung = Beschreibung. Ohne diese beiden
         Verweise läse ein Screenreader den ganzen Absatz als Knopfnamen vor. */
      aria-labelledby={`${id}-label`}
      aria-describedby={`${id}-desc`}
      onClick={onToggle}
      className="settings-item block w-full rounded-xl px-3 py-2.5 text-left"
    >
      <span className="flex items-center justify-between gap-3">
        <span id={`${id}-label`} className="text-sm font-semibold text-coal">
          {label}
        </span>
        <span aria-hidden="true" className="settings-switch" data-on={checked}>
          <span className="settings-switch__knob" />
        </span>
      </span>
      <span
        id={`${id}-desc`}
        className="mt-1 block text-xs leading-relaxed text-coal-soft"
      >
        {description}
      </span>
    </button>
  );
}

/* -------------------------------------------------------------------------- *
 * Zahnrad + Popover
 * -------------------------------------------------------------------------- */

export default function SettingsMenu() {
  const { settings, update } = useSettings();

  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const exitTimer = useRef<number | undefined>(undefined);
  /* Spiegel der Zustände: die Ereignis-Zuhörer unten sollen sich nicht bei
     jedem Öffnen neu anmelden müssen. */
  const openRef = useRef(false);
  const closingRef = useRef(false);

  const menuId = useId();
  const titleId = `${menuId}-title`;

  useEffect(() => () => window.clearTimeout(exitTimer.current), []);

  const openMenu = useCallback(() => {
    window.clearTimeout(exitTimer.current);
    openRef.current = true;
    closingRef.current = false;
    setClosing(false);
    setOpen(true);
  }, []);

  /**
   * `returnFocus` holt den Fokus sofort ans Zahnrad zurück (Escape, zweiter
   * Klick aufs Zahnrad). Bei einem Klick daneben wartet die Rückgabe bis zum
   * Ende des Ausgangs — und findet nur statt, wenn den Fokus bis dahin niemand
   * anderes übernommen hat. Sonst würde ein angeklicktes Eingabefeld ihn gleich
   * wieder verlieren.
   */
  const closeMenu = useCallback((returnFocus: boolean) => {
    if (!openRef.current || closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    if (returnFocus) triggerRef.current?.focus();
    exitTimer.current = window.setTimeout(
      () => {
        const active = document.activeElement;
        const nobodyElseHasIt =
          !active ||
          active === document.body ||
          popRef.current?.contains(active) === true;

        openRef.current = false;
        closingRef.current = false;
        setOpen(false);
        setClosing(false);

        if (nobodyElseHasIt) triggerRef.current?.focus();
      },
      prefersReducedMotion() ? 0 : EXIT_MS
    );
  }, []);

  const toggleMenu = useCallback(() => {
    if (openRef.current && !closingRef.current) closeMenu(true);
    else openMenu();
  }, [closeMenu, openMenu]);

  // Beim Öffnen in die erste Zeile springen — so ist das Menü sofort mit der
  // Tastatur bedienbar.
  useEffect(() => {
    if (!open || closing) return;
    popRef.current?.querySelector<HTMLElement>(ITEM_SELECTOR)?.focus();
  }, [open, closing]);

  // Klick daneben schließt. Das Zahnrad ist ausgenommen: es schaltet selbst um,
  // sonst würde es hier geschlossen und gleich darauf wieder geöffnet.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (popRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      closeMenu(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open, closeMenu]);

  // Escape schließt — am Dokument, damit es auch greift, wenn der Fokus
  // (Safari fokussiert Knöpfe beim Klicken nicht) außerhalb liegt.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      closeMenu(true);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, closeMenu]);

  /**
   * Mehr Platz — eine Zeile Layout, kein Geräte-Vollbild.
   *
   * Früher hat dieser Schalter zusätzlich `requestFullscreen()` gerufen und
   * den Browser in den echten Vollbildmodus geschickt. Auf dem Smartboard in
   * der Aula ging das schief: Die Anzeige dort läuft in einem eingebetteten
   * Browser, der den Wunsch nicht sauber bedient — mal blieb der Bildschirm
   * schwarz, mal ließ sich die Seite danach nicht mehr bedienen.
   *
   * Deshalb tut der Schalter jetzt nur noch das, was er auf jedem Gerät
   * zuverlässig kann: Die Fußzeile fällt aus dem Baum (SiteFooter gibt `null`
   * zurück), und weil der Seitenrahmen ein Flex-Layout ist, wächst der Inhalt
   * von selbst in ihre Höhe hinein. Kein Browser wird gefragt, also kann auch
   * keiner Nein sagen.
   */
  const toggleFullscreen = useCallback(() => {
    update({ fullscreen: !settings.fullscreen });
  }, [settings.fullscreen, update]);

  const toggleRealtime = useCallback(() => {
    update({ realtime: !settings.realtime });
  }, [settings.realtime, update]);

  /** Pfeiltasten wandern durch die Zeilen, Pos1/Ende springen an die Ränder. */
  function onMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const { key } = event;
    if (
      key !== "ArrowDown" &&
      key !== "ArrowUp" &&
      key !== "Home" &&
      key !== "End"
    ) {
      return;
    }
    const items = Array.from(
      popRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []
    );
    if (items.length === 0) return;
    event.preventDefault();

    const current = items.indexOf(document.activeElement as HTMLElement);
    let next = 0;
    if (key === "ArrowDown") {
      next = current < 0 ? 0 : (current + 1) % items.length;
    } else if (key === "ArrowUp") {
      next = current < 0 ? items.length - 1 : (current - 1 + items.length) % items.length;
    } else if (key === "End") {
      next = items.length - 1;
    }
    items[next]?.focus();
  }

  /** Pfeil nach unten/oben öffnet das Menü — wie bei einem Menüknopf üblich. */
  function onTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    if (openRef.current && !closingRef.current) {
      popRef.current?.querySelector<HTMLElement>(ITEM_SELECTOR)?.focus();
      return;
    }
    openMenu();
  }

  /**
   * Wandert der Fokus per Tabulator aus dem Menü, schließt es — ohne ihn
   * zurückzuholen, sonst käme man nie weiter. Ein leeres `relatedTarget`
   * (Safari beim Klick auf einen Knopf) bleibt bewusst folgenlos.
   */
  function onMenuBlur(event: ReactFocusEvent<HTMLDivElement>) {
    const next = event.relatedTarget;
    if (!(next instanceof Node)) return;
    if (popRef.current?.contains(next)) return;
    if (triggerRef.current?.contains(next)) return;
    closeMenu(false);
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleMenu}
        onKeyDown={onTriggerKeyDown}
        aria-label="Einstellungen"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className="gear-btn flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-paper/85"
      >
        <svg
          className="gear-btn__icon"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d={GEAR_PATH}
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12" r="3.1" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>

      {open && (
        <div
          ref={popRef}
          data-state={closing ? "closing" : "open"}
          onKeyDown={onMenuKeyDown}
          onBlur={onMenuBlur}
          /* Rechtsbündig unter dem Zahnrad und nie breiter als der Schirm. */
          className="settings-pop card absolute top-full right-0 z-50 mt-2 w-[280px] max-w-[calc(100vw-1.5rem)] p-2 text-coal shadow-(--shadow-pop)"
        >
          <p
            id={titleId}
            className="px-3 pt-1 pb-1.5 text-[11px] font-bold tracking-wide text-coal-faint uppercase"
          >
            Einstellungen
          </p>

          <div id={menuId} role="menu" aria-labelledby={titleId}>
            <ToggleItem
              label="Mehr Platz"
              description="Nimmt die Fußzeile weg — der Zeitstrahl bekommt ihre Höhe dazu. Gut für den Beamer in der Aula."
              checked={settings.fullscreen}
              onToggle={toggleFullscreen}
            />

            <ToggleItem
              label="Live-Übertragung"
              description="Neue Einträge erscheinen sofort, ohne die Seite neu zu laden. Ausgeschaltet siehst du Änderungen erst nach dem Neuladen."
              checked={settings.realtime}
              onToggle={toggleRealtime}
            />

            {!settings.realtime && (
              <div role="none" className="animate-fade-up px-3 pt-1.5 pb-1">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => window.location.reload()}
                  className="btn-ghost min-h-11 w-full text-xs"
                >
                  Jetzt neu laden
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
