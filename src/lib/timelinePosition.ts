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
 * kann das komplette Layout mit `useMemo` an `k` gehängt werden; das Pannen
 * verschiebt anschließend nur noch den Container per `translateX`. Folge: Beim
 * Ziehen wird nichts neu berechnet und die Spuren „springen" nicht.
 *
 * Zwei Stufen — Entscheidung und Position
 * ---------------------------------------
 * Beim Zoomen ändert sich `k` in winzigen Schritten. Würde bei jedem dieser
 * Schritte neu entschieden, welcher Eintrag auf welcher Seite und in welcher
 * Spur liegt, flackerte das ganze Bild. Deshalb ist die Rechnung geteilt:
 *
 *   1. `planTimeline`     — Seite, Spur und Cluster-Zugehörigkeit. Läuft auf
 *                           einem GERASTERTEN Zoomfaktor (`quantizeZoom`), also
 *                           nur bei spürbaren Zoomschritten.
 *   2. `positionTimeline` — die tatsächlichen Pixel. Läuft stufenlos mit `k`,
 *                           damit jeder Marker exakt über seinem Datum sitzt.
 *
 * Vertikaler Aufbau (beide Seiten der Achse gleich)
 * -------------------------------------------------
 *     ┌ Meilenstein-Karten (0–2 Spuren)
 *     ├ „+N"-Cluster-Spur
 *     ├ Marker-Spuren (1–3)
 *     ══ Achse ══
 *     ├ Marker-Spuren (1–3)
 *     ├ „+N"-Cluster-Spur
 *     └ Meilenstein-Karten (0–2 Spuren)
 *
 * Die kleinen Marker liegen also achsnah (kurzer Stiel = genaue Zeitangabe),
 * die großen Karten außen. Jedes platzierte Element kennt seinen `offset` —
 * den Abstand von der Achse bis zu seiner achsnahen Kante. Damit kommen die
 * Komponenten ohne eigene Geometrie aus.
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

/** Bis hierhin reicht die Achse mindestens — der Zeitstrahl endet nie „heute". */
export const DOMAIN_MIN_END_YEAR = 2027;

/**
 * Der sichtbare Gesamtbereich: ein Jahr Luft vor dem ältesten Eintrag bis
 * mindestens {@link DOMAIN_MIN_END_YEAR}. Dadurch klebt weder der erste noch
 * der letzte Eintrag am Rand — es bleibt sichtbar Platz für das, was kommt.
 * Einträge, die (versehentlich) in der Zukunft liegen, werden eingeschlossen,
 * damit sie erreichbar bleiben.
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
  const end = Math.max(
    DOMAIN_MIN_END_YEAR,
    now + 0.5,
    Number.isFinite(max) ? max + 0.5 : -Infinity
  );

  // Mindestens ein Jahr Spanne, damit die Skala nie entartet.
  return { start: Math.min(start, end - 1), end };
}

/* ========================================================================== */
/*  Zoom-Raster für die Layout-Entscheidungen                                 */
/* ========================================================================== */

/**
 * Stufen pro Verdopplung des Zoomfaktors. Sechs Stufen entsprechen ~12 %
 * Größenänderung — grob genug, dass beim Scrollen nicht ständig neu verteilt
 * wird, fein genug, dass frei werdender Platz zügig genutzt wird.
 */
export const LAYOUT_ZOOM_STEPS = 6;

/** Rastert `k` auf die nächste Layout-Stufe (siehe {@link LAYOUT_ZOOM_STEPS}). */
export function quantizeZoom(k: number): number {
  if (!Number.isFinite(k) || k <= 0) return 1;
  const step = Math.round(Math.log2(k) * LAYOUT_ZOOM_STEPS) / LAYOUT_ZOOM_STEPS;
  return Math.pow(2, step);
}

/* ========================================================================== */
/*  Maße (CSS-Pixel)                                                          */
/* ========================================================================== */

/** Breite einer kompakten Mini-Karte. */
export const ENTRY_WIDTH = 178;
/** Abstand vom linken Kartenrand bis zur Mitte des Farbpunkts (= Ankerpunkt). */
export const ENTRY_ANCHOR = 11;
/** Mindestabstand zwischen zwei Mini-Karten derselben Spur. */
export const ENTRY_GAP = 10;
/** Höhe einer Marker-Spur inkl. Zwischenraum. */
export const ENTRY_LANE_HEIGHT = 34;

