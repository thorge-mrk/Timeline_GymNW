"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { categoryById } from "@/lib/categories";
import type { Entry, Voice } from "@/lib/types";
import {
  layoutCloud,
  wordFontWeight,
  type CloudInput,
  type Measure,
} from "./cloudLayout";
import VoicePanel from "./VoicePanel";
import "./memoryCloud.css";

/** Ein Thema, fertig gewichtet — so kommt es aus MemoryCloud herüber. */
export interface CloudWord {
  entry: Entry;
  /** Erinnerungen insgesamt: der Eintrag selbst plus seine Stimmen. */
  memories: number;
  /** 0 … 1 — Stelle zwischen kleinster und größter Schrift. */
  weight: number;
  /** Auf Zeichenzahl gekürzter Anzeigetext. */
  label: string;
}

interface MemoryCloudFullProps {
  /** Bereits sortiert: das lauteste Thema zuerst. */
  words: CloudWord[];
  /**
   * Ein Thema, das schon beim Aufziehen offen stehen soll.
   *
   * Das Band zeigt die lautesten Themen als Wörter; wer dort eines antippt,
   * meint dieses eine und nicht die Wolke im Ganzen. Statt ihn in der frisch
   * aufgezogenen Wolke suchen zu lassen, steht das Panel dann sofort — die
   * Ansicht rückt das Wort ohnehin von selbst frei (siehe der Effekt zu
   * `selected`), sodass man auch sieht, WO in der Wolke man gelandet ist.
   */
  initialSelected?: string;
  /** Wie viele datumslose Beiträge es insgesamt gibt (kann größer sein als `words`). */
  total: number;
  /** Stimmen für das Panel. Fehlt die Funktion, zeigt das Panel nur den Eintrag. */
  voicesFor?: (entryId: string) => Voice[];
  /** Den ganzen Eintrag im Detail-Fenster öffnen — schließt vorher die Wolke. */
  onOpenEntry: (entry: Entry) => void;
  onAddVoice?: (entry: Entry) => void;
  /** Die Verwaltung hat eine Stimme geändert oder entfernt — Zähler nachladen. */
  onVoicesChanged?: (entryId: string) => void;
  onClose: () => void;
  /** Bekommt den Fokus zurück, sobald die Vollansicht schließt. */
  returnFocus: RefObject<HTMLElement | null>;
}

/** Ausgang kürzer als der Eingang — Schließen darf nie warten. */
const EXIT_MS = 250;

/** Ab dieser Wegstrecke war es ein Schieben und kein Klick. */
const DRAG_SLOP = 6;

/**
 * Staffelung des Aufziehens je Wort und ihre Obergrenze.
 *
 * Die Anordnung setzt von innen nach außen (`order` 0 ist das lauteste Thema,
 * ganz in der Mitte). Multipliziert mit `order` läuft die Wolke damit von der
 * Mitte nach außen auf — wie ein Atemzug, nicht wie eine Liste, die sich
 * Zeile für Zeile füllt.
 */
const STAGGER_MS = 22;
const STAGGER_MAX_MS = 460;

/**
 * Staffelung des Zusammenschrumpfens — RÜCKWÄRTS, von außen nach innen.
 *
 * Beim Schließen zieht sich die Wolke auf ihre Mitte zusammen: Der leise Rand
 * geht zuerst, das lauteste Wort zuletzt. Deutlich kürzer getaktet als der
 * Eingang, denn niemand wartet gern auf eine Verabschiedung; alles zusammen
 * bleibt unter `EXIT_MS`.
 */
const EXIT_STAGGER_MS = 5;
const EXIT_STAGGER_MAX_MS = 90;

/**
 * Deckkraft der Wörter, klein → groß.
 *
 * Bewusst ein SCHMALER Bereich. Weiter zurückgenommen sähen die kleinen
 * Wörter zwar hübsch nach Nebel aus, aber die dunkelste Kategorienfarbe auf
 * Papier fällt unter 0.88 unter das Kontrastverhältnis 4.5 : 1 — und ein Wort,
 * das man nicht lesen kann, ist keine Erinnerung mehr. Das Zurücktreten
 * leisten stattdessen Größe und Gewicht, die dafür keinen Preis haben.
 */
const FADE_MIN = 0.88;

/**
 * Grenzen des Einpass-Zooms.
 *
 * Nach dem Anordnen wird die ganze Wolke ins Bild gerückt. Sind es wenige
 * Themen, bleibt viel Fläche frei — dann darf die Wolke größer gezogen
 * werden, sonst klebte ein winziger Klumpen mitten auf einer leeren Wand.
 * Nach unten ist bei der Hälfte Schluss: Wer noch weiter herausmüsste, sieht
 * lieber einen Ausschnitt und schiebt.
 */
