"use client";

import { categoryById, categoryPillStyle } from "@/lib/categories";
import { formatEntryDate } from "@/lib/dates";
import { richTextToPlain } from "@/lib/richText";
import type { SimilarHit } from "@/lib/similarity";
import { peopleFor } from "@/lib/entryGroups";
import type { Entry } from "@/lib/types";
import "./similarEntries.css";

/** Mehr als drei Vorschläge sind keine Hilfe mehr, sondern eine zweite Aufgabe. */
const MAX_SHOWN = 3;

/** So viel Beschreibung genügt, um zu erkennen: Ist das wirklich dasselbe? */
const EXCERPT_MAX = 130;

export interface SimilarEntriesProps {
  hits: SimilarHit[];
  /** Anzahl bereits vorhandener Stimmen zu einem Eintrag. */
  voiceCount: (entryId: string) => number;
  /** „Meine Erinnerung hier dazuschreiben“ */
  onChoose: (entry: Entry) => void;
  /** „Nein, meins ist etwas anderes“ — Vorschläge ausblenden. */
  onDismiss: () => void;
}

/** Zwei Sprechblasen: Zu diesem Thema hat schon jemand etwas erzählt. */
function VoicesIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-0.5 h-5 w-5 shrink-0 text-fox-deep"
    >
      <path d="M8.6 14.4H6.2L3.4 16.7v-2.3H3.2A1.7 1.7 0 0 1 3 14.2V5.9c0-.8.7-1.5 1.5-1.5h9.3c.8 0 1.5.7 1.5 1.5v1.6" />
      <path d="M10.2 9.1h9.3c.8 0 1.5.7 1.5 1.5v6.2c0 .8-.7 1.5-1.5 1.5h-.4v2.3l-2.8-2.3h-6.1a1.5 1.5 0 0 1-1.5-1.5v-6.2c0-.8.7-1.5 1.5-1.5Z" />
    </svg>
  );
}

/**
 * „Gibt es das schon?“ — die Frage unter dem Titelfeld.
 *
 * Am Aktionstag tragen mehrere Menschen dasselbe Thema getrennt ein
 * („Berlinfahrt“ steht dreimal in der Datenbank). Deshalb ist das hier kein
 * Vorschlag am Rand mehr, sondern eine ausdrückliche Frage mit zwei
 * gleichwertigen Antworten: dazuschreiben oder einen eigenen Eintrag anlegen.
 *
 * Bewusst trotzdem kein Dialog und kein Overlay:
 *
 *  · Es blockiert nichts. Wer weitertippen will, tippt weiter — das Feld
 *    steht unter dem Eingabefeld und nimmt keinen Fokus.
 *  · Es behauptet nichts. Der Text fragt, er stellt nicht fest; die
 *    Ähnlichkeitssuche kann sich irren, und „Nein, meins ist etwas anderes“
 *    ist genauso gültig wie ein Treffer.
 *  · Es zeigt genug zum Entscheiden. Je Treffer: Titel, Kategorie, Datum,
 *    wie viele Erinnerungen schon dranhängen — und der Anfang der
 *    Beschreibung. Ohne den kann man „Sommerfest“ von „Sommerfest“ nicht
 *    unterscheiden.
 *
 * Wer nichts Passendes findet, sieht dieses Feld gar nicht: ohne Treffer
 * kommt `null` zurück.
 */