/** Maße des „+N"-Cluster-Badges. */
export const CLUSTER_WIDTH = 46;
export const CLUSTER_HEIGHT = 26;
export const CLUSTER_GAP = 10;

/** Luft zwischen Achse und erster Marker-Spur OBERHALB (Platz für die Stiele). */
export const AXIS_MARKER_GAP = 14;
/** Dasselbe UNTERHALB — hier steht zuerst die Achsenbeschriftung. */
export const AXIS_LABEL_BAND = 32;
/** Luft zwischen Cluster-Spur und dem Band der Meilenstein-Karten. */
export const MILESTONE_BAND_GAP = 10;
/** Vertikaler Abstand zwischen zwei Meilenstein-Spuren. */
export const MILESTONE_LANE_GAP = 12;
/** Horizontaler Mindestabstand zweier Meilenstein-Karten. */
export const MILESTONE_GAP = 14;

/* ========================================================================== */
/*  Seiten & Bänder                                                           */
/* ========================================================================== */

/** Ober- oder unterhalb der Achse. */
export type Side = "above" | "below";

export type MilestoneVariant = "full" | "compact" | "pill";

export interface MilestoneLayout {
  variant: MilestoneVariant;
  width: number;
  height: number;
  /** Bildhöhe innerhalb der Karte (0 = ohne Bildfläche). */
  imageHeight: number;
  /** Spuren JE SEITE (0 = auf diesem Schirm passt keine große Karte). */
  lanes: number;
}

/** Abstände einer Seite, gemessen von der Achse bis zur achsnahen Kante. */
export interface SideBands {
  entryLanes: number;
  milestoneLanes: number;
  markerOffset: number;
  clusterOffset: number;
  milestoneOffset: number;
}

export interface TimelineBands {
  above: SideBands;
  below: SideBands;
  milestone: MilestoneLayout;
}

const MILESTONE_SIZES: Record<
  MilestoneVariant,
  { width: number; height: number; imageHeight: number }
> = {
  full: { width: 260, height: 178, imageHeight: 96 },
  compact: { width: 224, height: 134, imageHeight: 64 },
  pill: { width: 192, height: 40, imageHeight: 0 },
};

interface BandPlan {
  /** Marker-Spuren je Seite (die Cluster-Spur kommt immer obendrauf). */
  markerLanes: number;
  /** Meilenstein-Spuren je Seite. */
  milestoneLanes: number;
  variant: MilestoneVariant;
}

/**
 * Wunschreihenfolge der Bänder. Gelesen wird von oben nach unten, genommen
 * wird der erste Plan, der auf BEIDE Seiten passt — so bleibt das Bild
 * symmetrisch, statt oben groß und unten winzig zu werden.
 *
 * Gewichtung: erst eine zweite Markerspur (mehr Einträge lesbar), dann große
 * Karten, dann notfalls Pillen. Ganz unten steht der ehrliche Fall „für Karten
 * ist kein Platz" — dann laufen alle Meilensteine als gekennzeichnete Marker.
 */
const BAND_PLANS: readonly BandPlan[] = [
  { markerLanes: 3, milestoneLanes: 2, variant: "full" }, // 512 px je Seite
  { markerLanes: 2, milestoneLanes: 2, variant: "full" }, // 478
  { markerLanes: 3, milestoneLanes: 1, variant: "full" }, // 324
  { markerLanes: 2, milestoneLanes: 1, variant: "full" }, // 288
  { markerLanes: 2, milestoneLanes: 1, variant: "compact" }, // 244
  { markerLanes: 1, milestoneLanes: 1, variant: "compact" }, // 210
  { markerLanes: 2, milestoneLanes: 1, variant: "pill" }, // 150
  { markerLanes: 1, milestoneLanes: 1, variant: "pill" }, // 116
  { markerLanes: 2, milestoneLanes: 0, variant: "pill" }, // 102
  { markerLanes: 1, milestoneLanes: 0, variant: "pill" }, // 68
];

/** Höhe, die ein Plan ab der ersten Markerspur braucht. */
function planHeight(plan: BandPlan): number {
  const lanes = (plan.markerLanes + 1) * ENTRY_LANE_HEIGHT; // +1 = Cluster-Spur
  if (plan.milestoneLanes === 0) return lanes;
  const size = MILESTONE_SIZES[plan.variant];
  return (
    lanes +
    MILESTONE_BAND_GAP +
    plan.milestoneLanes * size.height +
    (plan.milestoneLanes - 1) * MILESTONE_LANE_GAP
  );
}

