/**
 * Single Source of Truth für Kategorien (muss zum CHECK-Constraint der DB passen).
 */
export type CategoryId =
  | "schule"
  | "schueler"
  | "lehrer"
  | "ehemalige"
  | "sonstiges";

export interface Category {
  id: CategoryId;
  /** Deutsches Label für Chips/Formulare */
  label: string;
  /** Markerfarbe auf dem Zeitstrahl */
  color: string;
  /** Kurzbeschreibung (Formular-Hilfe) */
  description: string;
}

export const CATEGORIES: readonly Category[] = [
  {
    id: "schule",
    label: "Schule",
    color: "#0b1338",
    description: "Offizielle Ereignisse und Meilensteine der Schule",
  },
  {
    id: "schueler",
    label: "Schüler",
    color: "#f6921e",
    description: "Erinnerungen von Schülerinnen und Schülern",
  },
  {
    id: "lehrer",
    label: "Lehrkräfte",
    color: "#15779b",
    description: "Erinnerungen und Infos aus dem Kollegium",
  },
  {
    id: "ehemalige",
    label: "Ehemalige",
    color: "#6e8b3d",
    description: "Erinnerungen von Ehemaligen (z. B. „meine 10. Klasse 1996“)",
  },
  {
    id: "sonstiges",
    label: "Sonstiges",
    color: "#55555a",
    description: "Alles, was sonst nirgends passt",
  },
] as const;

export function categoryById(id: string): Category {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[4];
}

/** Kategorien, bei denen eine Klassen-Angabe sinnvoll ist (Filter + Formular). */
export const CLASS_CATEGORIES: readonly CategoryId[] = ["schueler", "ehemalige"];
