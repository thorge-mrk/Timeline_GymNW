"use client";

export interface LiveEntriesBadgeProps {
  /** Wie viele fremde Einträge seit dem Öffnen dieser Seite dazugekommen sind. */
  count: number;
  /** Titel des jüngsten Eintrags — steht klein und gekürzt unter dem Zähler. */
  latestTitle: string | null;
  /** Zähler auf 0 zurücksetzen und die Pille ausblenden. */
  onDismiss: () => void;
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3.5 3.5l9 9M12.5 3.5l-9 9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Schwebender Live-Zähler für die Eintragsseite.
 *
 * Am Aktionstag tragen mehrere Personen gleichzeitig ein — wer hier gerade
 * tippt, soll das mitbekommen. Nur darf davon nichts die eigene Eingabe stören:
 *
 *  · Die Pille sitzt unten links; der Absende-Knopf steht rechts/unten.
 *  · Zeigereingaben fängt ausschließlich die Pille ab (siehe `.live-badge` in
 *    form.css) — über dem Formular liegt keine unsichtbare Fläche.
 *  · Der Klick öffnet den Zeitstrahl in einem NEUEN Tab. Eine halb getippte
 *    Erinnerung darf nie verloren gehen.
 *
 * Die Hülle bleibt dauerhaft im DOM: Nur so liest ein Screenreader die
 * Änderungen der Live-Region vor (eine frisch eingefügte Region wird von
 * manchen Hilfsmitteln überhört).
 */
export function LiveEntriesBadge({
  count,
  latestTitle,
  onDismiss,
}: LiveEntriesBadgeProps) {
  return (
    <div className="live-badge" role="status" aria-live="polite">
      {count > 0 && (
        <div className="live-badge__pill card animate-slide-up-in flex items-center gap-1 border-navy-line bg-navy p-1.5 shadow-(--shadow-pop)">
          <a
            href="/"
            target="_blank"
            rel="noopener"
            title="Zeitstrahl in einem neuen Tab öffnen"
            className="live-badge__open flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl py-1.5 pr-2 pl-2.5"
          >
            {/* `key` = Zähler: Bei jedem neuen Eintrag pulst der Punkt erneut. */}
            <span
              key={count}
              aria-hidden
              className="animate-pulse-ring h-2 w-2 shrink-0 rounded-full bg-fox"
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-paper">
                {count === 1 ? "1 neuer Eintrag" : `${count} neue Einträge`}
              </span>
              {latestTitle && (
                <span className="mt-0.5 block truncate text-xs text-paper/70">
                  {latestTitle}
                </span>
              )}
              <span className="sr-only">
                — Zeitstrahl in einem neuen Tab öffnen
              </span>
            </span>
          </a>

          <button
            type="button"
            onClick={onDismiss}
            aria-label="Hinweis ausblenden"
            className="live-badge__close flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-paper/60"
          >
            <CloseIcon />
          </button>
        </div>
      )}
    </div>
  );
}
