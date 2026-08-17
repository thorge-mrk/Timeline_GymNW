"use client";

import { memo } from "react";
import SchoolMark from "@/components/SchoolMark";
import { categoryById } from "@/lib/categories";
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
  /** Verzögerung des gestaffelten Eingangs in ms; `null` = kein Eingang. */
  enterDelay: number | null;
  onSelect: (entry: Entry) => void;
}

/**
 * Große Meilenstein-Karte UNTER der Achse.
 *
 * Aufbau (beide Zustände teilen sich dieselbe Grammatik):
 *   · feine Navy-Kopfleiste als Deckel
 *   · Kopfbereich — entweder das Bild mit weichem Verlauf für die Lesbarkeit
 *     oder, wenn kein Bild da ist, warmes Papier mit dem Schul-Signet als
 *     Wasserzeichen. In beiden Fällen sitzt die Jahreszahl als ruhige
 *     Ziffernmarke unten links, darunter ein kurzer Fuchs-Strich.
 *   · Textbereich mit Titel und leiser Meta-Zeile
 *
 * Verbindungslinie und Fuchs-Punkt zeigen die genaue Position auf der Achse.
 */
function MilestoneCard({
  entry,
  x,
  left,
  lane,
  axisY,
  layout,
  highlighted,
  enterDelay,
  onSelect,
}: MilestoneCardProps) {
  const top =
    axisY + MILESTONE_CONNECTOR + lane * (layout.height + MILESTONE_LANE_GAP);
  const connectorHeight = top - axisY;
  const imageUrl = entry.image_path
    ? publicUrl("entry-images", entry.image_path)
    : null;

  const isPill = layout.variant === "pill";
  const isFull = layout.variant === "full";
  const category = categoryById(entry.category);

  // Der gestaffelte Eingang und der Puls der Hervorhebung sind beides
  // Animationen — sie dürfen sich nicht gegenseitig überschreiben.
  const entering = enterDelay !== null && !highlighted;

  return (
    <>
      {/* Achse → Karte: oben satt, unten ausklingend */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute w-px"
        style={{
          left: x,
          top: axisY,
          height: connectorHeight,
          background:
            "linear-gradient(to bottom, color-mix(in srgb, var(--color-fox) 75%, transparent), color-mix(in srgb, var(--color-fox) 22%, transparent))",
        }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute rounded-full bg-fox ring-[3px] ring-paper"
        style={{ left: x - 5, top: axisY - 5, width: 10, height: 10 }}
      />

      <button
        type="button"
        onClick={() => onSelect(entry)}
        aria-label={`Meilenstein: ${entry.title}, ${formatEntryDate(entry)}`}
        className={`tl-milestone card absolute cursor-pointer overflow-hidden p-0 text-left ${
          highlighted ? "tl-milestone--active animate-pulse-ring" : ""
        } ${entering ? "tl-enter-card" : ""}`}
        style={{
          left,
          top,
          width: layout.width,
          height: layout.height,
          ...(entering ? { animationDelay: `${enterDelay}ms` } : null),
        }}
      >
        {/* Kopfleiste: die Karte bekommt einen Deckel und damit eine Kante.
            `z-10`, weil der Kopfbereich darunter ebenfalls positioniert ist. */}
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 z-10 h-[3px] bg-navy"
        />

        {isPill ? (
          <div className="flex h-full items-center gap-2.5 px-3.5 pt-[3px]">
            <span className="shrink-0 text-[12px] font-bold text-navy tabular-nums">
              {entry.year}
            </span>
            <span
              aria-hidden="true"
              className="h-3 w-px shrink-0 bg-paper-line"
            />
            {/* `leading-4` statt `leading-none`: `truncate` schneidet sonst
                Unterlängen (g, j, p) ab. */}
            <span className="min-w-0 flex-1 truncate text-[12.5px] leading-4 font-semibold text-coal">
              {entry.title}
            </span>
          </div>
        ) : (
          <>
            {/* --------------------------------------------- Kopfbereich */}
            <div
              className="relative w-full overflow-hidden"
              style={{ height: layout.imageHeight }}
            >
              {imageUrl ? (
                <>
                  <img
                    src={imageUrl}
                    alt={entry.title}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                  {/* Verlauf statt Vollfläche — die Ziffern bleiben lesbar,
                      das Bild bleibt Bild. */}
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-navy/80 via-navy/20 to-transparent"
                  />
                </>
              ) : (
                <>
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-b from-paper-sunk to-paper-card"
                  />
                  <span
                    aria-hidden="true"
                    className="absolute -right-5 bottom-1 flex items-center"
                  >
                    {/* Nur eine Ahnung von Textur — es darf den Text nie stören. */}
                    <SchoolMark className="h-16 w-auto text-navy/[0.055]" />
                  </span>
                </>
              )}

              {/*
                Ziffernmarke — ruhig, tabular, immer an derselben Stelle.
                Ohne Bild trägt sie die Karte und darf groß sein; mit Bild ist
                sie nur Bildunterschrift, sonst erschlägt sie das Foto.
              */}
              <div className="absolute inset-x-0 bottom-0 flex flex-col items-start px-3.5 pb-2">
                <span
                  className={`leading-none font-bold tracking-tight tabular-nums ${
                    imageUrl
                      ? `text-paper ${isFull ? "text-[20px]" : "text-[17px]"}`
                      : `text-navy/85 ${isFull ? "text-[30px]" : "text-[23px]"}`
                  }`}
                >
                  {entry.year}
                </span>
                <span
                  aria-hidden="true"
                  className={`mt-1.5 h-[2px] rounded-full bg-fox ${
                    isFull ? "w-7" : "w-6"
                  }`}
                />
              </div>
            </div>

            {/* ---------------------------------------------- Textbereich */}
            <div className={isFull ? "px-3.5 pt-2.5 pb-2.5" : "px-3 pt-2 pb-2"}>
              <p
                className={`line-clamp-2 leading-snug font-semibold text-coal ${
                  isFull ? "text-[13.5px]" : "text-[12.5px]"
                }`}
              >
                {entry.title}
              </p>
              <p
                className={`flex items-center gap-1.5 text-[10px] text-coal-faint ${
                  isFull ? "mt-1.5" : "mt-1"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: category.color }}
                />
                <span className="truncate tabular-nums">
                  {entry.month != null
                    ? formatEntryDate(entry)
                    : category.label}
                </span>
              </p>
            </div>
          </>
        )}
      </button>
    </>
  );
}

export default memo(MilestoneCard);
