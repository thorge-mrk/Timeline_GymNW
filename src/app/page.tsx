"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SchoolMark from "@/components/SchoolMark";
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
import NewEntriesBeacon, {
  type Announcement,
} from "@/components/timeline/NewEntriesBeacon";
import Timeline, { type FocusRequest } from "@/components/timeline/Timeline";
import "@/components/timeline/timeline.css";

/** Nach dieser Ruhezeit gilt der Zeitstrahl als „unbenutzt" — dann fliegt die Kamera. */
const IDLE_BEFORE_FLIGHT_MS = 3000;

/** Breiten der Platzhalter-Marker — unregelmäßig, damit es nach Zeitstrahl aussieht. */
const SKELETON_MARKERS = [86, 122, 96, 138, 92];

/**
 * Ladezustand: statt eines wirbelnden Rades schon die Form dessen zeigen, was
 * gleich kommt — Marker über der Achse, Karten darunter. Animiert wird nur die
 * Deckkraft, sehr langsam; das beruhigt, statt zu hetzen.
 */
function TimelineSkeleton() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-7 p-6">
      <div aria-hidden="true" className="w-full max-w-2xl">
        <div className="flex items-end gap-3 pb-3.5">
          {SKELETON_MARKERS.map((width, index) => (
            <span
              key={width}
              className="tl-skel h-[26px] rounded-full border border-paper-line bg-paper-sunk"
              style={{ width, animationDelay: `${index * 110}ms` }}
            />
          ))}
        </div>

        <span className="block h-[3px] w-full rounded-full bg-navy/15" />

        <div className="mt-7 flex gap-3.5">
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className="tl-skel h-28 flex-1 rounded-2xl border border-paper-line bg-paper-card"
              style={{ animationDelay: `${index * 140}ms` }}
            />
          ))}
        </div>
      </div>

      <p role="status" aria-live="polite" className="text-sm text-coal-soft">
        Zeitstrahl wird geladen …
      </p>
    </div>
  );
}

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

  /** Der zuletzt eingetroffene Eintrag — Stoff für die Meldung unten links. */
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  /** Neue Einträge, die noch niemand angesehen hat (ältester zuerst). */
  const [pending, setPending] = useState<Entry[]>([]);
  /** Wie viele Einträge dieser Serie schon angeflogen wurden („3 von 5"). */
  const [seen, setSeen] = useState(0);
  /** Liegt ein Fenster über dem Zeitstrahl? Dann ruht der Zähler-Kreis. */
  const [overlayOpen, setOverlayOpen] = useState(false);

  /** Zeitpunkt der letzten Nutzer-Interaktion mit dem Zeitstrahl. */
  const lastInteractionRef = useRef(0);
  const focusNonceRef = useRef(0);
  const announceNonceRef = useRef(0);

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
  const focusEntry = useCallback((entry: Entry) => {
    setFilter((current) =>
      matchesFilter(entry, current) ? current : INITIAL_FILTER
    );
    focusNonceRef.current += 1;
    setFocus({ id: entry.id, nonce: focusNonceRef.current });
  }, []);

  const handleUpsert = useCallback(
    (entry: Entry) => setEntries((current) => upsertEntry(current, entry)),
    [setEntries]
  );

  const handleRemove = useCallback(
    (id: string) => {
      setEntries((current) => current.filter((entry) => entry.id !== id));
      // Was gelöscht wurde, kann auch niemand mehr ansteuern.
      setPending((current) => current.filter((entry) => entry.id !== id));
    },
    [setEntries]
  );

  /**
   * Ein neuer Eintrag ist eingetroffen. Gemeldet wird er immer — unten links.
   * Ob die Kamera auch hinfliegt, entscheidet die Ruhezeit: Wer gerade zoomt
   * oder schiebt, wird nicht unterbrochen; sein Eintrag reiht sich in den
   * Zähler ein und kann später der Reihe nach angesehen werden.
   */
  const handleInserted = useCallback(
    (entry: Entry) => {
      announceNonceRef.current += 1;
      setAnnouncement({ entry, nonce: announceNonceRef.current });

      if (Date.now() - lastInteractionRef.current > IDLE_BEFORE_FLIGHT_MS) {
        focusEntry(entry);
        return;
      }

      setPending((current) =>
        current.some((e) => e.id === entry.id) ? current : [...current, entry]
      );
    },
    [focusEntry]
  );

  /** Klick auf Meldung oder Zähler-Kreis: zum nächsten neuen Eintrag. */
  const handleJump = useCallback(
    (entry: Entry) => {
      if (pending.some((e) => e.id === entry.id)) {
        setPending((current) => current.filter((e) => e.id !== entry.id));
        setSeen((count) => count + 1);
      }
      focusEntry(entry);
    },
    [pending, focusEntry]
  );

  // Ist die Serie durchgesehen, beginnt die Zählung wieder bei null.
  useEffect(() => {
    if (pending.length === 0 && seen !== 0) setSeen(0);
  }, [pending.length, seen]);

  useRealtimeEntries({
    onUpsert: handleUpsert,
    onRemove: handleRemove,
    onInserted: handleInserted,
  });

  const noteInteraction = useCallback(() => {
    lastInteractionRef.current = Date.now();
  }, []);

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
          <TimelineSkeleton />
        ) : error && entries.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-6">
            <div className="card animate-fade-up max-w-md p-8 text-center shadow-(--shadow-card-lg)">
              <span
                aria-hidden="true"
                className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brick/10 text-brick"
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 7.5v5.5M12 16.6v.2"
                    stroke="currentColor"
                    strokeWidth="2.1"
                    strokeLinecap="round"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  />
                </svg>
              </span>
              <p className="mt-5 text-base font-bold text-coal">
                Der Zeitstrahl konnte nicht geladen werden.
              </p>
              <p className="hint mt-2 break-words">{error}</p>
              <button
                type="button"
                className="btn-primary mt-5"
                onClick={() => void refetch()}
              >
                Erneut versuchen
              </button>
            </div>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-6">
            <div className="card animate-fade-up max-w-md p-8 text-center shadow-(--shadow-card-lg)">
              <span
                aria-hidden="true"
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-fox-soft"
              >
                <SchoolMark className="h-8 w-auto text-fox" />
              </span>
              <p className="mt-5 text-base font-bold text-coal">
                Noch keine Einträge — die Geschichte beginnt bald!
              </p>
              <p className="hint mt-2">
                Sobald der erste Eintrag angelegt ist, erscheint er hier
                automatisch.
              </p>
              <span
                aria-hidden="true"
                className="mx-auto mt-6 block h-[2px] w-10 rounded-full bg-fox"
              />
            </div>
          </div>
        ) : (
          <Timeline
            entries={filtered}
            domain={domain}
            focus={focus}
            onEntryDeleted={handleRemove}
            onOverlayChange={setOverlayOpen}
            filterKey={`${filter.category}:${filter.className ?? ""}`}
            emptyHint={
              filtered.length === 0
                ? "Zu diesem Filter gibt es noch keine Einträge."
                : null
            }
          />
        )}

        <NewEntriesBeacon
          announcement={announcement}
          pending={pending}
          seen={seen}
          hidden={overlayOpen}
          onJump={handleJump}
        />
      </div>
    </div>
  );
}
