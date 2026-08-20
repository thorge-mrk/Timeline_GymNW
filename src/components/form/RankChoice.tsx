"use client";

/**
 * Meilenstein — das einzige Merkmal, das noch von Hand gesetzt wird.
 *
 * Vorher standen hier drei Stufen zur Auswahl (normal / wichtig / Meilenstein).
 * Zwei davon sind weggefallen, und zwar aus zwei verschiedenen Gründen:
 *
 *   „Wichtig“ war eine Behauptung. Jetzt entscheidet die Startseite: Woran
 *   sich mehrere Menschen erinnern (Stimmen an einem Thema), wird von selbst
 *   zur größeren Karte. Wichtigkeit wächst also — sie wird nicht angekreuzt.
 *   Deshalb schreibt dieses Formular is_important überhaupt nicht mehr.
 *
 *   „Normal“ ist kein Zustand, den man wählt, sondern der Normalfall. Ein
 *   Auswahlfeld mit drei Zeilen, von denen zwei nie stimmen sollen, ist genau
 *   die Art Ballast, die am Aktionstag Zeit kostet.
 *
 * Übrig bleibt ein einziges Häkchen für die Eckdaten der Schulgeschichte
 * (Gründung 1971, 50 Jahre GymNW). Es gibt es NUR beim Bearbeiten und NUR für
 * Admin-Konten — beim Anlegen ist ein Eintrag nie ein Meilenstein, und die
 * Datenbank sieht das genauso (Policies entries_insert_contributor und
 * entries_update_own_editor).
 */

/** Ist dieser gespeicherte Eintrag ein Meilenstein? (fürs Bearbeiten). */
export function milestoneOf(
  entry: { is_milestone?: boolean | null } | null | undefined
): boolean {
  return entry?.is_milestone === true;
}

/** Giebel und Säulen — das Zeichen für die größte Stufe. */
function MonumentIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0 text-navy"
    >
      <path d="M12 3.4 3.9 7.6h16.2z" />
      <path d="M6.6 10.2v6.4M12 10.2v6.4M17.4 10.2v6.4" />
      <path d="M3.9 19.4h16.2" />
    </svg>
  );
}

export interface RankChoiceProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function RankChoice({
  checked,
  onChange,
  disabled = false,
}: RankChoiceProps) {
  return (
    <div>
      <span className="label">Bedeutung auf dem Zeitstrahl</span>
      {/* Dieselbe Optik wie die anderen Wahlzeilen — ein Häkchen ist hier keine
          Sonderform, sondern die einzige verbliebene Entscheidung. */}
      <div
        className="choice-row rounded-xl border p-3.5
          has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2
          has-[:focus-visible]:outline-fox"
        data-on={checked}
      >
        <label
          className={`flex min-h-11 items-start gap-3 ${
            disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
          }`}
        >
          <input
            id="entry-milestone"
            type="checkbox"
            className="mt-0.5 h-5 w-5 shrink-0 accent-fox"
            checked={checked}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span className="min-w-0 text-sm">
            <span className="flex items-center gap-1.5 font-semibold text-coal">
              <MonumentIcon />
              Meilenstein der Schulgeschichte
            </span>
            <span className="hint mt-0.5 block leading-relaxed">
              Große Karte mit Bild auf dem Zeitstrahl — für die Eckdaten der
              Schule selbst, etwa die Gründung 1971 oder „50 Jahre GymNW“.
              Persönliche Erinnerungen bleiben ohne Häkchen.
            </span>
          </span>
        </label>
      </div>
    </div>
  );
}