/**
 * Wählt Spurenzahl und Kartengröße passend zur Höhe über UND unter der Achse.
 * Beide Seiten bekommen denselben Plan; ausschlaggebend ist die knappere Seite
 * (unten geht zuerst die Achsenbeschriftung ab).
 */
export function chooseBands(
  aboveHeight: number,
  belowHeight: number
): TimelineBands {
  const usable = Math.min(
    Math.max(aboveHeight - AXIS_MARKER_GAP, 0),
    Math.max(belowHeight - AXIS_LABEL_BAND, 0)
  );

  const plan =
    BAND_PLANS.find((candidate) => planHeight(candidate) <= usable) ??
    BAND_PLANS[BAND_PLANS.length - 1];

  const size = MILESTONE_SIZES[plan.variant];
  const band = (offset: number): SideBands => ({
    entryLanes: plan.markerLanes,
    milestoneLanes: plan.milestoneLanes,
    markerOffset: offset,
    clusterOffset: offset + plan.markerLanes * ENTRY_LANE_HEIGHT,
    milestoneOffset:
      offset + (plan.markerLanes + 1) * ENTRY_LANE_HEIGHT + MILESTONE_BAND_GAP,
  });

  return {
    above: band(AXIS_MARKER_GAP),
    below: band(AXIS_LABEL_BAND),
    milestone: {
      ...size,
      variant: plan.variant,
      lanes: plan.milestoneLanes,
    },
  };
}

/* ========================================================================== */
/*  Spur-Belegung über beide Seiten (greedy, ausbalanciert)                   */
/* ========================================================================== */

/** Ein Element mit Position im gerasterten Layout-Raum. */
export interface Anchored<T> {
  item: T;
  /** Ankerpunkt im Layout-Raum (gerastertes `k`). */
  lx: number;
}

/** Entscheidung: Seite und Spur. Noch ohne endgültige Pixel. */
export interface SideAssignment<T> extends Anchored<T> {
  side: Side;
  lane: number;
}

/** Fertig positioniertes Element im Content-Raum. */
export interface LanePlacement<T> {
  item: T;
  /** Ankerpunkt auf der Achse (Content-Pixel). */
  x: number;
  /** Linke Kante des Elements (Content-Pixel, an die Ränder geklemmt). */
  left: number;
  side: Side;
  lane: number;
  /** Abstand Achse → achsnahe Kante des Elements. */
  offset: number;
}

/**
 * Größte Abweichung zwischen gerastertem und echtem Zoom: eine halbe
 * Rasterstufe, also knapp 6 %.
 */
const ZOOM_DRIFT = Math.pow(2, 1 / (2 * LAYOUT_ZOOM_STEPS)) - 1;

/**
 * Sicherheitsstreifen an den beiden Rändern des Content-Raums.
 *
 * Elemente am Rand werden geklemmt — und zwar zweimal: beim Planen im
 * gerasterten Raum und beim Positionieren im echten. Weil beide Räume um bis zu
 * {@link ZOOM_DRIFT} auseinanderliegen, landet ein geklemmtes Element in echt
 * ein Stück weiter innen, als der Plan dachte. Ohne Reserve könnte es dadurch
 * seinen Spurnachbarn überlappen. Mit ihr plant die Spurbelegung an den Rändern
 * eine Spur konservativer — sichtbar ist davon nichts, denn die tatsächliche
 * Position entsteht ohnehin erst in `positionTimeline`.
 */
function edgeReserve(width: number, anchor: number): number {
  return Math.ceil((2 * width - anchor) * ZOOM_DRIFT);
}

interface SidePackConfig {
  width: number;
  /** Abstand linke Kante → Ankerpunkt (bei zentrierten Karten: width / 2). */
  anchor: number;
  /** Mindestabstand zum nächsten Element derselben Spur. */
  gap: number;
  /** Spuren JE SEITE. */
  lanes: number;
  /** Seite, die bei Gleichstand gewinnt. */
  prefer: Side;
  /** Gesamtbreite im Layout-Raum (zum Klemmen an den Rändern). */
  contentWidth: number;
}

