"use client";

import { useEffect, useId, useRef } from "react";
import RichText from "@/components/RichText";
import { categoryById, categoryPillStyle } from "@/lib/categories";
import type { Entry, Voice } from "@/lib/types";
import "./memoryCloud.css";

interface VoicePanelProps {
  entry: Entry;
  /** Alle Stimmen zu diesem Thema, älteste zuerst. Kann leer sein. */
  voices: Voice[];
  /** Erinnerungen insgesamt: der Eintrag selbst plus seine Stimmen. */
  memories: number;
  onClose: () => void;
  /** Den ganzen Eintrag öffnen (Bilder, Ton, Verwaltung) — schließt die Wolke. */
  onOpenEntry: () => void;
  /** Nur gesetzt, wenn jemand angemeldet ist. */
  onAddVoice?: () => void;
}

/**
 * Die Menschen hinter einem Wort.
 *
 * Wer auf ein Wort der Wolke tippt, will nicht „einen Datensatz" sehen,
 * sondern erfahren, WER sich woran erinnert. Genau das steht hier: der
 * Eintrag mit seiner Beschreibung, und darunter jede weitere Stimme mit
 * Vorname, Klasse und Text.
 *
 * Alle drei Angaben sind freiwillig — am Aktionstag schreibt jemand nur
 * „war super" ohne Namen, jemand anders nur seine Klasse. Die Darstellung
 * hält jede Mischung aus: Fehlt der Name, fehlt die Zeile; fehlt alles außer
 * dem Text, steht eben nur der Text.
 *
 * WARUM EIN PANEL UND NICHT DAS DETAIL-FENSTER: Die Wolke lädt zum Stöbern
 * ein — ein Wort, noch eins, noch eins. Ein Modal müsste man dafür jedes Mal
 * schließen und die Wolke verschwände jedes Mal hinter einem grauen Schleier.
 * Das Panel legt sich stattdessen an den Rand, die Wolke bleibt sichtbar und
 * in Bewegung, und der nächste Klick tauscht einfach den Inhalt aus. Wer
 * mehr will (Bilder, Ton, Bearbeiten), kommt über den Knopf unten ins
 * vollständige Fenster.
 */
export default function VoicePanel({
  entry,
  voices,
  memories,
  onClose,
  onOpenEntry,
  onAddVoice,
}: VoicePanelProps) {
  const titleId = useId();
  const rootRef = useRef<HTMLElement>(null);

  const category = categoryById(entry.category);

  /*
   * Beim Öffnen wandert der Fokus hierher. Für die Tastatur ist das der
   * springende Punkt: Sonst stünde man nach dem Klick auf ein Wort weiter
   * mitten in der Wolke und müsste sich durch alle übrigen Wörter tabben,
   * um zu erfahren, was der Klick bewirkt hat.
   */
  useEffect(() => {
    rootRef.current?.focus();
  }, [entry.id]);

  const attribution = (voice: Voice) =>
    [
      voice.author_name?.trim() || null,
      voice.class_name?.trim() ? `Klasse ${voice.class_name.trim()}` : null,
    ]
      .filter(Boolean)
      .join(", ");

  const meta = [
    entry.class_name ? `Klasse ${entry.class_name}` : null,
    entry.author_name ? `Erzählt von ${entry.author_name}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <aside
      ref={rootRef}
      tabIndex={-1}
      role="group"
      aria-labelledby={titleId}
      className="mcf-panel card absolute z-20 flex flex-col overflow-hidden shadow-(--shadow-pop) outline-none"
    >
      {/* ------------------------------------------------------------- Kopf */}
      <header className="shrink-0 border-b border-paper-line px-5 pt-4 pb-3.5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
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

            <h3
              id={titleId}
              className="mt-2.5 text-[17px] leading-snug font-bold text-balance text-coal"
            >
              {entry.title}
            </h3>

            {/*
              Die Zahl ausgeschrieben — in der Wolke steht nur „· 4", weil eine
              Pille sonst zum Satz würde. Hier ist Platz für das ganze Wort.
            */}
            <p className="mt-1 text-[12px] leading-5 text-coal-soft tabular-nums">
              {memories === 1 ? "1 Erinnerung" : `${memories} Erinnerungen`}
              <span className="text-coal-faint"> · ohne Jahreszahl</span>
            </p>

            {meta && <p className="mt-0.5 text-[12px] text-coal-faint">{meta}</p>}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Stimmen schließen"
            className="mcf-x flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-paper-line bg-paper-card text-coal-soft"
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M3.5 3.5l9 9M12.5 3.5l-9 9"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </header>

      {/* ------------------------------------------------------------ Inhalt */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
        {entry.description && (
          <RichText text={entry.description} className="text-coal" />
        )}

        {voices.length > 0 ? (
          <section className={entry.description ? "mt-5" : ""}>
            <h4 className="label mb-2.5">
              {voices.length === 1
                ? "Eine weitere Stimme"
                : `${voices.length} weitere Stimmen`}
            </h4>

            {/*
              Wie im Detail-Fenster: ein Zitat, kein Kommentar. Farbiger Strich
              in der Kategoriefarbe, der Text, darunter leise die Herkunft.
              Der Text kommt als React-Kind ins Dokument, nie als HTML.
            */}
            <ul className="flex flex-col gap-2.5">
              {voices.map((voice) => {
                const from = attribution(voice);
                return (
                  <li
                    key={voice.id}
                    className="relative rounded-xl bg-paper-sunk py-3 pr-3.5 pl-4"
                  >
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-2.5 left-0 w-[3px] rounded-full"
                      style={{ backgroundColor: category.color, opacity: 0.5 }}
                    />
                    <p className="text-[14px] leading-relaxed whitespace-pre-line text-coal">
                      {voice.body}
                    </p>
                    {from && (
                      <p className="mt-1.5 text-[11px] text-coal-faint">— {from}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : (
          <p
            className={`text-[13px] leading-relaxed text-coal-faint ${
              entry.description ? "mt-5" : ""
            }`}
          >
            Bisher erinnert sich nur eine Person hieran — und du?
          </p>
        )}
      </div>

      {/* ------------------------------------------------------------- Fuß */}
      <footer className="flex shrink-0 flex-col gap-2 border-t border-paper-line px-5 py-3.5">
        {onAddVoice && (
          <button type="button" onClick={onAddVoice} className="btn-accent w-full">
            Auch meine Erinnerung dazuschreiben
          </button>
        )}
        <button type="button" onClick={onOpenEntry} className="btn-ghost w-full">
          Ganzen Eintrag öffnen
        </button>
      </footer>
    </aside>
  );
}
