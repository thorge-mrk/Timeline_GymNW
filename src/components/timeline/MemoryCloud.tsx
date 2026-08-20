"use client";

import { useMemo, useRef, useState } from "react";
import { categoryById } from "@/lib/categories";
import { peopleFor } from "@/lib/entryGroups";
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
  /** Die Verwaltung hat eine Stimme geändert oder entfernt — Zähler nachladen. */
  onVoicesChanged?: (entryId: string) => void;
}

/**
 * Bis hierher steht ein Titel ganz da. Was länger ist, wird auf sein
 * Schlüsselwort gebracht — nicht abgeschnitten.
 */
const FULL_CHARS = 18;

/** So lang darf das Schlüsselwort höchstens werden. */
const KEY_CHARS = 16;

/**
 * Wörter, die für sich genommen nichts erinnern.
 *
 * Artikel, Präpositionen, Hilfsverben: „Unterricht BEI Herrn Piernitzki" —
 * das „bei" trägt nichts, das „Unterricht" trägt alles. Bewusst kurz
 * gehalten und ohne Vollständigkeitsanspruch; sie muss nur die häufigsten
 * Anfänge deutscher Erinnerungstitel abräumen.
 */
const FILLER = new Set([
  "der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem",
  "einer", "eines", "und", "oder", "aber", "mit", "von", "vom", "zu", "zum",
  "zur", "in", "im", "ins", "an", "am", "ans", "auf", "aus", "bei", "beim",
  "für", "über", "unter", "nach", "vor", "als", "wie", "dass", "ist", "sind",
  "war", "waren", "hat", "haben", "sich", "so", "mein", "meine", "meiner",
  "unser", "unsere", "unserer", "sein", "seine", "ihr", "ihre", "es", "man",
]);

/** So viele Themen zeigt das Band als Vorgeschmack. */
const PEEK_COUNT = 5;

/**
 * Die Größenspanne der Wörter IM BAND, in Pixeln.
 *
 * Auch hier soll man sehen, welches Thema das lauteste ist — aber das Band
 * ist eine Zeile am unteren Rand und kein zweiter Auftritt. In der
 * Vollansicht liegt zwischen dem leisesten und dem lautesten Wort der Faktor
 * fünf; das ist dort richtig, weil die Wolke die ganze Fläche hat, um es zu
 * tragen. Eine Zeile verträgt das nicht: Wörter, die um das Fünffache
 * auseinanderliegen, machen aus der Leiste eine Zickzacklinie und schieben
 * die Grundlinie bei jedem Datenstand woanders hin.
 *
 * 11,5 px bis 14,5 px sind FAKTOR 1,26 — drei Pixel Unterschied zwischen dem
 * ersten und dem fünften Wort. Nebeneinander gelesen ist die Rangfolge damit
 * eindeutig, die Zeile bleibt aber eine Zeile: Alle fünf Größen liegen um die
 * 13 px der Überschrift herum, keine sticht heraus, keine verschwindet.
 */
const PEEK_MIN_PX = 11.5;
const PEEK_MAX_PX = 14.5;

/**
 * Ab welcher Fensterbreite das wievielte Wort mitkommt.
 *
 * Fünf Wörter brauchen Platz, den ein Handy hochkant nicht hat. Statt sie
 * dort umbrechen zu lassen — aus einer Leiste würden zwei Zeilen, und der
 * Zeitstrahl verlöre sie — zeigt das Band einfach WENIGER: auf 390 px steht
 * allein das lauteste Thema, ab 440 px kommt das zweite dazu, ab 560 px das
 * dritte, ab 700 px das vierte, ab 860 px alle fünf.
 *
 * Die Schwellen sind gemessen, nicht geraten: An jeder steht das neu
 * hinzukommende Wort mit den echten Titeln noch vollständig neben der
 * Überschrift, mit Luft nach rechts. Ein Wort weniger ist besser als ein
 * angeschnittenes — abgeschnittene Schrift verspricht Text, den es nicht
 * gibt, und das ist in einer Wortwolke das Schlimmste, was passieren kann.
 */
const PEEK_AT = [
  "flex",
  "hidden min-[440px]:flex",
  "hidden min-[560px]:flex",
  "hidden min-[700px]:flex",
  "hidden min-[860px]:flex",
];

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
 * verrät die hochgestellte Zahl am Wort und das Panel dahinter.
 */
const MEMORY_CAP = 8;

