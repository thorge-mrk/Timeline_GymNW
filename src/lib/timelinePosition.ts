/**
 * Geometrie & Layout des Zeitstrahls — ausschließlich reine Funktionen.
 *
 * Grundidee des Koordinatensystems
 * --------------------------------
 * Jeder Eintrag hat ein „Bruchteil-Jahr" (z. B. 1996.454, siehe `entryYearFraction`).
 * Eine lineare Skala bildet den Gesamtbereich [domainStart, domainEnd] auf die
 * Breite der Zeichenfläche ab. Beim Zoomen wird dieses Ergebnis zusätzlich mit dem
 * d3-Zoomfaktor `k` multipliziert — es entsteht der „Content-Raum":
 *
 *     contentX = k * scale(bruchteilJahr)          Breite: contentWidth = k * width
 *
 * Der Content-Raum hängt NUR von `k` ab, nicht von der Verschiebung `x`. Deshalb
 * kann das komplette Layout (Spuren, Cluster) mit `useMemo` an `k` gehängt werden;
 * das Pannen verschiebt anschließend nur noch den Container per `translateX`.
 * Folge: Beim Ziehen wird nichts neu berechnet und die Spuren „springen" nicht.
 */

import { entryYearFraction, monthName } from "./dates";
import type { Entry } from "./types";

/* ========================================================================== */
/*  Gesamtbereich der Achse                                                   */
/* ========================================================================== */

export interface TimelineDomain {
  start: number;
  end: number;
}

/** Fallback-Start, wenn noch keine Einträge da sind (Gründungsjahr der Schule). */
export const FALLBACK_START_YEAR = 1971;

/**
 * Der sichtbare Gesamtbereich: ein Jahr Luft vor dem ältesten Eintrag bis ein
 * halbes Jahr nach heute. Einträge, die (versehentlich) in der Zukunft liegen,
 * werden mit eingeschlossen, damit sie erreichbar bleiben.
 */
export function timelineDomain(
  entries: ReadonlyArray<Entry>,
  now: number
): TimelineDomain {
  let min = Infinity;
  let max = -Infinity;
  for (const entry of entries) {
    const fraction = entryYearFraction(entry);
    if (fraction < min) min = fraction;
    if (fraction > max) max = fraction;
  }

  const start = Number.isFinite(min)
    ? Math.floor(min) - 1
    : FALLBACK_START_YEAR;
  const end = Math.max(now + 0.5, Number.isFinite(max) ? max + 0.5 : -Infinity);

  // Mindestens ein Jahr Spanne, damit die Skala nie entartet.
  return { start: Math.min(start, end - 1), end };
}

/* ========================================================================== */
/*  Maße (CSS-Pixel)                                                          */
/* ========================================================================== */

/** Breite einer kompakten Mini-Karte über der Achse. */
export const ENTRY_WIDTH = 178;
/** Abstand vom linken Kartenrand bis zur Mitte des Farbpunkts (= Ankerpunkt). */
export const ENTRY_ANCHOR = 11;
/** Mindestabstand zwischen zwei Mini-Karten derselben Spur. */
export const ENTRY_GAP = 10;
/** Höhe einer Marker-Spur inkl. Zwischenraum. */
export const ENTRY_LANE_HEIGHT = 34;
/** Mehr Spuren als das wird nie belegt — darüber übernehmen Cluster-Badges. */
export const ENTRY_MAX_LANES = 4;
/** Luft zwischen Achse und unterster Marker-Spur (Platz für die Stiele). */
export const AXIS_MARKER_GAP = 14;

/** Maße des „+N"-Cluster-Badges. */
export const CLUSTER_WIDTH = 46;
export const CLUSTER_HEIGHT = 26;
export const CLUSTER_GAP = 10;

/** Länge der Verbindungslinie Achse → Meilenstein-Karte. */
export const MILESTONE_CONNECTOR = 32;
/** Vertikaler Abstand zwischen zwei Meilenstein-Spuren. */
export const MILESTONE_LANE_GAP = 12;
/** Horizontaler Mindestabstand zweier Meilenstein-Karten. */
export const MILESTONE_GAP = 14;

/* ========================================================================== */
/*  Meilenstein-Varianten (höhenabhängig)                                     */
/* ========================================================================== */

export type MilestoneVariant = "full" | "compact" | "pill";

export interface MilestoneLayout {
  variant: MilestoneVariant;
  width: number;
  height: number;
  /** Bildhöhe innerhalb der Karte (0 = ohne Bildfläche). */
  imageHeight: number;
  lanes: number;
}