/** Hält ein Element vollständig innerhalb des Content-Raums. */
function clampLeft(left: number, width: number, contentWidth: number): number {
  const max = Math.max(0, contentWidth - width);
  return Math.min(Math.max(left, 0), max);
}

/**
 * Greedy-Belegung über BEIDE Seiten der Achse.
 *
 * Für jedes (nach x sortierte) Element wird auf jeder Seite die unterste noch
 * freie Spur gesucht. „Frei" heißt: das zuletzt dort platzierte Element endet
 * (inkl. `gap`) links von der neuen linken Kante — also echte Pixel-Überlappung
 * bei der aktuellen Zoomstufe, kein fester Zeitabstand.
 *
 * Gewonnen hat
 *   1. die kleinere Spurnummer  → achsnah wird zuerst gefüllt,
 *   2. bei Gleichstand die Seite mit weniger Elementen → das Bild bleibt
 *      ausgewogen, statt eine Seite vollzustopfen,
 *   3. bei Gleichstand `cfg.prefer` → deterministisch.
 *
 * Damit wandert automatisch nach oben, was unten keinen Platz mehr findet —
 * und umgekehrt. Passt ein Element auf keiner Seite, landet es im Overflow.
 */
export function packSides<T>(
  items: ReadonlyArray<Anchored<T>>,
  cfg: SidePackConfig
): { placed: SideAssignment<T>[]; overflow: Anchored<T>[] } {
  const placed: SideAssignment<T>[] = [];
  const overflow: Anchored<T>[] = [];

  /** Rechte Kante (inkl. gap) des zuletzt platzierten Elements je Spur. */
  const laneEnd: Record<Side, number[]> = { above: [], below: [] };
  const used: Record<Side, number> = { above: 0, below: 0 };
  const order: Side[] =
    cfg.prefer === "above" ? ["above", "below"] : ["below", "above"];

  const max = Math.max(0, cfg.contentWidth - cfg.width);
  const reserve = edgeReserve(cfg.width, cfg.anchor);
  const lo = Math.min(reserve, max);
  const hi = Math.max(lo, max - reserve);

  for (const entry of items) {
    const left = Math.min(Math.max(entry.lx - cfg.anchor, lo), hi);

    let bestSide: Side | null = null;
    let bestLane = Number.POSITIVE_INFINITY;

    for (const side of order) {
      for (let lane = 0; lane < cfg.lanes; lane++) {
        const end = laneEnd[side][lane];
        if (end !== undefined && end > left) continue;
        // Erste freie Spur dieser Seite — tiefer wird hier nicht gesucht.
        if (
          bestSide === null ||
          lane < bestLane ||
          (lane === bestLane && used[side] < used[bestSide])
        ) {
          bestSide = side;
          bestLane = lane;
        }
        break;
      }
    }

    if (bestSide === null) {
      overflow.push(entry);
      continue;
    }

    laneEnd[bestSide][bestLane] = left + cfg.width + cfg.gap;
    used[bestSide] += 1;
    placed.push({ ...entry, side: bestSide, lane: bestLane });
  }

  return { placed, overflow };
}

/* ========================================================================== */
/*  Cluster („+N")                                                            */
/* ========================================================================== */

export interface ClusterPlan {
  key: string;
  entries: Entry[];
  side: Side;
  /** Fach im Layout-Raum — bestimmt später die erlaubte Spanne des Badges. */
  slot: number;
  /** Zeitspanne der enthaltenen Einträge — Ziel des Zoom-Sprungs. */
  yearMin: number;
  yearMax: number;
}

export interface EntryCluster extends ClusterPlan {
  /** Mittelpunkt des Badges im Content-Raum. */
  x: number;
  left: number;
  /** Abstand Achse → achsnahe Kante des Badges. */
  offset: number;
}

/** Breite eines Cluster-Fachs: Badge plus Luft nach links und rechts. */
const CLUSTER_SLOT = CLUSTER_WIDTH + 2 * CLUSTER_GAP;

