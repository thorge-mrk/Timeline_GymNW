"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { scaleLinear } from "d3-scale";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type D3ZoomEvent, type ZoomBehavior } from "d3-zoom";
import "d3-transition";

import { entryYearFraction, nowYearFraction } from "@/lib/dates";
import type { Entry } from "@/lib/types";
import {
  AXIS_MARKER_GAP,
  CLUSTER_HEIGHT,
  CLUSTER_WIDTH,
  ENTRY_LANE_HEIGHT,
  ENTRY_WIDTH,
  MILESTONE_CONNECTOR,
  buildAxisTicks,
  layoutTimeline,
  type EntryCluster,
  type TimelineDomain,
} from "@/lib/timelinePosition";

import ClusterListModal from "./ClusterListModal";
import EntryDetailModal from "./EntryDetailModal";
import EntryMarker from "./EntryMarker";
import MilestoneCard from "./MilestoneCard";
import TimelineAxis from "./TimelineAxis";
import "./timeline.css";

/** Kleinste sinnvolle Sichtspanne: drei Monate. Bestimmt den maximalen Zoom. */
const MIN_VISIBLE_YEARS = 0.25;
/** Kontext (in Jahren), der beim Anfliegen eines Eintrags sichtbar bleibt. */
const FOCUS_SPAN_YEARS = 8;
/** Dauer des Kamerafluges — eine erklärende Bewegung, die länger dauern darf. */
const FLY_DURATION = 800;

/* --- Gestaffelter Eingang nach Filterwechsel ----------------------------- */

/** Abstand zwischen zwei Elementen der Welle. */
const ENTER_STEP_MS = 40;
/** Danach starten alle gleichzeitig — sonst wartet man dem Zeitstrahl beim Bauen zu. */
const ENTER_MAX_INDEX = 12;
/** Fenster, in dem der Eingang gilt (letzte Verzögerung + Dauer + Reserve). */
const ENTER_WINDOW_MS = ENTER_MAX_INDEX * ENTER_STEP_MS + 280;

/** Verzögerung für Element `index` — oder `null`, wenn gerade nichts eingeht. */
function enterDelayFor(active: boolean, index: number): number | null {
  if (!active) return null;
  return Math.min(index, ENTER_MAX_INDEX) * ENTER_STEP_MS;
}

export interface FocusRequest {
  id: string;
  /** Erhöht sich bei jeder neuen Anforderung — auch für denselben Eintrag. */
  nonce: number;
}

