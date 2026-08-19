"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Entry } from "@/lib/types";
import { toEntry } from "./useEntries";

type Operation = "insert" | "update" | "delete";

export interface UseRealtimeEntriesOptions {
  /**
   * Abo überhaupt aufbauen? Standard: ja. Steht die Live-Übertragung in den
   * Einstellungen auf „aus", wird gar kein Kanal geöffnet — die Ansicht zeigt
   * dann den Stand vom Laden.
   */
  enabled?: boolean;
  /** Zeile existiert (und ist per RLS lesbar) → in den State übernehmen. */
  onUpsert: (entry: Entry) => void;
  /** Zeile existiert nachweislich nicht mehr → aus dem State entfernen. */
  onRemove: (id: string) => void;
  /** Zusätzlich bei frischen INSERTs (für Kameraflug / Toast). */
  onInserted?: (entry: Entry) => void;
  /**
   * Zusätzlich bei UPDATEs — für Ansichten, die wissen müssen, dass genau
   * dieser Eintrag gerade von jemand anderem verändert wurde.
   * Optional; wer nur eine Liste pflegt, braucht weiterhin nur `onUpsert`.
   */
  onUpdated?: (entry: Entry) => void;
  /**
   * An diesem Thema hat jemand eine weitere Erinnerung ergänzt (oder die
   * Verwaltung eine entfernt). Übergeben wird die id des EINTRAGS, nicht der
   * Stimme — nachgeladen wird ohnehin das ganze Bündel.
   */
  onVoiceChanged?: (entryId: string) => void;
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
 *
 * Scheitert die Verbindung (Verbindungslimit erreicht, Netz weg, Kanal
 * geschlossen), passiert nichts Lautes: `connected` bleibt bzw. wird `false`,
 * die Seite läuft mit dem Stand vom Laden weiter. Es gibt bewusst keinen
 * Fehlerdialog — der Zeitstrahl ist eine Tafel, kein Arbeitsplatz.
 */
export function useRealtimeEntries(opts: UseRealtimeEntriesOptions): {
  connected: boolean;
} {
  const [connected, setConnected] = useState(false);
  const enabled = opts.enabled ?? true;

  // Callbacks über Refs, damit der Channel nicht bei jedem Render neu aufgebaut wird.
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    if (!enabled) {
      setConnected(false);
      return;
    }

    let cancelled = false;
    const channel = supabase.channel("timeline");

    const handle =
      (op: Operation) =>
      async (message: Record<string, unknown>): Promise<void> => {
        const id = extractId(message?.payload);
        if (!id) return;

        try {
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
            else if (op === "update") optsRef.current.onUpdated?.(entry);
          } else {
            // Keine Zeile mehr sichtbar → wirklich weg (oder nie sichtbar gewesen).
            optsRef.current.onRemove(id);
          }
        } catch {
          /* Netz weg o. Ä. — der nächste Broadcast holt es nach. */
        }
      };

    channel
      .on("broadcast", { event: "insert" }, (msg) => void handle("insert")(msg))
      .on("broadcast", { event: "update" }, (msg) => void handle("update")(msg))
      .on("broadcast", { event: "delete" }, (msg) => void handle("delete")(msg))
      // Stimmen kommen über ein eigenes Ereignis herein; der Payload trägt die
      // id des Eintrags, an dem sich etwas getan hat.
      .on("broadcast", { event: "voice" }, (msg) => {
        const entryId = extractId(
          (msg as Record<string, unknown>)?.payload
        );
        if (entryId) optsRef.current.onVoiceChanged?.(entryId);
      })
      // Zweiter Parameter ist der Fehler; er wird bewusst verschluckt.
      // `CHANNEL_ERROR`/`TIMED_OUT` heißt hier nur: kein Live-Betrieb.
      .subscribe((status) => {
        if (!cancelled) setConnected(status === "SUBSCRIBED");
      });

    return () => {
      cancelled = true;
      setConnected(false);
      try {
        void supabase.removeChannel(channel);
      } catch {
        /* Kanal war nie offen — dann gibt es auch nichts abzuräumen. */
      }
    };
  }, [enabled]);

  return { connected };
}
