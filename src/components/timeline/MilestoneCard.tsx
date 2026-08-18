"use client";

import { memo, useState, type CSSProperties, type ReactNode } from "react";
import SchoolMark from "@/components/SchoolMark";
import { categoryById } from "@/lib/categories";
import { formatEntryDate } from "@/lib/dates";
import { publicUrl } from "@/lib/supabase";
import type { Entry } from "@/lib/types";
import type { ImportantLayout, MilestoneLayout, Side } from "@/lib/timelinePosition";

/*
 * Die beiden großen Kartenformate des Zeitstrahls wohnen zusammen in dieser
 * Datei, weil sie sich Gerüst und Grammatik teilen:
 *
 *   MilestoneCard  — Rang 1: große Bildkarte mit Jahres-Ziffernmarke
 *   ImportantCard  — Rang 2: mittelgroße Karte, mit Bild, aber OHNE die große
 *                    Jahreszahl; ohne Bild schrumpft sie auf Titel + Datum
 *
 * Beide hängen mit derselben Linie an der Achse und benutzen dieselben
 * Eingangs-/Hover-Regeln aus `timeline.css`.
 */

interface CardShellProps {
  /** Ankerpunkt auf der Achse (Content-Pixel). */
  x: number;
  left: number;
  side: Side;
  /** Abstand Achse → achsnahe Kante der Karte (= Länge der Verbindungslinie). */
  offset: number;
  height: number;
  axisY: number;
  width: number;
  cardHeight: number;
  /** Klasse für Rang-spezifische Feinheiten (Ring, Punktgröße). */
  rankClass: string;
  /** Deckkraft des Fuchs-Punkts auf der Achse. */
  dotSize: number;
  highlighted: boolean;
  enterDelay: number | null;
  ariaLabel: string;
  onClick: () => void;
  children: ReactNode;
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

/** Gemeinsames Gerüst: Linie zur Achse, Punkt auf der Achse, Karte. */
function CardShell({
  x,
  left,
  side,
  offset,
  height,
  axisY,
  width,
  cardHeight,
  rankClass,
  dotSize,
  highlighted,
  enterDelay,
  ariaLabel,
  onClick,
  children,
}: CardShellProps) {
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
        style={{
          left: x - dotSize / 2,
          top: axisY - dotSize / 2,
          width: dotSize,
          height: dotSize,
        }}
      />

      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className={`tl-milestone card absolute cursor-pointer overflow-hidden p-0 text-left ${rankClass} ${
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
          width,
          height: cardHeight,
          ...(enter.delay !== null
            ? { animationDelay: `${enter.delay}ms` }
            : null),
        }}
      >
        {children}
      </button>
    </>
  );
}

/**
 * Bildfläche einer Karte — RANDLOS.
 *
 * Die Karte trägt keinen echten Rahmen mehr (siehe `.tl-milestone` in
 * `timeline.css`: `border-width: 0`, Kontur als Hairline nach innen). Dadurch
 * fällt der Inhalt mit der Außenkante zusammen und das Bild füllt die volle
 * Kartenbreite. `border-radius: inherit` an den beiden oberen Ecken sorgt
 * dafür, dass die Rundung auch dann sauber greift, wenn die Karte gerade
 * bewegt wird (WebKit klemmt sonst gelegentlich an den Ecken).
 */
function CardMedia({
  imageUrl,
  alt,
  imageHeight,
  markHeight,
  children,
}: {
  imageUrl: string | null;
  alt: string;
  imageHeight: number;
  markHeight: string;
  children?: ReactNode;
}) {
  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        height: imageHeight,
        borderTopLeftRadius: "inherit",
        borderTopRightRadius: "inherit",
      }}
    >
      {imageUrl ? (
        <>
          <img
            src={imageUrl}
            alt={alt}
            loading="lazy"
            className="block h-full w-full object-cover"
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
            <SchoolMark className={`${markHeight} w-auto text-navy/[0.055]`} />
          </span>
        </>
      )}
      {children}
    </div>
  );
}

interface MilestoneCardProps {
  entry: Entry;
  x: number;
  left: number;
  side: Side;
  offset: number;
  height: number;
  axisY: number;
  layout: MilestoneLayout;
  highlighted: boolean;
  /** Verzögerung des gestaffelten Eingangs in ms; `null` = kein Eingang. */
  enterDelay: number | null;
  onSelect: (entry: Entry) => void;
}

/**
 * Große Meilenstein-Karte — je nach Platz OBER- oder UNTERHALB der Achse.
 *
 * Aufbau (alle Varianten teilen sich dieselbe Grammatik):
 *   · Kopfbereich — entweder das Bild (randlos bis an die abgerundeten Ecken)
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

  return (
    <CardShell
      x={x}
      left={left}
      side={side}
      offset={offset}
      height={height}
      axisY={axisY}
      width={layout.width}
      cardHeight={layout.height}
      rankClass=""
      dotSize={10}
      highlighted={highlighted}
      enterDelay={enterDelay}
      ariaLabel={`Meilenstein: ${entry.title}, ${formatEntryDate(entry)}`}
      onClick={() => onSelect(entry)}
    >
      {isPill ? (
        <div className="flex h-full items-center gap-2.5 px-3.5">
          <span className="shrink-0 text-[12px] font-bold text-navy tabular-nums">
            {entry.year}
          </span>
          <span aria-hidden="true" className="h-3 w-px shrink-0 bg-paper-line" />
          {/* `leading-4` statt `leading-none`: `truncate` schneidet sonst
              Unterlängen (g, j, p) ab. */}
          <span className="min-w-0 flex-1 truncate text-[12.5px] leading-4 font-semibold text-coal">
            {entry.title}
          </span>
        </div>
      ) : (
        <>
          <CardMedia
            imageUrl={imageUrl}
            alt={entry.title}
            imageHeight={layout.imageHeight}
            markHeight="h-16"
          >
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
          </CardMedia>

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
                {entry.month != null ? formatEntryDate(entry) : category.label}
              </span>
            </p>
          </div>
        </>
      )}
    </CardShell>
  );
}

interface ImportantCardProps {
  entry: Entry;
  x: number;
  left: number;
  side: Side;
  offset: number;
  height: number;
  axisY: number;
  layout: ImportantLayout;
  highlighted: boolean;
  enterDelay: number | null;
  onSelect: (entry: Entry) => void;
}

/**
 * Mittelgroße Karte für einen WICHTIGEN Eintrag — die Stufe zwischen
 * Meilenstein und Pille.
 *
 * Unterschiede zur Meilenstein-Karte, ganz bewusst:
 *   · KEINE große Jahres-Ziffernmarke im Bild. Das Datum steht klein in der
 *     Meta-Zeile; die Karte lebt vom Bild und vom Titel.
 *   · deutlich kleiner (Maße kommen aus `chooseBands`, gekoppelt an die
 *     gerade gewählte Meilenstein-Variante).
 *   · schmaler Fuchs-Streifen an der achsnahen Kante statt Fuchs-Rahmen — er
 *     zeigt den Rang, ohne mit den Meilensteinen zu konkurrieren.
 *
 * Ohne Bild fällt die Bildfläche ersatzlos weg: dann ist es eine kompakte
 * Karte mit Titel und Datum, keine leere Bühne.
 */
function ImportantCard({
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
}: ImportantCardProps) {
  const imageUrl = entry.image_path
    ? publicUrl("entry-images", entry.image_path)
    : null;
  const category = categoryById(entry.category);

  return (
    <CardShell
      x={x}
      left={left}
      side={side}
      offset={offset}
      height={height}
      axisY={axisY}
      width={layout.width}
      cardHeight={imageUrl ? layout.height : layout.textHeight}
      rankClass="tl-important"
      dotSize={8}
      highlighted={highlighted}
      enterDelay={enterDelay}
      ariaLabel={`Wichtig: ${entry.title}, ${formatEntryDate(entry)}`}
      onClick={() => onSelect(entry)}
    >
      {imageUrl && (
        <CardMedia
          imageUrl={imageUrl}
          alt={entry.title}
          imageHeight={layout.imageHeight}
          markHeight="h-10"
        />
      )}

      <div
        className={`flex flex-col justify-center px-3 ${
          imageUrl ? "pt-1.5 pb-2" : "h-full py-2"
        }`}
      >
        <p className="line-clamp-2 text-[12.5px] leading-snug font-semibold text-coal">
          {entry.title}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-[10px] text-coal-faint">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: category.color }}
          />
          <span className="truncate tabular-nums">{formatEntryDate(entry)}</span>
        </p>
      </div>
    </CardShell>
  );
}

export const ImportantEntryCard = memo(ImportantCard);
export default memo(MilestoneCard);