interface TimelineProps {
  /** Bereits gefilterte Einträge — sie werden gezeichnet. */
  entries: Entry[];
  /** Gesamtbereich der Achse (aus ALLEN Einträgen, damit Filter nichts verschieben). */
  domain: TimelineDomain;
  /** Anforderung, einen bestimmten Eintrag anzufliegen. */
  focus: FocusRequest | null;
  onEntryDeleted: (id: string) => void;
  /** Hinweis, wenn der aktive Filter nichts übrig lässt. */
  emptyHint?: string | null;
  /**
   * Kennung des aktiven Filters. Ändert sie sich, kommen die Elemente kurz
   * gestaffelt herein. Bewusst NICHT `entries`: ein per Realtime eintreffender
   * Eintrag hat mit Kameraflug, Puls und Hinweis schon seine eigene
   * Choreografie — der Rest der Tafel soll dabei ruhig bleiben.
   */
  filterKey: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export default function Timeline({
  entries,
  domain,
  focus,
  onEntryDeleted,
  emptyHint,
  filterKey,
}: TimelineProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<ZoomBehavior<HTMLDivElement, unknown> | null>(null);

  const [size, setSize] = useState({ width: 0, height: 0 });
  const sizeRef = useRef(size);
  const [transform, setTransform] = useState({ k: 1, x: 0 });
  const transformRef = useRef(transform);

  /** Wurde die aktuelle Geste zum Ziehen benutzt? Dann keinen Klick auslösen. */
  const draggedRef = useRef(false);
  const gestureStartRef = useRef({ k: 1, x: 0 });
  const handledFocusRef = useRef<number | null>(null);

  const [selected, setSelected] = useState<Entry | null>(null);
  const [clusterEntries, setClusterEntries] = useState<Entry[] | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  /*
   * Wechselt der Filter, kommen die Elemente kurz gestaffelt herein. Der
   * Zustand wird noch WÄHREND des Renderns angepasst, damit der erste
   * sichtbare Frame schon der Startframe der Animation ist — sonst blitzt der
   * Endzustand einmal auf.
   *
   * Nach `ENTER_WINDOW_MS` wird der Eingang wieder abgeschaltet. Das ist der
   * entscheidende Teil: Marker, die später beim Pannen ins Bild rutschen,
   * sollen NICHT animieren. Blockiert wird dabei nie etwas — die Elemente
   * sind die ganze Zeit anklickbar.
   */
  const [enterKey, setEnterKey] = useState(filterKey);
  const [entering, setEntering] = useState(true);
  if (enterKey !== filterKey) {
    setEnterKey(filterKey);
    setEntering(true);
  }

  useEffect(() => {
    if (!entering) return;
    const timer = window.setTimeout(() => setEntering(false), ENTER_WINDOW_MS);
    return () => window.clearTimeout(timer);
  }, [entering, filterKey]);

  const { width, height } = size;
  const { k, x } = transform;

  /* ---------------------------------------------------------------- Skala */

  const now = useMemo(() => nowYearFraction(), []);
  const domainSpan = Math.max(domain.end - domain.start, 1);

  /** Bruchteil-Jahr → Basis-Pixel (ohne Zoom). */
  const baseScale = useMemo(() => {
    const scale = scaleLinear()
      .domain([domain.start, domain.end])
      .range([0, Math.max(width, 1)]);
    return scale;
  }, [domain.start, domain.end, width]);

  /** Größter Zoomfaktor: Sichtspanne von etwa drei Monaten. */
  const maxScale = Math.max(1, domainSpan / MIN_VISIBLE_YEARS);

  const contentWidth = Math.max(width, 1) * k;
  const toX = useCallback(
    (yearFraction: number) => k * baseScale(yearFraction),
    [k, baseScale]
  );

  /* ------------------------------------------------------- Vertikales Maß */

  const axisY = Math.round(height / 2);
  const aboveHeight = Math.max(axisY - 8, 0);
  const belowHeight = Math.max(height - axisY - MILESTONE_CONNECTOR - 8, 0);

  /* -------------------------------------------------------------- Layout */

  // Hängt bewusst NICHT an transform.x: Pannen darf kein Neu-Layout auslösen.
  const layout = useMemo(() => {
    if (width <= 0 || height <= 0) {
      return null;
    }
    return layoutTimeline(entries, {
      toX: (yearFraction) => k * baseScale(yearFraction),
      contentWidth: Math.max(width, 1) * k,
      aboveHeight,
      belowHeight,
    });
  }, [entries, k, baseScale, width, height, aboveHeight, belowHeight]);

  /**
   * Sichtfenster im Content-Raum: Viewport + 20 % Puffer, gerastert auf 10 %
   * der Breite. Da `lo`/`hi` einfache Zahlen sind, laufen die Memos unten beim
   * Pannen erst wieder an, wenn das Fenster tatsächlich weiterspringt.
   */
  const windowStep = Math.max(40, width * 0.1);
  const lo = Math.floor((-x - width * 0.2) / windowStep) * windowStep;
  const hi = Math.ceil((-x + width * 1.2) / windowStep) * windowStep;

  const visibleMarkers = useMemo(() => {
    if (!layout) return [];
    return layout.markers.filter((m) => m.left + ENTRY_WIDTH >= lo && m.left <= hi);
  }, [layout, lo, hi]);

  const visibleMilestones = useMemo(() => {
    if (!layout) return [];
    const cardWidth = layout.milestone.width;
    return layout.milestones.filter(
      (m) => m.left + cardWidth >= lo && m.left <= hi
    );
  }, [layout, lo, hi]);

  const visibleClusters = useMemo(() => {
    if (!layout) return [];
    return layout.clusters.filter((c) => c.left + CLUSTER_WIDTH >= lo && c.left <= hi);
  }, [layout, lo, hi]);

  const ticks = useMemo(() => {
    if (width <= 0) return [];
    const pxPerYear = (k * width) / domainSpan;
    return buildAxisTicks(
      pxPerYear,
      baseScale.invert(lo / k),
      baseScale.invert(hi / k)
    );
  }, [k, width, domainSpan, baseScale, lo, hi]);

  /* ---------------------------------------------------------- Zoom & Pan */

  useEffect(() => {
    const node = hostRef.current;
    if (!node) return;

    const selection = select<HTMLDivElement, unknown>(node);
    const behavior = zoom<HTMLDivElement, unknown>()
      .filter((event: Event & { ctrlKey?: boolean; button?: number }) => {
        // Bedienelemente (Zoom-Knöpfe) dürfen keine Geste starten.
        const target = event.target;
        if (target instanceof Element && target.closest("[data-no-zoom]")) {
          return false;
        }
        // Standardfilter von d3, aber Trackpad-Pinch (ctrl+wheel) erlaubt.
        return (!event.ctrlKey || event.type === "wheel") && !event.button;
      })
      .on("start", (event: D3ZoomEvent<HTMLDivElement, unknown>) => {
        if (!event.sourceEvent) return;
        draggedRef.current = false;
        gestureStartRef.current = {
          k: event.transform.k,
          x: event.transform.x,
        };
      })
      .on("zoom", (event: D3ZoomEvent<HTMLDivElement, unknown>) => {
        const next = { k: event.transform.k, x: event.transform.x };
        transformRef.current = next;

        // Direkt ans DOM: die Verschiebung fühlt sich dadurch auch dann flüssig
        // an, wenn React einen Frame später rendert (gleicher Wert, kein Sprung).
        if (contentRef.current) {
          contentRef.current.style.transform = `translate3d(${next.x}px,0,0)`;
        }

        if (event.sourceEvent) {
          const start = gestureStartRef.current;
          if (
            Math.abs(next.x - start.x) > 4 ||
            Math.abs(next.k - start.k) > 0.005
          ) {
            draggedRef.current = true;
          }
        }

        setTransform(next);
      });

    zoomRef.current = behavior;
    selection.call(behavior);

    return () => {
      selection.on(".zoom", null);
      zoomRef.current = null;
    };
  }, []);

  // Grenzen nachziehen, sobald sich Größe oder Datenbestand ändern.
  useEffect(() => {
    const behavior = zoomRef.current;
    if (!behavior || width <= 0) return;
    behavior
      .extent([
        [0, 0],
        [width, Math.max(height, 1)],
      ])
      .scaleExtent([1, maxScale])
      .translateExtent([
        [0, -Infinity],
        [width, Infinity],
      ]);
  }, [width, height, maxScale]);

  // Größe messen; beim Breitenwechsel den Ausschnitt proportional mitnehmen.
  useEffect(() => {
    const node = hostRef.current;
    if (!node) return;

    const observer = new ResizeObserver((observed) => {
      const rect = observed[0]?.contentRect;
      if (!rect) return;

      const next = {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
      const previous = sizeRef.current;
      sizeRef.current = next;

      if (previous.width > 0 && next.width > 0 && previous.width !== next.width) {
        const factor = next.width / previous.width;
        const behavior = zoomRef.current;
        const current = transformRef.current;
        if (behavior) {
          behavior.transform(
            select<HTMLDivElement, unknown>(node),
            zoomIdentity.translate(current.x * factor, 0).scale(current.k)
          );
        }
      }

      setSize(next);
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /* ----------------------------------------------- Programmatische Fahrten */

  const applyTransform = useCallback(
    (targetK: number, targetX: number, duration: number) => {
      const node = hostRef.current;
      const behavior = zoomRef.current;
      if (!node || !behavior) return;

      const selection = select<HTMLDivElement, unknown>(node);
      const target = zoomIdentity.translate(targetX, 0).scale(targetK);
      if (duration > 0) {
        selection
          .transition()
          .duration(duration)
          .call(behavior.transform, target);
      } else {
        behavior.transform(selection, target);
      }
    },
    []
  );

  /** Verschiebung so wählen, dass `center` in der Mitte liegt (im gültigen Bereich). */
  const translationFor = useCallback(
    (center: number, targetK: number) =>
      clamp(
        width / 2 - targetK * baseScale(center),
        -(targetK - 1) * width,
        0
      ),
    [width, baseScale]
  );

  /** Fliegt auf einen Zeitraum (z. B. einen Cluster). */
  const flyToRange = useCallback(
    (yearMin: number, yearMax: number, duration: number) => {
      const wanted = Math.max((yearMax - yearMin) * 1.6, MIN_VISIBLE_YEARS);
      const targetK = clamp(domainSpan / wanted, 1, maxScale);
      const center = (yearMin + yearMax) / 2;
      applyTransform(targetK, translationFor(center, targetK), duration);
    },
    [domainSpan, maxScale, applyTransform, translationFor]
  );

  /** Fliegt auf einen einzelnen Eintrag und hebt ihn danach kurz hervor. */
  const flyToEntry = useCallback(
    (entry: Entry) => {
      const targetK = clamp(
        Math.max(transformRef.current.k, domainSpan / FOCUS_SPAN_YEARS),
        1,
        maxScale
      );
      const center = entryYearFraction(entry);
      applyTransform(targetK, translationFor(center, targetK), FLY_DURATION);
      setHighlightId(entry.id);
    },
    [domainSpan, maxScale, applyTransform, translationFor]
  );

  // Anforderung von außen (neuer Eintrag per Realtime oder Toast-Knopf)
  useEffect(() => {
    if (!focus || width <= 0) return;
    if (handledFocusRef.current === focus.nonce) return;
    const entry = entries.find((e) => e.id === focus.id);
    if (!entry) return;
    handledFocusRef.current = focus.nonce;
    flyToEntry(entry);
  }, [focus, entries, width, flyToEntry]);

  // Hervorhebung wieder abklingen lassen
  useEffect(() => {
    if (!highlightId) return;
    const timer = window.setTimeout(() => setHighlightId(null), 5000);
    return () => window.clearTimeout(timer);
  }, [highlightId]);

  /* ------------------------------------------------------------ Bedienung */

  const zoomByFactor = useCallback((factor: number) => {
    const node = hostRef.current;
    const behavior = zoomRef.current;
    if (!node || !behavior) return;
    select<HTMLDivElement, unknown>(node)
      .transition()
      .duration(250)
      .call(behavior.scaleBy, factor);
  }, []);

  const resetZoom = useCallback(() => {
    const node = hostRef.current;
    const behavior = zoomRef.current;
    if (!node || !behavior) return;
    select<HTMLDivElement, unknown>(node)
      .transition()
      .duration(500)
      .call(behavior.transform, zoomIdentity);
  }, []);

  const handleSelect = useCallback((entry: Entry) => {
    // Nach einem Zieh-/Zoomvorgang soll der abschließende Klick nichts öffnen.
    if (draggedRef.current) return;
    setSelected(entry);
  }, []);

  const handleCluster = useCallback(
    (cluster: EntryCluster) => {
      if (draggedRef.current) return;
      const wanted = Math.max(
        (cluster.yearMax - cluster.yearMin) * 1.6,
        MIN_VISIBLE_YEARS
      );
      const targetK = clamp(domainSpan / wanted, 1, maxScale);
      // Bringt Zoomen nichts mehr (schon am Anschlag oder identische Daten):
      // dann direkt öffnen bzw. die Einträge auflisten.
      if (targetK <= transformRef.current.k * 1.02) {
        if (cluster.entries.length === 1) setSelected(cluster.entries[0]);
        else setClusterEntries(cluster.entries);
        return;
      }
      flyToRange(cluster.yearMin, cluster.yearMax, 600);
    },
    [domainSpan, maxScale, flyToRange]
  );

  const handleDeleted = useCallback(
    (id: string) => {
      setClusterEntries((current) =>
        current ? current.filter((e) => e.id !== id) : current
      );
      onEntryDeleted(id);
    },
    [onEntryDeleted]
  );

  /* -------------------------------------------------------------- Rendern */

  const clusterBottom =
    height -
    axisY +
    AXIS_MARKER_GAP +
    (layout?.entryLanes ?? 0) * ENTRY_LANE_HEIGHT;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={hostRef}
        className="relative min-h-0 flex-1 cursor-grab touch-none overflow-hidden select-none active:cursor-grabbing"
      >
        <div
          ref={contentRef}
          className="absolute inset-y-0 left-0 will-change-transform"
          style={{
            width: contentWidth,
            transform: `translate3d(${x}px,0,0)`,
          }}
        >
          {layout && (
            <>
              <TimelineAxis
                ticks={ticks}
                toX={toX}
                contentWidth={contentWidth}
                height={height}
                axisY={axisY}
                now={now}
              />

              {visibleMilestones.map((placement, index) => (
                <MilestoneCard
                  key={placement.item.id}
                  entry={placement.item}
                  x={placement.x}
                  left={placement.left}
                  lane={placement.lane}
                  axisY={axisY}
                  layout={layout.milestone}
                  highlighted={highlightId === placement.item.id}
                  enterDelay={enterDelayFor(entering, index)}
                  onSelect={handleSelect}
                />
              ))}

              {visibleMarkers.map((placement, index) => (
                <EntryMarker
                  key={placement.item.id}
                  entry={placement.item}
                  x={placement.x}
                  left={placement.left}
                  lane={placement.lane}
                  height={height}
                  axisY={axisY}
                  highlighted={highlightId === placement.item.id}
                  enterDelay={enterDelayFor(entering, index)}
                  onSelect={handleSelect}
                />
              ))}

              {visibleClusters.map((cluster) => (
                <button
                  key={cluster.key}
                  type="button"
                  onClick={() => handleCluster(cluster)}
                  aria-label={`${cluster.entries.length} weitere Einträge — hineinzoomen`}
                  className="tl-cluster absolute flex items-center justify-center rounded-full bg-navy text-[11px] font-bold tracking-tight text-paper tabular-nums shadow-(--shadow-card) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fox"
                  style={{
                    left: cluster.left,
                    bottom: clusterBottom,
                    width: CLUSTER_WIDTH,
                    height: CLUSTER_HEIGHT,
                  }}
                >
                  +{cluster.entries.length}
                </button>
              ))}
            </>
          )}
        </div>

        {/*
          Weicher Rand: die Zeitfläche läuft nach links und rechts ins Papier
          aus, statt Karten hart abzuschneiden. Liegt bewusst NEBEN dem
          verschobenen Inhalt — es soll am Bildschirmrand kleben, nicht mitfahren.
          Schmal gehalten, damit der „Heute“-Marker am rechten Rand der
          Gesamtansicht nicht verblasst.
        */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-paper to-paper/0 sm:w-10"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-paper to-paper/0 sm:w-10"
        />

        {emptyHint && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
            <p className="card animate-fade-up px-5 py-3.5 text-sm text-coal-soft shadow-(--shadow-card-lg)">
              {emptyHint}
            </p>
          </div>
        )}

        {/* Bedienhinweis */}
        <p className="pointer-events-none absolute bottom-4 left-5 z-10 hidden text-[11px] text-coal-faint sm:block">
          Ziehen zum Verschieben · Scrollen oder Kneifen zum Zoomen
        </p>

        {/* Schwebende Bedienleiste — ein Stück, klare Trennlinien */}
        <div
          data-no-zoom
          role="group"
          aria-label="Zoom"
          className="card absolute right-3 bottom-3 z-20 flex flex-col overflow-hidden shadow-(--shadow-pop) sm:right-4 sm:bottom-4"
        >
          <button
            type="button"
            onClick={() => zoomByFactor(1.8)}
            aria-label="Hineinzoomen"
            className="tl-zoom-btn flex h-11 w-11 cursor-pointer items-center justify-center text-navy"
          >
            <span aria-hidden="true" className="tl-zoom-btn__glyph">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path
                  d="M9 3.6v10.8M3.6 9h10.8"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </button>

          <span aria-hidden="true" className="h-px w-full bg-paper-line" />

          <button
            type="button"
            onClick={() => zoomByFactor(1 / 1.8)}
            aria-label="Herauszoomen"
            className="tl-zoom-btn flex h-11 w-11 cursor-pointer items-center justify-center text-navy"
          >
            <span aria-hidden="true" className="tl-zoom-btn__glyph">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path
                  d="M3.6 9h10.8"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </button>

          <span aria-hidden="true" className="h-px w-full bg-paper-line" />

          <button
            type="button"
            onClick={resetZoom}
            aria-label="Gesamtansicht zeigen"
            className="tl-zoom-btn flex h-11 w-11 cursor-pointer items-center justify-center text-navy"
          >
            {/* Zwei Endmarken mit Doppelpfeil — „den ganzen Zeitraum zeigen“ */}
            <span aria-hidden="true" className="tl-zoom-btn__glyph">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path
                  d="M2.4 4.6v8.8M15.6 4.6v8.8"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                />
                <path
                  d="M5.4 9h7.2M5.4 9l2.1-2.1M5.4 9l2.1 2.1M12.6 9l-2.1-2.1M12.6 9l-2.1 2.1"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </button>
        </div>
      </div>

      {selected && (
        <EntryDetailModal
          entry={selected}
          onClose={() => setSelected(null)}
          onDeleted={handleDeleted}
        />
      )}

      {clusterEntries && clusterEntries.length > 0 && !selected && (
        <ClusterListModal
          entries={clusterEntries}
          onSelect={(entry) => {
            setClusterEntries(null);
            setSelected(entry);
          }}
          onClose={() => setClusterEntries(null)}
        />
      )}
    </div>
  );
}
