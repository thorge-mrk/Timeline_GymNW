"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CategoryId } from "@/lib/categories";
import type { Database } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";
import type { Entry } from "@/lib/types";

type EntryRow = Database["public"]["Tables"]["entries"]["Row"];

/** PostgREST liefert maximal 1000 Zeilen pro Anfrage. */
const PAGE_SIZE = 1000;
/** Sicherheitsnetz gegen Endlosschleifen. */
const MAX_PAGES = 50;

/** DB-Zeile → App-Typ. Die Kategorie ist in der DB `text` mit CHECK-Constraint. */
export function toEntry(row: EntryRow): Entry {
  return { ...row, category: row.category as CategoryId };
}

/** Chronologische Sortierung wie im Server-Query (sort_date, dann id). */
export function compareEntries(a: Entry, b: Entry): number {
  const byDate = (a.sort_date ?? "").localeCompare(b.sort_date ?? "");
  return byDate !== 0 ? byDate : a.id.localeCompare(b.id);
}

/** Fügt einen Eintrag ein oder ersetzt ihn und hält die Liste sortiert. */
export function upsertEntry(list: Entry[], entry: Entry): Entry[] {
  const exists = list.some((e) => e.id === entry.id);
  const next = exists
    ? list.map((e) => (e.id === entry.id ? entry : e))
    : [...list, entry];
  return next.sort(compareEntries);
}

export interface UseEntriesResult {
  entries: Entry[];
  setEntries: React.Dispatch<React.SetStateAction<Entry[]>>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Lädt alle Zeitstrahl-Einträge. Bewusst „alles auf einmal": Der Zeitstrahl
 * braucht den kompletten Datenbestand, um Gesamtbereich und Spuren zu berechnen.
 * Wegen des PostgREST-Limits wird in 1000er-Blöcken per `.range()` geladen.
 */
export function useEntries(): UseEntriesResult {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Zählt Anfragen mit, damit veraltete Antworten verworfen werden. */
  const requestRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refetch = useCallback(async () => {
    const request = ++requestRef.current;
    setLoading(true);
    setError(null);

    const collected: Entry[] = [];
    try {
      for (let page = 0; page < MAX_PAGES; page++) {
        const from = page * PAGE_SIZE;
        const { data, error: queryError } = await supabase
          .from("entries")
          .select("*")
          .order("sort_date", { ascending: true, nullsFirst: true })
          .order("id", { ascending: true })
          .range(from, from + PAGE_SIZE - 1);

        if (queryError) throw new Error(queryError.message);
        if (!data || data.length === 0) break;

        for (const row of data) collected.push(toEntry(row));
        if (data.length < PAGE_SIZE) break;
      }

      if (!mountedRef.current || request !== requestRef.current) return;
      setEntries(collected);
      setError(null);
    } catch (cause) {
      if (!mountedRef.current || request !== requestRef.current) return;
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(message);
    } finally {
      if (mountedRef.current && request === requestRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { entries, setEntries, loading, error, refetch };
}
