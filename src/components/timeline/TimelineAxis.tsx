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

/**
 * Navy-Achse in der vertikalen Mitte, adaptive Beschriftung (Dekaden fett,
 * Jahre normal, Monate klein), dezente Gitterlinien und der „Heute"-Marker.
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
              tick.level === "decade" ? "bg-paper-line" : "bg-paper-line/60"
            }`}
            style={{ left: toX(tick.value) }}
          />
        )
      )}

      {/* Die Achse selbst */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-0 h-0.5 rounded-full bg-navy"
        style={{ top: axisY - 1, width: contentWidth }}
      />

      {/* Beschriftungsband direkt unter der Achse */}
      {ticks.map((tick) => {
        const x = toX(tick.value);
        if (tick.level === "month") {
          return (
            <span
              key={`label-${tick.key}`}
              aria-hidden="true"
              className="pointer-events-none absolute -translate-x-1/2 text-[10px] whitespace-nowrap text-coal-soft/70"
              style={{ left: x, top: axisY + 7 }}
            >
              {tick.label}
            </span>
          );
        }
        return (
          <span
            key={`label-${tick.key}`}
            aria-hidden="true"
            className={`pointer-events-none absolute -translate-x-1/2 whitespace-nowrap tabular-nums ${
              tick.level === "decade"
                ? "text-sm font-bold text-navy"
                : "text-xs text-coal-soft"
            }`}
            style={{ left: x, top: axisY + 6 }}
          >
            {tick.label}
          </span>
        );
      })}

      {/* Kleine Tick-Striche auf der Achse */}
      {ticks.map((tick) => (
        <span
          key={`tick-${tick.key}`}
          aria-hidden="true"
          className={`pointer-events-none absolute w-px ${
            tick.level === "month" ? "bg-navy/25" : "bg-navy/60"
          }`}
          style={{
            left: toX(tick.value),
            top: axisY,
            height: tick.level === "month" ? 4 : 6,
          }}
        />
      ))}

      {/* „Heute" */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-0 w-px bg-fox/45"
        style={{ left: todayX, height }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -translate-x-1/2 rounded-full bg-fox px-2 py-0.5 text-[10px] font-bold text-navy shadow-(--shadow-card)"
        style={{ left: todayX, top: 8 }}
      >
        Heute
      </span>
    </>
  );
}

export default memo(TimelineAxis);
