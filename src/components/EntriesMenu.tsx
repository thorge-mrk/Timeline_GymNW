"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useAuth } from "@/hooks/useAuth";
import { categoryById } from "@/lib/categories";
import { entryToSmartDate, formatSmartDate } from "@/lib/dates";
import { supabase } from "@/lib/supabase";
import "./site.css";
import "./entriesMenu.css";

/**
 * Der Stift in der Kopfzeile — der Weg zurück zum eigenen Beitrag.
 *
 * Bis eben stand diese Liste als Kasten über dem Eintrag-Formular. Dort war
 * sie zweimal am falschen Ort: Sie stand im Weg, wenn man etwas Neues
 * erzählen wollte, und sie war unerreichbar, wenn man gerade auf dem
 * Zeitstrahl stand und den Tippfehler sah. Jetzt hängt sie hinter einem Stift
 * neben dem Zahnrad — von jeder Seite aus einen Klick weit.
 *
 * Was im Menü steht, hängt an der Rolle:
 *
 *   Eintrag-Konto  →  die drei jüngsten EIGENEN Beiträge, nur zum Ändern.
 *                     Drei, nicht zehn: Es ist eine Korrekturhilfe für das,
 *                     was man gerade eingetragen hat, kein zweiter Zeitstrahl.
 *   Admin          →  ALLE Beiträge, neueste zuerst, mit Ändern und Löschen.
 *                     Bei 58 Einträgen und wachsend braucht das ein Suchfeld
 *                     und eine Liste, die scrollt statt den Bildschirm zu
 *                     sprengen.
 *
 * Gelesen wird immer frisch beim Öffnen. Ein zwischengespeicherter Stand wäre
 * genau dann falsch, wenn er zählt — direkt nach dem Speichern.
 *
 * Rechte entscheidet die Datenbank, nicht dieses Menü: Ein Eintrag-Konto
 * bekommt die Löschknöpfe gar nicht erst zu sehen, und selbst wenn, liefe der
 * DELETE gegen die Policy ins Leere (0 Zeilen) — genau darauf wird unten
 * geprüft.
 */

/** Der Ausgang ist kürzer als der Eingang — genau wie beim Einstellungsmenü. */
const EXIT_MS = 140;

/** Alles, was im Menü Fokus bekommen kann (für Pfeiltasten und Fokusfalle). */
const ITEM_SELECTOR = '[role="menuitem"]';
const FOCUS_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Drei eigene Zeilen sind eine Hilfe, zehn wären eine Liste zum Durchsuchen. */
const OWN_LIMIT = 3;
/** Für Admins: genug für den ganzen Bestand, ohne je unbegrenzt zu laden. */
const ALL_LIMIT = 200;

/** Nur die Spalten, die in einer Zeile auch wirklich vorkommen. */
interface MenuEntry {
  id: string;
  title: string;
  category: string;
  year: number | null;
  month: number | null;
  day: number | null;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Ein Stift — dasselbe Zeichen wie am „Ändern“-Knopf im Formular. */
function PencilIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15.1 4.3 19.7 8.9 9.4 19.2H4.8v-4.6z" />
      <path d="m13.1 6.3 4.6 4.6" />
    </svg>
  );
}

/** Papierkorb — nur im Admin-Menü, immer mit Namen für Screenreader. */
function TrashIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3.6 5.6h12.8M8.1 5.6V3.9h3.8v1.7" />
      <path d="M5.4 5.6 6.1 16h7.8l.7-10.4" />
      <path d="M8.6 8.6v4.4M11.4 8.6v4.4" />
    </svg>
  );
}

/** Vereinheitlicht Groß-/Kleinschreibung fürs Suchen. */
function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("de-DE");
}

