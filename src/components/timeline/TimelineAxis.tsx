"use client";

import { memo } from "react";
import type { AxisTick } from "@/lib/timelinePosition";

interface TimelineAxisProps {
  ticks: AxisTick[];
  /** Bruchteil-Jahr → Content-Pixel. */
  toX: (yearFraction: number) => number;
  contentWidth: number;
  height: number;
  axisY: number;
  /** Heutiges Datum als Bruchteil-Jahr. */
  now: number;
}

/** Höhe des Tick-Strichs je Ebene. */
const TICK_HEIGHT: Record<AxisTick["level"], number> = {
  decade: 9,
  year: 6,
  month: 4,
};

/**
 * Die Achse ist das Rückgrat der Seite und darf so aussehen: eine kräftige
 * Navy-Linie mit einem weichen Schattenband darunter, damit sie auf dem
 * Papier aufliegt statt darauf zu schweben.
 *
 * Beschriftung in drei klaren Stufen — Dekaden führen (groß, fett, Navy),
 * Jahre begleiten, Monate flüstern. Alle Ziffern `tabular-nums`, damit beim
 * Zoomen nichts zappelt.
 */
function TimelineAxis({
  ticks,
  toX,
  contentWidth,
  height,
  axisY,
  now,
}: TimelineAxisProps) {
  const todayX = toX(now);

  return (
    <>
      {/* Gitterlinien — nur für Jahre/Dekaden, sonst wird es unruhig */}
      {ticks.map((tick) =>
        tick.level === "month" ? null : (
          <span
            key={`grid-${tick.key}`}
            aria-hidden="true"
            className={`pointer-events-none absolute top-0 bottom-0 w-px ${
              tick.level === "decade" ? "bg-navy/10" : "bg-paper-line/70"
            }`}
            style={{ left: toX(tick.value) }}
          />
        )
      )}

      {/* Weiches Band unter der Achse: gibt ihr Gewicht, ohne laut zu werden */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-0 bg-gradient-to-b from-navy/10 to-transparent"
        style={{ top: axisY + 1.5, width: contentWidth, height: 10 }}
      />

      {/* Die Achse selbst */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-0 rounded-full bg-navy"
        style={{ top: axisY - 1.5, width: contentWidth, height: 3 }}
      />

      {/* Tick-Striche */}
      {ticks.map((tick) => {
        const isDecade = tick.level === "decade";
        return (
          <span
            key={`tick-${tick.key}`}
            aria-hidden="true"
            className={`pointer-events-none absolute rounded-b-full ${
              isDecade
                ? "bg-navy"
                : tick.level === "year"
                  ? "bg-navy/55"
                  : "bg-navy/22"
            }`}
            style={{
              left: toX(tick.value) - (isDecade ? 1 : 0),
              top: axisY + 1.5,
              width: isDecade ? 2 : 1,
              height: TICK_HEIGHT[tick.level],
            }}
          />
        );
      })}

      {/* Beschriftungsband */}
      {ticks.map((tick) => (
        <span
          key={`label-${tick.key}`}
          aria-hidden="true"
          className={`pointer-events-none absolute -translate-x-1/2 leading-4 whitespace-nowrap tabular-nums ${
            tick.level === "decade"
              ? "text-[15px] font-bold tracking-tight text-navy"
              : tick.level === "year"
                ? "text-[11.5px] font-semibold text-coal-soft"
                : "text-[10px] text-coal-faint"
          }`}
          style={{ left: toX(tick.value), top: axisY + 12 }}
        >
          {tick.label}
        </span>
      ))}

      {/* „Heute“ — schlanke Fuchs-Linie, die an den Enden ausklingt */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-0 w-px"
        style={{
          left: todayX,
          height,
          background:
            "linear-gradient(to bottom, color-mix(in srgb, var(--color-fox) 6%, transparent), color-mix(in srgb, var(--color-fox) 60%, transparent) 45%, color-mix(in srgb, var(--color-fox) 6%, transparent))",
        }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute rounded-full bg-fox ring-[3px] ring-paper"
        style={{ left: todayX - 4, top: axisY - 4, width: 8, height: 8 }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute flex -translate-x-full items-center gap-1.5 rounded-full border border-fox/30 bg-paper/85 px-2 py-[3px] text-[10px] font-bold tracking-[0.1em] text-fox-deep uppercase"
        style={{ left: todayX - 14, top: 10 }}
      >
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-fox" />
        Heute
      </span>
    </>
  );
}

export default memo(TimelineAxis);
