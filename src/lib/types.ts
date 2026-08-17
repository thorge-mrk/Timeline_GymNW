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

export type AppRole = "admin" | "editor";

/** Flexibles Datum: nur Jahr, Jahr+Monat oder volles Datum. */
export interface SmartDate {
  year: number;
  month?: number;
  day?: number;
}
