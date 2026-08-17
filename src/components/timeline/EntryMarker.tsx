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
  onSelect: (entry: Entry) => void;
}

/**
 * Kompakter Marker für einen normalen Eintrag ÜBER der Achse: dünner Stiel bis
 * zur Achse plus eine Mini-Karte mit Farbpunkt, gekürztem Titel und Jahr.
 */
function EntryMarker({
  entry,
  x,
  left,
  lane,
  height,
  axisY,
  highlighted,
  onSelect,
}: EntryMarkerProps) {
  const category = categoryById(entry.category);
  const dotColor = entry.is_milestone ? "#f6921e" : category.color;

  /** Abstand der Kartenunterkante vom unteren Rand der Zeichenfläche. */
  const bottom = height - axisY + AXIS_MARKER_GAP + lane * ENTRY_LANE_HEIGHT;
  const stemHeight = AXIS_MARKER_GAP + lane * ENTRY_LANE_HEIGHT;

  return (
    <>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute w-px bg-paper-line"
        style={{ left: x, bottom: height - axisY, height: stemHeight }}
      />
      <button
        type="button"
        onClick={() => onSelect(entry)}
        aria-label={`${entry.title}, ${formatEntryDate(entry)}`}
        title={entry.title}
        className={`absolute flex cursor-pointer items-center gap-2 rounded-full border bg-paper-card/95 py-1 pr-3 pl-1.5 text-left shadow-(--shadow-card) transition-colors hover:border-fox focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fox ${
          highlighted
            ? "animate-pulse-ring border-fox"
            : "border-paper-line"
        }`}
        style={{
          left: left,
          bottom,
          width: ENTRY_WIDTH,
          // Der Farbpunkt sitzt exakt über dem Ankerpunkt der Achse. Wurde die
          // Karte am Rand geklemmt, wandert stattdessen der Punkt innerhalb der
          // Karte mit (begrenzt, damit der Titel lesbar bleibt).
          paddingLeft: Math.min(44, Math.max(6, x - left - ENTRY_ANCHOR + 6)),
        }}
      >
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: dotColor }}
        />
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-coal">
          {entry.is_milestone && <span className="text-fox">★ </span>}
          {entry.title}
        </span>
        <span className="shrink-0 text-[10px] tabular-nums text-coal-soft">
          {entry.year}
        </span>
      </button>
    </>
  );
}

export default memo(EntryMarker);
