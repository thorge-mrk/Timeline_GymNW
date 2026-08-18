"use client";

import { memo, useState, type CSSProperties } from "react";
import { categoryById, categoryPillStyle } from "@/lib/categories";
import { formatEntryDate } from "@/lib/dates";
import type { Entry } from "@/lib/types";
import {
  ENTRY_ANCHOR,
  entryRank,
  markerShowsYear,
  type Side,
} from "@/lib/timelinePosition";

interface EntryMarkerProps {
  entry: Entry;
  /** Ankerpunkt auf der Achse (Content-Pixel). */
  x: number;
  /** Linke Kante der Karte (bereits an die Ränder geklemmt). */
  left: number;
  /** Gewählte Breite — schmaler, wenn es sonst eng würde. */
  width: number;
  /** Ober- oder unterhalb der Achse. */
  side: Side;
  /** Abstand Achse → achsnahe Kante der Karte. */
  offset: number;
  /** Höhe der Zeichenfläche und y-Position der Achse. */
  height: number;
  axisY: number;
  highlighted: boolean;
  /** Verzögerung des gestaffelten Eingangs in ms; `null` = kein Eingang. */
  enterDelay: number | null;
  onSelect: (entry: Entry) => void;
}

/** Kleiner Stern für Meilensteine — als Pfad statt „★", damit er überall gleich sitzt. */
function MilestoneStar() {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 10 10"
      fill="currentColor"
      aria-hidden="true"
      className="shrink-0 text-fox-deep"
    >
      <path d="M5 0l1.3 3.2L9.7 4 7.1 6.1l.8 3.4L5 7.7 2.1 9.5l.8-3.4L.3 4l3.4-.8z" />
    </svg>
  );
}

/**
 * Zeichen für einen heruntergestuften WICHTIGEN Eintrag: derselbe Farbpunkt wie
 * bei einem normalen Eintrag, aber mit einem feinen Fuchs-Ring darum. Bewusst
 * kein Stern — der gehört den Meilensteinen. Der Ring sagt „das hier ist mehr
 * als eine Notiz", ohne die Stufe darüber zu beanspruchen.
 */
function ImportantDot({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      className="relative flex h-[11px] w-[11px] shrink-0 items-center justify-center rounded-full border border-fox/70"
    >
      <span
        className="h-[5px] w-[5px] rounded-full"
        style={{ backgroundColor: color }}
      />
    </span>
  );
}

/**
 * Kompakter Marker für einen Eintrag — ein Stiel zur Achse plus eine schmale
 * Pille, die KOMPLETT in der Kategoriefarbe steht: helle Tint-Fläche, farbiger
 * Rahmen, dunkle Ink-Schrift. So ist die Einordnung schon aus zwei Metern
 * Entfernung erkennbar, ohne dass der Titel an Kontrast verliert.
 *
 * Die Pille ist NICHT immer gleich breit: Wo es eng wird, setzt das Layout sie
 * schmaler (siehe `MARKER_WIDTHS`). Als Erstes fällt dabei die Jahreszahl weg —
 * sie steht ohnehin an der Achse darunter —, danach wird der Titel früher
 * beschnitten. Lieber ein knapper Titel als ein anonymes „+N".
 *
 * Wer eine Stufe höher gehört, aber gerade keine Karte bekommen hat, läuft hier
 * ebenfalls mit — erkennbar am Zeichen ganz links: Stern für Meilensteine,
 * Punkt-Ring für wichtige Einträge. Beim Hineinzoomen wird wieder eine Karte
 * daraus.
 */
