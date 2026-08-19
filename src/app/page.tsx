"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import SchoolMark from "@/components/SchoolMark";
import { nowYearFraction } from "@/lib/dates";
import { splitByDate } from "@/lib/entryGroups";
import { timelineDomain } from "@/lib/timelinePosition";
import type { Entry } from "@/lib/types";
import { upsertEntry, useEntries } from "@/hooks/useEntries";
import { useRealtimeEntries } from "@/hooks/useRealtimeEntries";
import { useVoices } from "@/hooks/useVoices";
import { useSettings } from "@/hooks/useSettings";
import FilterBar, {
  INITIAL_FILTER,
  usesClassFilter,
  type FilterState,
} from "@/components/timeline/FilterBar";
import EntryDetailModal from "@/components/timeline/EntryDetailModal";
import MemoryCloud from "@/components/timeline/MemoryCloud";
import NewEntriesBeacon from "@/components/timeline/NewEntriesBeacon";
import WelcomeCurtain from "@/components/timeline/WelcomeCurtain";
import Timeline, { type FocusRequest } from "@/components/timeline/Timeline";
import { useAuth } from "@/hooks/useAuth";
import "@/components/timeline/timeline.css";

/**
 * Nach dieser Ruhezeit gilt der Zeitstrahl als „unbenutzt" — dann fliegt die
 * Kamera von selbst zum nächsten neuen Eintrag. Acht Sekunden, weil vor der
 * Tafel Menschen stehen und lesen: Wer einen langen Text durchgeht, hat nach
 * drei Sekunden noch lange nicht aufgehört hinzusehen.
 */
const IDLE_BEFORE_FLIGHT_MS = 8000;

/** So oft wird geprüft, ob die Ruhezeit erreicht ist. */
const IDLE_CHECK_MS = 1000;

/**
 * Ab so vielen zusätzlichen Stimmen gilt ein Thema als wichtig und bekommt die
 * größere Karte. Zwei genügen: Sobald sich ein zweiter Mensch an dasselbe
 * erinnert, ist es keine Einzelerinnerung mehr — und genau das soll man sehen.
 */
