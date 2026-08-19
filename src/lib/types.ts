import type { Database } from "./database.types";
import type { CategoryId } from "./categories";

/** Ein Zeitstrahl-Eintrag, wie er aus der DB kommt. */
export type Entry = Omit<
  Database["public"]["Tables"]["entries"]["Row"],
  "category"
> & { category: CategoryId };

export type EntryInsert = Omit<
  Database["public"]["Tables"]["entries"]["Insert"],
  "category"
> & { category: CategoryId };

/**
 * Eine weitere Erinnerung zu einem bestehenden Eintrag.
 *
 * Wenn zehn Menschen „Amerika-Austausch“ eintragen, wird daraus nicht zehnmal
 * derselbe Punkt auf der Achse, sondern ein Thema mit zehn Stimmen — jede mit
 * eigenem Text und eigenem Namen.
 */
export type Voice = Database["public"]["Tables"]["entry_voices"]["Row"];
export type VoiceInsert = Database["public"]["Tables"]["entry_voices"]["Insert"];

export type AppRole = "admin" | "editor";

/**
 * Flexibles Datum: nur Jahr, Jahr+Monat oder volles Datum — oder eben gar
 * nichts. „Weiß ich nicht mehr“ ist am Aktionstag die häufigste Antwort, und
 * eine Erinnerung ohne Jahreszahl ist keine schlechtere Erinnerung.
 */
export interface SmartDate {
  year: number;
  month?: number;
  day?: number;
}

/** Hat der Eintrag einen Platz auf der Achse? */
export function isDated(
  entry: Entry
): entry is Entry & { year: number; sort_date: string } {
  return entry.year !== null && entry.sort_date !== null;
}
