"use client";

import type { Entry } from "@/lib/types";
import "./timeline.css";

/** Ab hier wird nicht mehr ausgezählt, sondern abgekürzt („+9+"). */
const COUNT_CAP = 9;

interface NewEntriesBeaconProps {
  /** Noch nicht angesehene neue Einträge, ältester zuerst. */
  pending: Entry[];
  /** Liegt ein Fenster über dem Zeitstrahl? Dann tritt der Kreis zur Seite. */
  hidden: boolean;
  /** Springt zum übergebenen Eintrag. */
  onJump: (entry: Entry) => void;
}

/**
 * Der Zähler-Kreis unten links — mehr ist es nicht, und mehr soll es nicht sein.
 *
 * Er steht IMMER an derselben Stelle und zeigt schlicht „+3": so viele neue
 * Einträge sind eingetroffen, seit man zuletzt hingesehen hat. Ein Klick fliegt
 * zum ältesten davon, die Zahl zählt herunter; bei null wird der Kreis
 * unsichtbar (und nicht gelöscht — er wartet nur).
 *
 * Bewusst weggefallen ist die frühere Textmeldung samt Verwandlungsanimation:
 * Auf einer Tafel, vor der Menschen stehen, ist eine Karte, die auftaucht,
 * etwas sagt und wieder zusammenfährt, mehr Unruhe als Information. Die Zahl
 * genügt — und was sie meint, erklärt der Sprung.
 *
 * Liegt ein Fenster über dem Zeitstrahl, wird der Kreis nur AUSGEBLENDET. Sein
 * Zustand lebt in der Seite weiter, es geht also nichts verloren.
 */
export default function NewEntriesBeacon({
  pending,
  hidden,
  onJump,
}: NewEntriesBeaconProps) {
  const count = pending.length;
  const visible = count > 0 && !hidden;
  const target = pending[0];

  const countLabel = count > COUNT_CAP ? `${COUNT_CAP}+` : String(count);
  const label =
    count === 1
      ? "Ein neuer Eintrag — dorthin springen"
      : `${count} neue Einträge — zum nächsten springen`;

  return (
    <div
      role="status"
      aria-live="polite"
      data-state={visible ? "open" : "hidden"}
      className="tl-beacon-slot absolute bottom-4 left-4 z-30 sm:bottom-12 sm:left-5"
    >
      <span className="sr-only">{visible ? label : ""}</span>

      <button
        type="button"
        aria-label={label}
        // Ausgeblendet heißt auch: nicht per Tabulator erreichbar.
        tabIndex={visible ? 0 : -1}
        aria-hidden={visible ? undefined : true}
        onClick={() => {
          if (target) onJump(target);
        }}
        className="tl-beacon flex cursor-pointer items-center justify-center border border-navy-line bg-navy font-bold text-paper tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fox"
      >
        <span
          aria-hidden="true"
          className={`leading-none ${
            countLabel.length > 1 ? "text-[14px]" : "text-[16px]"
          }`}
        >
          +{countLabel}
        </span>
      </button>
    </div>
  );
}
