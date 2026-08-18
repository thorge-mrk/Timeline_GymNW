"use client";

import { memo, useState, type CSSProperties } from "react";
import SchoolMark from "@/components/SchoolMark";
import { categoryById } from "@/lib/categories";
import { formatEntryDate } from "@/lib/dates";
import { publicUrl } from "@/lib/supabase";
import type { Entry } from "@/lib/types";
import type { MilestoneLayout, Side } from "@/lib/timelinePosition";

interface MilestoneCardProps {
  entry: Entry;
  /** Ankerpunkt auf der Achse (Content-Pixel). */
  x: number;
  left: number;
  /** Ober- oder unterhalb der Achse. */
  side: Side;
  /** Abstand Achse → achsnahe Kante der Karte (= Länge der Verbindungslinie). */
  offset: number;
  /** Höhe der Zeichenfläche und y-Position der Achse. */
  height: number;
  axisY: number;
  layout: MilestoneLayout;
  highlighted: boolean;
  /** Verzögerung des gestaffelten Eingangs in ms; `null` = kein Eingang. */
  enterDelay: number | null;
  onSelect: (entry: Entry) => void;
}

/**
 * Die Verbindungslinie ist lang — sie führt an den Marker-Spuren vorbei bis zur
 * Karte. Damit sie dabei nicht als Strich durchs Bild schneidet, ist sie an der
 * Achse satt, in der Marker-Zone fast unsichtbar und an der Karte wieder etwas
 * kräftiger: Anfang und Ende der Beziehung sind sichtbar, der Weg dazwischen
 * hält sich zurück.
 */
function connectorGradient(side: Side): string {
  const direction = side === "above" ? "to top" : "to bottom";
  return `linear-gradient(${direction},
    color-mix(in srgb, var(--color-fox) 78%, transparent) 0%,
    color-mix(in srgb, var(--color-fox) 10%, transparent) 55%,
    color-mix(in srgb, var(--color-fox) 45%, transparent) 100%)`;
}

/**
 * Große Meilenstein-Karte — je nach Platz OBER- oder UNTERHALB der Achse.
 *
 * Aufbau (alle Varianten teilen sich dieselbe Grammatik):
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
  side,
  offset,
  height,
  axisY,
  layout,
  highlighted,
  enterDelay,
  onSelect,
}: MilestoneCardProps) {
  const imageUrl = entry.image_path
    ? publicUrl("entry-images", entry.image_path)
    : null;

  const isPill = layout.variant === "pill";
  const isFull = layout.variant === "full";
  const category = categoryById(entry.category);

  /*
   * Eingang einmal beim Montieren festlegen und nach dem Lauf abräumen —
   * siehe EntryMarker: ein Klassenwechsel würde die Animation erneut starten,
   * und zwei `animation`-Regeln auf einem Element verdrängen sich.
   */
  const [enter, setEnter] = useState<{
    className: string;
    delay: number | null;
  }>(() => {
    if (highlighted) return { className: "", delay: null };
    if (enterDelay !== null) {
      return { className: "tl-enter-card", delay: enterDelay };
    }
    return { className: "tl-appear-card", delay: null };
  });

  /** Achsnahe Kante: oben von unten gemessen, unten von oben. */
  const anchorEdge: CSSProperties =
    side === "above"
      ? { bottom: height - axisY + offset }
      : { top: axisY + offset };

  const connectorEdge: CSSProperties =
    side === "above" ? { bottom: height - axisY } : { top: axisY };

  return (
    <>
      {/* Achse → Karte: an der Achse satt, unterwegs zurückhaltend */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute w-px"
        style={{
          left: x,
          ...connectorEdge,
          height: offset,
          background: connectorGradient(side),
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
        } ${enter.className}`}
        onAnimationEnd={(event) => {
          if (event.target === event.currentTarget && enter.className) {
            setEnter({ className: "", delay: null });
          }
        }}
        style={{
          left,
          ...anchorEdge,
          width: layout.width,
          height: layout.height,
          ...(enter.delay !== null
            ? { animationDelay: `${enter.delay}ms` }
            : null),
        }}
      >
        {isPill ? (
          <div className="flex h-full items-center gap-2.5 px-3.5">
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