const FIT_MIN = 0.5;
const FIT_MAX = 1.6;

/**
 * Ab welcher Bühnenbreite die Wolke ALLE Themen zeigen darf.
 *
 * Darunter — also auf jedem hochkant gehaltenen Handy — greift die Lesegrenze
 * `READABLE`: Die Wolke nimmt so viele der lautesten Themen, wie in lesbarer
 * Schrift auf die Fläche passen, und mehr nicht. Vorher quetschten sich
 * zwanzig Themen auf 390 px, alle bei 14 px, alle gleich wichtig aussehend —
 * eine Wortwolke, die nichts mehr sagt. Der Rest verschwindet nicht: Er steht
 * unter der Wolke als Liste (siehe `restOpen`).
 */
const NARROW = 640;

/**
 * Kleinste Schrift, die auf einem Handy noch gesetzt wird — in Weltpixeln.
 *
 * Auf dem Bildschirm kommen mindestens 94 % davon an — enger passt der
 * Einpass-Zoom die fertige Wolke nie ein, meist zieht er sie sogar größer.
 * 16 px Welt sind also nie weniger als gut 15 px Schrift: die Grenze, ab der
 * eine Wortwolke im Stehen mit dem Handy in der Hand noch lesbar ist.
 */
const READABLE = 16;

/**
 * Der Streifen unten, der dem Knopf für die übrigen Themen gehört.
 *
 * Er wird schon beim Anordnen abgezogen und nicht erst beim Einpassen. Sonst
 * reichte die Wolke bis zur Unterkante, der Einpass-Zoom müsste sie kleiner
 * rechnen, um den Knopf freizuhalten — und genau damit wäre die Lesegrenze
 * wieder unterlaufen, für die der ganze Aufwand betrieben wird.
 */
const REST_ROOM = 56;

interface View {
  k: number;
  x: number;
  y: number;
}

function clamp(value: number, low: number, high: number): number {
  return value < low ? low : value > high ? high : value;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Ein Rad-Ereignis in Pixel umrechnen.
 *
 * Firefox unter Linux meldet Zeilen (deltaMode 1), manche Browser ganze Seiten
 * (2). Ohne Umrechnung wäre dieselbe Bewegung dort um Größenordnungen stärker.
 */
function wheelUnit(event: WheelEvent): number {
  return event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1;
}

/**
 * Textbreiten messen — ohne dafür etwas ins Dokument zu hängen.
 *
 * Ein Canvas kennt dieselben Schriftmaße wie die Seite, misst aber ohne Layout
 * und ohne Reflow. Bei vierzig Wörtern und mehreren Anläufen sind das schnell
 * ein paar hundert Messungen; über echte DOM-Knoten wäre das ein Ruckler.
 */
function makeMeasure(family: string, slack: number): Measure {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    // Ohne Canvas lieber großzügig schätzen: zu breit heißt nur mehr Luft,
    // zu schmal hieße Überschneidung.
    return (text, size) => text.length * size * 0.62;
  }
  return (text, size, weight) => {
    ctx.font = `${weight} ${size}px ${family}`;
    return ctx.measureText(text).width * slack;
  };
}

/**
 * Die Wolke in groß — eine eigene Ansicht über dem Zeitstrahl.
 *
 * Was hier passiert:
 *
 *   ANORDNUNG  kommt aus `cloudLayout.ts`: Spirale von innen nach außen,
 *              Rechteck gegen Rechteck geprüft, Streuung aus der Eintrags-id.
 *              Diese Datei legt das Ergebnis nur aus.
 *
 *   BEWEGUNG   drei ineinandergelegte Ebenen je Wort: außen das Aufziehen und
 *              Zusammenschrumpfen (Deckkraft + Maßstab, gestaffelt von der
 *              Mitte nach außen und beim Schließen zurück), in der Mitte das
 *              endlose Schweben, innen die Schrift mit Hover und Druck. Drei,
 *              weil auf einem Element immer nur EIN `transform` gleichzeitig
 *              laufen kann. Bewegt werden ausschließlich `transform` und
 *              `opacity` — nichts davon zwingt den Browser zu neuem Layout,
 *              die Wolke kann also stundenlang auf einem Beamer stehen.
 *
 *   GESTEN     Rad, Kneifen und Ziehen liegen als eigene Zuhörer auf dieser
 *              Ansicht. Der Zeitstrahl darunter hat sein eigenes d3-Zoom;
 *              damit sich die beiden nicht in die Quere kommen, hängt diese
 *              Ansicht als Portal am `body` (also außerhalb des Zeitstrahls,
 *              wo dessen Zuhörer nichts mehr hören), trägt zusätzlich
 *              `data-no-zoom` und stoppt jedes Ereignis, das sie selbst
 *              verarbeitet.
 */
