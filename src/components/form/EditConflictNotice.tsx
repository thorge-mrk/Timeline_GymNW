"use client";

import Link from "next/link";

export type EditConflict = "changed" | "deleted";

export interface EditConflictNoticeProps {
  kind: EditConflict;
  /** Nur bei „changed“: holt die aktuelle Fassung aus der Datenbank. */
  onReload: () => void;
  /** Nur bei „changed“: Hinweis wegklicken und weitertippen. */
  onDismiss: () => void;
}

/**
 * Hinweis, wenn jemand anderes am selben Eintrag gearbeitet hat.
 *
 * Beides passiert nur im Bearbeiten-Modus und beides greift bewusst NICHT in
 * das Formular ein: Nichts wird ungefragt überschrieben, nichts verschwindet.
 * Der Mensch entscheidet, ob die fremde Fassung übernommen wird.
 */
export function EditConflictNotice({
  kind,
  onReload,
  onDismiss,
}: EditConflictNoticeProps) {
  if (kind === "deleted") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="card animate-fade-up mb-5 border-brick/25 bg-brick/8 p-5 shadow-(--shadow-card)"
      >
        <p className="text-sm font-bold text-coal">
          Dieser Eintrag wurde inzwischen von jemand anderem gelöscht.
        </p>
        <p className="hint mt-1.5 max-w-prose leading-relaxed">
          Speichern ist deshalb nicht mehr möglich. Die Eingaben bleiben unten
          stehen — falls etwas davon erhalten bleiben soll, am besten
          herauskopieren und als neuen Eintrag anlegen.
        </p>
        <Link href="/" className="btn-primary mt-4 min-h-11">
          Zum Zeitstrahl
        </Link>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="card animate-fade-up mb-5 flex flex-wrap items-center gap-x-4 gap-y-3 border-paper-line bg-paper-sunk p-4"
    >
      <div className="min-w-[14rem] flex-1">
        <p className="text-sm font-semibold text-coal">
          Dieser Eintrag wurde gerade von jemand anderem geändert.
        </p>
        <p className="hint mt-1 max-w-prose leading-relaxed">
          Hier bleibt alles so stehen, wie es getippt wurde. „Neu laden“ holt
          die fremde Fassung — die eigenen Änderungen gehen dabei verloren.
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button type="button" className="btn-ghost min-h-11" onClick={onReload}>
          Neu laden
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Hinweis ausblenden"
          className="btn-ghost h-11 w-11 shrink-0 px-0 text-coal-faint"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path
              d="M3.5 3.5l9 9M12.5 3.5l-9 9"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