const IMPORTANT_FROM_VOICES = 2;

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
  const router = useRouter();
  const { entries, setEntries, loading, error, refetch } = useEntries();
  const { index: voiceIndex, refetchEntry: refetchVoices } = useVoices();
  const [filter, setFilter] = useState<FilterState>(INITIAL_FILTER);
  const [focus, setFocus] = useState<FocusRequest | null>(null);

  /** Neue Einträge, die noch niemand angesehen hat (ältester zuerst). */
  const [pending, setPending] = useState<Entry[]>([]);
  /** Liegt ein Fenster über dem Zeitstrahl? Dann ruht der Zähler-Kreis. */
  const [overlayOpen, setOverlayOpen] = useState(false);

  /** Zeitpunkt der letzten Nutzer-Interaktion mit dem Zeitstrahl. */
  const lastInteractionRef = useRef(0);
  const focusNonceRef = useRef(0);

  /** Live-Übertragung und Vollbild sind pro Gerät einstellbar. */
  const { settings } = useSettings();
  /** Angemeldet? Dann darf man zu einem Thema dazuschreiben. */
  const { isContributor } = useAuth();

  /** Ist die Erinnerungs-Wolke aufgeklappt? */
  const [cloudOpen, setCloudOpen] = useState(false);
  /** Aus der Wolke geöffnetes Thema — der Zeitstrahl hat sein eigenes Fenster. */
  const [cloudEntry, setCloudEntry] = useState<Entry | null>(null);

  /*
   * Liegt irgendetwas über dem Zeitstrahl? Dann ruhen Zähler-Kreis und
   * Selbstlauf. Die offene Wolke gehört ausdrücklich dazu: Wer darin stöbert,
   * soll nicht merken, dass hinter ihm die Kamera weiterfliegt.
   */
  const overlayVisible = overlayOpen || cloudEntry !== null || cloudOpen;

  /** Immer der aktuelle Stand der Schlange — für den Selbstlauf weiter unten. */
  const pendingRef = useRef<Entry[]>(pending);
  pendingRef.current = pending;

  const now = useMemo(() => nowYearFraction(), []);

  /*
   * Erinnerungen mit und ohne Jahreszahl gehen hier auseinander. Auf die Achse
   * kommt nur, was ein Datum hat — alles andere sammelt sich in der Wolke
   * darunter. Getrennt wird VOR dem Filter, damit die Achse nicht plötzlich
   * andere Grenzen bekommt, bloß weil jemand eine Kategorie anklickt.
   */
  const { dated, undated } = useMemo(() => splitByDate(entries), [entries]);

  // Gesamtbereich aus allen DATIERTEN Einträgen.
  const domain = useMemo(() => timelineDomain(dated, now), [dated, now]);

  /*
   * WICHTIGKEIT WIRD NICHT MEHR AUSGEWÄHLT, SIE WÄCHST.
   *
   * Früher konnte man beim Eintragen ankreuzen „das ist wichtig". Das war eine
   * Behauptung. Jetzt entscheidet, wie viele Menschen dieselbe Erinnerung
   * teilen: Wer allein an etwas denkt, bekommt eine Pille; woran sich mehrere
   * erinnern, wird zur größeren Karte. Ein Thema wird also nicht wichtig, weil
   * jemand das Kästchen gefunden hat, sondern weil es viele betrifft.
   *
   * Meilensteine bleiben davon unberührt — das sind die Eckdaten der Schule
   * selbst und nicht das Ergebnis einer Abstimmung.
   */
  const ranked = useMemo(
    () =>
      dated.map((entry) =>
        !entry.is_milestone &&
        !entry.is_important &&
        voiceIndex.count(entry.id) >= IMPORTANT_FROM_VOICES
          ? { ...entry, is_important: true }
          : entry
      ),
    [dated, voiceIndex]
  );

  const filtered = useMemo(
    () => ranked.filter((entry) => matchesFilter(entry, filter)),
    [ranked, filter]
  );

  /** Die datumslosen Erinnerungen — vom selben Filter erfasst. */
  const filteredUndated = useMemo(
    () => undated.filter((entry) => matchesFilter(entry, filter)),
    [undated, filter]
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

  /** Wie viele Menschen hängen an diesem Thema? Der Zähler an Pille und Wolke. */
  const voiceCount = useCallback(
    (entryId: string) => voiceIndex.count(entryId),
    [voiceIndex]
  );

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
   * Ein neuer Eintrag ist eingetroffen. Er stellt sich hinten in die Schlange —
   * der Kreis unten links zählt einen hoch. Angesehen wird er entweder per
   * Klick oder von selbst, sobald acht Sekunden lang niemand etwas getan hat.
   * Wer gerade zoomt oder schiebt, wird also nie unterbrochen.
   */
  const handleInserted = useCallback((entry: Entry) => {
    setPending((current) =>
      current.some((e) => e.id === entry.id) ? current : [...current, entry]
    );
  }, []);

  /** Zum nächsten neuen Eintrag springen und ihn aus der Schlange nehmen. */
  const handleJump = useCallback(
    (entry: Entry) => {
      setPending((current) => current.filter((e) => e.id !== entry.id));
      focusEntry(entry);
    },
    [focusEntry]
  );

  /*
   * Der Selbstlauf. Geprüft wird sekündlich, geflogen erst nach der vollen
   * Ruhezeit — und nach jedem Flug beginnt sie von vorn. So arbeitet sich die
   * Kamera in ruhigem Takt durch die Schlange, statt sie in einem Rutsch
   * abzuräumen. Liegt ein Fenster über dem Zeitstrahl, ruht der Selbstlauf:
   * Wer gerade liest, will nicht weggeflogen werden.
   */
  useEffect(() => {
    if (pending.length === 0 || overlayVisible) return;
    const timer = window.setInterval(() => {
      if (Date.now() - lastInteractionRef.current < IDLE_BEFORE_FLIGHT_MS) {
        return;
      }
      lastInteractionRef.current = Date.now();
      const next = pendingRef.current[0];
      if (next) handleJump(next);
    }, IDLE_CHECK_MS);
    return () => window.clearInterval(timer);
  }, [pending.length, overlayVisible, handleJump]);

  /*
   * Live-Übertragung — nur, wenn sie eingeschaltet ist. Ist sie aus, wird gar
   * kein Kanal geöffnet: Die Seite zeigt dann den Stand vom Laden, und der
   * Zähler-Kreis bleibt entsprechend leer.
   */
  useRealtimeEntries({
    enabled: settings.realtime,
    onUpsert: handleUpsert,
    onRemove: handleRemove,
    onInserted: handleInserted,
    // Ergänzt jemand eine Erinnerung, wächst die Zahl am Thema mit — ohne
    // dass deshalb die Kamera losfliegt: Es ist kein neuer Ort, nur eine
    // weitere Stimme am selben.
    onVoiceChanged: refetchVoices,
  });

  // Wird die Übertragung abgeschaltet, verschwindet auch die Warteschlange:
  // Ein Zähler, der nicht mehr weiterzählt, wäre nur noch ein Rätsel.
  useEffect(() => {
    if (!settings.realtime) setPending([]);
  }, [settings.realtime]);

  const noteInteraction = useCallback(() => {
    lastInteractionRef.current = Date.now();
  }, []);

  /** Ein Fenster aus der Wolke verdeckt den Zeitstrahl genauso wie eins vom Strahl. */
  /** Zu einem Thema dazuschreiben — der Weg führt ins Formular. */
  const goAddVoice = useCallback(
    (entry: Entry) => router.push(`/eintragen/?ergaenzen=${entry.id}`),
    [router]
  );

  // Der Ruhezeit-Zähler startet mit dem Laden der Seite, nicht bei null —
  // sonst gälte der allererste Moment schon als „acht Sekunden nichts getan".
  useEffect(() => {
    lastInteractionRef.current = Date.now();
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <FilterBar
        filter={filter}
        onChange={setFilter}
        classOptions={classOptions}
        count={filtered.length + filteredUndated.length}
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
            voiceCount={voiceCount}
            voicesFor={voiceIndex.forEntry}
            onAddVoice={isContributor ? goAddVoice : undefined}
            onVoicesChanged={refetchVoices}
            emptyHint={
              filtered.length === 0
                ? "Zu diesem Filter gibt es noch keine Einträge."
                : null
            }
          />
        )}

        <NewEntriesBeacon
          pending={pending}
          hidden={overlayVisible}
          onJump={handleJump}
        />
      </div>

      {/*
        Die Erinnerungen ohne Jahreszahl. Sie stehen UNTER dem Zeitstrahl, nicht
        darauf — ein eigener Ort für alles, was sich nicht datieren lässt, ohne
        dass jemand ein Datum erfinden müsste. Ist die Wolke leer, gibt die
        Komponente `null` zurück und nimmt keinen Platz weg.
      */}
      <MemoryCloud
        entries={filteredUndated}
        voiceCount={voiceCount}
        voicesFor={voiceIndex.forEntry}
        onOpen={setCloudEntry}
        onAddVoice={isContributor ? goAddVoice : undefined}
        onVoicesChanged={refetchVoices}
        open={cloudOpen}
        onOpenChange={setCloudOpen}
      />

      {cloudEntry && (
        <EntryDetailModal
          entry={cloudEntry}
          onClose={() => setCloudEntry(null)}
          onDeleted={(id) => {
            handleRemove(id);
            setCloudEntry(null);
          }}
          voices={voiceIndex.forEntry(cloudEntry.id)}
          onAddVoice={isContributor ? goAddVoice : undefined}
          onVoicesChanged={refetchVoices}
        />
      )}

      {/* Einmal kurz sagen, was das hier ist — dann aus dem Weg. */}
      <WelcomeCurtain ready={!loading && entries.length > 0} />
    </div>
  );
}
