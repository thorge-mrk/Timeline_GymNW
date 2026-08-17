"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { nowYearFraction } from "@/lib/dates";
import { timelineDomain } from "@/lib/timelinePosition";
import type { Entry } from "@/lib/types";
import { upsertEntry, useEntries } from "@/hooks/useEntries";
import { useRealtimeEntries } from "@/hooks/useRealtimeEntries";
import FilterBar, {
  INITIAL_FILTER,
  usesClassFilter,
  type FilterState,
} from "@/components/timeline/FilterBar";
import RealtimeToast from "@/components/timeline/RealtimeToast";
import Timeline, { type FocusRequest } from "@/components/timeline/Timeline";

/** Nach dieser Ruhezeit gilt der Zeitstrahl als „unbenutzt" — dann fliegt die Kamera. */
const IDLE_BEFORE_FLIGHT_MS = 3000;

function matchesFilter(entry: Entry, filter: FilterState): boolean {
  if (filter.category === "alle") return true;
  if (filter.category === "meilensteine") return entry.is_milestone;
  if (entry.category !== filter.category) return false;
  if (filter.className && entry.class_name !== filter.className) return false;
  return true;
}

export default function Home() {
  const { entries, setEntries, loading, error, refetch } = useEntries();
  const [filter, setFilter] = useState<FilterState>(INITIAL_FILTER);
  const [focus, setFocus] = useState<FocusRequest | null>(null);
  const [toastEntry, setToastEntry] = useState<Entry | null>(null);

  /** Zeitpunkt der letzten Nutzer-Interaktion mit dem Zeitstrahl. */
  const lastInteractionRef = useRef(0);
  const focusNonceRef = useRef(0);

  const now = useMemo(() => nowYearFraction(), []);
  // Gesamtbereich aus ALLEN Einträgen — Filter sollen die Achse nicht verschieben.
  const domain = useMemo(() => timelineDomain(entries, now), [entries, now]);

  const filtered = useMemo(
    () => entries.filter((entry) => matchesFilter(entry, filter)),
    [entries, filter]
  );

  const classOptions = useMemo(() => {
    if (!usesClassFilter(filter.category)) return [];
    const names = new Set<string>();
    for (const entry of entries) {
      if (entry.category === filter.category && entry.class_name) {
        names.add(entry.class_name);
      }
    }
    return [...names].sort((a, b) =>
      a.localeCompare(b, "de", { numeric: true, sensitivity: "base" })
    );
  }, [entries, filter.category]);

  /** Fliegt zu einem Eintrag; blendet dafür nötigenfalls den Filter aus. */
  const focusEntry = useCallback(
    (entry: Entry) => {
      setFilter((current) =>
        matchesFilter(entry, current) ? current : INITIAL_FILTER
      );
      focusNonceRef.current += 1;
      setFocus({ id: entry.id, nonce: focusNonceRef.current });
      setToastEntry(null);
    },
    []
  );

  const handleUpsert = useCallback(
    (entry: Entry) => setEntries((current) => upsertEntry(current, entry)),
    [setEntries]
  );

  const handleRemove = useCallback(
    (id: string) =>
      setEntries((current) => current.filter((entry) => entry.id !== id)),
    [setEntries]
  );

  const handleInserted = useCallback(
    (entry: Entry) => {
      const idle = Date.now() - lastInteractionRef.current;
      if (idle > IDLE_BEFORE_FLIGHT_MS) {
        focusEntry(entry);
      } else {
        setToastEntry(entry);
      }
    },
    [focusEntry]
  );

  useRealtimeEntries({
    onUpsert: handleUpsert,
    onRemove: handleRemove,
    onInserted: handleInserted,
  });

  const noteInteraction = useCallback(() => {
    lastInteractionRef.current = Date.now();
  }, []);

  const dismissToast = useCallback(() => setToastEntry(null), []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <FilterBar
        filter={filter}
        onChange={setFilter}
        classOptions={classOptions}
        count={filtered.length}
      />

      <div
        className="relative flex min-h-0 flex-1 flex-col"
        onPointerDownCapture={noteInteraction}
        onWheelCapture={noteInteraction}
        onTouchStartCapture={noteInteraction}
      >
        {loading && entries.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <span
              role="status"
              aria-label="Zeitstrahl wird geladen"
              className="h-8 w-8 animate-spin rounded-full border-2 border-paper-line border-t-navy"
            />
          </div>
        ) : error && entries.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-6">
            <div className="card max-w-md p-6 text-center">
              <p className="font-semibold text-coal">
                Der Zeitstrahl konnte nicht geladen werden.
              </p>
              <p className="hint mt-1.5 break-words">{error}</p>
              <button
                type="button"
                className="btn-primary mt-4"
                onClick={() => void refetch()}
              >
                Erneut versuchen
              </button>
            </div>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-6">
            <div className="card max-w-md p-6 text-center">
              <p className="font-semibold text-coal">
                Noch keine Einträge — die Geschichte beginnt bald!
              </p>
              <p className="hint mt-1.5">
                Sobald der erste Eintrag angelegt ist, erscheint er hier
                automatisch.
              </p>
            </div>
          </div>
        ) : (
          <Timeline
            entries={filtered}
            domain={domain}
            focus={focus}
            onEntryDeleted={handleRemove}
            emptyHint={
              filtered.length === 0
                ? "Zu diesem Filter gibt es noch keine Einträge."
                : null
            }
          />
        )}

        {toastEntry && (
          <RealtimeToast
            entry={toastEntry}
            onShow={() => focusEntry(toastEntry)}
            onDismiss={dismissToast}
          />
        )}
      </div>
    </div>
  );
}
