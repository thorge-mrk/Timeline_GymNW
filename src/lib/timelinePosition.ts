/**
 * Geometrie & Layout des Zeitstrahls — ausschließlich reine Funktionen.
 *
 * Grundidee des Koordinatensystems
 * --------------------------------
 * Jeder Eintrag hat ein „Bruchteil-Jahr" (z. B. 1996.454, siehe `entryYearFraction`).
 * Eine lineare Skala bildet den Gesamtbereich [domainStart, domainEnd] auf die
 * Breite der Zeichenfläche ab — allerdings NICHT auf [0, width], sondern auf
 * [padLeft, width − padRight] (siehe {@link edgePadding}). Dieser Rand ist der
 * Platz, den die äußersten KARTEN brauchen, um vollständig im Bild zu stehen.
 * Beim Zoomen wird das Ergebnis zusätzlich mit dem d3-Zoomfaktor `k`
 * multipliziert — es entsteht der „Content-Raum":
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
 *   1. `planTimeline`     — Seite, Spur, Pillenbreite und Cluster-Zugehörigkeit.
 *                           Läuft auf einem GERASTERTEN Zoomfaktor
 *                           (`quantizeZoom`) — und erst, wenn die Geste steht
 *                           (siehe `planK` in `Timeline.tsx`). Wer zoomt, soll
 *                           die Bewegung sehen, nicht das Umräumen.
 *   2. `positionTimeline` — die tatsächlichen Pixel. Läuft stufenlos mit `k`,
 *                           damit jeder Marker in JEDEM Bild exakt über seinem
 *                           Datum sitzt, egal wie alt der Plan gerade ist.
 *
 * Drei Ränge
 * ----------
 *   is_milestone   große Bildkarte      (nur Admins)
 *   is_important   mittelgroße Karte    (auch Eintrag-Konten)
 *   —              schmale Pille
 * Reicht der Platz nicht, wird IN DIESER REIHENFOLGE heruntergestuft: zuerst
 * verlieren normale Einträge ihre Spur (→ „+N"), dann wichtige, zuletzt
 * Meilensteine. Siehe {@link planTimeline}.
 *
 * Vertikaler Aufbau (beide Seiten der Achse gleich aufgebaut)
 * ----------------------------------------------------------
 *     ┌ Kartenband (0–2 Spuren) — Meilenstein- UND Wichtig-Karten
 *     ├ „+N"-Cluster-Spur
 *     ├ Pillen-Spuren (1–5)
 *     ══ Achse ══
 *     ├ Pillen-Spuren (1–5)
 *     ├ „+N"-Cluster-Spur
 *     └ Kartenband (0–2 Spuren)
 *
 * Beide Kartenarten teilen sich EIN Band. Das ist kein Sparzwang, sondern die
 * bessere Lesart: Sie stehen auf derselben Höhe nebeneinander, die mittlere
 * Karte ist sichtbar kleiner — und es kostet keinen einzigen Pixel zusätzliche
 * Höhe, was den Pillen-Spuren zugutekommt. Innerhalb des Bandes greifen die
 * Meilensteine zuerst zu (siehe {@link planTimeline}).
 *
 * Die kleinen Pillen liegen achsnah (kurzer Stiel = genaue Zeitangabe), die
 * Karten außen. Jedes platzierte Element kennt seinen `offset` — den Abstand
 * von der Achse bis zu seiner achsnahen Kante. Damit kommen die Komponenten
 * ohne eigene Geometrie aus.
 */

import { entryYearFraction, monthName } from "./dates";
import type { Entry } from "./types";

/* ========================================================================== */
/*  Gesamtbereich der Achse                                                   */
/* ========================================================================== */

export interface TimelineDomain {
  start: number;
  end: number;
  /** Bruchteil-Jahr des ältesten Eintrags — Grundlage der Panning-Grenzen. */
  firstEntry: number;
  /** Bruchteil-Jahr des jüngsten Eintrags. */
  lastEntry: number;
}

/** Fallback-Start, wenn noch keine Einträge da sind (Gründungsjahr der Schule). */
export const FALLBACK_START_YEAR = 1971;

/** Bis hierhin reicht die Achse mindestens — der Zeitstrahl endet nie „heute". */
export const DOMAIN_MIN_END_YEAR = 2027;

/**
 * Der sichtbare Gesamtbereich: vom Jahresanfang des ältesten Eintrags bis
 * mindestens {@link DOMAIN_MIN_END_YEAR}.
 *
 * Früher lag hier links ein volles Jahr Luft, damit die erste Karte nicht am
 * Rand klebt. Diese Aufgabe hat jetzt {@link edgePadding} — ein Rand in PIXELN,
 * abgeleitet aus den Kartenmaßen. Das ist ehrlicher: Ein Jahr Luft ist
 * herausgezoomt zu wenig und hineingezoomt viel zu viel.
 *
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

  const hasEntries = Number.isFinite(min);
  const start = hasEntries ? Math.floor(min) : FALLBACK_START_YEAR;
  const end = Math.max(
    DOMAIN_MIN_END_YEAR,
    now + 0.5,
    hasEntries ? max + 0.5 : -Infinity
  );

  // Mindestens ein Jahr Spanne, damit die Skala nie entartet.
  const safeStart = Math.min(start, end - 1);
  return {
    start: safeStart,
    end,
    firstEntry: hasEntries ? min : safeStart,
    lastEntry: hasEntries ? max : end,
  };
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

/**
 * Wie weit darf der Plan beim HERAUSzoomen veralten, bevor er nachgezogen
 * werden MUSS? Zwei Rasterstufen (≈ 26 %).
 *
 * Hintergrund: Der Plan wird nur gefasst, wenn die Geste steht (siehe
 * `Timeline.tsx`) — sonst würde mitten im Zoomen umsortiert, und genau das
 * sieht man als Ruck. Beim Hineinzoomen ist ein alter Plan harmlos: Die
 * Elemente rücken nur weiter auseinander, es kann nichts kollidieren. Beim
 * Herauszoomen ist es umgekehrt — die für mehr Platz gefassten Pillen rücken
 * zusammen und würden sich irgendwann überlappen. Deshalb diese Reißleine.
 */
