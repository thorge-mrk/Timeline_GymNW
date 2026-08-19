"use client";

import { useMemo, useRef } from "react";
import { categoryPillStyle } from "@/lib/categories";
import type { Entry, Voice } from "@/lib/types";
import MemoryCloudFull, { type CloudWord } from "./MemoryCloudFull";
import "./memoryCloud.css";

interface MemoryCloudProps {
  /** Nur Einträge OHNE Datum. Kann leer sein. */
  entries: Entry[];
  /** Wie viele Stimmen hängen an diesem Eintrag? (0 = nur der Eintrag selbst) */
  voiceCount: (entryId: string) => number;
  /** Alle Stimmen eines Themas — für das Panel in der Vollansicht. */
  voicesFor?: (entryId: string) => Voice[];
  /** Eintrag im Detail-Fenster öffnen (aus der Vollansicht heraus). */
  onOpen: (entry: Entry) => void;
  /** Steht die Wolke groß über dem Zeitstrahl? */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Nur gesetzt, wenn jemand angemeldet ist — dann darf man dazuschreiben. */
  onAddVoice?: (entry: Entry) => void;
}

/** Ab hier wird der Titel gekürzt. Der volle Text bleibt in `title` und `aria-label`. */
const MAX_CHARS = 30;

/** So viele Themen zeigt das Band als Vorgeschmack. */
const PEEK_COUNT = 3;

/**
 * Wenn ALLE Themen gleich viele Stimmen haben, gibt es keine Rangfolge —
 * dann stehen sie alle auf derselben, angenehm mittleren Größe. Eine
 * erfundene Staffelung wäre gelogen, und alles auf Minimum wäre Geflüster.
 */
const FLAT_WEIGHT = 0.35;

/**
 * Ab so vielen Erinnerungen wächst ein Wort nicht weiter.
 *
 * Ohne Deckel erschlägt ein einziges Massenthema die Wolke: Erinnern sich
 * dreißig Menschen an die Bläserklasse und drei an den Schulhof-Kastanienbaum,
 * dann steht der Kastanienbaum als unlesbarer Krümel neben einem Plakat. Der
 * Deckel sagt: „ab acht ist es ein großes Thema" — wie viel größer genau,
 * verrät die Zahl an der Pille und das Panel. Zusammen mit der Wurzel unten
 * bleibt der Unterschied zwischen 1 und 8 gut sichtbar und alles darüber
 * angenehm ruhig.
 */
const MEMORY_CAP = 8;

/**
 * So viele Wörter zeigt die Wolke höchstens.
 *
 * An einem vollen Aktionstag können hunderte datumslose Einträge zusammen-
 * kommen; als Wolke wäre das Konfetti, und das Anordnen würde spürbar dauern.
 * Gezeigt werden die lautesten — der Rest steht weiterhin im Zeitstrahl-Filter
 * und wird beim nächsten Laden neu gewichtet.
 */
const MAX_WORDS = 60;

/**
 * „Berlinfahrt, 12 Klasse und Coronazeiten“ ist eine schöne Erinnerung und ein
 * schlechtes Wort für eine Wolke. Gekürzt wird möglichst an einer Wortgrenze,
 * damit kein Wortfetzen stehen bleibt; verloren geht nichts — der volle Titel
 * hängt am `title`-Attribut und am `aria-label`.
 */
function shorten(title: string): string {
  const text = title.trim();
  if (text.length <= MAX_CHARS) return text;

  const cut = text.slice(0, MAX_CHARS);
  const space = cut.lastIndexOf(" ");
  const head = space > MAX_CHARS * 0.55 ? cut.slice(0, space) : cut;
  return `${head.replace(/[\s.,;:!?/–-]+$/, "")}…`;
}

/**
 * Erinnerungs-Wolke — das Zuhause aller Erinnerungen ohne Jahreszahl.
 *
 * „Meine Einschulung“, „der Amerika-Austausch“, „die Bläserklasse“: Die
 * Hälfte der Menschen weiß noch genau, WAS war, aber nicht mehr WANN. Auf der
 * Achse hätten diese Einträge keinen ehrlichen Platz — hier haben sie einen.
 *
 * ZWEI ZUSTÄNDE, mehr nicht:
 *
 *   BAND         Eine schmale Leiste am unteren Rand des Zeitstrahls:
 *                „Erinnerungen ohne Datum · 14 Beiträge“, dazu die drei
 *                lautesten Themen als Vorgeschmack. Solange niemand danach
 *                fragt, nimmt sie der Achse eine Zeile weg und sonst nichts.
 *
 *   VOLLANSICHT  Ein Klick, und die Wolke steht bildschirmfüllend über dem
 *                Zeitstrahl (`MemoryCloudFull`): zentriert im Raum verteilt,
 *                sanft schwebend, zum Zoomen und Schieben, mit den Stimmen
 *                hinter jedem Wort.
 *
 * Gelesen wird die Wolke über zwei Kanäle gleichzeitig:
 *   Größe → wie viele Menschen sich an dieses Thema erinnern
 *   Farbe → Kategorie, dieselben Pillen-Farben wie an der Achse
 *
 * Ohne datumslose Einträge gibt die Komponente `null` zurück und steht
 * niemandem im Weg.
 */
