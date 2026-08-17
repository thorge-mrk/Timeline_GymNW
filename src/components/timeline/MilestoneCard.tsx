"use client";

import { memo } from "react";
import { formatEntryDate } from "@/lib/dates";
import { publicUrl } from "@/lib/supabase";
import type { Entry } from "@/lib/types";
import {
  MILESTONE_CONNECTOR,
  MILESTONE_LANE_GAP,
  type MilestoneLayout,
} from "@/lib/timelinePosition";

interface MilestoneCardProps {
  entry: Entry;
  /** Ankerpunkt auf der Achse (Content-Pixel). */
  x: number;
  left: number;
  lane: number;
  axisY: number;
  layout: MilestoneLayout;
  highlighted: boolean;
  onSelect: (entry: Entry) => void;
}

/**
 * Große Meilenstein-Karte UNTER der Achse: Bild oben, darunter Jahr (fox) und
 * Titel. Ohne Bild tritt eine Navy-Fläche mit großer Jahreszahl an seine Stelle.
 * Verbindungslinie und oranger Achsenpunkt zeigen die genaue Position.
 */
function MilestoneCard({
  entry,
  x,
  left,
  lane,
  axisY,
  layout,
  highlighted,
  onSelect,
}: MilestoneCardProps) {
  const top = axisY + MILESTONE_CONNECTOR + lane * (layout.height + MILESTONE_LANE_GAP);
  const connectorHeight = top - axisY;
  const imageUrl = entry.image_path
    ? publicUrl("entry-images", entry.image_path)
    : null;
  const showImage = layout.imageHeight > 0;

  return (
    <>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute w-px bg-fox/45"
        style={{ left: x, top: axisY, height: connectorHeight }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute rounded-full border-2 border-paper bg-fox"
        style={{ left: x - 6, top: axisY - 6, width: 12, height: 12 }}
      />

      <button
        type="button"
        onClick={() => onSelect(entry)}
        aria-label={`Meilenstein: ${entry.title}, ${formatEntryDate(entry)}`}
        className={`card absolute cursor-pointer overflow-hidden p-0 text-left transition-shadow hover:shadow-(--shadow-card-lg) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fox ${
          highlighted ? "animate-pulse-ring border-fox" : ""
        }`}
        style={{ left, top, width: layout.width, height: layout.height }}
      >
        {showImage &&
          (imageUrl ? (
            <img
              src={imageUrl}
              alt={entry.title}
              loading="lazy"
              className="w-full rounded-t-2xl object-cover"
              style={{ height: layout.imageHeight }}
            />
          ) : (
            <div
              aria-hidden="true"
              className="flex w-full items-center justify-center rounded-t-2xl bg-navy"
              style={{ height: layout.imageHeight }}
            >
              <span className="text-3xl font-extrabold tracking-tight text-fox tabular-nums">
                {entry.year}
              </span>
            </div>
          ))}

        <div
          className={
            layout.variant === "pill"
              ? "flex h-full items-center gap-2 px-3"
              : "px-3 py-2.5"
          }
        >
          <span
            className={`text-xs font-bold text-fox tabular-nums ${
              layout.variant === "pill" ? "shrink-0" : "block"
            }`}
          >
            {entry.year}
          </span>
          <span
            className={`text-sm leading-snug font-semibold text-coal ${
              layout.variant === "pill"
                ? "min-w-0 flex-1 truncate"
                : "mt-0.5 line-clamp-2"
            }`}
          >
            {entry.title}
          </span>
        </div>
      </button>
    </>
  );
}

export default memo(MilestoneCard);
