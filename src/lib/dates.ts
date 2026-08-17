import type { Entry, SmartDate } from "./types";

export const MIN_YEAR = 1900;
export const MAX_YEAR = 2100;

const GERMAN_MONTHS = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
] as const;

export function monthName(month: number): string {
  return GERMAN_MONTHS[month - 1] ?? "";
}

function isValid(d: SmartDate): boolean {
  if (!Number.isInteger(d.year) || d.year < MIN_YEAR || d.year > MAX_YEAR) {
    return false;
  }
  if (d.month !== undefined) {
    if (!Number.isInteger(d.month) || d.month < 1 || d.month > 12) return false;
  }
  if (d.day !== undefined) {
    if (d.month === undefined) return false;
    if (!Number.isInteger(d.day) || d.day < 1 || d.day > 31) return false;
    // Echte Datumsprüfung (lehnt z. B. 31.02. ab)
    const probe = new Date(Date.UTC(d.year, d.month - 1, d.day));
    if (
      probe.getUTCFullYear() !== d.year ||
      probe.getUTCMonth() !== d.month - 1 ||
      probe.getUTCDate() !== d.day
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Smarter Datums-Parser für deutsche Eingaben:
 *   "1996"        → { year: 1996 }
 *   "3.1996"      → { year: 1996, month: 3 }        (auch "03/1996")
 *   "12.3.1996"   → { year: 1996, month: 3, day: 12 }
 *   "1996-03-12"  → ISO wird ebenfalls akzeptiert
 * Liefert null bei ungültiger Eingabe.
 */
export function parseSmartDate(raw: string): SmartDate | null {
  const input = raw.trim();
  if (!input) return null;

  let m = /^(\d{4})$/.exec(input);
  if (m) {
    const d: SmartDate = { year: Number(m[1]) };
    return isValid(d) ? d : null;
  }

  m = /^(\d{1,2})[./](\d{4})$/.exec(input);
  if (m) {
    const d: SmartDate = { year: Number(m[2]), month: Number(m[1]) };
    return isValid(d) ? d : null;
  }

  m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(input);
  if (m) {
    const d: SmartDate = {
      year: Number(m[3]),
      month: Number(m[2]),
      day: Number(m[1]),
    };
    return isValid(d) ? d : null;
  }

  m = /^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/.exec(input);
  if (m) {
    const d: SmartDate = {
      year: Number(m[1]),
      month: Number(m[2]),
      ...(m[3] ? { day: Number(m[3]) } : {}),
    };
    return isValid(d) ? d : null;
  }

  return null;
}

/** „1996“ · „März 1996“ · „12. März 1996“ */
export function formatSmartDate(d: SmartDate): string {
  if (d.month !== undefined && d.day !== undefined) {
    return `${d.day}. ${monthName(d.month)} ${d.year}`;
  }
  if (d.month !== undefined) {
    return `${monthName(d.month)} ${d.year}`;
  }
  return String(d.year);
}

export function entryToSmartDate(
  e: Pick<Entry, "year" | "month" | "day">
): SmartDate {
  return {
    year: e.year,
    ...(e.month != null ? { month: e.month } : {}),
    ...(e.day != null ? { day: e.day } : {}),
  };
}

export function formatEntryDate(
  e: Pick<Entry, "year" | "month" | "day">
): string {
  return formatSmartDate(entryToSmartDate(e));
}

/**
 * Position auf der Zeitachse als Bruchteil-Jahr:
 *   nur Jahr   → Jahresmitte (1996.5)
 *   Jahr+Monat → Monatsmitte
 *   volles Datum → Tagesmitte (über Tag-des-Jahres, schaltjahresfest)
 */
export function yearFraction(d: SmartDate): number {
  if (d.month !== undefined && d.day !== undefined) {
    const start = Date.UTC(d.year, 0, 1);
    const t = Date.UTC(d.year, d.month - 1, d.day, 12);
    const yearMs = Date.UTC(d.year + 1, 0, 1) - start;
    return d.year + (t - start) / yearMs;
  }
  if (d.month !== undefined) {
    return d.year + (d.month - 0.5) / 12;
  }
  return d.year + 0.5;
}

export function entryYearFraction(
  e: Pick<Entry, "year" | "month" | "day">
): number {
  return yearFraction(entryToSmartDate(e));
}

/** Heutiges Datum als Bruchteil-Jahr (rechter Rand des Zeitstrahls). */
export function nowYearFraction(): number {
  const now = new Date();
  const start = Date.UTC(now.getFullYear(), 0, 1);
  const yearMs = Date.UTC(now.getFullYear() + 1, 0, 1) - start;
  return now.getFullYear() + (now.getTime() - start) / yearMs;
}