function EntryMarker({
  entry,
  x,
  left,
  width,
  side,
  offset,
  height,
  axisY,
  highlighted,
  enterDelay,
  onSelect,
}: EntryMarkerProps) {
  const category = categoryById(entry.category);
  const rank = entryRank(entry);
  const isMilestone = rank === "milestone";
  const isImportant = rank === "important";
  const showYear = markerShowsYear(width);

  /*
   * Der Eingang wird EINMAL beim Montieren festgelegt und danach abgeräumt:
   *   · `tl-enter-marker` — die gestaffelte Welle nach einem Filterwechsel
   *   · `tl-appear`       — der kurze Eingang für alles, was später dazukommt
   *   · nichts            — wer angeflogen wurde, pulst stattdessen
   *
   * Fest, weil ein späterer Klassenwechsel die Animation ein zweites Mal
   * starten würde; abgeräumt, weil sich zwei `animation`-Regeln auf demselben
   * Element gegenseitig verdrängen (der Puls käme sonst nicht durch).
   */
  const [enter, setEnter] = useState<{
    className: string;
    delay: number | null;
  }>(() => {
    if (highlighted) return { className: "", delay: null };
    if (enterDelay !== null) {
      return { className: "tl-enter-marker", delay: enterDelay };
    }
    return { className: "tl-appear", delay: null };
  });

  /** Achsnahe Kante: oben von unten gemessen, unten von oben. */
  const anchorEdge: CSSProperties =
    side === "above"
      ? { bottom: height - axisY + offset }
      : { top: axisY + offset };

  const stemEdge: CSSProperties =
    side === "above" ? { bottom: height - axisY } : { top: axisY };

  const rankLabel = isMilestone
    ? "Meilenstein: "
    : isImportant
      ? "Wichtig: "
      : "";

  return (
    <>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute w-px"
        style={{
          left: x,
          ...stemEdge,
          height: offset,
          background:
            side === "above"
              ? "linear-gradient(to top, color-mix(in srgb, var(--color-navy) 34%, transparent), color-mix(in srgb, var(--color-navy) 9%, transparent))"
              : "linear-gradient(to bottom, color-mix(in srgb, var(--color-navy) 34%, transparent), color-mix(in srgb, var(--color-navy) 9%, transparent))",
        }}
      />
      <button
        type="button"
        onClick={() => onSelect(entry)}
        aria-label={`${rankLabel}${entry.title}, ${formatEntryDate(entry)}`}
        title={entry.title}
        className={`tl-marker absolute flex h-[26px] cursor-pointer items-center gap-1.5 rounded-full border pr-2.5 text-left shadow-(--shadow-card) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fox ${
          isMilestone ? "tl-marker--milestone" : ""
        } ${isImportant ? "tl-marker--important" : ""} ${
          highlighted ? "tl-marker--active animate-pulse-ring" : ""
        } ${enter.className}`}
        onAnimationEnd={(event) => {
          if (event.target === event.currentTarget && enter.className) {
            setEnter({ className: "", delay: null });
          }
        }}
        style={{
          ...categoryPillStyle(entry.category),
          // Meilensteine und der gerade angeflogene Eintrag bekommen den
          // Fuchs-Rahmen — inline, weil die Kategoriefarbe ebenfalls inline
          // kommt und CSS-Klassen dagegen nicht ankämen.
          ...(isMilestone || highlighted
            ? { borderColor: "var(--color-fox)" }
            : null),
          left,
          ...anchorEdge,
          width,
          // Punkt bzw. Stern sitzt exakt über dem Ankerpunkt der Achse. Wurde
          // die Karte am Rand geklemmt, wandert er innerhalb der Karte mit
          // (begrenzt, damit der Titel lesbar bleibt).
          paddingLeft: Math.min(
            44,
            Math.max(7.5, x - left - ENTRY_ANCHOR + 7.5)
          ),
          ...(enter.delay !== null
            ? { animationDelay: `${enter.delay}ms` }
            : null),
        }}
      >
        {isMilestone ? (
          <MilestoneStar />
        ) : isImportant ? (
          <ImportantDot color={category.color} />
        ) : (
          <span
            aria-hidden="true"
            className="h-[7px] w-[7px] shrink-0 rounded-full"
            style={{ backgroundColor: category.color }}
          />
        )}
        {/* `leading-4` statt `leading-none`: `truncate` würde sonst die
            Unterlängen (g, j, p) abschneiden. Farbe kommt geerbt aus der
            Kategorie (ink) — deshalb hier bewusst keine Textfarbe. */}
        <span className="min-w-0 flex-1 truncate text-[12px] leading-4 font-semibold">
          {entry.title}
        </span>
        {showYear && (
          <span className="shrink-0 text-[10.5px] leading-4 font-medium opacity-70 tabular-nums">
            {entry.year}
          </span>
        )}
      </button>
    </>
  );
}

export default memo(EntryMarker);
