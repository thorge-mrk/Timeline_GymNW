"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Entry } from "@/lib/types";
import { toEntry } from "./useEntries";

type Operation = "insert" | "update" | "delete";

export interface UseRealtimeEntriesOptions {
  /** Zeile existiert (und ist per RLS lesbar) → in den State übernehmen. */
  onUpsert: (entry: Entry) => void;
  /** Zeile existiert nachweislich nicht mehr → aus dem State entfernen. */
  onRemove: (id: string) => void;
  /** Zusätzlich bei frischen INSERTs (für Kameraflug / Toast). */
  onInserted?: (entry: Entry) => void;
}

/**
 * Der Broadcast-Payload ist NUR ein Hinweis, keine Datenquelle. Er kommt über
 * einen öffentlichen Channel und ist damit prinzipiell fälschbar — deshalb wird
 * ausschließlich die id herausgelesen und die Zeile anschließend regulär (also
 * RLS-geprüft) nachgeladen.
 */
function extractId(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const record = payload as Record<string, unknown>;

  if (typeof record.id === "string") return record.id;
  // Defensive Varianten, falls der Trigger den Payload verschachtelt.
  if (typeof record.payload === "object" && record.payload !== null) {
    const nested = (record.payload as Record<string, unknown>).id;
    if (typeof nested === "string") return nested;
  }
  if (typeof record.record === "object" && record.record !== null) {
    const nested = (record.record as Record<string, unknown>).id;
    if (typeof nested === "string") return nested;
  }
  return null;
}

/**
 * Hört auf den öffentlichen Broadcast-Channel `timeline` und hält den lokalen
 * State aktuell. Bewusst ohne `postgres_changes` — die DB sendet nur `{op, id}`.
 */
export function useRealtimeEntries(opts: UseRealtimeEntriesOptions): {
  connected: boolean;
} {
  const [connected, setConnected] = useState(false);

  // Callbacks über Refs, damit der Channel nicht bei jedem Render neu aufgebaut wird.
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    let cancelled = false;
    const channel = supabase.channel("timeline");

    const handle =
      (op: Operation) =>
      async (message: Record<string, unknown>): Promise<void> => {
        const id = extractId(message?.payload);
        if (!id) return;

        // Immer nachladen: Der Payload sagt uns nur, WAS sich geändert hat.
        const { data, error } = await supabase
          .from("entries")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (cancelled || error) return;

        if (data) {
          const entry = toEntry(data);
          optsRef.current.onUpsert(entry);
          if (op === "insert") optsRef.current.onInserted?.(entry);
        } else {
          // Keine Zeile mehr sichtbar → wirklich weg (oder nie sichtbar gewesen).
          optsRef.current.onRemove(id);
        }
      };

    channel
      .on("broadcast", { event: "insert" }, (msg) => void handle("insert")(msg))
      .on("broadcast", { event: "update" }, (msg) => void handle("update")(msg))
      .on("broadcast", { event: "delete" }, (msg) => void handle("delete")(msg))
      .subscribe((status) => {
        if (!cancelled) setConnected(status === "SUBSCRIBED");
      });

    return () => {
      cancelled = true;
      setConnected(false);
      void supabase.removeChannel(channel);
    };
  }, []);

  return { connected };
}
