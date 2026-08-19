"use client";

import { categoryById, categoryPillStyle } from "@/lib/categories";
import { formatEntryDate } from "@/lib/dates";
import type { SimilarHit } from "@/lib/similarity";
import type { Entry } from "@/lib/types";
import "./similarEntries.css";

/** Mehr als drei Vorschläge sind keine Hilfe mehr, sondern eine zweite Aufgabe. */
const MAX_SHOWN = 3;

export interface SimilarEntriesProps {
  hits: SimilarHit[];
  /** Anzahl bereits vorhandener Stimmen zu einem Eintrag. */
  voiceCount: (entryId: string) => number;
  /** „Meine Erinnerung dort ergänzen“ */
  onChoose: (entry: Entry) => void;
  /** „Nein, das ist etwas anderes“ — Vorschläge ausblenden. */
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
 * Vorschläge unter dem Titelfeld: „Das gibt es schon — willst du dich
 * anschließen?“
 *
 * Am Aktionstag tragen mehrere Menschen dasselbe Thema getrennt ein
 * („Berlinfahrt“ steht dreimal in der Datenbank). Deshalb zeigt dieses Feld
 * beim Tippen, was es schon gibt, und bietet an, die eigene Erinnerung dort
 * DAZUZUSCHREIBEN, statt einen zweiten Punkt auf der Achse anzulegen.
 *
 * Bewusst kein Dialog und kein Overlay:
 *
 *  · Es blockiert nichts. Wer weitertippen will, tippt weiter — das Feld
 *    steht unter dem Eingabefeld und nimmt keinen Fokus.
 *  · Es behauptet nichts. Der Text fragt, er stellt nicht fest; die
 *    Ähnlichkeitssuche kann sich irren, und „Nein, meins ist etwas anderes“
 *    ist genauso gültig wie ein Treffer.
 *  · Es bleibt kurz. Höchstens drei Vorschläge, jeder mit Datum, Kategorie
 *    und der Zahl der Erinnerungen, die schon daran hängen — genug, um zu
 *    erkennen, ob es dasselbe Thema ist.
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
            className="text-sm font-bold text-coal"
          >
            Daran erinnert sich schon jemand
          </h3>
          <p className="hint mt-1 max-w-prose leading-relaxed">
            Ist eines davon dein Thema? Dann schreib deine Erinnerung dort dazu
            — so steht ihr gemeinsam auf dem Zeitstrahl statt zweimal einzeln.
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
          const voices = voiceCount(entry.id);

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

                  {voices > 0 && (
                    <span className="hint font-semibold">
                      {voices === 1 ? "1 Erinnerung" : `${voices} Erinnerungen`}
                    </span>
                  )}

                  {/* Warum dieser Vorschlag hier steht — das nimmt dem Feld das Rätselhafte. */}
                  <span className="hint text-coal-faint">{hit.reason}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onChoose(entry)}
                className="btn-ghost similar-join min-h-11 shrink-0 text-xs"
              >
                Meine Erinnerung dazuschreiben
                <span className="sr-only"> zu „{entry.title}“</span>
              </button>
            </li>
          );
        })}
      </ul>

      <button type="button" onClick={onDismiss} className="similar-dismiss mt-1 text-xs">
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