export const PLAN_SHRINK_TOLERANCE = Math.pow(2, 2 / LAYOUT_ZOOM_STEPS);

/* ========================================================================== */
/*  Maße (CSS-Pixel)                                                          */
/* ========================================================================== */

/** Volle Breite einer Pille: Punkt + Titel + Jahreszahl. */
export const ENTRY_WIDTH = 178;
/** Abstand vom linken Kartenrand bis zur Mitte des Farbpunkts (= Ankerpunkt). */
export const ENTRY_ANCHOR = 11;
/** Mindestabstand zwischen zwei Pillen derselben Spur. */
export const ENTRY_GAP = 10;
/** Höhe einer Marker-Spur inkl. Zwischenraum. */
export const ENTRY_LANE_HEIGHT = 34;

/**
 * Breitenleiter der Pillen, breiteste zuerst.
 *
 * Wird pro Eintrag von oben nach unten durchprobiert: Passt die volle Pille
 * nirgends mehr, rückt sie zusammen (erst fällt die Jahreszahl weg, dann wird
 * der Titel kürzer beschnitten) — und erst wenn AUCH die schmalste Breite in
 * keiner Spur mehr Platz findet, wandert der Eintrag in ein „+N"-Cluster.
 * Ein sichtbarer, knapper Titel ist mehr wert als ein anonymes Badge.
 */
export const MARKER_WIDTHS: readonly number[] = [ENTRY_WIDTH, 146, 118, 96];

/** Ab dieser Breite trägt die Pille noch ihre Jahreszahl. */
export function markerShowsYear(width: number): boolean {
  return width >= ENTRY_WIDTH;
}

/**
 * Maße des „+N"-Badges — bewusst klein und unaufdringlich: Es ist ein Hinweis
 * („hier steckt noch mehr"), keine eigene Station auf dem Zeitstrahl.
 */
export const CLUSTER_WIDTH = 36;
export const CLUSTER_HEIGHT = 22;
export const CLUSTER_GAP = 8;

/** Luft zwischen Achse und erster Marker-Spur OBERHALB (Platz für die Stiele). */
export const AXIS_MARKER_GAP = 14;
/** Dasselbe UNTERHALB — hier steht zuerst die Achsenbeschriftung. */
export const AXIS_LABEL_BAND = 32;
/** Luft zwischen zwei Bändern (Marker → Wichtig → Meilenstein). */
export const MILESTONE_BAND_GAP = 10;
/** Vertikaler Abstand zwischen zwei Karten-Spuren. */
export const MILESTONE_LANE_GAP = 12;
/** Horizontaler Mindestabstand zweier Meilenstein-Karten. */
export const MILESTONE_GAP = 14;
/** Horizontaler Mindestabstand zweier Wichtig-Karten. */
export const IMPORTANT_GAP = 12;

/* ========================================================================== */
/*  Seiten & Bänder                                                           */
/* ========================================================================== */

/** Ober- oder unterhalb der Achse. */
export type Side = "above" | "below";

export type MilestoneVariant = "full" | "compact" | "pill";
export type ImportantVariant = "card" | "slim";

export interface MilestoneLayout {
  variant: MilestoneVariant;
  width: number;
  height: number;
  /** Bildhöhe innerhalb der Karte (0 = ohne Bildfläche). */
  imageHeight: number;
}

export interface ImportantLayout {
  variant: ImportantVariant;
  width: number;
  /** Höhe der Karte MIT Bild. */
  height: number;
  imageHeight: number;
  /** Höhe der bildlosen Variante (nur Titel + Datum). */
  textHeight: number;
  /** Zeilen, die der Titel bekommt — die Höhen unten sind darauf gerechnet. */
  titleLines: 1 | 2;
}

/** Das gemeinsame Band der beiden Kartenarten. */
export interface CardBand {
  /** Karten-Spuren JE SEITE (0 = auf diesem Schirm passt keine Karte). */
  lanes: number;
  /** Höhe einer Karten-Spur = Höhe der größten vorkommenden Karte. */
  height: number;
  milestone: MilestoneLayout;
  important: ImportantLayout;
  /**
   * Dürfen wichtige Einträge hier eine Karte bekommen? Falsch, sobald selbst
   * die Meilensteine nur noch als Pillenband dargestellt werden können — dann
   * bliebe für eine Stufe darunter ohnehin nichts übrig.
   */
  importantCards: boolean;
}

/** Abstände einer Seite, gemessen von der Achse bis zur achsnahen Kante. */
export interface SideBands {
  entryLanes: number;
  markerOffset: number;
  clusterOffset: number;
  cardOffset: number;
}

export interface TimelineBands {
  above: SideBands;
  below: SideBands;
  card: CardBand;
}

const MILESTONE_SIZES: Record<
  MilestoneVariant,
  { width: number; height: number; imageHeight: number }
> = {
  full: { width: 260, height: 178, imageHeight: 96 },
  compact: { width: 224, height: 134, imageHeight: 64 },
  pill: { width: 192, height: 40, imageHeight: 0 },
};

/*
 * Die Höhen sind ausgerechnet, nicht geschätzt: Innenabstand + Titelzeilen
 * (12,5 px / leading-snug ≈ 17,2 px) + Zwischenraum + Meta-Zeile (≈ 15 px) +
 * Innenabstand. Deshalb passt der Text in jeder Variante ohne Abschneiden.
 */