export default function MemoryCloud({
  entries,
  voiceCount,
  voicesFor,
  onOpen,
  open,
  onOpenChange,
  onAddVoice,
}: MemoryCloudProps): React.ReactElement | null {
  /** Das Band bekommt den Fokus zurück, wenn die Vollansicht schließt. */
  const toggleRef = useRef<HTMLButtonElement>(null);

  const words = useMemo<CloudWord[]>(() => {
    const counted = entries.map((entry) => ({
      entry,
      memories: Math.max(1, voiceCount(entry.id) + 1),
      weight: 0,
      label: shorten(entry.title),
    }));

    if (!counted.length) return counted;

    /*
     * Reihenfolge: lautestes Thema zuerst. Bei Gleichstand entscheidet das
     * Alter, zuletzt die id — dieselbe Datenlage ergibt damit IMMER dieselbe
     * Reihenfolge, egal wie die Einträge hereinkommen. Die Vollansicht setzt
     * in genau dieser Reihenfolge von der Mitte nach außen; ohne feste
     * Sortierung stünde die Wolke bei jedem Laden anders da.
     */
    counted.sort((a, b) => {
      if (b.memories !== a.memories) return b.memories - a.memories;
      const byAge = a.entry.created_at.localeCompare(b.entry.created_at);
      if (byAge !== 0) return byAge;
      return a.entry.id.localeCompare(b.entry.id);
    });

    const shown = counted.slice(0, MAX_WORDS);

    /*
     * Wurzel statt gerader Linie: Zwischen 1 und 2 Stimmen liegt gefühlt ein
     * riesiger Unterschied, zwischen 11 und 12 kaum einer. Linear skaliert
     * würde ein einzelnes lautes Thema alle anderen zu Fußnoten machen.
     * Über `MEMORY_CAP` hinaus wächst gar nichts mehr.
     */
    let low = Infinity;
    let high = 0;
    for (const word of shown) {
      const capped = Math.min(word.memories, MEMORY_CAP);
      if (capped < low) low = capped;
      if (capped > high) high = capped;
    }
    const span = Math.sqrt(high) - Math.sqrt(low);
    for (const word of shown) {
      const capped = Math.min(word.memories, MEMORY_CAP);
      word.weight =
        span > 0 ? (Math.sqrt(capped) - Math.sqrt(low)) / span : FLAT_WEIGHT;
    }

    return shown;
  }, [entries, voiceCount]);

  if (!words.length) return null;

  const total = entries.length;
  const countLabel = total === 1 ? "1 Beitrag" : `${total} Beiträge`;

  return (
    <>
      <section
        aria-label="Erinnerungen ohne Datum"
        className="mc-root shrink-0 border-t border-paper-line bg-paper-card"
      >
        <button
          ref={toggleRef}
          type="button"
          onClick={() => onOpenChange(true)}
          aria-haspopup="dialog"
          aria-label={`Erinnerungen ohne Datum, ${countLabel}, Wortwolke groß öffnen`}
          className="mc-toggle flex w-full cursor-pointer items-center gap-2.5 px-4 py-2.5 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-fox sm:gap-3 sm:px-5"
        >
          {/* Eine Wolke. Mehr Erklärung braucht es nicht. */}
          <svg
            width="18"
            height="18"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
            className="shrink-0 text-coal-faint"
          >
            <path
              d="M5.6 15.5h8.9a3.4 3.4 0 0 0 .5-6.76 4.9 4.9 0 0 0-9.24-1.2 3.6 3.6 0 0 0-.16 7.96Z"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
          </svg>

          <span aria-hidden="true" className="flex min-w-0 flex-1 items-baseline gap-1.5">
            <span className="truncate text-[13px] leading-5 font-semibold text-coal">
              Erinnerungen ohne Datum
            </span>
            <span className="shrink-0 text-coal-faint">·</span>
            <span className="shrink-0 text-[12px] leading-5 text-coal-soft tabular-nums">
              {countLabel}
            </span>
          </span>

          {/*
            Vorgeschmack: die drei lautesten Themen in ihrer Kategoriefarbe.
            Auf dem Handy ist dafür kein Platz — dort führt allein die Zahl.
          */}
          <span
            aria-hidden="true"
            className="mc-peek hidden shrink-0 items-center gap-1.5 sm:flex"
          >
            {words.slice(0, PEEK_COUNT).map((word) => (
              <span
                key={word.entry.id}
                className="max-w-[11rem] truncate rounded-full border px-2 py-0.5 text-[11px] leading-4 font-semibold"
                style={categoryPillStyle(word.entry.category)}
              >
                {word.label}
              </span>
            ))}
          </span>

          {/*
            Zwei Pfeile, die auseinanderstreben: Was gleich passiert, ist kein
            Aufklappen einer Schublade, sondern ein Aufgehen auf den ganzen
            Bildschirm. Das Zeichen soll dasselbe versprechen.
          */}
          <span
            aria-hidden="true"
            className="mc-grow flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-coal-soft"
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <path
                d="M6.2 2.5H2.5v3.7M9.8 2.5h3.7v3.7M6.2 13.5H2.5V9.8M9.8 13.5h3.7V9.8"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </button>
      </section>

      {open && (
        <MemoryCloudFull
          words={words}
          total={total}
          voicesFor={voicesFor}
          onOpenEntry={onOpen}
          onAddVoice={onAddVoice}
          onClose={() => onOpenChange(false)}
          returnFocus={toggleRef}
        />
      )}
    </>
  );
}
