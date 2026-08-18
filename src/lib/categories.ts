/**
 * Single Source of Truth für Kategorien (muss zum CHECK-Constraint der DB passen).
 *
 * Jede Kategorie bringt eine kleine Farbfamilie mit, damit Einträge überall
 * gleich aussehen und auf Papier gut lesbar bleiben:
 *   base  – die Farbe selbst (Punkte, Achsenmarken, kräftige Flächen)
 *   ink   – dunkle Variante für Text auf hellem Grund (Kontrast > 7:1)
 *   tint  – sehr helle Fläche für ganze Pillen und Badges
 *   line  – Rahmen zur Tint-Fläche
 * Bewusst kein Schwarz und kein Grau: Die Kategorien sollen sich auch auf
 * einem Beamer klar unterscheiden.
 */
export type CategoryId =
  | "schule"
  | "schueler"
  | "lehrer"
  | "ehemalige"
  | "sonstiges";

export interface Category {
  id: CategoryId;
  label: string;
  /** Kräftige Grundfarbe */
  color: string;
  /** Dunkle Textvariante */
  ink: string;
  /** Helle Füllfläche */
  tint: string;
  /** Rahmenfarbe zur Füllfläche */
  line: string;
  description: string;
}

export const CATEGORIES: readonly Category[] = [
  {
    id: "schule",
    label: "Schule",
    color: "#2a6fa8",
    ink: "#1b4c74",
    tint: "#e8f1f8",
    line: "#bad5e8",
    description: "Offizielle Ereignisse und Meilensteine der Schule",
  },
  {
    id: "schueler",
    label: "Schüler",
    color: "#d97918",
    ink: "#8f4e0b",
    tint: "#fcefe1",
    line: "#f1d0a7",
    description: "Erinnerungen von Schülerinnen und Schülern",
  },
  {
    id: "lehrer",
    label: "Lehrkräfte",
    color: "#2e7d6b",
    ink: "#1e5548",
    tint: "#e6f2ef",
    line: "#b5d7ce",
    description: "Erinnerungen und Infos aus dem Kollegium",
  },
  {
    id: "ehemalige",
    label: "Ehemalige",
    color: "#7a5aa8",
    ink: "#533a76",
    tint: "#f0ebf8",
    line: "#d0c2e5",
    description: "Erinnerungen von Ehemaligen (z. B. „meine 10. Klasse 1996“)",
  },
  {
    id: "sonstiges",
    label: "Sonstiges",
    color: "#a8604a",
    ink: "#7a4234",
    tint: "#f8ece8",
    line: "#e5c8bf",
    description: "Alles, was sonst nirgends passt",
  },
] as const;

export function categoryById(id: string): Category {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[4];
}

/** Kategorien, bei denen eine Klassen-Angabe sinnvoll ist (Filter + Formular). */
export const CLASS_CATEGORIES: readonly CategoryId[] = ["schueler", "ehemalige"];

/**
 * Inline-Styles für eine ganze Pille in Kategoriefarbe (Marker, Chips, Badges).
 * Helle Fläche + farbiger Rahmen + dunkle Schrift — bunt UND lesbar.
 */
export function categoryPillStyle(id: string): React.CSSProperties {
  const c = categoryById(id);
  return { backgroundColor: c.tint, borderColor: c.line, color: c.ink };
}