const MILESTONE_SIZES: Record<
  MilestoneVariant,
  { width: number; height: number; imageHeight: number }
> = {
  full: { width: 260, height: 178, imageHeight: 96 },
  compact: { width: 224, height: 134, imageHeight: 64 },
  pill: { width: 192, height: 40, imageHeight: 0 },
};

/**
 * Reihenfolge der Wunsch-Layouts: erst möglichst viele Spuren, dann möglichst
 * große Karten. So zeigt ein hoher Bildschirm zwei Reihen echter Bildkarten,
 * ein flaches Handy-Display notfalls nur eine Reihe kleiner Pillen.
 */
const MILESTONE_PREFERENCE: ReadonlyArray<{
  variant: MilestoneVariant;
  lanes: number;
}> = [
  { variant: "full", lanes: 2 },
  { variant: "compact", lanes: 2 },
  { variant: "full", lanes: 1 },
  { variant: "compact", lanes: 1 },
  { variant: "pill", lanes: 2 },
  { variant: "pill", lanes: 1 },
];

/** Wählt Kartengröße und Spurenzahl passend zum Platz unterhalb der Achse. */
export function chooseMilestoneLayout(belowHeight: number): MilestoneLayout {
  for (const option of MILESTONE_PREFERENCE) {
    const size = MILESTONE_SIZES[option.variant];
    const needed =
      option.lanes * size.height + (option.lanes - 1) * MILESTONE_LANE_GAP;
    if (needed <= belowHeight) {
      return { ...size, variant: option.variant, lanes: option.lanes };
    }
  }
  return { ...MILESTONE_SIZES.pill, variant: "pill", lanes: 1 };
}

/**
 * Wie viele Marker-Spuren passen über die Achse? Die oberste Spur bleibt für
 * Cluster-Badges reserviert, deshalb `- 1`.
 */
export function chooseEntryLanes(aboveHeight: number): number {
  const usable = aboveHeight - AXIS_MARKER_GAP;
  const lanes = Math.floor(usable / ENTRY_LANE_HEIGHT) - 1;
  return Math.min(ENTRY_MAX_LANES, Math.max(1, lanes));
}

/* ========================================================================== */
/*  Spur-Layout (greedy)                                                      */
/* ========================================================================== */

/** Ein Element mit bereits berechneter x-Position im Content-Raum. */
export interface Anchored<T> {
  item: T;
  x: number;
}

export interface LanePlacement<T> {
  item: T;
  /** Ankerpunkt auf der Achse (Content-Pixel). */
  x: number;
  /** Spur; 0 = direkt an der Achse. */
  lane: number;
  /** Linke Kante des Elements (Content-Pixel, an die Ränder geklemmt). */
  left: number;
}

interface PackConfig {
  /** Breite des Elements. */
  width: number;
  /** Abstand linke Kante → Ankerpunkt (bei zentrierten Karten: width / 2). */
  anchor: number;
  /** Mindestabstand zum nächsten Element derselben Spur. */
  gap: number;
  maxLanes: number;
  /** Gesamtbreite des Content-Raums (zum Klemmen an den Rändern). */
  contentWidth: number;
}

/** Hält ein Element vollständig innerhalb des Content-Raums. */
function clampLeft(left: number, width: number, contentWidth: number): number {
  const max = Math.max(0, contentWidth - width);
  return Math.min(Math.max(left, 0), max);
}

/**
 * Greedy-Spurbelegung: Die (nach x sortierten) Elemente werden der Reihe nach
 * in die unterste freie Spur gelegt. „Frei" heißt: das zuletzt dort platzierte
 * Element endet (inkl. `gap`) links von der neuen linken Kante — also echte
 * Pixel-Überlappung bei der AKTUELLEN Zoomstufe, nicht ein fester Zeitabstand.
 * Passt ein Element in keine der `maxLanes` Spuren, landet es im Overflow.
 */
export function packLanes<T>(
  items: ReadonlyArray<Anchored<T>>,
  cfg: PackConfig
): { placed: LanePlacement<T>[]; overflow: Anchored<T>[] } {
  const placed: LanePlacement<T>[] = [];
  const overflow: Anchored<T>[] = [];
  /** Rechte Kante (inkl. gap) des zuletzt platzierten Elements je Spur. */
  const laneEnd: number[] = [];

  for (const entry of items) {
    const left = clampLeft(entry.x - cfg.anchor, cfg.width, cfg.contentWidth);

    let lane = -1;
    for (let l = 0; l < cfg.maxLanes; l++) {
      if (laneEnd[l] === undefined || laneEnd[l] <= left) {
        lane = l;
        break;
      }
    }

    if (lane === -1) {
      overflow.push(entry);
      continue;
    }

    laneEnd[lane] = left + cfg.width + cfg.gap;
    placed.push({ item: entry.item, x: entry.x, lane, left });
  }

  return { placed, overflow };
}

