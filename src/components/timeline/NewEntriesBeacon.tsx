"use client";

import { useEffect, useState } from "react";
import { categoryById } from "@/lib/categories";
import type { Entry } from "@/lib/types";
import "./timeline.css";

/** So lange steht die Meldung, bevor sie zum Zähler zusammenfährt. */
const MESSAGE_MS = 4200;
/** Ab hier wird nicht mehr ausgezählt, sondern abgekürzt („12+"). */
const COUNT_CAP = 12;

export interface Announcement {
  entry: Entry;
  /** Erhöht sich bei jedem neuen Eintrag — auch für denselben Titel. */
  nonce: number;
}

interface NewEntriesBeaconProps {
  /** Zuletzt eingetroffener Eintrag — löst die Meldung aus. */
  announcement: Announcement | null;
  /** Noch nicht angesehene neue Einträge, ältester zuerst. */
  pending: Entry[];
  /** Wie viele Einträge dieser Serie schon angeflogen wurden. */
  seen: number;
  /** Liegt ein Fenster über dem Zeitstrahl? Dann hat der Kreis dort nichts zu suchen. */
  hidden: boolean;
  /** Springt zum übergebenen Eintrag. */
  onJump: (entry: Entry) => void;
}

/**
 * Die Live-Meldung unten links — und was danach von ihr übrig bleibt.
 *
 * Zwei Zustände, eine Bewegung:
 *   1. „«Titel» wurde eingetragen" — eine Navy-Karte mit Kategorie-Akzent.
 *   2. Nach ein paar Sekunden fährt dieselbe Karte zu einem runden Zähler
 *      zusammen: Breite und Radius wandern, der Text blendet aus, die Zahl ein.
 *      Es ist bewusst DASSELBE Element — man sieht, dass die Meldung nicht
 *      verschwindet, sondern sich zusammenrollt und wartet.
 *
 * Ein Klick springt zum jeweils nächsten neuen Eintrag; der Zähler zeigt dabei
 * den Fortschritt („3/5"). Ist der letzte erreicht, verschwindet er.
 *
 * Warum hier ausnahmsweise `width` animiert wird: Genau das ist die Bewegung,
 * die erzählt wird. Das Element ist absolut positioniert und hat keine
 * Geschwister im Fluss — der Reflow bleibt auf diese eine Box beschränkt.
 * Alles andere (Text, Zahl, Druck) läuft über `transform` und `opacity`.
 */
export default function NewEntriesBeacon({
  announcement,
  pending,
  seen,
  hidden,
  onJump,
}: NewEntriesBeaconProps) {
  const [phase, setPhase] = useState<"message" | "counter">("counter");
  const [shownNonce, setShownNonce] = useState<number | null>(null);

  // Ein neuer Eintrag holt die Meldung zurück — noch während des Renderns,
  // damit der erste sichtbare Frame schon der Startframe ist.
  const nonce = announcement?.nonce ?? null;
  if (nonce !== null && nonce !== shownNonce) {
    setShownNonce(nonce);
    setPhase("message");
  }

  useEffect(() => {
    if (phase !== "message") return;
    const timer = window.setTimeout(() => setPhase("counter"), MESSAGE_MS);
    return () => window.clearTimeout(timer);
  }, [phase, shownNonce]);

  const total = seen + pending.length;
  const showMessage = phase === "message" && announcement !== null;
  const visible = !hidden && (showMessage || pending.length > 0);

  /** Ziel eines Klicks: der gemeldete Eintrag, sonst der nächste offene. */
  const target = showMessage ? announcement.entry : pending[0];

  const countLabel =
    seen > 0
      ? `${seen}/${total}`
      : pending.length > COUNT_CAP
        ? `${COUNT_CAP}+`
        : String(pending.length);

  const label = showMessage
    ? `„${announcement.entry.title}“ wurde eingetragen — anzeigen`
    : seen > 0
      ? `Eintrag ${seen} von ${total} — zum nächsten springen`
      : pending.length === 1
        ? "Ein neuer Eintrag — anzeigen"
        : `${pending.length} neue Einträge — zum nächsten springen`;

  const category = announcement
    ? categoryById(announcement.entry.category)
    : null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-state={visible ? "open" : "hidden"}
      className="tl-beacon-slot absolute right-4 bottom-4 left-4 z-30 flex justify-start sm:bottom-12 sm:left-5"
    >
      <span className="sr-only">{visible ? label : ""}</span>

      <button
        type="button"
        data-phase={showMessage ? "message" : "counter"}
        aria-label={label}
        onClick={() => {
          setPhase("counter");
          if (target) onJump(target);
        }}
        className="tl-beacon relative cursor-pointer border border-navy-line bg-navy text-left text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fox"
      >
        {announcement && category && (
          <span aria-hidden="true" className="tl-beacon__msg">
            <span
              className="tl-beacon__accent"
              style={{ backgroundColor: category.color }}
            />
            <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 py-2 pr-4 pl-3.5">
              <span className="truncate text-[13.5px] leading-5 font-semibold">
                „{announcement.entry.title}“{" "}
                <span className="font-normal text-paper/70">
                  wurde eingetragen
                </span>
              </span>
              <span className="flex items-center gap-1.5 text-[10.5px] leading-4 text-paper/55">
                <span
                  aria-hidden="true"
                  className="animate-pulse-ring h-1.5 w-1.5 shrink-0 rounded-full bg-fox"
                />
                <span className="truncate tabular-nums">
                  {category.label} · {announcement.entry.year}
                </span>
              </span>
            </span>
          </span>
        )}

        <span
          aria-hidden="true"
          className={`tl-beacon__count absolute inset-0 flex items-center justify-center font-bold tabular-nums ${
            countLabel.length > 1 ? "text-[12.5px]" : "text-[15px]"
          }`}
        >
          {countLabel}
        </span>
      </button>
    </div>
  );
}
