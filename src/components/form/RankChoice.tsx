"use client";

/**
 * Rangstufe eines Eintrags — wie groß er auf dem Zeitstrahl erscheint.
 *
 * In der Datenbank stehen dafür zwei Spalten (is_milestone, is_important), die
 * sich gegenseitig ausschließen: Die Bedingung entries_rank_exclusive lässt
 * beide nie gleichzeitig zu. Im Formular ist es deshalb bewusst *eine* Auswahl
 * mit drei Möglichkeiten — so kann man gar nicht erst etwas Verbotenes
 * einstellen.
 *
 * „Meilenstein“ dürfen nur Admin-Konten setzen (auch die Datenbank prüft das);
 * für Eintrag-Konten taucht die Möglichkeit deshalb gar nicht erst auf.
 */

export type EntryRank = "normal" | "important" | "milestone";

/** Die beiden Datenbankspalten — nie beide gleichzeitig true. */
export interface RankFlags {
  is_milestone: boolean;
  is_important: boolean;
}

/** Rang eines gespeicherten Eintrags (fürs Bearbeiten). */
export function rankOf(
  entry: { is_milestone?: boolean | null; is_important?: boolean | null } | null | undefined
): EntryRank {
  if (entry?.is_milestone) return "milestone";
  if (entry?.is_important) return "important";
  return "normal";
}

/**
 * Rang → Spalten. Ohne Adminrechte wird aus „Meilenstein“ ein „Wichtig“:
 * Die Datenbank würde den Meilenstein sonst ablehnen und das Speichern
 * abbrechen — und die Absicht „das ist besonders“ bleibt so erhalten.
 */
export function rankFlags(rank: EntryRank, isAdmin: boolean): RankFlags {
  const milestone = isAdmin && rank === "milestone";
  return { is_milestone: milestone, is_important: !milestone && rank !== "normal" };
}

function DotIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      className="h-4 w-4 shrink-0 text-coal-faint"
    >
      <circle cx="12" cy="12" r="4.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-4 w-4 shrink-0 text-fox"
    >
      <path d="M12 3.6l2.42 4.9 5.41.79-3.92 3.82.93 5.39L12 15.95l-4.84 2.55.93-5.39L4.17 9.29l5.41-.79z" />
    </svg>
  );
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

interface Option {
  id: EntryRank;
  title: string;
  hint: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

const OPTIONS: Option[] = [
  {
    id: "normal",
    title: "Normaler Eintrag",
    hint: "Erscheint als farbige Pille auf dem Zeitstrahl.",
    icon: <DotIcon />,
  },
  {
    id: "important",
    title: "Wichtig",
    hint: "Wichtige Einträge werden auf dem Zeitstrahl größer mit Bild angezeigt.",
    icon: <StarIcon />,
  },
  {
    id: "milestone",
    title: "Meilenstein (nur Admin)",
    hint: "Die größte Stufe: eine große Karte mit dem Titelbild.",
    icon: <MonumentIcon />,
    adminOnly: true,
  },
];

export interface RankChoiceProps {
  value: EntryRank;
  onChange: (rank: EntryRank) => void;
  /** Nur Admin-Konten sehen die dritte Möglichkeit. */
  allowMilestone: boolean;
  disabled?: boolean;
}

export function RankChoice({
  value,
  onChange,
  allowMilestone,
  disabled = false,
}: RankChoiceProps) {
  const options = OPTIONS.filter((o) => allowMilestone || !o.adminOnly);

  return (
    <div>
      <span className="label" id="entry-rank-label">
        Bedeutung auf dem Zeitstrahl
      </span>
      <div
        role="radiogroup"
        aria-labelledby="entry-rank-label"
        className="space-y-2"
      >
        {options.map((option) => {
          const active = value === option.id;
          return (
            <label
              key={option.id}
              data-on={active}
              className={`rank-option flex min-h-11 items-start gap-3 rounded-xl border p-3.5
                has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2
                has-[:focus-visible]:outline-fox ${
                  disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                }`}
            >
              <input
                type="radio"
                name="entry-rank"
                value={option.id}
                className="mt-0.5 h-5 w-5 shrink-0 accent-fox"
                checked={active}
                disabled={disabled}
                onChange={() => onChange(option.id)}
              />
              <span className="min-w-0 text-sm">
                <span className="flex items-center gap-1.5 font-semibold text-coal">
                  {option.icon}
                  {option.title}
                </span>
                <span className="hint mt-0.5 block leading-relaxed">
                  {option.hint}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