const IMPORTANT_SIZES: Record<
  ImportantVariant,
  {
    width: number;
    height: number;
    imageHeight: number;
    textHeight: number;
    titleLines: 1 | 2;
  }
> = {
  card: { width: 196, height: 126, imageHeight: 58, textHeight: 70, titleLines: 2 },
  slim: { width: 172, height: 94, imageHeight: 44, textHeight: 54, titleLines: 1 },
};

/**
 * Eine Wichtig-Karte darf nie so groß wirken wie eine Meilenstein-Karte —
 * sonst geht die Rangfolge verloren. Deshalb hängt ihre Größe an der gerade
 * gewählten Meilenstein-Variante. Sind die Meilensteine schon auf Pillen
 * heruntergestuft, bekommen die wichtigen Einträge erst recht keine Karte.
 */
const IMPORTANT_FOR_MILESTONE: Record<MilestoneVariant, ImportantVariant | null> =
  {
    full: "card",
    compact: "slim",
    pill: null,
  };

/** Größte Karte, die überhaupt vorkommen kann — Grundlage des Randmaßes. */
export const MAX_CARD_WIDTH = MILESTONE_SIZES.full.width;

/** Mehr als so viele Pillen-Spuren je Seite werden nie gestapelt. */
export const MAX_MARKER_LANES = 5;

/* ========================================================================== */
/*  Rand des Zeichenbereichs                                                  */
/* ========================================================================== */

/**
 * Breite des weichen Papierrandes am Bildschirmrand (`w-6` / `sm:w-10`). Der
 * Verlauf ist außen deckend — eine Karte, die genau dort beginnt, wirkt
 * angeschnitten. Deshalb wird ein Teil davon in den Rand eingerechnet.
 */
export const EDGE_FADE = 14;

/**
 * Anteil der Bildbreite, den die beiden Ränder zusammen höchstens fressen
 * dürfen. Auf einem schmalen Telefon ist ein voller Kartenrand schlicht nicht
 * bezahlbar; dort wird proportional gekürzt.
 */
const EDGE_PADDING_MAX_SHARE = 0.36;

/**
 * Luft links und rechts des Zeichenbereichs, damit die äußersten Elemente
 * VOLLSTÄNDIG im Bild stehen — hergeleitet aus den Kartenmaßen, nicht geraten:
 *
 *   links   Eine Meilenstein-Karte sitzt mittig über ihrem Datum, braucht also
 *           die halbe Kartenbreite; eine Pille nur ihren Ankerabstand.
 *   rechts  Umgekehrt ist die Pille der Engpass: Ihr Anker sitzt ganz links,
 *           der Rest der Pille steht rechts davon.
 *
 * Dazu je ein Stück des weichen Papierrandes. Das Ergebnis ist ein Maß in
 * Bildschirm-Pixeln — es gilt bei jeder Zoomstufe gleich, weil es an der
 * Kartengröße hängt und nicht an der Zeitspanne.
 */
export function edgePadding(viewportWidth: number): {
  left: number;
  right: number;
} {
  const left = Math.max(MAX_CARD_WIDTH / 2, ENTRY_ANCHOR) + EDGE_FADE;
  const right = Math.max(MAX_CARD_WIDTH / 2, ENTRY_WIDTH - ENTRY_ANCHOR) + EDGE_FADE;
  const total = left + right;
  const budget = Math.max(viewportWidth, 0) * EDGE_PADDING_MAX_SHARE;
  if (total <= budget) return { left, right };
  const factor = total > 0 ? budget / total : 0;
  return { left: left * factor, right: right * factor };
}

/* ========================================================================== */
/*  Panning-Grenzen (zoomabhängig)                                            */
/* ========================================================================== */

export interface PanContext {
  /** Breite des Welt-Raums = Breite der Zeichenfläche bei k = 1. */
  worldWidth: number;
  /** Welt-Pixel des ältesten bzw. jüngsten Eintrags. */
  firstX: number;
  lastX: number;
  /** Luft, die neben dem äußersten Eintrag im Bild bleibt (BILDSCHIRM-Pixel). */
  padLeft: number;
  padRight: number;
}

/**
 * Erlaubter Ausschnitt im Welt-Raum (k = 1) für einen gegebenen Zoomfaktor.
 *
 * Die Achse selbst läuft immer über den vollen Bereich [0, worldWidth] — sie
 * darf ruhig bis 2027 weiterlaufen, das ist der sichtbare Platz für das, was
 * noch kommt. Beim SCHIEBEN ist dieser Vorlauf herausgezoomt willkommen und
 * hineingezoomt lästig: Bei zwanzigfacher Vergrößerung sind aus einem halben
 * Jahr Leerraum plötzlich mehrere Bildschirmbreiten geworden.
 *
 * Die Rechnung dreht das um. Der Zuschlag neben dem äußersten Eintrag ist als
 * BILDSCHIRM-Maß gedacht (`padLeft`/`padRight` — genau der Rand, den die
 * äußerste Karte braucht). In Weltkoordinaten ist das `pad / k`:
 *
 *     min(k) = firstX − padLeft  / k
 *     max(k) = lastX  + padRight / k
 *
 *   · k = 1   → der Zuschlag ist so groß wie der halbe Kartenrand in Pixeln;
 *               zusammen mit der Aufweitung unten ergibt das den vollen,
 *               großzügigen Bereich [0, worldWidth]. Nichts ändert sich.
 *   · k → max → der Zuschlag schrumpft gegen null; das Ende rückt bis auf
 *               „letzter Eintrag + seine Karte" an den letzten Eintrag heran.
 *
 * Zwei Sicherungen: Der Bereich verlässt nie den Welt-Raum, und er ist nie
 * schmaler als das Sichtfenster (`worldWidth / k`) — sonst hätte d3 nichts,
 * worin es den Ausschnitt halten könnte, und würde ihn zentrieren.
 */
