"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { indexVoices, type VoiceIndex } from "@/lib/entryGroups";
import { supabase } from "@/lib/supabase";
import type { Voice } from "@/lib/types";

/** PostgREST liefert höchstens 1000 Zeilen pro Anfrage. */
const PAGE_SIZE = 1000;
const MAX_PAGES = 50;

export interface UseVoicesResult {
  voices: Voice[];
  index: VoiceIndex;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  /** Eine einzelne Stimme nachladen bzw. entfernen — für Realtime. */
  refetchEntry: (entryId: string) => Promise<void>;
}

/**
 * Lädt alle Stimmen auf einmal.
 *
 * Das klingt großzügig, ist aber die richtige Größenordnung: Selbst ein voller
 * Aktionstag bringt einige hundert Ergänzungen, und der Zeitstrahl braucht
 * ohnehin von jedem Thema zu wissen, wie viele Menschen daran hängen — sonst
 * könnte er weder die Wolke gewichten noch die Zähler an den Pillen zeigen.
 */
export function useVoices(): UseVoicesResult {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

    const collected: Voice[] = [];
    try {
      for (let page = 0; page < MAX_PAGES; page++) {
        const from = page * PAGE_SIZE;
        const { data, error: queryError } = await supabase
          .from("entry_voices")
          .select("*")
          .order("created_at", { ascending: true })
          .range(from, from + PAGE_SIZE - 1);

        if (queryError) throw new Error(queryError.message);
        if (!data || data.length === 0) break;
        collected.push(...data);
        if (data.length < PAGE_SIZE) break;
      }

      if (!mountedRef.current || request !== requestRef.current) return;
      setVoices(collected);
      setError(null);
    } catch (cause) {
      if (!mountedRef.current || request !== requestRef.current) return;
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (mountedRef.current && request === requestRef.current) {
        setLoading(false);
      }
    }
  }, []);

  /**
   * Nur die Stimmen EINES Themas erneuern. Der Broadcast sagt uns lediglich,
   * an welchem Eintrag sich etwas getan hat — was genau, holen wir uns
   * regulär und damit RLS-geprüft.
   */
  const refetchEntry = useCallback(async (entryId: string) => {
    try {
      const { data, error: queryError } = await supabase
        .from("entry_voices")
        .select("*")
        .eq("entry_id", entryId)
        .order("created_at", { ascending: true });

      if (queryError || !mountedRef.current) return;
      const fresh = data ?? [];
      setVoices((current) => [
        ...current.filter((v) => v.entry_id !== entryId),
        ...fresh,
      ]);
    } catch {
      /* Netz weg — der nächste Hinweis holt es nach. */
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const index = useMemo(() => indexVoices(voices), [voices]);

  return { voices, index, loading, error, refetch, refetchEntry };
}