/* ========================================================================== */
/*  Cluster („+N")                                                            */
/* ========================================================================== */

export interface EntryCluster {
  key: string;
  entries: Entry[];
  /** Mittelpunkt des Badges im Content-Raum. */
  x: number;
  left: number;
  lane: number;
  /** Zeitspanne der enthaltenen Einträge — Ziel des Zoom-Sprungs. */
  yearMin: number;
  yearMax: number;
}

/** Breite eines Cluster-Fachs: Badge plus Luft nach links und rechts. */
const CLUSTER_SLOT = CLUSTER_WIDTH + 2 * CLUSTER_GAP;

/**
 * Fasst alle Einträge, für die keine Spur mehr frei war, zu „+N"-Badges zusammen.
 *
 * Der Content-Raum wird dafür in feste Fächer der Breite `CLUSTER_SLOT`
 * eingeteilt; jeder Overflow-Eintrag fällt in genau ein Fach. Das hat zwei
 * Vorteile gegenüber einem Ketten-Verfahren: Erstens kann nie ein einziges
 * Riesen-Badge über den halben Zeitstrahl entstehen, zweitens überlappen sich
 * benachbarte Badges garantiert nicht (das Badge darf sein Fach nicht verlassen).
 * Innerhalb seines Fachs sitzt das Badge so nah wie möglich an der Mitte seiner
 * Einträge.
 */
function buildClusters<T extends Entry>(
  overflow: ReadonlyArray<Anchored<T>>,
  lane: number,
  contentWidth: number
): EntryCluster[] {
  const slots = new Map<number, { entries: Entry[]; xSum: number }>();

  for (const item of overflow) {
    const slot = Math.floor(item.x / CLUSTER_SLOT);
    const bucket = slots.get(slot);
    if (bucket) {
      bucket.entries.push(item.item);
      bucket.xSum += item.x;
    } else {
      slots.set(slot, { entries: [item.item], xSum: item.x });
    }
  }

  return [...slots.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([slot, bucket]) => {
      const slotStart = slot * CLUSTER_SLOT;
      const wanted = bucket.xSum / bucket.entries.length - CLUSTER_WIDTH / 2;
      // Badge bleibt vollständig in seinem Fach → keine Überschneidungen.
      const left = clampLeft(
        Math.min(
          Math.max(wanted, slotStart + CLUSTER_GAP / 2),
          slotStart + CLUSTER_SLOT - CLUSTER_WIDTH - CLUSTER_GAP / 2
        ),
        CLUSTER_WIDTH,
        contentWidth
      );

      let yearMin = Infinity;
      let yearMax = -Infinity;
      for (const entry of bucket.entries) {
        const fraction = entryYearFraction(entry);
        if (fraction < yearMin) yearMin = fraction;
        if (fraction > yearMax) yearMax = fraction;
      }

      return {
        key: `slot${slot}:${bucket.entries[0].id}`,
        entries: bucket.entries,
        x: left + CLUSTER_WIDTH / 2,
        left,
        lane,
        yearMin,
        yearMax,
      };
    });
}

/* ========================================================================== */
/*  Gesamtlayout                                                              */
/* ========================================================================== */

export interface TimelineLayout {
  /** Kompakte Marker über der Achse (normale Einträge + verdrängte Meilensteine). */
  markers: LanePlacement<Entry>[];
  /** „+N"-Badges in der obersten Spur. */
  clusters: EntryCluster[];
  /** Große Meilenstein-Karten unter der Achse. */
  milestones: LanePlacement<Entry>[];
  entryLanes: number;
  milestone: MilestoneLayout;
}

export interface LayoutOptions {
  /** Bruchteil-Jahr → Content-Pixel (bereits inkl. Zoomfaktor k). */
  toX: (yearFraction: number) => number;
  contentWidth: number;
  /** Verfügbare Höhe oberhalb der Achse. */
  aboveHeight: number;
  /** Verfügbare Höhe unterhalb der Achse (ohne Beschriftungsband/Konnektor). */
  belowHeight: number;
}