/**
 * Fasst alle Einträge, für die keine Spur mehr frei war, zu „+N"-Badges zusammen.
 *
 * Der Layout-Raum wird dafür in feste Fächer der Breite `CLUSTER_SLOT`
 * eingeteilt; jeder Overflow-Eintrag fällt in genau ein Fach. Das hat zwei
 * Vorteile gegenüber einem Ketten-Verfahren: Erstens kann nie ein einziges
 * Riesen-Badge über den halben Zeitstrahl entstehen, zweitens überlappen sich
 * benachbarte Badges garantiert nicht (das Badge darf sein Fach nicht verlassen).
 *
 * Die Badges wechseln sich über die Fächer hinweg zwischen oben und unten ab —
 * so wird die für sie reservierte Spur auf beiden Seiten genutzt und keine
 * Seite wirkt überladen.
 */
function planClusters(
  overflow: ReadonlyArray<Anchored<Entry>>,
  prefer: Side
): ClusterPlan[] {
  const slots = new Map<number, Entry[]>();

  for (const item of overflow) {
    const slot = Math.floor(item.lx / CLUSTER_SLOT);
    const bucket = slots.get(slot);
    if (bucket) bucket.push(item.item);
    else slots.set(slot, [item.item]);
  }

  const other: Side = prefer === "above" ? "below" : "above";

  return [...slots.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([slot, entries], index) => {
      let yearMin = Infinity;
      let yearMax = -Infinity;
      for (const entry of entries) {
        const fraction = entryYearFraction(entry);
        if (fraction < yearMin) yearMin = fraction;
        if (fraction > yearMax) yearMax = fraction;
      }

      return {
        key: `slot${slot}:${entries[0].id}`,
        entries,
        side: index % 2 === 0 ? prefer : other,
        slot,
        yearMin,
        yearMax,
      };
    });
}

/* ========================================================================== */
/*  Plan (Entscheidungen — gerastertes k)                                     */
/* ========================================================================== */

export interface TimelinePlan {
  markers: SideAssignment<Entry>[];
  milestones: SideAssignment<Entry>[];
  clusters: ClusterPlan[];
  bands: TimelineBands;
  /** Zoomfaktor, bei dem der Plan gefasst wurde. */
  layoutScale: number;
}

export interface PlanOptions {
  /** Bruchteil-Jahr → Pixel bei GERASTERTEM Zoom. */
  toLayoutX: (yearFraction: number) => number;
  /** Gesamtbreite bei gerastertem Zoom. */
  layoutContentWidth: number;
  /** Der gerasterte Zoomfaktor selbst (für die spätere Umrechnung). */
  layoutScale: number;
  /** Verfügbare Höhe oberhalb der Achse. */
  aboveHeight: number;
  /** Verfügbare Höhe unterhalb der Achse. */
  belowHeight: number;
}

/**
 * Verteilt ALLE Einträge auf Seiten und Spuren (nicht nur die sichtbaren) —
 * sonst würden Spurzuordnung und Cluster beim Pannen springen.
 *
 * Ablauf:
 *   1. Meilensteine bekommen die großen Karten, verteilt auf beide Seiten
 *      (Startseite: unten — so bleibt die gewohnte Lesart erhalten).
 *   2. Was dort keinen Platz findet, wird zum kompakten Marker degradiert und
 *      als Meilenstein gekennzeichnet; beim Hineinzoomen wird wieder eine
 *      große Karte daraus.
 *   3. Normale Einträge + degradierte Meilensteine füllen die Marker-Spuren,
 *      ebenfalls auf beiden Seiten (Startseite: oben).
 *   4. Der Rest wird zu „+N"-Badges in der jeweiligen Cluster-Spur.
 */
export function planTimeline(
  entries: ReadonlyArray<Entry>,
  opts: PlanOptions
): TimelinePlan {
  const bands = chooseBands(opts.aboveHeight, opts.belowHeight);

  const anchored: Anchored<Entry>[] = entries
    .map((entry) => ({
      item: entry,
      lx: opts.toLayoutX(entryYearFraction(entry)),
    }))
    .sort((a, b) => a.lx - b.lx || a.item.id.localeCompare(b.item.id));

  const milestonePack = packSides(
    anchored.filter((a) => a.item.is_milestone),
    {
      width: bands.milestone.width,
      anchor: bands.milestone.width / 2,
      gap: MILESTONE_GAP,
      lanes: bands.milestone.lanes,
      prefer: "below",
      contentWidth: opts.layoutContentWidth,
    }
  );

  const markerItems = anchored
    .filter((a) => !a.item.is_milestone)
    .concat(milestonePack.overflow)
    .sort((a, b) => a.lx - b.lx || a.item.id.localeCompare(b.item.id));

  const markerPack = packSides(markerItems, {
    width: ENTRY_WIDTH,
    anchor: ENTRY_ANCHOR,
    gap: ENTRY_GAP,
    lanes: bands.above.entryLanes,
    prefer: "above",
    contentWidth: opts.layoutContentWidth,
  });

  return {
    markers: markerPack.placed,
    milestones: milestonePack.placed,
    clusters: planClusters(markerPack.overflow, "above"),
    bands,
    layoutScale: opts.layoutScale,
  };
}

