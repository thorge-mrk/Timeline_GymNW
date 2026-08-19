"use client";

import { useId, useMemo, type CSSProperties } from "react";
import { categoryPillStyle } from "@/lib/categories";
import type { Entry } from "@/lib/types";
import "./memoryCloud.css";

interface MemoryCloudProps {
  /** Nur Einträge OHNE Datum. Kann leer sein. */
  entries: Entry[];
  /** Wie viele Stimmen hängen an diesem Eintrag? (0 = nur der Eintrag selbst) */
  voiceCount: (entryId: string) => number;
  /** Eintrag im Detail-Fenster öffnen. */
  onOpen: (entry: Entry) => void;
  /** Steuerung von außen, damit der Zeitstrahl weiß, wie viel Platz die Wolke nimmt. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Ab hier wird der Titel gekürzt. Der volle Text bleibt in `title` und `aria-label`. */
const MAX_CHARS = 30;

/** So viele Themen zeigt das zugeklappte Band als Vorgeschmack. */
const PEEK_COUNT = 3;

/**
 * Wenn ALLE Themen gleich viele Stimmen haben, gibt es keine Rangfolge —
 * dann stehen sie alle auf derselben, angenehm mittleren Größe. Eine
 * erfundene Staffelung wäre gelogen, und alles auf Minimum wäre Geflüster.
 */
const FLAT_WEIGHT = 0.3;

/** Ein Wort in der Wolke. */
interface CloudWord {
  entry: Entry;
  /** Erinnerungen insgesamt: der Eintrag selbst plus seine Stimmen. */
  memories: number;
  /** 0 … 1 — Stelle zwischen kleinster und größter Schrift. */
  weight: number;
  /** Gekürzter Anzeigetext. */
  label: string;
}

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
 * Reihenfolge der Wörter — der eigentliche „Wolken-Algorithmus“.
 *
 * Ein echtes Wortwolken-Verfahren (Spirale, Kollisionsprüfung) müsste jedes
 * Wort erst ausmessen und bei jeder Breitenänderung neu rechnen; auf dem Handy
 * käme dabei zuverlässig Kraut und Rüben heraus. Stattdessen fließen die
 * Wörter ganz normal um (`flex-wrap`) — die Wolkenform entsteht über die
 * REIHENFOLGE:
 *
 *   1. absteigend nach Stimmen sortieren, bei Gleichstand nach Alter und
 *      zuletzt nach id — dieselbe Datenlage ergibt damit IMMER dieselbe
 *      Reihenfolge, egal in welcher Reihenfolge die Einträge hereinkommen
 *   2. von der Mitte nach außen austeilen: das lauteste Thema landet in der
 *      Mitte, die leiseren wandern abwechselnd nach links und rechts
 *
 * Ergebnis: innen groß und dicht, außen klein und luftig — eine Wolke, und
 * kein Zufall. `Math.random()` kommt hier bewusst nicht vor: Wer die Seite neu
 * lädt, soll sein Thema an derselben Stelle wiederfinden.
 */
function cloudOrder(words: CloudWord[]): CloudWord[] {
  const sorted = [...words].sort((a, b) => {
    if (b.memories !== a.memories) return b.memories - a.memories;
    const byAge = a.entry.created_at.localeCompare(b.entry.created_at);
    if (byAge !== 0) return byAge;
    return a.entry.id.localeCompare(b.entry.id);
  });

  const out: CloudWord[] = new Array<CloudWord>(sorted.length);
  let left = Math.floor((sorted.length - 1) / 2);
  let right = left + 1;
  for (let i = 0; i < sorted.length; i++) {
    if (i % 2 === 0) out[left--] = sorted[i];
    else out[right++] = sorted[i];
  }
  return out;
}

/**
 * Erinnerungs-Wolke — das Zuhause aller Erinnerungen ohne Jahreszahl.
 *
 * „Meine Einschulung“, „der Amerika-Austausch“, „die Bläserklasse“: Die
 * Hälfte der Menschen weiß noch genau, WAS war, aber nicht mehr WANN. Auf der
 * Achse hätten diese Einträge keinen ehrlichen Platz — hier haben sie einen.
 *
 * Das Band liegt unter dem Zeitstrahl und ist zugeklappt nur eine Zeile hoch:
 * Solange niemand danach fragt, nimmt es der Achse keinen Millimeter weg.
 * Aufgeklappt fährt es wie eine Schublade heraus (deshalb `--ease-drawer`,
 * nicht `--ease-out-strong`) und zeigt die Wolke über die volle Breite.
 *
 * Gelesen wird sie über zwei Kanäle gleichzeitig:
 *   Größe → wie viele Menschen sich an dieses Thema erinnern
 *   Farbe → Kategorie, dieselben Pillen-Farben wie an der Achse
 *
 * Ohne datumslose Einträge gibt die Komponente `null` zurück und steht
 * niemandem im Weg.
 */
export default function MemoryCloud({
  entries,
  voiceCount,
  onOpen,
  open,
  onOpenChange,
}: MemoryCloudProps): React.ReactElement | null {
  const panelId = useId();

  const words = useMemo(() => {
    const counted: CloudWord[] = entries.map((entry) => ({
      entry,
      memories: Math.max(1, voiceCount(entry.id) + 1),
      weight: 0,
      label: shorten(entry.title),
    }));

    if (!counted.length) return counted;

    /*
     * Wurzel statt gerader Linie: Zwischen 1 und 2 Stimmen liegt gefühlt ein
     * riesiger Unterschied, zwischen 11 und 12 kaum einer. Linear skaliert
     * würde ein einzelnes lautes Thema alle anderen zu Fußnoten machen.
     */
    let low = Infinity;
    let high = 0;
    for (const w of counted) {
      if (w.memories < low) low = w.memories;
      if (w.memories > high) high = w.memories;
    }
    const span = Math.sqrt(high) - Math.sqrt(low);
    for (const w of counted) {
      w.weight =
        span > 0 ? (Math.sqrt(w.memories) - Math.sqrt(low)) / span : FLAT_WEIGHT;
    }

    return cloudOrder(counted);
  }, [entries, voiceCount]);

  /** Die lautesten Themen — sie stehen im zugeklappten Band als Vorgeschmack. */
  const peek = useMemo(
    () => [...words].sort((a, b) => b.memories - a.memories).slice(0, PEEK_COUNT),
    [words]
  );

  if (!words.length) return null;

  const countLabel = words.length === 1 ? "1 Beitrag" : `${words.length} Beiträge`;

  return (
    <section
      data-state={open ? "open" : "closed"}
      aria-label="Erinnerungen ohne Datum"
      className="mc-root shrink-0 border-t border-paper-line bg-paper-card"
    >
      {/* ------------------------------------------------------- Das Band */}
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-controls={panelId}
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

        <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
          <span className="truncate text-[13px] leading-5 font-semibold text-coal">
            Erinnerungen ohne Datum
          </span>
          <span aria-hidden="true" className="shrink-0 text-coal-faint">
            ·
          </span>
          <span className="shrink-0 text-[12px] leading-5 text-coal-soft tabular-nums">
            {countLabel}
          </span>
        </span>

        {/*
          Vorgeschmack: die drei lautesten Themen in ihrer Kategoriefarbe.
          Auf dem Handy ist dafür kein Platz — dort führt allein die Zahl.
          Beim Aufklappen bleiben sie stehen und blenden nur aus, sonst würde
          das Band beim Öffnen zucken.
        */}
        <span
          aria-hidden="true"
          className="mc-peek hidden shrink-0 items-center gap-1.5 sm:flex"
        >
          {peek.map((word) => (
            <span
              key={word.entry.id}
              className="max-w-[11rem] truncate rounded-full border px-2 py-0.5 text-[11px] leading-4 font-semibold"
              style={categoryPillStyle(word.entry.category)}
            >
              {word.label}
            </span>
          ))}
        </span>

        <span
          aria-hidden="true"
          className="mc-chevron flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-coal-soft"
        >
          {/* Zeigt nach unten: dort geht die Wolke auf. Aufgeklappt dreht sich
              das Zeichen und zeigt zurück nach oben — Weg hin, Weg zurück. */}
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="M3.5 6L8 10.5 12.5 6"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      {/* ---------------------------------------------------- Die Schublade */}
      {/*
        Zugeklappt ist die Wolke `inert`: kein Tabstopp, keine Vorlesestimme.
        Sie ist dann nur zusammengeschoben, nicht abgebaut — der Browser muss
        beim Öffnen also nichts neu bauen, und die Wörter stehen sofort da.
      */}
      <div id={panelId} className="mc-panel" inert={!open}>
        <div className="mc-clip">
          <div className="mc-scroll px-4 pt-1 pb-5 sm:px-5 sm:pb-6">
            <p className="mb-3 text-[12px] leading-5 text-coal-faint">
              Diese Erinnerungen haben keine Jahreszahl — je größer ein Thema,
              desto mehr Menschen erinnern sich daran.
            </p>

            <div className="mc-cloud flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 sm:gap-x-2.5 sm:gap-y-2">
              {words.map((word) => (
                <button
                  key={word.entry.id}
                  type="button"
                  onClick={() => onOpen(word.entry)}
                  title={word.entry.title}
                  aria-label={`${word.entry.title}, ${
                    word.memories === 1
                      ? "1 Erinnerung"
                      : `${word.memories} Erinnerungen`
                  }, öffnen`}
                  className="mc-word max-w-full cursor-pointer overflow-hidden rounded-full border font-semibold text-ellipsis whitespace-nowrap"
                  style={
                    {
                      ...categoryPillStyle(word.entry.category),
                      "--mc-w": word.weight.toFixed(3),
                    } as CSSProperties
                  }
                >
                  {word.label}
                  {word.memories > 1 && (
                    <span className="mc-count tabular-nums"> ·{word.memories}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