export default function SimilarEntries({
  hits,
  voiceCount,
  onChoose,
  onDismiss,
}: SimilarEntriesProps) {
  const shown = hits.slice(0, MAX_SHOWN);
  if (shown.length === 0) return null;

  return (
    <section
      aria-labelledby="similar-entries-heading"
      className="similar-panel card mt-3 border-fox/30 bg-fox-soft p-4"
    >
      <div className="flex items-start gap-2.5">
        <VoicesIcon />
        <div className="min-w-0 flex-1">
          <h3
            id="similar-entries-heading"
            className="text-base font-bold text-coal"
          >
            Gibt es das schon?
          </h3>
          <p className="hint mt-1 max-w-prose leading-relaxed">
            Wir haben etwas Ähnliches gefunden. Möchtest du deine Erinnerung dort
            dazuschreiben — oder ist deins etwas anderes?
          </p>
        </div>
      </div>

      {/*
        Eine kurze Ansage für Screenreader statt der ganzen Liste: Beim Tippen
        ändert sich das Feld bei jedem Anschlag, und eine vorgelesene Liste
        wäre dann nur noch Lärm.
      */}
      <p role="status" aria-live="polite" className="sr-only">
        {shown.length === 1
          ? "1 ähnlicher Eintrag gefunden."
          : `${shown.length} ähnliche Einträge gefunden.`}
      </p>

      <ul className="mt-3 space-y-2">
        {shown.map((hit, index) => {
          const entry = hit.entry;
          const category = categoryById(entry.category);
          const date = formatEntryDate(entry);
          /* Der Eintrag selbst ist die erste Erinnerung — genauso zählt es die
             Erinnerungs-Wolke, und zwei verschiedene Zahlen für dieselbe Sache
             wären nur verwirrend. */
          const memories = peopleFor(entry, voiceCount(entry.id));
          const plain = richTextToPlain(entry.description).trim();
          const excerpt = plain.slice(0, EXCERPT_MAX);

          return (
            <li
              key={entry.id}
              /* Kleiner Versatz je Reihe — die Liste kommt herein, sie blitzt nicht auf. */
              style={{ "--enter-delay": `${index * 45}ms` } as React.CSSProperties}
              className="similar-hit flex flex-wrap items-start justify-between gap-x-3 gap-y-2.5
                rounded-xl border border-paper-line bg-paper-card p-3"
            >
              <div className="min-w-[10rem] flex-1">
                <p className="text-sm font-semibold break-words text-coal">
                  {entry.title}
                </p>

                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                    style={categoryPillStyle(entry.category)}
                  >
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                    {category.label}
                  </span>

                  {/* Einträge ohne Datum gibt es bewusst — dann fällt die Angabe weg. */}
                  {date && <span className="hint">{date}</span>}

                  <span className="hint font-semibold">
                    {memories === 1 ? "1 Erinnerung" : `${memories} Erinnerungen`}
                  </span>

                  {/* Warum dieser Vorschlag hier steht — das nimmt dem Feld das Rätselhafte. */}
                  <span className="hint text-coal-faint">{hit.reason}</span>
                </div>

                {/* Der Anfang der Beschreibung: das eigentliche Erkennungsmerkmal. */}
                {excerpt && (
                  <p className="hint mt-1.5 leading-relaxed break-words">
                    {excerpt}
                    {plain.length > EXCERPT_MAX ? " …" : ""}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => onChoose(entry)}
                className="btn-ghost similar-join min-h-11 shrink-0 text-xs"
              >
                Meine Erinnerung hier dazuschreiben
                <span className="sr-only"> zu „{entry.title}“</span>
              </button>
            </li>
          );
        })}
      </ul>

      {/*
        Der zweite Weg. Er sieht bewusst wie ein Knopf aus und nicht wie ein
        Kleingedrucktes: „Nein“ ist hier eine vollwertige Antwort, keine
        Ausrede.
      */}
      <button
        type="button"
        onClick={onDismiss}
        className="btn-ghost similar-deny mt-3 min-h-11 w-full text-xs sm:w-auto"
      >
        Nein, meins ist etwas anderes
      </button>
    </section>
  );
}

/*
 * Zusätzlich als benannter Export: Die übrigen Formular-Komponenten werden so
 * eingebunden (`import { RankChoice } from "./RankChoice"`). So funktionieren
 * beide Schreibweisen und der Einbau ins Formular kann sich aussuchen, welche
 * besser passt.
 */
export { SimilarEntries };
