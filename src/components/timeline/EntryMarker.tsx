"use client";

import { memo } from "react";
import { categoryById } from "@/lib/categories";
import { formatEntryDate } from "@/lib/dates";
import type { Entry } from "@/lib/types";
import {
  AXIS_MARKER_GAP,
  ENTRY_ANCHOR,
  ENTRY_LANE_HEIGHT,
  ENTRY_WIDTH,
} from "@/lib/timelinePosition";

interface EntryMarkerProps {
  entry: Entry;
  /** Ankerpunkt auf der Achse (Content-Pixel). */
  x: number;
  /** Linke Kante der Karte (bereits an die Ränder geklemmt). */
  left: number;
  lane: number;
  /** Höhe der Zeichenfläche und y-Position der Achse. */
  height: number;
  axisY: number;
  highlighted: boolean;
  /** Verzögerung des gestaffelten Eingangs in ms; `null` = kein Eingang. */
  enterDelay: number | null;
  onSelect: (entry: Entry) => void;
}

/** Kleiner Stern für Meilensteine — als Pfad statt „★“, damit er überall gleich sitzt. */
function MilestoneStar() {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 10 10"
      fill="currentColor"
      aria-hidden="true"
      className="shrink-0 text-fox"
    >
      <path d="M5 0l1.3 3.2L9.7 4 7.1 6.1l.8 3.4L5 7.7 2.1 9.5l.8-3.4L.3 4l3.4-.8z" />
    </svg>
  );
}

/**
 * Kompakter Marker für einen Eintrag ÜBER der Achse: ein Stiel, der nach unten
 * zur Achse hin dichter wird, plus eine schmale Karte mit Kategoriepunkt,
 * Titel und Jahr.
 *
 * Typografische Hierarchie: der Titel führt (`text-coal`, halbfett), das Jahr
 * begleitet nur (`text-coal-faint`, tabular). Der Kategoriepunkt ist klein und
 * satt — er ordnet ein, er schreit nicht.
 */
function EntryMarker({
  entry,
  x,
  left,
  lane,
  height,
  axisY,
  highlighted,
  enterDelay,
  onSelect,
}: EntryMarkerProps) {
  const category = categoryById(entry.category);
  const dotColor = entry.is_milestone ? "#f49231" : category.color;

  /** Abstand der Kartenunterkante vom unteren Rand der Zeichenfläche. */
  const bottom = height - axisY + AXIS_MARKER_GAP + lane * ENTRY_LANE_HEIGHT;
  const stemHeight = AXIS_MARKER_GAP + lane * ENTRY_LANE_HEIGHT;

  const entering = enterDelay !== null && !highlighted;

  return (
    <>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute w-px"
        style={{
          left: x,
          bottom: height - axisY,
          height: stemHeight,
          background:
            "linear-gradient(to top, color-mix(in srgb, var(--color-navy) 34%, transparent), color-mix(in srgb, var(--color-navy) 9%, transparent))",
        }}
      />
      <button
        type="button"
        onClick={() => onSelect(entry)}
        aria-label={`${entry.title}, ${formatEntryDate(entry)}`}
        title={entry.title}
        className={`tl-marker absolute flex h-[26px] cursor-pointer items-center gap-1.5 rounded-full border bg-paper-card pr-2.5 text-left shadow-(--shadow-card) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fox ${
          highlighted
            ? "tl-marker--active animate-pulse-ring"
            : "border-paper-line"
        } ${entering ? "tl-enter-marker" : ""}`}
        style={{
          left: left,
          bottom,
          width: ENTRY_WIDTH,
          // Der Farbpunkt sitzt exakt über dem Ankerpunkt der Achse. Wurde die
          // Karte am Rand geklemmt, wandert stattdessen der Punkt innerhalb der
          // Karte mit (begrenzt, damit der Titel lesbar bleibt).
          paddingLeft: Math.min(
            44,
            Math.max(7.5, x - left - ENTRY_ANCHOR + 7.5)
          ),
          ...(entering ? { animationDelay: `${enterDelay}ms` } : null),
        }}
      >
        <span
          aria-hidden="true"
          className="h-[7px] w-[7px] shrink-0 rounded-full"
          style={{ backgroundColor: dotColor }}
        />
        {entry.is_milestone && <MilestoneStar />}
        {/* `leading-4` statt `leading-none`: `truncate` würde sonst die
            Unterlängen (g, j, p) abschneiden. */}
        <span className="min-w-0 flex-1 truncate text-[12px] leading-4 font-semibold text-coal">
          {entry.title}
        </span>
        <span className="shrink-0 text-[10.5px] leading-4 font-medium text-coal-faint tabular-nums">
          {entry.year}
        </span>
      </button>
    </>
  );
}

export default memo(EntryMarker);
