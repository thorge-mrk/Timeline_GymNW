"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useEntries } from "@/hooks/useEntries";
import { findSimilarEntries, normalizeForMatch } from "@/lib/similarity";
import { supabase } from "@/lib/supabase";
import type { Entry } from "@/lib/types";
import SimilarEntries from "./SimilarEntries";

/**
 * „Gibt es das schon?“ — die Brücke zwischen Titelfeld und Ähnlichkeitssuche.
 *
 * Die eigentliche Suche und die Vorschlagsliste kommen aus zwei fremden
 * Dateien (src/lib/similarity.ts, ./SimilarEntries.tsx). Hier steht nur, was
 * das Formular dafür beisteuern muss: der Datenbestand, die Anzahl der Stimmen
 * je Eintrag und die Entscheidung, wann überhaupt gesucht wird.
 *
 * Diese Schale bleibt bewusst über alle Schritte hinweg eingehängt (der
 * Schritt wird nur ausgeblendet, nicht abgebaut) — sonst würde bei jedem
 * Schrittwechsel der komplette Datenbestand neu geladen.
 */

/** Unter drei Zeichen ist jeder Vorschlag geraten. */
const MIN_QUERY = 3;
/** Mehr als drei Vorschläge liest am Aktionstag niemand — die Anzeige zeigt ohnehin nicht mehr. */
const MAX_HITS = 3;

interface SimilarPanelProps {
  /** Der gerade getippte Titel. */
  query: string;
  /** Der Mensch wählt einen Vorschlag: ab in den Ergänzen-Modus. */
  onChoose: (entry: Entry) => void;
}

/**
 * Wie viele Erinnerungen hängen schon an einem Eintrag? Rein lesend, ein
 * einziger schlanker Aufruf. Geht er schief, zählt eben niemand mit — das ist
 * kein Grund, das Formular zu stören.
 */
function useVoiceCounts(): (entryId: string) => number {
  const [counts, setCounts] = useState<ReadonlyMap<string, number>>(
    () => new Map()
  );

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data, error } = await supabase
          .from("entry_voices")
          .select("entry_id");
        if (!active || error || !data) return;
        const map = new Map<string, number>();
        for (const row of data) {
          map.set(row.entry_id, (map.get(row.entry_id) ?? 0) + 1);
        }
        setCounts(map);
      } catch {
        /* Ohne Zählung geht es auch. */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return useCallback((entryId: string) => counts.get(entryId) ?? 0, [counts]);
}

export function SimilarPanel({ query, onChoose }: SimilarPanelProps) {
  const { entries } = useEntries();
  const voiceCount = useVoiceCounts();
  /**
   * Weggeklickt wird immer nur für genau diesen Titel. Tippt jemand weiter und
   * meint damit etwas anderes, dürfen die Vorschläge wiederkommen.
   */
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);

  const hits = useMemo(() => {
    if (query.trim().length < MIN_QUERY || entries.length === 0) return [];
    try {
      return findSimilarEntries(query, entries, { limit: MAX_HITS });
    } catch {
      // Fremder Code darf das Formular nicht mit in den Abgrund reißen —
      // am Aktionstag steht ein Mensch davor.
      return [];
    }
  }, [query, entries]);

  const normalized = useMemo(() => {
    try {
      return normalizeForMatch(query);
    } catch {
      return query.trim().toLowerCase();
    }
  }, [query]);

  const handleDismiss = useCallback(
    () => setDismissedFor(normalized),
    [normalized]
  );

  if (hits.length === 0 || dismissedFor === normalized) return null;

  return (
    <SimilarEntries
      hits={hits}
      voiceCount={voiceCount}
      onChoose={onChoose}
      onDismiss={handleDismiss}
    />
  );
}