/**
 * Die Kennlinie der Wortgröße: Erinnerungen hoch `CURVE`.
 *
 * Vorher stand hier die WURZEL. Die ist mathematisch sympathisch — zwischen 1
 * und 2 Stimmen liegt gefühlt mehr als zwischen 11 und 12 —, aber sie tut
 * genau das Falsche für eine Wolke: Sie drückt die SPITZE zusammen. Mit den
 * echten Daten (5 · 4 · 4 · 3 · 3 · 2 …) stand das lauteste Thema nur 14 %
 * über dem zweiten, und das Bild sah aus wie eine Liste.
 *
 * Ein Exponent ÜBER eins dreht das um: Er spreizt oben und rafft unten.
 * Bei 1.4 und derselben Datenlage ergibt sich (auf 1440 px, 21 … 104 px):
 *
 *     5 Erinnerungen → 104 px      das Erste, was man sieht
 *     4 Erinnerungen →  80 px
 *     3 Erinnerungen →  57 px
 *     2 Erinnerungen →  37 px
 *     1 Erinnerung   →  21 px      der leise Rand der Wolke
 *
 * Genau die Staffelung, um die die Schule gebeten hat: „die erste weit
 * größer, dann kleiner". Der lange Schwanz gleich großer Einer-Wörter ist
 * dabei kein Fehler, sondern ehrlich — zwischen zwei Themen mit je einer
 * Erinnerung gibt es nichts zu unterscheiden, und eine erfundene Staffelung
 * wäre gelogen.
 */
const CURVE = 1.4;

/**
 * So viele Wörter zeigt die Wolke höchstens.
 *
 * An einem vollen Aktionstag können hunderte datumslose Einträge zusammen-
 * kommen; als Wolke wäre das Konfetti, und das Anordnen würde spürbar dauern.
 * Gezeigt werden die lautesten — der Rest steht weiterhin im Zeitstrahl-Filter
 * und wird beim nächsten Laden neu gewichtet.
 */
const MAX_WORDS = 60;