/**
 * Berechnet das komplette Layout für ALLE Einträge (nicht nur die sichtbaren).
 * Das ist wichtig, damit Spurzuordnung und Cluster beim Pannen stabil bleiben —
 * gefiltert wird erst beim Rendern.
 *
 * Ablauf:
 *   1. Meilensteine bekommen die großen Karten unter der Achse (1–2 Spuren).
 *   2. Was dort keinen Platz findet, wird zum kompakten Marker über der Achse
 *      degradiert — beim Hineinzoomen wird daraus wieder eine große Karte.
 *   3. Normale Einträge + degradierte Meilensteine füllen die Spuren über der Achse.
 *   4. Der Rest wird zu „+N"-Badges in der obersten Spur zusammengefasst.
 */
export function layoutTimeline(
  entries: ReadonlyArray<Entry>,
  opts: LayoutOptions
): TimelineLayout {
  const entryLanes = chooseEntryLanes(opts.aboveHeight);
  const milestone = chooseMilestoneLayout(opts.belowHeight);

  const anchored: Anchored<Entry>[] = entries
    .map((entry) => ({ item: entry, x: opts.toX(entryYearFraction(entry)) }))
    .sort((a, b) => a.x - b.x || a.item.id.localeCompare(b.item.id));

  const milestonePack = packLanes(
    anchored.filter((a) => a.item.is_milestone),
    {
      width: milestone.width,
      anchor: milestone.width / 2,
      gap: MILESTONE_GAP,
      maxLanes: milestone.lanes,
      contentWidth: opts.contentWidth,
    }
  );

  const aboveItems = anchored
    .filter((a) => !a.item.is_milestone)
    .concat(milestonePack.overflow)
    .sort((a, b) => a.x - b.x || a.item.id.localeCompare(b.item.id));

  const markerPack = packLanes(aboveItems, {
    width: ENTRY_WIDTH,
    anchor: ENTRY_ANCHOR,
    gap: ENTRY_GAP,
    maxLanes: entryLanes,
    contentWidth: opts.contentWidth,
  });

  return {
    markers: markerPack.placed,
    clusters: buildClusters(markerPack.overflow, entryLanes, opts.contentWidth),
    milestones: milestonePack.placed,
    entryLanes,
    milestone,
  };
}

/* ========================================================================== */
/*  Achsen-Ticks                                                              */
/* ========================================================================== */

export type TickLevel = "decade" | "year" | "month";

export interface AxisTick {
  key: string;
  /** Position als Bruchteil-Jahr (Jahres- bzw. Monatsanfang). */
  value: number;
  level: TickLevel;
  label: string;
}

/** „März" → „Mär", „September" → „Sep" */
function shortMonth(month: number): string {
  return monthName(month).slice(0, 3);
}

/**
 * Adaptive Achsenbeschriftung. Je mehr Pixel ein Jahr breit ist, desto feiner
 * wird das Raster: 20er-Schritte → Dekaden → 5 Jahre → Jahre → Quartale → Monate.
 * Erzeugt werden nur Ticks im übergebenen Fenster (Sichtbereich + Puffer).
 */
export function buildAxisTicks(
  pxPerYear: number,
  fromYear: number,
  toYear: number
): AxisTick[] {
  if (!Number.isFinite(pxPerYear) || pxPerYear <= 0) return [];
  if (!Number.isFinite(fromYear) || !Number.isFinite(toYear)) return [];

  const yearStep =
    pxPerYear >= 46 ? 1 : pxPerYear >= 14 ? 5 : pxPerYear >= 6 ? 10 : 20;
  const pxPerMonth = pxPerYear / 12;
  const monthStep = pxPerMonth >= 40 ? 1 : pxPerMonth >= 16 ? 3 : 0;
  const longMonthLabels = pxPerMonth >= 92;

  const first = Math.floor(fromYear);
  const last = Math.ceil(toYear);
  const ticks: AxisTick[] = [];
  const MAX_TICKS = 400; // Sicherheitsnetz gegen absurde Fenster

  for (
    let year = Math.floor(first / yearStep) * yearStep;
    year <= last && ticks.length < MAX_TICKS;
    year += yearStep
  ) {
    ticks.push({
      key: `y${year}`,
      value: year,
      level: year % 10 === 0 ? "decade" : "year",
      label: String(year),
    });
  }

  if (monthStep > 0) {
    for (let year = first; year <= last && ticks.length < MAX_TICKS; year++) {
      for (let month = 1; month <= 12; month += monthStep) {
        if (month === 1) continue; // Januar ist bereits der Jahres-Tick
        ticks.push({
          key: `m${year}-${month}`,
          value: year + (month - 1) / 12,
          level: "month",
          label: longMonthLabels
            ? `${monthName(month)} ${year}`
            : shortMonth(month),
        });
      }
    }
  }

  return ticks;
}