export default function MemoryCloudFull({
  words,
  initialSelected,
  total,
  voicesFor,
  onOpenEntry,
  onAddVoice,
  onVoicesChanged,
  onClose,
  returnFocus,
}: MemoryCloudFullProps) {
  const titleId = useId();
  const restId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  /** Knopf und Liste der übrigen Themen — dort wird gelesen, nicht geschoben. */
  const restRef = useRef<HTMLDivElement>(null);

  const [host, setHost] = useState<HTMLElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [fontsReady, setFontsReady] = useState(false);
  /*
   * Nur der ANFANGSWERT — danach gehört die Auswahl dieser Ansicht allein.
   * Die Vollansicht wird pro Öffnen neu gebaut (`{open && …}` im Band), ein
   * Nachziehen bei geänderter Eigenschaft wäre also nicht nur unnötig,
   * sondern würde das Panel wieder aufreißen, das jemand gerade zugemacht hat.
   */
  const [selected, setSelected] = useState<string | null>(
    initialSelected ?? null
  );
  const [closing, setClosing] = useState(false);
  /** Steht die Liste der übrigen Themen offen? (Nur schmale Bildschirme.) */
  const [restOpen, setRestOpen] = useState(false);
  /** Wurde geschoben oder gezoomt? Nur dann gibt es den Zurücksetzen-Knopf. */
  const [shifted, setShifted] = useState(false);

  const closingRef = useRef(false);
  const exitTimer = useRef<number | undefined>(undefined);

  /* ------------------------------------------------------- Ausgang & Fokus */

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    exitTimer.current = window.setTimeout(
      onClose,
      prefersReducedMotion() ? 0 : EXIT_MS
    );
  }, [onClose]);

  // Portal erst im Browser — beim statischen Export gibt es kein `document`.
  useEffect(() => {
    setHost(document.body);
  }, []);

  useEffect(() => {
    const fonts = document.fonts;
    if (!fonts) {
      setFontsReady(true);
      return;
    }
    let alive = true;
    void fonts.ready.then(() => {
      if (alive) setFontsReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Fokus hierher, beim Schließen zurück an das Band.
  useEffect(() => {
    if (!host) return;
    rootRef.current?.focus();
    return () => {
      window.clearTimeout(exitTimer.current);
      const back = returnFocus.current;
      if (back instanceof HTMLElement && back.isConnected) back.focus();
    };
  }, [host, returnFocus]);

  /* ------------------------------------------------------------- Tastatur */

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const root = rootRef.current;
      if (!root) return;
      // Liegt etwas über uns (Detail-Fenster, Galerie), gehört die Taste dem —
      // wir mischen uns nur ein, solange der Fokus wirklich bei uns liegt.
      const target = event.target;
      const mine =
        target === document.body ||
        (target instanceof Node && root.contains(target));
      if (!mine) return;

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        // Eine Ebene je Druck: erst das Panel, dann die Liste der übrigen
        // Themen, zuletzt die ganze Ansicht.
        if (selected) setSelected(null);
        else if (restOpen) setRestOpen(false);
        else requestClose();
        return;
      }

      if (event.key === "Tab") {
        // Fokusfalle: Der Tabulator bleibt in der Vollansicht.
        const stops = Array.from(
          root.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
          )
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
  }, [requestClose, restOpen, selected]);

  /* ---------------------------------------------------------- Bühnengröße */

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;

    const read = () => {
      const rect = node.getBoundingClientRect();
      const next = { w: Math.round(rect.width), h: Math.round(rect.height) };
      setSize((current) =>
        current && current.w === next.w && current.h === next.h ? current : next
      );
    };

    read();
    const observer = new ResizeObserver(read);
    observer.observe(node);
    return () => observer.disconnect();
  }, [host]);

  /* ------------------------------------------------------------ Anordnung */

  const items = useMemo<CloudInput[]>(
    () =>
      words.map((word) => ({
        id: word.entry.id,
        label: word.label,
        memories: word.memories,
        weight: word.weight,
      })),
    [words]
  );

  const layout = useMemo(() => {
    if (!size) return null;
    const stage = stageRef.current;
    const family = stage
      ? window.getComputedStyle(stage).fontFamily
      : "sans-serif";
    /*
     * Solange die Hausschrift noch lädt, misst der Canvas die Ersatzschrift.
     * Ein Aufschlag von 6 % fängt den Unterschied ab — lieber ein bisschen zu
     * viel Luft als ein kurzes Überlappen. Sind die Schriften da, wird ohne
     * Aufschlag neu gerechnet.
     */
    const measure = makeMeasure(family, fontsReady ? 1 : 1.06);
    const narrow = size.w < NARROW;
    const flaeche = narrow
      ? { w: size.w, h: Math.max(160, size.h - REST_ROOM) }
      : size;
    return layoutCloud(items, measure, flaeche, narrow ? READABLE : 0);
  }, [items, size, fontsReady]);

  /*
   * Was die Wolke nicht zeigt.
   *
   * Auf schmalen Bildschirmen bleiben Themen übrig — die leisesten, weil die
   * Anordnung von innen nach außen setzt und beim ersten Wort abbricht, das
   * nicht mehr lesbar unterkäme. Sie bekommen ihre eigene, ruhige Liste.
   */
  const rest = useMemo(() => {
    if (!layout) return [];
    const shown = new Set(layout.words.map((word) => word.id));
    return words.filter((word) => !shown.has(word.entry.id));
  }, [layout, words]);

  // Wird der Bildschirm breiter, passen wieder alle hinein — dann hat die
  // Liste keinen Inhalt mehr und darf nicht als leerer Kasten stehen bleiben.
  useEffect(() => {
    if (!rest.length) setRestOpen(false);
  }, [rest.length]);

  /* ------------------------------------------------------------ Ausschnitt */

  /** Startansicht: die ganze Wolke mittig ins Bild. */
  const fit = useMemo<View>(() => {
    if (!layout || !size) return { k: 1, x: 0, y: 0 };
    /*
     * Steht unten der Knopf für die übrigen Themen, gehört ihm der Streifen
     * allein. Sonst legte er sich beim Aufgehen über das leiseste Wort der
     * Wolke — und ausgerechnet das kleinste Wort hinter einem Knopf zu
     * verstecken wäre die schlechteste aller Lösungen.
     */
    const room = size.h - (rest.length ? REST_ROOM : 0);
    const raw = Math.min(
      (size.w * 0.94) / layout.box.w,
      (room * 0.94) / layout.box.h
    );
    const k = clamp(raw, FIT_MIN, FIT_MAX);
    return {
      k,
      x: (size.w - layout.box.w * k) / 2 - layout.box.x * k,
      y: (room - layout.box.h * k) / 2 - layout.box.y * k,
    };
  }, [layout, rest.length, size]);

  const viewRef = useRef<View>(fit);

  const applyView = useCallback(() => {
    const world = worldRef.current;
    const view = viewRef.current;
    if (world) {
      world.style.transform = `translate(${view.x.toFixed(1)}px, ${view.y.toFixed(
        1
      )}px) scale(${view.k.toFixed(4)})`;
    }
    const off =
      Math.abs(view.k - fit.k) > 0.01 ||
      Math.abs(view.x - fit.x) > 2 ||
      Math.abs(view.y - fit.y) > 2;
    setShifted((current) => (current === off ? current : off));
  }, [fit]);

  const setView = useCallback(
    (next: View) => {
      if (!layout || !size) return;
      const box = layout.box;
      const k = clamp(next.k, Math.max(0.3, fit.k * 0.5), Math.min(6, fit.k * 5));

      /*
       * Schiebegrenze. Die Wolke darf über den Rand hinauswandern — anders
       * käme man bei starkem Zoom nie an ihre Ränder —, aber nie ganz aus dem
       * Bild: Ein Stück von ihr bleibt immer sichtbar, sonst schiebt jemand
       * die Wolke aus Versehen ins Nichts und starrt auf eine leere Fläche.
       */
      const w = box.w * k;
      const h = box.h * k;
      const keepX = Math.min(140, w * 0.6);
      const keepY = Math.min(140, h * 0.6);
      const left = clamp(next.x + box.x * k, -(w - keepX), size.w - keepX);
      const top = clamp(next.y + box.y * k, -(h - keepY), size.h - keepY);

      viewRef.current = { k, x: left - box.x * k, y: top - box.y * k };
      applyView();
    },
    [applyView, fit.k, layout, size]
  );

  /** Zoomt um einen Bildschirmpunkt herum — der Punkt bleibt, wo er ist. */
  const zoomAt = useCallback(
    (factor: number, clientX: number, clientY: number) => {
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      const view = viewRef.current;
      const k = clamp(view.k * factor, 0.05, 20);
      const scale = k / view.k;
      setView({
        k,
        x: px - (px - view.x) * scale,
        y: py - (py - view.y) * scale,
      });
    },
    [setView]
  );

  const panBy = useCallback(
    (dx: number, dy: number) => {
      const view = viewRef.current;
      setView({ k: view.k, x: view.x + dx, y: view.y + dy });
    },
    [setView]
  );

  const resetView = useCallback(() => {
    viewRef.current = { ...fit };
    applyView();
  }, [applyView, fit]);

  /**
   * Eine geführte Fahrt statt eines Sprungs.
   *
   * Beim Ziehen wird der Ausschnitt Bild für Bild neu gesetzt — da wäre eine
   * Übergangszeit genau das, was sich „klebrig" anfühlt. Nur wenn die Ansicht
   * von selbst wandert (weil das Panel aufgeht), bekommt sie für einen Moment
   * eine Kurve mit und nimmt sie danach wieder ab.
   */
  const glideTimer = useRef<number | undefined>(undefined);

  const glideTo = useCallback(
    (next: View) => {
      const world = worldRef.current;
      if (world && !prefersReducedMotion()) {
        world.dataset.glide = "true";
        window.clearTimeout(glideTimer.current);
        glideTimer.current = window.setTimeout(() => {
          delete world.dataset.glide;
        }, 420);
      }
      setView(next);
    },
    [setView]
  );

  useEffect(() => () => window.clearTimeout(glideTimer.current), []);

  // Neue Anordnung (anderer Bildschirm, andere Daten) → wieder alles im Bild.
  useEffect(() => {
    resetView();
  }, [resetView, layout]);

  /*
   * Das offene Wort darf nicht hinter dem Panel verschwinden.
   *
   * Das Panel legt sich über die Wolke (breit: rechte Spalte, schmal:
   * Schublade von unten). Wer ein Wort am rechten Rand antippt, bekäme sonst
   * die Stimmen zu sehen — und das Wort dazu nicht mehr. Also rückt die
   * Ansicht das Wort so weit heraus, dass es frei steht: eine kurze,
   * geführte Fahrt, kein Sprung, und nur so weit wie nötig.
   */
  useEffect(() => {
    if (!selected || !layout || !size) return;
    const placed = layout.words.find((word) => word.id === selected);
    const stage = stageRef.current;
    const panel = panelRef.current?.firstElementChild;
    if (!placed || !stage || !panel) return;

    const stageRect = stage.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const pad = 24;
    const wide = stageRect.width >= 1024;
    const safe = wide
      ? {
          x0: pad,
          x1: panelRect.left - stageRect.left - pad,
          y0: pad,
          y1: stageRect.height - pad,
        }
      : {
          x0: pad,
          x1: stageRect.width - pad,
          y0: pad,
          y1: panelRect.top - stageRect.top - pad,
        };

    const view = viewRef.current;
    const x = view.x + placed.box.x * view.k;
    const y = view.y + placed.box.y * view.k;
    const w = placed.box.w * view.k;
    const h = placed.box.h * view.k;

    let dx = 0;
    let dy = 0;
    if (x + w > safe.x1) dx = safe.x1 - (x + w);
    if (x + dx < safe.x0) dx = safe.x0 - x;
    if (y + h > safe.y1) dy = safe.y1 - (y + h);
    if (y + dy < safe.y0) dy = safe.y0 - y;

    if (dx || dy) glideTo({ k: view.k, x: view.x + dx, y: view.y + dy });
  }, [glideTo, layout, selected, size]);

  /* --------------------------------------------------------------- Rad */

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const onWheel = (event: WheelEvent) => {
      // Im Panel und in der Liste der übrigen Themen wird gelesen, nicht
      // gezoomt — dort gehört das Rad dem Text.
      const target = event.target;
      if (
        target instanceof Node &&
        (panelRef.current?.contains(target) || restRef.current?.contains(target))
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const unit = wheelUnit(event);
      // Querwischen auf dem Trackpad schiebt, längs zoomt — wie am Zeitstrahl.
      if (!event.ctrlKey && Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        panBy(-event.deltaX * unit, 0);
        return;
      }
      const delta = event.deltaY * unit;
      // Kneifen (ctrl+Rad) darf kräftiger zupacken als ein Mausrad.
      const strength = event.ctrlKey ? 0.011 : 0.0032;
      zoomAt(
        Math.exp(-clamp(delta * strength, -0.4, 0.4)),
        event.clientX,
        event.clientY
      );
    };

    /*
     * Safari auf dem iPad kennt zusätzlich eigene Gesten-Ereignisse und würde
     * damit die GANZE SEITE zoomen. Abgelehnt — das Kneifen gehört der Wolke.
     */
    const onGesture = (event: Event) => event.preventDefault();

    root.addEventListener("wheel", onWheel, { passive: false });
    root.addEventListener("gesturestart", onGesture);
    root.addEventListener("gesturechange", onGesture);
    return () => {
      root.removeEventListener("wheel", onWheel);
      root.removeEventListener("gesturestart", onGesture);
      root.removeEventListener("gesturechange", onGesture);
    };
  }, [host, panBy, zoomAt]);

  /* ----------------------------------------------------- Ziehen & Kneifen */

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; cx: number; cy: number } | null>(null);
  /** Wie weit der Zeiger seit dem Aufsetzen gewandert ist. */
  const travel = useRef(0);
  /** Der letzte Zeigerweg war ein Schieben — dann zählt der Klick nicht. */
  const dragged = useRef(false);
  const [grabbing, setGrabbing] = useState(false);

  const twoFinger = () => {
    const [a, b] = [...pointers.current.values()];
    return {
      dist: Math.hypot(a.x - b.x, a.y - b.y),
      cx: (a.x + b.x) / 2,
      cy: (a.y + b.y) / 2,
    };
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const target = event.target;
    if (
      target instanceof Node &&
      (panelRef.current?.contains(target) || restRef.current?.contains(target))
    ) {
      return;
    }

    dragged.current = false;
    travel.current = 0;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) pinch.current = twoFinger();
    setGrabbing(true);
  };

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const known = pointers.current.get(event.pointerId);
      if (!known) return;
      const dx = event.clientX - known.x;
      const dy = event.clientY - known.y;
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      travel.current += Math.abs(dx) + Math.abs(dy);
      if (travel.current > DRAG_SLOP) dragged.current = true;

      if (pointers.current.size >= 2) {
        const now = twoFinger();
        const before = pinch.current;
        pinch.current = now;
        if (before && before.dist > 0) {
          // Erst schieben (die Mitte der beiden Finger führt), dann zoomen.
          panBy(now.cx - before.cx, now.cy - before.cy);
          zoomAt(now.dist / before.dist, now.cx, now.cy);
        }
        return;
      }

      panBy(dx, dy);
    };

    const onUp = (event: PointerEvent) => {
      if (!pointers.current.delete(event.pointerId)) return;
      pinch.current = pointers.current.size >= 2 ? twoFinger() : null;
      if (pointers.current.size === 0) setGrabbing(false);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [panBy, zoomAt]);

  /* ---------------------------------------------------------------- Klick */

  /**
   * Ein Wort öffnen — oder wieder schließen, wenn es schon offen ist.
   *
   * `fromPointer` unterscheidet die beiden Wege dorthin: Ein Klick, der nur
   * das Ende eines Schiebens ist, darf kein Wort öffnen — sonst poppt beim
   * Loslassen der Wolke ein Panel auf. Die Tastatur ist davon ausgenommen
   * (Klicks per Leertaste oder Eingabe melden `detail === 0`), sonst bliebe
   * ein Wort nach einmaligem Schieben mit der Maus für immer stumm.
   */
  const openWord = useCallback((id: string, fromPointer: boolean) => {
    if (fromPointer && dragged.current) return;
    setSelected((current) => (current === id ? null : id));
  }, []);

  const selectedWord = useMemo(
    () => words.find((word) => word.entry.id === selected) ?? null,
    [selected, words]
  );

  /** Nachschlagewerk für die Ausgabe — sonst wäre jedes Wort eine Suche. */
  const byId = useMemo(
    () => new Map(words.map((word) => [word.entry.id, word])),
    [words]
  );

  if (!host) return null;

  const state = closing ? "closing" : "open";
  /*
   * Bei sehr vielen datumslosen Beiträgen zeigt die Wolke nur die lautesten.
   * Dann steht das auch da — eine Zahl, die nicht zur Zeile im Band passt,
   * wäre ein Rätsel.
   */
  const shownCount = layout ? layout.words.length : words.length;
  const countLabel =
    total > shownCount
      ? `${shownCount} von ${total} Beiträgen`
      : total === 1
        ? "1 Beitrag"
        : `${total} Beiträge`;
  const restLabel =
    rest.length === 1 ? "1 weiterer Beitrag" : `${rest.length} weitere Beiträge`;

  return createPortal(
    <div
      ref={rootRef}
      data-no-zoom
      data-state={state}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      className="mcf-root fixed inset-0 z-[45] flex flex-col outline-none"
    >
      {/* ------------------------------------------------------------ Kopf */}
      <header className="mcf-bar relative z-10 flex shrink-0 items-center gap-3 px-3 py-3 sm:gap-5 sm:px-5 sm:py-4">
        {/*
          Der Weg zurück ist der wichtigste Knopf dieser Ansicht — also ist er
          auch der größte. Kein Kreuzchen in der Ecke: Vor der Tafel steht
          jemand, der die Seite zum ersten Mal sieht, und der muss auf drei
          Meter Entfernung erkennen können, wie er hier wieder herauskommt.
        */}
        <button
          type="button"
          onClick={requestClose}
          className="btn-primary mcf-back shrink-0 px-4 py-3 text-[15px] sm:px-5"
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
              d="M11.5 4.5 6 10l5.5 5.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Zurück zum Zeitstrahl
        </button>

        {/*
          Auf dem Handy ist neben dem großen Knopf kein Platz für eine
          Überschrift, die sich sowieso nur zu „Erinnerungen o…" kürzen würde.
          Sie bleibt für Vorlesestimmen stehen (`sr-only`) und tritt erst ab
          `sm` sichtbar dazu; die Zahl trägt dort allein.
        */}
        <div className="min-w-0 flex-1">
          <h2
            id={titleId}
            className="sr-only truncate text-[15px] font-bold text-coal sm:not-sr-only"
          >
            Erinnerungen ohne Datum
          </h2>
          <p className="truncate text-[13px] text-coal-soft sm:text-[12px]">
            <span className="tabular-nums">{countLabel}</span>
            <span className="hidden sm:inline">
              {" "}
              · je größer ein Wort, desto mehr Menschen erinnern sich daran
            </span>
          </p>
        </div>

        {/*
          Auf dem Handy nur das Zeichen: Neben dem großen Zurück-Knopf ist für
          drei Wörter kein Platz, und abgeschnittene Beschriftung ist schlimmer
          als gar keine. Der Name steht im `aria-label`.
        */}
        {shifted && (
          <button
            type="button"
            onClick={resetView}
            aria-label="Ansicht zurücksetzen"
            className="btn-ghost mcf-reset shrink-0 px-2.5 py-2.5 text-[13px] sm:px-3"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M2.5 5.6V2.5h3.1M13.5 5.6V2.5h-3.1M2.5 10.4v3.1h3.1M13.5 10.4v3.1h-3.1"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="hidden sm:inline">Ansicht zurücksetzen</span>
          </button>
        )}
      </header>

      {/* ----------------------------------------------------------- Bühne */}
      <div
        ref={stageRef}
        data-grab={grabbing ? "true" : undefined}
        onPointerDown={onPointerDown}
        className="mcf-stage relative min-h-0 flex-1 overflow-hidden"
      >
        <div ref={worldRef} className="mcf-world absolute top-0 left-0">
          {layout?.words.map((placed) => {
            const word = byId.get(placed.id);
            if (!word) return null;
            const memoryLabel =
              word.memories === 1 ? "1 Erinnerung" : `${word.memories} Erinnerungen`;
            return (
              <button
                key={placed.id}
                type="button"
                onClick={(event) => openWord(placed.id, event.detail !== 0)}
                title={`${word.entry.title} — ${memoryLabel}`}
                aria-label={`${word.entry.title}, ${memoryLabel}, öffnen`}
                aria-expanded={selected === placed.id}
                data-selected={selected === placed.id ? "true" : undefined}
                className="mcf-word absolute cursor-pointer"
                style={
                  {
                    left: `${placed.box.x}px`,
                    top: `${placed.box.y}px`,
                    width: `${placed.box.w}px`,
                    height: `${placed.box.h}px`,
                    fontSize: `${placed.size}px`,
                    /*
                     * Zwei Takte, nicht einer: Das Aufziehen läuft von der
                     * Mitte nach außen, das Zusammenschrumpfen von außen nach
                     * innen. Ein gemeinsamer `animation-delay` hätte beim
                     * Schließen bis zu einer halben Sekunde Wartezeit bedeutet.
                     */
                    "--mcf-in-delay": `${Math.min(
                      placed.order * STAGGER_MS,
                      STAGGER_MAX_MS
                    )}ms`,
                    "--mcf-out-delay": `${Math.min(
                      (layout.words.length - 1 - placed.order) * EXIT_STAGGER_MS,
                      EXIT_STAGGER_MAX_MS
                    )}ms`,
                  } as CSSProperties
                }
              >
                <span
                  className="mcf-float"
                  style={
                    {
                      "--mcf-dx": `${placed.drift.dx.toFixed(2)}px`,
                      "--mcf-dy": `${placed.drift.dy.toFixed(2)}px`,
                      animationDuration: `${placed.drift.dur.toFixed(2)}s`,
                      animationDelay: `-${placed.drift.phase.toFixed(2)}s`,
                    } as CSSProperties
                  }
                >
                  {/*
                    Das Wort. Kein Hintergrund, kein Rahmen, kein Kästchen —
                    nur Schrift auf Papier. Was ein Wort vom anderen
                    unterscheidet, liefert die Schrift selbst: Kategorienfarbe
                    (die dunkle `ink`-Variante, nicht die helle Fläche),
                    Gewicht und Deckkraft. Alle drei kommen als Inline-Werte
                    von hier, weil sie von den Daten abhängen; wie sie sich
                    bewegen, steht in memoryCloud.css. Das Gewicht stammt aus
                    `cloudLayout.ts` — dort MUSS es bekannt sein, weil ein
                    fetteres Wort breiter ist und der Kasten sonst nicht passt.
                  */}
                  <span
                    className="mcf-ink"
                    style={
                      {
                        color: categoryById(word.entry.category).ink,
                        "--mcf-weight": wordFontWeight(word.weight),
                        "--mcf-fade": (
                          FADE_MIN +
                          word.weight * (1 - FADE_MIN)
                        ).toFixed(3),
                      } as CSSProperties
                    }
                  >
                    <span className="mcf-text">{placed.label}</span>
                    {/*
                      Die Erinnerungszahl — hochgestellt statt als „· 4"
                      hinter dem Wort. Der Mittelpunkt machte aus jedem Wort
                      einen halben Satz, und genau das darf eine Wortwolke
                      nicht sein. Weglassen wollten wir die Zahl aber auch
                      nicht: Die Größe sagt „viel" oder „wenig", die Zahl sagt
                      „genau fünf" — und über dem Deckel `MEMORY_CAP` sagt sie
                      als Einzige noch etwas, weil dort alle Wörter gleich groß
                      sind. Auf 42 % verkleinert und halb durchsichtig ist sie
                      eine Fußnote am Wort: da, wenn man hinsieht, und still,
                      wenn man es nicht tut. Vorgelesen wird sie nicht doppelt —
                      das `aria-label` des Knopfes sagt bereits „Pausen,
                      5 Erinnerungen, öffnen".
                    */}
                    {word.memories > 1 && (
                      <span aria-hidden="true" className="mcf-count tabular-nums">
                        {word.memories}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Leerlauf: Es gibt Wörter, aber noch keine Anordnung (erste Messung). */}
        {!layout && (
          <p
            role="status"
            className="absolute inset-0 flex items-center justify-center text-sm text-coal-faint"
          >
            Wolke wird angeordnet …
          </p>
        )}

        {/* ------------------------------------------------- Die Stimmen */}
        {selectedWord && (
          <div ref={panelRef}>
            <VoicePanel
              key={selectedWord.entry.id}
              entry={selectedWord.entry}
              voices={voicesFor?.(selectedWord.entry.id) ?? []}
              memories={selectedWord.memories}
              onClose={() => setSelected(null)}
              onOpenEntry={() => {
                // Das Detail-Fenster gehört dem Zeitstrahl. Wir gehen also aus
                // dem Weg, statt uns ein zweites Fenster überzustülpen —
                // sonst kämpften zwei Fokusfallen um dieselbe Tastatur.
                onOpenEntry(selectedWord.entry);
                requestClose();
              }}
              onAddVoice={
                onAddVoice ? () => onAddVoice(selectedWord.entry) : undefined
              }
              onVoicesChanged={onVoicesChanged}
            />
          </div>
        )}

        {/*
          Die übrigen Themen.

          Auf einem Handy zeigt die Wolke nur, was lesbar hineinpasst — das
          sind die lautesten Themen. Alles andere stünde sonst als 12-px-Krümel
          da oder gar nicht, und beides wäre eine Erinnerung, die man verliert.
          Also bekommt es hier einen ruhigen Weg: einen Knopf, dahinter eine
          schlichte Liste aus Titel und Anzahl. Ein Klick öffnet dieselben
          Stimmen wie ein Wort in der Wolke — nur der Weg dorthin ist ein
          anderer.

          Der ganze Block liegt AUSSERHALB der Gesten: Rad und Zeiger prüfen
          `restRef` und lassen die Finger davon, damit man in der Liste
          scrollen kann, statt die Wolke zu zoomen.
        */}
        {rest.length > 0 && (
          <div
            ref={restRef}
            className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-2 px-3 pb-3"
          >
            {restOpen && (
              <ul
                id={restId}
                className="mcf-rest card w-full max-w-md list-none overflow-y-auto p-1"
              >
                {rest.map((word) => {
                  const memoryLabel =
                    word.memories === 1
                      ? "1 Erinnerung"
                      : `${word.memories} Erinnerungen`;
                  return (
                    <li key={word.entry.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(word.entry.id);
                          setRestOpen(false);
                        }}
                        title={`${word.entry.title} — ${memoryLabel}`}
                        aria-label={`${word.entry.title}, ${memoryLabel}, öffnen`}
                        className="mcf-rest-item flex w-full cursor-pointer items-baseline gap-3 rounded-lg px-3 py-2.5 text-left"
                      >
                        <span
                          className="min-w-0 flex-1 truncate text-[14px] font-semibold"
                          style={{ color: categoryById(word.entry.category).ink }}
                        >
                          {word.entry.title}
                        </span>
                        <span
                          aria-hidden="true"
                          className="shrink-0 text-[12px] text-coal-soft tabular-nums"
                        >
                          {word.memories}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <button
              type="button"
              onClick={() => setRestOpen((current) => !current)}
              aria-expanded={restOpen}
              aria-controls={restId}
              className="btn-ghost mcf-rest-toggle px-4 py-2.5 text-[13px] shadow-(--shadow-card)"
            >
              {restLabel}
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
                className="mcf-rest-arrow shrink-0"
                data-open={restOpen ? "true" : undefined}
              >
                <path
                  d="M4 6.2 8 10.2l4-4"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>,
    host
  );
}
