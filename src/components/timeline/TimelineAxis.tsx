"use client";

import { memo } from "react";
import type { AxisTick } from "@/lib/timelinePosition";

interface TimelineAxisProps {
  ticks: AxisTick[];
  /** Bruchteil-Jahr → Content-Pixel. */
  toX: (yearFraction: number) => number;
  contentWidth: number;
  axisY: number;
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
 *
 * Eine „Heute“-Markierung gibt es bewusst NICHT (mehr): Das Jetzt steht als
 * echter Eintrag auf dem Zeitstrahl („55 Jahre GymNW“). Eine zweite, technische
 * Marke daneben hätte nur erklärt, was ohnehin zu sehen ist.
 */
function TimelineAxis({
  ticks,
  toX,
  contentWidth,
  axisY,
}: TimelineAxisProps) {
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

    </>
  );
}

export default memo(TimelineAxis);