export function panLimits(
  ctx: PanContext,
  k: number
): { min: number; max: number } {
  const world = Math.max(ctx.worldWidth, 1);
  const scale = Math.max(k, 1);

  let lo = Math.min(Math.max(ctx.firstX - ctx.padLeft / scale, 0), world);
  let hi = Math.max(Math.min(ctx.lastX + ctx.padRight / scale, world), 0);
  if (hi < lo) {
    const middle = (lo + hi) / 2;
    lo = middle;
    hi = middle;
  }

  // Das Sichtfenster muss hineinpassen, sonst gibt es nichts zu begrenzen.
  const needed = world / scale;
  if (hi - lo < needed) {
    const center = (lo + hi) / 2;
    lo = center - needed / 2;
    hi = center + needed / 2;
    if (lo < 0) {
      hi = Math.min(world, hi - lo);
      lo = 0;
    }
    if (hi > world) {
      lo = Math.max(0, lo - (hi - world));
      hi = world;
    }
  }

  return { min: lo, max: hi };
}

/* ========================================================================== */
/*  Bänder wählen                                                             */
/* ========================================================================== */

/** Welche Bänder überhaupt gebraucht werden (aus dem Datenbestand). */
export interface BandNeeds {
  milestones: boolean;
  important: boolean;
}

/** Pillen-Spuren, die vor dem Kartenband gesichert werden. */
const PRE_CARD_LANES = 3;

/**
 * Verteilt die verfügbare Höhe — in der Reihenfolge, in der jeder weitere
 * Pixel den größten Gewinn bringt:
 *
 *   0. Pflicht:  eine Pillen-Spur + die Spur für die „+N"-Badges       68 px
 *   1. zweite und dritte Pillen-Spur                                   +34 je
 *   2. Kartenband, größte Variante, die passt (full → compact → pill)  +188/144/50
 *   3. zweite Karten-Spur                                              +Kartenhöhe +12
 *   4. vierte und fünfte Pillen-Spur                                   +34 je
 *
 * Warum die ersten drei Pillen-Spuren VOR dem Kartenband kommen: Eine große
 * Karte kostet so viel Höhe wie fünf Pillen-Spuren. Bekäme sie den Vortritt,
 * stünde auf einem mittelhohen Schirm eine schöne Karte über einem Feld aus
 * „+N"-Badges — und genau die sollen verschwinden. Umgekehrt gilt aber auch:
 * Ein Zeitstrahl ganz ohne Bildkarten verliert sein Gesicht. Deshalb wird die
 * Rechnung zweimal geführt (drei bzw. zwei gesicherte Spuren) und die Variante
 * mit den ECHTEN Karten genommen, falls die großzügigere Reservierung nur noch
 * ein Pillenband übrig ließe.
 *
 * Die KARTENGRÖSSE richtet sich nach der knapperen Seite, damit das Bild
 * symmetrisch bleibt. Die PILLEN-SPUREN werden zusätzlich je Seite gezählt:
 * Unterhalb der Achse geht zuerst die Beschriftung ab, oberhalb ist dadurch
 * oft eine Spur mehr drin — und die wird auch genommen.
 *
 * Bänder, für die es gar keine Einträge gibt, werden übersprungen; ihre Höhe
 * kommt den Pillen-Spuren zugute.
 */