/* ========================================================================== */
/*  Positionen (stufenloses k)                                                */
/* ========================================================================== */

export interface TimelineLayout {
  /** Kompakte Marker (normale Einträge + verdrängte Meilensteine). */
  markers: LanePlacement<Entry>[];
  /** Große Meilenstein-Karten. */
  milestones: LanePlacement<Entry>[];
  /** „+N"-Badges. */
  clusters: EntryCluster[];
  bands: TimelineBands;
  milestone: MilestoneLayout;
}

export interface PositionOptions {
  /** Bruchteil-Jahr → Content-Pixel beim ECHTEN Zoom. */
  toX: (yearFraction: number) => number;
  contentWidth: number;
  /** Der echte Zoomfaktor. */
  scale: number;
}

function offsetFor(
  bands: TimelineBands,
  side: Side,
  kind: "marker" | "milestone",
  lane: number
): number {
  const band = bands[side];
  if (kind === "marker") {
    return band.markerOffset + lane * ENTRY_LANE_HEIGHT;
  }
  return (
    band.milestoneOffset +
    lane * (bands.milestone.height + MILESTONE_LANE_GAP)
  );
}

function positionAll(
  items: ReadonlyArray<SideAssignment<Entry>>,
  kind: "marker" | "milestone",
  width: number,
  anchor: number,
  opts: PositionOptions,
  bands: TimelineBands
): LanePlacement<Entry>[] {
  return items.map((assignment) => {
    const x = opts.toX(entryYearFraction(assignment.item));
    return {
      item: assignment.item,
      x,
      left: clampLeft(x - anchor, width, opts.contentWidth),
      side: assignment.side,
      lane: assignment.lane,
      offset: offsetFor(bands, assignment.side, kind, assignment.lane),
    };
  });
}

/**
 * Rechnet einen Plan in echte Pixel um. Nur diese Funktion läuft bei jedem
 * Zoom-Frame — sie sortiert und entscheidet nichts, sie misst nur.
 *
 * Der Plan stammt von einer leicht anderen Zoomstufe (`layoutScale`), deshalb
 * werden die Cluster-Fächer mit `ratio` mitskaliert. `ratio` liegt bauartbedingt
 * zwischen 0,94 und 1,06 — die Fächer bleiben also immer breiter als ein Badge
 * und können sich nicht überlappen.
 */
export function positionTimeline(
  plan: TimelinePlan,
  opts: PositionOptions
): TimelineLayout {
  const { bands } = plan;
  const ratio = plan.layoutScale > 0 ? opts.scale / plan.layoutScale : 1;
  const slotWidth = CLUSTER_SLOT * ratio;
  const margin = (CLUSTER_GAP / 2) * ratio;

  const clusters: EntryCluster[] = plan.clusters.map((cluster) => {
    let sum = 0;
    for (const entry of cluster.entries) {
      sum += opts.toX(entryYearFraction(entry));
    }
    const slotStart = cluster.slot * slotWidth;
    const wanted = sum / cluster.entries.length - CLUSTER_WIDTH / 2;
    const left = clampLeft(
      Math.min(
        Math.max(wanted, slotStart + margin),
        slotStart + slotWidth - CLUSTER_WIDTH - margin
      ),
      CLUSTER_WIDTH,
      opts.contentWidth
    );

    return {
      ...cluster,
      x: left + CLUSTER_WIDTH / 2,
      left,
      offset: bands[cluster.side].clusterOffset,
    };
  });

  return {
    markers: positionAll(
      plan.markers,
      "marker",
      ENTRY_WIDTH,
      ENTRY_ANCHOR,
      opts,
      bands
    ),
    milestones: positionAll(
      plan.milestones,
      "milestone",
      bands.milestone.width,
      bands.milestone.width / 2,
      opts,
      bands
    ),
    clusters,
    bands,
    milestone: bands.milestone,
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