export default function EntriesMenu() {
  const { session, isAdmin, isContributor } = useAuth();
  const userId = session?.user.id ?? null;

  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [rows, setRows] = useState<readonly MenuEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  /** Welche Zeile fragt gerade nach? `null` heißt: keine. */
  const [confirmId, setConfirmId] = useState<string | null>(null);
  /** Welche Zeile wird gerade gelöscht? */
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const exitTimer = useRef<number | undefined>(undefined);
  /* Spiegel der Zustände: die Zuhörer unten sollen sich nicht bei jedem
     Öffnen neu anmelden müssen. */
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
   * `returnFocus` holt den Fokus sofort an den Stift zurück (Escape, zweiter
   * Klick). Bei einem Klick daneben wartet die Rückgabe bis zum Ende des
   * Ausgangs — und findet nur statt, wenn ihn bis dahin niemand anderes
   * übernommen hat.
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
        setConfirmId(null);
        setActionError(null);

        if (nobodyElseHasIt) triggerRef.current?.focus();
      },
      prefersReducedMotion() ? 0 : EXIT_MS
    );
  }, []);

  const toggleMenu = useCallback(() => {
    if (openRef.current && !closingRef.current) closeMenu(true);
    else openMenu();
  }, [closeMenu, openMenu]);

  /*
   * Beim Öffnen frisch laden. Zwischenspeichern wäre genau dann falsch, wenn
   * es zählt: direkt nach dem Speichern eines Beitrags.
   */
  useEffect(() => {
    if (!open || closing || !userId) return;
    let active = true;
    setRows(null);
    setLoadError(null);

    void (async () => {
      const base = supabase
        .from("entries")
        .select("id,title,year,month,day,category")
        .order("created_at", { ascending: false });
      const { data, error } = isAdmin
        ? await base.limit(ALL_LIMIT)
        : await base.eq("created_by", userId).limit(OWN_LIMIT);
      if (!active) return;
      if (error || !data) {
        setLoadError("Die Liste konnte gerade nicht geladen werden.");
        setRows([]);
        return;
      }
      setRows(data);
    })();

    return () => {
      active = false;
    };
  }, [open, closing, userId, isAdmin]);

  // Beim Öffnen in die erste bedienbare Stelle springen: ins Suchfeld
  // (Admin) oder in die erste Zeile.
  useEffect(() => {
    if (!open || closing) return;
    const target =
      searchRef.current ??
      popRef.current?.querySelector<HTMLElement>(ITEM_SELECTOR) ??
      popRef.current;
    target?.focus();
  }, [open, closing, isAdmin]);

  // Klick daneben schließt. Der Stift ist ausgenommen — er schaltet selbst um.
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
  // außerhalb liegt (Safari fokussiert Knöpfe beim Klicken nicht).
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      // Steht eine Rückfrage offen, nimmt Escape erst diese zurück.
      if (confirmId) {
        setConfirmId(null);
        return;
      }
      closeMenu(true);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, confirmId, closeMenu]);

  const shown = useMemo(() => {
    if (!rows) return [];
    const needle = normalize(query);
    if (!needle) return rows;
    return rows.filter((row) => normalize(row.title).includes(needle));
  }, [rows, query]);

  /**
   * Löschen. Die Datenbank entscheidet: Fehlen die Rechte, kommen schlicht
   * null Zeilen zurück — kein Fehler, aber auch nichts gelöscht. Genau das
   * muss hier auffallen, sonst verschwände die Zeile aus der Liste, ohne dass
   * der Eintrag verschwunden wäre.
   */
  async function handleDelete(row: MenuEntry) {
    if (busyId) return;
    setBusyId(row.id);
    setActionError(null);
    const { data, error } = await supabase
      .from("entries")
      .delete()
      .eq("id", row.id)
      .select("id");

    setBusyId(null);
    if (error) {
      setActionError(`Löschen hat nicht geklappt: ${error.message}`);
      return;
    }
    if (!data || data.length === 0) {
      setActionError(
        "Dieser Eintrag wurde nicht gelöscht — dafür fehlen die Rechte."
      );
      return;
    }
    setConfirmId(null);
    setRows((current) =>
      current ? current.filter((item) => item.id !== row.id) : current
    );
  }

  /** Pfeiltasten wandern durch die Zeilen, Pos1/Ende springen an die Ränder. */
  function onMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const { key } = event;

    // Fokusfalle: Der Tabulator kommt aus dem offenen Menü nicht heraus.
    if (key === "Tab") {
      const focusables = Array.from(
        popRef.current?.querySelectorAll<HTMLElement>(FOCUS_SELECTOR) ?? []
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === popRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
      return;
    }

    if (key !== "ArrowDown" && key !== "ArrowUp" && key !== "Home" && key !== "End") {
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

  /*
   * Ohne Schreibrechte gibt es hier nichts zu holen: Ein Konto, das weder
   * eintragen noch ändern darf, bekäme ein Menü mit einer leeren Liste — eine
   * Ansage über etwas, das es ohnehin nicht tun kann.
   */
  if (!session || !isContributor) return null;

  const heading = isAdmin ? "Alle Einträge" : "Deine letzten Einträge";

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleMenu}
        onKeyDown={onTriggerKeyDown}
        aria-label={heading}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className="entries-btn flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-paper/85"
      >
        <span aria-hidden="true" className="entries-btn__icon flex">
          <PencilIcon />
        </span>
      </button>

      {open && (
        <div
          ref={popRef}
          data-state={closing ? "closing" : "open"}
          onKeyDown={onMenuKeyDown}
          /*
            Auf dem Handy hängt das Menü nicht am Stift, sondern an den beiden
            Bildschirmrändern: Der Stift steht in der Mitte der Knopfgruppe,
            eine rechtsbündige Tafel von 22 rem liefe links aus dem Bild.
            Ab 40 rem sitzt sie wie gewohnt direkt unter ihrem Auslöser.
          */
          className={`settings-pop card fixed inset-x-3 top-16 z-50 p-2 text-coal shadow-(--shadow-pop)
            sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:max-w-[calc(100vw-1.5rem)]
            ${isAdmin ? "sm:w-[22rem]" : "sm:w-[19rem]"}`}
        >
          <div className="flex items-baseline justify-between gap-3 px-3 pt-1 pb-1.5">
            <p
              id={titleId}
              className="text-[11px] font-bold tracking-wide text-coal-faint uppercase"
            >
              {heading}
            </p>
            {isAdmin && rows && (
              <p className="hint tabular-nums">
                {shown.length === rows.length
                  ? `${rows.length}`
                  : `${shown.length}/${rows.length}`}
              </p>
            )}
          </div>

          {/* Suchfeld: bei 58 Zeilen ist Scrollen allein keine Bedienung. */}
          {isAdmin && (
            <div className="px-1 pb-2">
              <input
                ref={searchRef}
                type="search"
                className="input min-h-11 text-sm"
                placeholder="Nach Titel suchen …"
                aria-label="Einträge nach Titel durchsuchen"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setConfirmId(null);
                }}
              />
            </div>
          )}

          <div
            id={menuId}
            role="menu"
            aria-labelledby={titleId}
            className="entries-scroll"
          >
            {rows === null && (
              <p className="flex items-center gap-2.5 px-3 py-4 text-sm text-coal-soft">
                <span
                  aria-hidden
                  className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-paper-line border-t-fox [animation-duration:0.72s]"
                />
                Wird geladen …
              </p>
            )}

            {rows !== null && shown.length === 0 && (
              <p className="px-3 py-4 text-sm leading-relaxed text-coal-soft">
                {loadError
                  ? loadError
                  : isAdmin
                    ? query.trim()
                      ? "Kein Eintrag mit diesem Titel."
                      : "Es gibt noch keine Einträge."
                    : "Du hast noch nichts eingetragen. Sobald du deinen ersten Beitrag gespeichert hast, findest du ihn hier wieder."}
              </p>
            )}

            <ul className="space-y-0.5">
              {shown.map((row) => {
                const date = entryToSmartDate(row);
                const dateLabel = date ? formatSmartDate(date) : "Ohne Datum";
                const asking = confirmId === row.id;
                const deleting = busyId === row.id;

                if (asking) {
                  return (
                    <li key={row.id} className="entries-confirm animate-fade-up">
                      <p className="text-sm leading-snug font-semibold text-coal">
                        „{row.title}“ löschen?
                      </p>
                      <p className="hint mt-1 leading-relaxed">
                        Der Eintrag ({dateLabel}) verschwindet vom Zeitstrahl —
                        samt Text, Bildern und allen Stimmen, die andere dazu
                        geschrieben haben. Das lässt sich nicht rückgängig
                        machen.
                      </p>
                      <div className="mt-2.5 flex gap-2">
                        <button
                          type="button"
                          role="menuitem"
                          className="btn-danger min-h-11 flex-1 text-xs"
                          disabled={deleting}
                          onClick={() => void handleDelete(row)}
                        >
                          {deleting && (
                            <span
                              aria-hidden
                              className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-paper/30 border-t-paper [animation-duration:0.72s]"
                            />
                          )}
                          {deleting ? "Wird gelöscht …" : "Ja, löschen"}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="btn-ghost min-h-11 flex-1 text-xs"
                          disabled={deleting}
                          onClick={() => setConfirmId(null)}
                        >
                          Abbrechen
                        </button>
                      </div>
                    </li>
                  );
                }

                return (
                  <li key={row.id} className="entries-row flex items-stretch gap-1">
                    <Link
                      href={`/eintragen/?id=${row.id}`}
                      role="menuitem"
                      className="entries-item flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl px-3 py-2"
                      onClick={() => closeMenu(false)}
                    >
                      <span
                        aria-hidden
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor: categoryById(row.category).color,
                        }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-coal">
                          {row.title}
                        </span>
                        <span className="hint mt-0.5 block truncate">
                          {dateLabel}
                        </span>
                      </span>
                    </Link>

                    {isAdmin && (
                      <button
                        type="button"
                        role="menuitem"
                        className="entries-del flex h-auto w-11 shrink-0 items-center justify-center rounded-xl"
                        onClick={() => {
                          setActionError(null);
                          setConfirmId(row.id);
                        }}
                      >
                        <TrashIcon />
                        <span className="sr-only">
                          „{row.title}“ löschen
                        </span>
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          {actionError && (
            <p
              role="alert"
              className="entries-error mx-1 mt-2 rounded-xl border px-3 py-2.5 text-xs leading-relaxed font-semibold"
            >
              {actionError}
            </p>
          )}

          {/* Der Weg nach vorn steht immer unten — auch bei leerer Liste. */}
          <div role="none" className="mt-1 border-t border-paper-line px-1 pt-2">
            <Link
              href="/eintragen/"
              role="menuitem"
              className="btn-ghost min-h-11 w-full text-xs"
              onClick={() => closeMenu(false)}
            >
              Neuen Eintrag anlegen
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