export function chooseBands(
  aboveHeight: number,
  belowHeight: number,
  needs: BandNeeds = { milestones: true, important: true }
): TimelineBands {
  const usableAbove = Math.max(aboveHeight - AXIS_MARKER_GAP, 0);
  const usableBelow = Math.max(belowHeight - AXIS_LABEL_BAND, 0);
  const shared = Math.min(usableAbove, usableBelow);

  const build = (preLanes: number): TimelineBands => {
    /** Fest verplante Höhe; alles darüber wird je Seite in Pillen umgesetzt. */
    let spent = 2 * ENTRY_LANE_HEIGHT; // 1 Pillen-Spur + 1 Cluster-Spur
    /** Pillen-Spuren, die BEIDE Seiten sicher bekommen. */
    let guaranteed = 1;

    const takeLane = (): void => {
      if (guaranteed >= MAX_MARKER_LANES) return;
      if (spent + ENTRY_LANE_HEIGHT > shared) return;
      guaranteed += 1;
      spent += ENTRY_LANE_HEIGHT;
    };

    // ---- 1. Pillen-Spuren bis `preLanes` ---------------------------------
    while (guaranteed < preLanes) {
      const before = guaranteed;
      takeLane();
      if (guaranteed === before) break; // passt nicht mehr
    }

    // ---- 2. Kartenband ----------------------------------------------------
    let milestoneVariant: MilestoneVariant = "pill";
    let importantVariant: ImportantVariant = "slim";
    let importantCards = false;
    let cardLanes = 0;
    let cardHeight = 0;

    if (needs.milestones) {
      for (const candidate of ["full", "compact", "pill"] as const) {
        const height = MILESTONE_SIZES[candidate].height;
        if (spent + MILESTONE_BAND_GAP + height <= shared) {
          milestoneVariant = candidate;
          cardLanes = 1;
          cardHeight = height;
          spent += MILESTONE_BAND_GAP + height;
          const coupled = IMPORTANT_FOR_MILESTONE[candidate];
          if (coupled && needs.important) {
            importantVariant = coupled;
            importantCards = true;
          }
          break;
        }
      }
    } else if (needs.important) {
      // Ohne Meilensteine im Bestand tragen die wichtigen Einträge das Band
      // allein — und dürfen dann auch die volle Kartengröße haben.
      for (const candidate of ["card", "slim"] as const) {
        const height = IMPORTANT_SIZES[candidate].height;
        if (spent + MILESTONE_BAND_GAP + height <= shared) {
          importantVariant = candidate;
          importantCards = true;
          cardLanes = 1;
          cardHeight = height;
          spent += MILESTONE_BAND_GAP + height;
          break;
        }
      }
    }

    // ---- 3. zweite Karten-Spur -------------------------------------------
    if (cardLanes === 1 && spent + cardHeight + MILESTONE_LANE_GAP <= shared) {
      cardLanes = 2;
      spent += cardHeight + MILESTONE_LANE_GAP;
    }

    // ---- 4. restliche Pillen-Spuren ---------------------------------------
    takeLane();
    takeLane();

    const card: CardBand = {
      lanes: cardLanes,
      height: cardHeight,
      milestone: {
        ...MILESTONE_SIZES[milestoneVariant],
        variant: milestoneVariant,
      },
      important: {
        ...IMPORTANT_SIZES[importantVariant],
        variant: importantVariant,
      },
      importantCards: importantCards && cardLanes > 0,
    };

    /** Was auf DIESER Seite über das Gesicherte hinaus noch hineinpasst. */
    const lanesFor = (usable: number): number =>
      Math.min(
        MAX_MARKER_LANES,
        guaranteed +
          Math.max(0, Math.floor((usable - spent) / ENTRY_LANE_HEIGHT))
      );

    const band = (offset: number, lanes: number): SideBands => {
      const clusterOffset = offset + lanes * ENTRY_LANE_HEIGHT;
      return {
        entryLanes: lanes,
        markerOffset: offset,
        clusterOffset,
        cardOffset: clusterOffset + ENTRY_LANE_HEIGHT + MILESTONE_BAND_GAP,
      };
    };

    return {
      above: band(AXIS_MARKER_GAP, lanesFor(usableAbove)),
      below: band(AXIS_LABEL_BAND, lanesFor(usableBelow)),
      card,
    };
  };

  /** Echte Bildkarte — ein Meilenstein-Pillenband zählt nicht als solche. */
  const hasRealCard = (bands: TimelineBands): boolean =>
    bands.card.lanes > 0 && bands.card.milestone.variant !== "pill";

  const spacious = build(PRE_CARD_LANES);
  if (hasRealCard(spacious) || !needs.milestones) return spacious;

  const withCards = build(PRE_CARD_LANES - 1);
  return hasRealCard(withCards) ? withCards : spacious;
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

/** Entscheidung: Seite, Spur und gewählte Breite. Noch ohne endgültige Pixel. */
export interface SideAssignment<T> extends Anchored<T> {
  side: Side;
  lane: number;
  /** Gewählte Breite aus der Breitenleiter. */
  width: number;
}

/** Fertig positioniertes Element im Content-Raum. */
export interface LanePlacement<T> {
  item: T;
  /** Ankerpunkt auf der Achse (Content-Pixel). */
  x: number;
  /** Linke Kante des Elements (Content-Pixel, an die Ränder geklemmt). */
  left: number;
  /** Breite, mit der geplant wurde. */
  width: number;
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

/** Eine Rang-Stufe der Belegung: gleiche Art Element, gleiche Breitenleiter. */
export interface PackTier<T> {
  items: ReadonlyArray<Anchored<T>>;
  /** Breiten-Kandidaten, breiteste zuerst (mindestens eine). */
  widths: readonly number[];
  /** Mindestabstand zum nächsten Element derselben Spur. */
  gap: number;
}

interface SidePackConfig {
  /** Abstand linke Kante -> Ankerpunkt; `"center"` = mittig über dem Datum. */
  anchor: number | "center";
  /** Spuren je Seite — oben und unten dürfen sich unterscheiden. */
  lanes: Record<Side, number>;
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
 * Belegte Bereiche einer Spur, nach `start` sortiert. Ein Intervall statt nur
 * "rechte Kante": Spätere Ränge dürfen in LÜCKEN rutschen, die frühere Ränge
 * gelassen haben — sonst könnte ein bevorzugter Eintrag eine ganze Spur
 * blockieren, obwohl links davon noch alles frei ist.
 */
type LaneOccupancy = { start: number; end: number }[];

/** Index der ersten Belegung, die bei/nach `start` beginnt. */
function lowerBound(lane: LaneOccupancy, start: number): number {
  let lo = 0;
  let hi = lane.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (lane[mid].start < start) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function laneFits(lane: LaneOccupancy, start: number, end: number): boolean {
  const index = lowerBound(lane, start);
  const before = lane[index - 1];
  if (before && before.end > start) return false;
  const after = lane[index];
  if (after && after.start < end) return false;
  return true;
}

function laneOccupy(lane: LaneOccupancy, start: number, end: number): void {
  lane.splice(lowerBound(lane, start), 0, { start, end });
}

/**
 * Greedy-Belegung über BEIDE Seiten der Achse, in Rang-Stufen.
 *
 * `tiers` enthält die Elemente nach Priorität — die erste Stufe darf sich die
 * Spuren zuerst nehmen, spätere Stufen füllen die Lücken. Innerhalb einer Stufe
 * wird von links nach rechts gegangen. Für jedes Element wird die BREITESTE
 * Variante gesucht, die überhaupt noch irgendwo passt; erst wenn keine passt,
 * kommt es in den Overflow (und damit später in ein Cluster-Badge).
 *
 * Gewonnen hat
 *   1. die kleinere Spurnummer  -> achsnah wird zuerst gefüllt,
 *   2. bei Gleichstand die Seite mit weniger Elementen -> das Bild bleibt
 *      ausgewogen, statt eine Seite vollzustopfen,
 *   3. bei Gleichstand `cfg.prefer` -> deterministisch.
 */
export function packSides<T>(
  tiers: ReadonlyArray<PackTier<T>>,
  cfg: SidePackConfig
): { placed: SideAssignment<T>[]; overflow: Anchored<T>[] } {
  const placed: SideAssignment<T>[] = [];
  const overflow: Anchored<T>[] = [];

  const occupancy: Record<Side, LaneOccupancy[]> = {
    above: Array.from({ length: Math.max(cfg.lanes.above, 0) }, () => []),
    below: Array.from({ length: Math.max(cfg.lanes.below, 0) }, () => []),
  };
  const used: Record<Side, number> = { above: 0, below: 0 };
  const order: Side[] =
    cfg.prefer === "above" ? ["above", "below"] : ["below", "above"];

  for (const tier of tiers) {
    for (const entry of tier.items) {
      let assigned = false;

      for (const width of tier.widths) {
        const anchor = cfg.anchor === "center" ? width / 2 : cfg.anchor;
        const max = Math.max(0, cfg.contentWidth - width);
        const reserve = edgeReserve(width, anchor);
        const lo = Math.min(reserve, max);
        const hi = Math.max(lo, max - reserve);
        const left = Math.min(Math.max(entry.lx - anchor, lo), hi);
        const end = left + width + tier.gap;

        let bestSide: Side | null = null;
        let bestLane = Number.POSITIVE_INFINITY;

        for (const side of order) {
          const lanes = occupancy[side];
          for (let lane = 0; lane < lanes.length; lane++) {
            if (!laneFits(lanes[lane], left, end)) continue;
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

        if (bestSide === null) continue; // schmaler versuchen

        laneOccupy(occupancy[bestSide][bestLane], left, end);
        used[bestSide] += 1;
        placed.push({ ...entry, side: bestSide, lane: bestLane, width });
        assigned = true;
        break;
      }

      if (!assigned) overflow.push(entry);
    }
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
  important: SideAssignment<Entry>[];
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

/** Rang eines Eintrags. `is_milestone` und `is_important` schließen sich aus. */
export function entryRank(entry: Entry): "milestone" | "important" | "normal" {
  if (entry.is_milestone) return "milestone";
  if (entry.is_important) return "important";
  return "normal";
}

/**
 * Verteilt ALLE Einträge auf Seiten und Spuren (nicht nur die sichtbaren) —
 * sonst würden Spurzuordnung und Cluster beim Pannen springen.
 *
 * Ablauf:
 *   1. KARTENBAND. Beide Kartenarten teilen sich die Spuren, aber nicht
 *      gleichberechtigt: Meilensteine greifen als erste Stufe zu, wichtige
 *      Einträge füllen anschließend die Lücken.
 *   2. PILLEN-SPUREN. Was im Kartenband keinen Platz fand, wird zur Pille — und
 *      zwar VOR den normalen Einträgen: erst verdrängte Meilensteine, dann
 *      verdrängte wichtige Einträge, zuletzt die normalen.
 *   3. Was auch dort nicht mehr passt, wird zu einem „+N"-Badge.
 *
 * Daraus ergibt sich die geforderte Rangfolge des Herunterstufens von selbst:
 * Wird der Platz knapp, verliert IMMER zuerst ein normaler Eintrag seine Pille,
 * dann ein wichtiger, und ein Meilenstein zuallerletzt.
 *
 * Zur Cluster-Spur: Sie ist nur nötig, wenn es überhaupt Overflow gibt. Deshalb
 * wird zuerst großzügig gepackt (Pillen dürfen die Cluster-Spur mitbenutzen) —
 * und nur wenn dabei etwas übrig bleibt, ein zweites Mal mit freigehaltener
 * Cluster-Spur.
 */
export function planTimeline(
  entries: ReadonlyArray<Entry>,
  opts: PlanOptions
): TimelinePlan {
  const anchored: Anchored<Entry>[] = entries
    .map((entry) => ({
      item: entry,
      lx: opts.toLayoutX(entryYearFraction(entry)),
    }))
    .sort((a, b) => a.lx - b.lx || a.item.id.localeCompare(b.item.id));

  const milestoneItems = anchored.filter(
    (a) => entryRank(a.item) === "milestone"
  );
  const importantItems = anchored.filter(
    (a) => entryRank(a.item) === "important"
  );
  const normalItems = anchored.filter((a) => entryRank(a.item) === "normal");

  const bands = chooseBands(opts.aboveHeight, opts.belowHeight, {
    milestones: milestoneItems.length > 0,
    important: importantItems.length > 0,
  });
  const { card } = bands;

  /* ---- 1. Kartenband: Meilensteine zuerst, wichtige Einträge danach ----- */
  const cardPack = packSides(
    [
      {
        items: milestoneItems,
        widths: [card.milestone.width],
        gap: MILESTONE_GAP,
      },
      {
        items: card.importantCards ? importantItems : [],
        widths: [card.important.width],
        gap: IMPORTANT_GAP,
      },
    ],
    {
      anchor: "center",
      lanes: { above: card.lanes, below: card.lanes },
      prefer: "below",
      contentWidth: opts.layoutContentWidth,
    }
  );

  const isMilestone = (a: Anchored<Entry>) => a.item.is_milestone;
  const milestoneCards = cardPack.placed.filter(isMilestone);
  const importantCards = cardPack.placed.filter((a) => !isMilestone(a));
  const milestoneRest = cardPack.overflow.filter(isMilestone);
  const importantRest = card.importantCards
    ? cardPack.overflow.filter((a) => !isMilestone(a))
    : importantItems;

  /* ---- 2. Pillen-Spuren, nach Rang gestaffelt --------------------------- */
  const tiers: PackTier<Entry>[] = [
    { items: milestoneRest, widths: MARKER_WIDTHS, gap: ENTRY_GAP },
    { items: importantRest, widths: MARKER_WIDTHS, gap: ENTRY_GAP },
    { items: normalItems, widths: MARKER_WIDTHS, gap: ENTRY_GAP },
  ];
  const markerConfig = (bonusLanes: number) => ({
    anchor: ENTRY_ANCHOR,
    lanes: {
      above: bands.above.entryLanes + bonusLanes,
      below: bands.below.entryLanes + bonusLanes,
    },
    prefer: "above" as Side,
    contentWidth: opts.layoutContentWidth,
  });

  // Erst großzügig: Solange kein Badge nötig ist, darf die für Badges
  // reservierte Spur als ganz normale Pillen-Spur mitlaufen.
  let markerPack = packSides(tiers, markerConfig(1));
  if (markerPack.overflow.length > 0) {
    markerPack = packSides(tiers, markerConfig(0));
  }

  return {
    markers: markerPack.placed,
    important: importantCards,
    milestones: milestoneCards,
    clusters: planClusters(markerPack.overflow, "above"),
    bands,
    layoutScale: opts.layoutScale,
  };
}

/* ========================================================================== */
/*  Zielzoom für den Kameraflug                                               */
/* ========================================================================== */

/**
 * So viele Rasterstufen weit darf nach oben gesucht werden — 30 Stufen sind
 * gut das Zweiunddreißigfache. Das reicht vom Gesamtbild bis in einen einzelnen
 * Monat und kostet im schlimmsten Fall dreißig Planungen; die fallen einmal
 * pro Klick an, nicht pro Bild.
 */
const SOLO_STEPS = 30;

/**
 * Kleinster Zoomfaktor ab `from`, bei dem die genannten Einträge als EIGENE
 * Karte oder Pille dastehen — also nicht mehr in einem „+N" stecken.
 *
 * Warum das nötig ist: Ein fester Zielzoom („acht Jahre zeigen") trifft mal zu
 * weit, mal zu nah. In einem dichten Jahrgang steckt der Eintrag danach immer
 * noch in einem Bündel, und der Kameraflug hätte sein Versprechen gebrochen —
 * man sollte ja SEHEN, wo genau er liegt. Deshalb wird hier nicht gerechnet,
 * sondern probiert: Der Plan wird stufenweise weiter hineingezoomt neu gefasst,
 * bis die Einträge frei stehen.
 *
 * Drei Ausgänge:
 *   · Alle frei      → der SPARSAMSTE Zoom, bei dem das gilt. Gerade so nah
 *                      wie nötig, damit der Kontext ringsum erhalten bleibt.
 *   · Nur mehr frei  → der sparsamste Zoom mit der größten Ausbeute. Ein
 *                      Bündel darf sich auch in zwei Schritten öffnen.
 *   · `null`         → Zoomen hilft nicht. Tragen mehrere Einträge dasselbe
 *                      Datum, liegen sie auf demselben Punkt der Achse; kein
 *                      Zoom der Welt trennt sie. Dann ist die Liste die
 *                      ehrliche Antwort, nicht noch mehr Vergrößerung.
 */
export function scaleThatFrees(
  entries: ReadonlyArray<Entry>,
  ids: ReadonlyArray<string>,
  from: number,
  max: number,
  optionsFor: (scale: number) => PlanOptions
): number | null {
  const wanted = new Set(ids);
  const freeCount = (scale: number): number => {
    const plan = planTimeline(entries, optionsFor(scale));
    let count = 0;
    for (const group of [plan.markers, plan.important, plan.milestones]) {
      for (const placed of group) if (wanted.has(placed.item.id)) count++;
    }
    return count;
  };

  let bestScale: number | null = null;
  let bestCount = -1;

  for (let step = 0; step <= SOLO_STEPS; step++) {
    const scale = Math.min(from * Math.pow(2, step / LAYOUT_ZOOM_STEPS), max);
    const count = freeCount(scale);
    if (count === wanted.size) return scale;
    if (count > bestCount) {
      bestCount = count;
      bestScale = scale;
    }
    if (scale >= max) break;
  }

  // Nichts gewonnen: Schon bei `from` standen genauso viele frei wie überall
  // sonst — dann bringt Hineinzoomen nur Leere.
  return bestScale !== null && bestScale > from ? bestScale : null;
}

/* ========================================================================== */
/*  Positionen (stufenloses k)                                                */
/* ========================================================================== */

export interface TimelineLayout {
  /** Pillen (normale Einträge + heruntergestufte Ränge). */
  markers: LanePlacement<Entry>[];
  /** Mittelgroße Karten für wichtige Einträge. */
  important: LanePlacement<Entry>[];
  /** Große Meilenstein-Karten. */
  milestones: LanePlacement<Entry>[];
  /** „+N"-Badges. */
  clusters: EntryCluster[];
  bands: TimelineBands;
  /** Maße der großen Karte. */
  milestone: MilestoneLayout;
  /** Maße der mittleren Karte. */
  importantLayout: ImportantLayout;
}

export interface PositionOptions {
  /** Bruchteil-Jahr → Content-Pixel beim ECHTEN Zoom. */
  toX: (yearFraction: number) => number;
  contentWidth: number;
  /** Der echte Zoomfaktor. */
  scale: number;
}

type BandKind = "marker" | "card";

function offsetFor(
  bands: TimelineBands,
  side: Side,
  kind: BandKind,
  lane: number
): number {
  const band = bands[side];
  if (kind === "marker") {
    return band.markerOffset + lane * ENTRY_LANE_HEIGHT;
  }
  // Beide Kartenarten teilen sich das Band; die Spurhöhe richtet sich nach der
  // größeren von beiden, die kleinere lässt nach außen einfach mehr Luft.
  return band.cardOffset + lane * (bands.card.height + MILESTONE_LANE_GAP);
}

function positionAll(
  items: ReadonlyArray<SideAssignment<Entry>>,
  kind: BandKind,
  anchorMode: number | "center",
  opts: PositionOptions,
  bands: TimelineBands
): LanePlacement<Entry>[] {
  const placed = items.map((assignment) => {
    const width = assignment.width;
    const anchor = anchorMode === "center" ? width / 2 : anchorMode;
    const x = opts.toX(entryYearFraction(assignment.item));
    return {
      item: assignment.item,
      x,
      left: clampLeft(x - anchor, width, opts.contentWidth),
      width,
      side: assignment.side,
      lane: assignment.lane,
      offset: offsetFor(bands, assignment.side, kind, assignment.lane),
    };
  });
  /*
   * Von links nach rechts sortiert verlassen die Listen diese Funktion — der
   * Plan liefert sie nach Rang gestaffelt, also durcheinander. Das kostet hier
   * fast nichts und schenkt zwei Dinge: Die Zeichenfläche kann den sichtbaren
   * Ausschnitt per Binärsuche greifen ({@link sliceVisible}), statt jedes Mal
   * alles durchzugehen, und der gestaffelte Eingang läuft in Leserichtung
   * durchs Bild statt in der Reihenfolge der Ränge.
   */
  return placed.sort((a, b) => a.left - b.left);
}

/**
 * Rechnet einen Plan in echte Pixel um. Nur diese Funktion läuft bei jedem
 * Zoom-Frame — sie sortiert und entscheidet nichts, sie misst nur.
 *
 * Der Plan stammt von einer anderen Zoomstufe (`layoutScale`), deshalb werden
 * die Cluster-Fächer mit `ratio` mitskaliert — so bleibt jedes Badge über
 * seiner Gruppe stehen, auch wenn der Plan gerade eine Weile älter ist als das
 * Bild (während einer Geste ist er das absichtlich, siehe
 * {@link PLAN_SHRINK_TOLERANCE}). Wird das Fach dabei schmaler als das Badge,
 * setzt sich das Badge mittig hinein, statt aus dem Fach zu rutschen.
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
    const lowest = slotStart + margin;
    const highest = slotStart + slotWidth - CLUSTER_WIDTH - margin;
    const left = clampLeft(
      highest > lowest
        ? Math.min(Math.max(wanted, lowest), highest)
        : (lowest + highest) / 2,
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
    markers: positionAll(plan.markers, "marker", ENTRY_ANCHOR, opts, bands),
    important: positionAll(plan.important, "card", "center", opts, bands),
    milestones: positionAll(plan.milestones, "card", "center", opts, bands),
    clusters,
    bands,
    milestone: bands.card.milestone,
    importantLayout: bands.card.important,
  };
}

/* ========================================================================== */
/*  Sichtbarer Ausschnitt                                                     */
/* ========================================================================== */

/** Erster Index, dessen `left` mindestens `value` ist (Binärsuche). */
function firstFrom(
  items: ReadonlyArray<{ left: number }>,
  value: number
): number {
  let low = 0;
  let high = items.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (items[mid].left < value) low = mid + 1;
    else high = mid;
  }
  return low;
}

/**
 * Der Teil einer nach `left` sortierten Liste, der das Fenster [`from`, `to`]
 * berührt.
 *
 * Statt bei jedem Bild die ganze Liste zu filtern, werden nur die beiden
 * Ränder gesucht. Bei sechzehn Einträgen ist das Kosmetik — bei den paar
 * hundert, die in ein paar Schuljahren zusammenkommen, ist es der Unterschied
 * zwischen „läuft" und „hakt".
 *
 * `maxWidth` ist die größte vorkommende Elementbreite: Ein Element, das links
 * vor dem Fenster beginnt, kann noch hineinragen. Lieber ein paar Elemente zu
 * viel zeichnen als eines zu wenig — der Puffer des Fensters fängt das ohnehin.
 */
export function sliceVisible<T extends { left: number }>(
  items: ReadonlyArray<T>,
  from: number,
  to: number,
  maxWidth: number
): T[] {
  const start = firstFrom(items, from - maxWidth);
  const end = firstFrom(items, to + 1);
  return items.slice(start, end);
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
 *
 * Die Schwellen sind bewusst großzügiger als früher (Jahre ab 56 statt 46 px,
 * Monate ab 58 statt 40 px). Zwei Gründe, und beide zählen:
 *
 *   Lesbarkeit  „2021 2022 2023 2024 …" im 46-Pixel-Abstand ist eine Zahlenwand.
 *               Mit Luft dazwischen liest man die Achse, statt sie zu entziffern.
 *   Ruhe        Jeder Tick ist beim Zoomen ein Element, das in JEDEM Bild neu
 *               gesetzt werden muss. In der dichtesten Stufe waren das über
 *               160 Stück — mehr als alle Einträge zusammen. Weniger Ticks
 *               heißt hier ganz direkt: flüssigeres Zoomen.
 */
export function buildAxisTicks(
  pxPerYear: number,
  fromYear: number,
  toYear: number
): AxisTick[] {
  if (!Number.isFinite(pxPerYear) || pxPerYear <= 0) return [];
  if (!Number.isFinite(fromYear) || !Number.isFinite(toYear)) return [];

  const yearStep =
    pxPerYear >= 56 ? 1 : pxPerYear >= 16 ? 5 : pxPerYear >= 7 ? 10 : 20;
  const pxPerMonth = pxPerYear / 12;
  const monthStep = pxPerMonth >= 58 ? 1 : pxPerMonth >= 20 ? 3 : 0;
  const longMonthLabels = pxPerMonth >= 100;

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