/** Satzzeichen weg, die an einem einzeln stehenden Wort nichts zu suchen haben. */
function bare(word: string): string {
  return word.replace(/^[„“"'(\[]+/, "").replace(/[\s.,;:!?/–—-]+$/, "");
}

/**
 * Das Schlüsselwort eines Titels.
 *
 * „Unterricht bei Herrn Piernitzki und Frau Lösch" stand vorher als
 * „Unterricht bei Herrn…" in der Wolke. Drei Punkte sind in einer Wortwolke
 * aber das Gegenteil dessen, was sie sein soll: Sie versprechen Text, den es
 * nicht gibt, und sie machen aus einem Wort einen angefangenen Satz. Also
 * steht dort jetzt „Unterricht" — ein Wort, das für sich lesbar ist.
 *
 * Gesucht wird das erste inhaltstragende Wort (Artikel und Präpositionen
 * werden übersprungen), und wenn danach noch Platz im Budget ist, kommt das
 * zweite dazu: „beste Klasse", nicht nur „beste".
 *
 * GEKÜRZT WIRD NUR DIE ANZEIGE. Der volle Titel steht unverändert im
 * `title`-Attribut, im `aria-label` und im Stimmen-Panel — er gehört den
 * Menschen, die ihn geschrieben haben.
 */
function keyword(title: string): string {
  const text = title.trim().replace(/\s+/g, " ");
  if (text.length <= FULL_CHARS) return text;

  const parts = text.split(" ").map(bare).filter(Boolean);
  if (!parts.length) return text.slice(0, KEY_CHARS);

  // Vorne die Füllwörter abräumen — aber nie alles: Besteht ein Titel nur aus
  // ihnen, ist ein Füllwort immer noch besser als gar nichts.
  let at = 0;
  while (at < parts.length - 1 && FILLER.has(parts[at].toLowerCase())) at++;

  let head = parts[at];
  const next = parts[at + 1];
  if (
    next &&
    !FILLER.has(next.toLowerCase()) &&
    head.length + 1 + next.length <= KEY_CHARS
  ) {
    head = `${head} ${next}`;
  }
  return head;
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
 *                „Erinnerungen ohne Datum“, dahinter die fünf lautesten
 *                Themen als blanke Wörter — das wichtigste zuerst, leicht
 *                nach Größe gestaffelt. Ein Klick auf ein Wort öffnet
 *                genau dieses Thema. Solange niemand danach fragt, nimmt
 *                die Leiste der Achse eine Zeile weg und sonst nichts.
 *
 *   VOLLANSICHT  Ein Klick, und die Wolke steht bildschirmfüllend über dem
 *                Zeitstrahl (`MemoryCloudFull`): zentriert im Raum verteilt,
 *                sanft schwebend, zum Zoomen und Schieben, mit den Stimmen
 *                hinter jedem Wort.
 *
 * Gelesen wird die Wolke über drei Kanäle gleichzeitig — und alle drei
 * stecken in der Schrift selbst, nicht in einem Kästchen drumherum:
 *   Größe und Gewicht → wie viele Menschen sich an dieses Thema erinnern
 *   Farbe             → Kategorie, dieselbe Tinte wie an der Achse
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
  onVoicesChanged,
}: MemoryCloudProps): React.ReactElement | null {
  /** Das Band bekommt den Fokus zurück, wenn die Vollansicht schließt. */
  const toggleRef = useRef<HTMLButtonElement>(null);

  /**
   * Welches Thema hat die Vollansicht aufgestoßen?
   *
   * Wer im Band auf „Pausen" tippt, will die Pausen sehen — nicht eine Wolke,
   * in der er „Pausen" erst wiederfinden muss. Die id wandert deshalb als
   * Startauswahl in die Vollansicht; die kennt den Weg dorthin schon, weil
   * die Liste der übrigen Themen ihn ebenfalls geht. `null` heißt: Es wurde
   * die Leiste selbst angetippt, dann öffnet die Wolke wie bisher als Ganzes.
   */
  const [openedWith, setOpenedWith] = useState<string | null>(null);

  /**
   * Wohin der Fokus zurückgeht, wenn die Vollansicht schließt.
   *
   * Nicht immer an die Leiste: Wer mit der Tastatur auf „Pausen" war und von
   * dort aufgezogen hat, will hinterher wieder auf „Pausen" stehen und nicht
   * drei Stationen davor. Gemerkt wird deshalb der Knopf, der die Ansicht
   * tatsächlich geöffnet hat.
   */
  const backRef = useRef<HTMLElement | null>(null);

  const words = useMemo<CloudWord[]>(() => {
    const counted = entries.map((entry) => ({
      entry,
      memories: peopleFor(entry, voiceCount(entry.id)),
      weight: 0,
      label: keyword(entry.title),
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
     * Die Kennlinie (siehe `CURVE`): erst deckeln, dann potenzieren, dann auf
     * 0 … 1 normieren. Gerechnet wird immer gegen das kleinste und größte
     * Thema DIESER Wolke, nicht gegen feste Zahlen — so nutzt die Staffelung
     * die volle Spanne, egal ob das lauteste Thema drei oder dreißig
     * Erinnerungen hat.
     */
    let low = Infinity;
    let high = 0;
    for (const word of shown) {
      const capped = Math.min(word.memories, MEMORY_CAP);
      if (capped < low) low = capped;
      if (capped > high) high = capped;
    }
    const floor = Math.pow(low, CURVE);
    const span = Math.pow(high, CURVE) - floor;
    for (const word of shown) {
      const capped = Math.min(word.memories, MEMORY_CAP);
      word.weight =
        span > 0 ? (Math.pow(capped, CURVE) - floor) / span : FLAT_WEIGHT;
    }

    return shown;
  }, [entries, voiceCount]);

  /*
   * Die Größen der Bandwörter — eigene Rechnung, nicht die der Wolke.
   *
   * `word.weight` ist gegen ALLE Themen normiert; unter den fünf lautesten
   * lägen die Werte dicht beieinander und die Staffelung wäre kaum zu sehen.
   * Hier wird deshalb noch einmal normiert, aber nur innerhalb dieser fünf —
   * und linear in den Erinnerungen, nicht über die Kennlinie: Eine Zeile
   * braucht keine Spreizung, sie braucht eine Reihenfolge.
   *
   * Gleich viele Erinnerungen ergeben gleiche Größe. Das ist kein Versehen:
   * Zwei Themen mit je drei Erinnerungen sind gleich laut, und ein
   * erfundener Unterschied wäre gelogen. Sind ALLE fünf gleich laut, stehen
   * sie zusammen auf der Mitte der Spanne.
   */
  const peek = useMemo(() => {
    const top = words.slice(0, PEEK_COUNT);
    let low = Infinity;
    let high = 0;
    for (const word of top) {
      if (word.memories < low) low = word.memories;
      if (word.memories > high) high = word.memories;
    }
    const span = high - low;
    return top.map((word) => ({
      word,
      size:
        span > 0
          ? PEEK_MIN_PX +
            ((word.memories - low) / span) * (PEEK_MAX_PX - PEEK_MIN_PX)
          : (PEEK_MIN_PX + PEEK_MAX_PX) / 2,
    }));
  }, [words]);

  if (!words.length) return null;

  const total = entries.length;
  const countLabel = total === 1 ? "1 Beitrag" : `${total} Beiträge`;

  /** Die Wolke aufziehen — mit oder ohne vorgewähltes Thema. */
  const openCloud = (entryId: string | null, from: HTMLElement | null) => {
    backRef.current = from ?? toggleRef.current;
    setOpenedWith(entryId);
    onOpenChange(true);
  };

  return (
    <>
      <section
        aria-label="Erinnerungen ohne Datum"
        className="mc-root shrink-0 border-t border-paper-line bg-paper-card"
      >
        {/*
          Eine Zeile, zwei Arten von Ziel: links die Leiste selbst, die die
          ganze Wolke aufzieht, rechts daneben die lautesten Themen, von denen
          jedes für sich anklickbar ist. Deshalb ist das Band kein einziger
          großer Knopf mehr — Knöpfe dürfen nicht ineinander stecken.
        */}
        <div className="flex w-full items-center gap-2.5 px-4 py-2.5 sm:gap-3 sm:px-5">
          <button
            ref={toggleRef}
            type="button"
            onClick={(event) => openCloud(null, event.currentTarget)}
            aria-haspopup="dialog"
            aria-label={`Erinnerungen ohne Datum, ${countLabel}, Wortwolke groß öffnen`}
            className="mc-toggle -my-1 flex shrink-0 cursor-pointer items-center gap-2 rounded-md py-1 pr-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fox"
          >
            {/*
              Nur noch die Überschrift. Das Wolkenzeichen davor ist weg: Es
              hat nichts erklärt, was der Text nicht schon sagte, und stand
              als einziges Bild in einer Zeile aus lauter Schrift. Die Zahl
              der Beiträge ist ebenfalls weg — im Band führt jetzt das, was
              die Menschen geschrieben haben, nicht wie viele es waren. Für
              Vorlesestimmen steht sie weiterhin im `aria-label`, wo sie
              niemanden stört und trotzdem Auskunft gibt.
            */}
            <span
              aria-hidden="true"
              className="text-[13px] leading-5 font-semibold whitespace-nowrap text-coal"
            >
              Erinnerungen ohne Datum
            </span>

            {/*
              Zwei Pfeile, die auseinanderstreben: Was gleich passiert, ist
              kein Aufklappen einer Schublade, sondern ein Aufgehen auf den
              ganzen Bildschirm. Das Zeichen soll dasselbe versprechen — es
              bleibt, weil es die Handlung des Knopfes zeigt und nicht bloß
              schmückt.
            */}
            <span
              aria-hidden="true"
              className="mc-grow flex h-5 w-5 shrink-0 items-center justify-center text-coal-soft"
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

          {/*
            Die lautesten Themen — als blanke Wörter in ihrer Kategoriefarbe,
            genau wie in der Wolke selbst. Ein Kästchen hier und Schrift dort
            wäre ein Versprechen, das die Vollansicht nicht hält. Getrennt
            wird mit einem Mittelpunkt, damit aus fünf Wörtern kein Satz wird.

            `overflow-hidden` ist der Notnagel für den Fall, dass ein sehr
            langer Titel doch einmal über die Zeile hinausragt: Dann wird
            hinten beschnitten — beim UNwichtigsten Wort — statt umgebrochen.
            Im Regelfall greift es nie, dafür sorgen die Schwellen in
            `PEEK_AT`.
          */}
          <span className="mc-peek flex min-w-0 flex-1 items-baseline gap-1.5 overflow-hidden sm:gap-2">
            {peek.map(({ word, size }, index) => {
              const memoryLabel =
                word.memories === 1
                  ? "1 Erinnerung"
                  : `${word.memories} Erinnerungen`;
              return (
                <span
                  key={word.entry.id}
                  className={`shrink-0 items-baseline gap-1.5 sm:gap-2 ${PEEK_AT[index]}`}
                >
                  {index > 0 && (
                    <span aria-hidden="true" className="text-[11px] text-coal-faint">
                      ·
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(event) =>
                      openCloud(word.entry.id, event.currentTarget)
                    }
                    aria-haspopup="dialog"
                    title={`${word.entry.title} — ${memoryLabel}`}
                    aria-label={`${word.entry.title}, ${memoryLabel}, öffnen`}
                    className="mc-peek-word cursor-pointer leading-4 font-bold whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fox"
                    style={{
                      color: categoryById(word.entry.category).ink,
                      fontSize: `${size.toFixed(2)}px`,
                    }}
                  >
                    {word.label}
                  </button>
                </span>
              );
            })}
          </span>
        </div>
      </section>

      {open && (
        <MemoryCloudFull
          words={words}
          total={total}
          voicesFor={voicesFor}
          onOpenEntry={onOpen}
          onAddVoice={onAddVoice}
          onVoicesChanged={onVoicesChanged}
          initialSelected={openedWith ?? undefined}
          onClose={() => {
            setOpenedWith(null);
            onOpenChange(false);
          }}
          returnFocus={backRef}
        />
      )}
    </>
  );
}
