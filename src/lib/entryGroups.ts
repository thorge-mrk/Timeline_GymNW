import type { Entry, Voice } from "./types";

/**
 * Zwei Arten von Erinnerung — und beide sind gleich viel wert.
 *
 * Am Aktionstag weiß längst nicht jeder, wann etwas war. „Meine Einschulung",
 * „der Amerika-Austausch", „die eine Klassenfahrt" — das sind vollständige
 * Erinnerungen ohne Jahreszahl. Sie auf ein geratenes Datum zu schieben wäre
 * eine Erfindung, sie wegzulassen wäre ein Verlust. Also bekommen sie einen
 * eigenen Ort: die Erinnerungs-Wolke unter dem Zeitstrahl.
 */
export interface EntrySplit {
  /** Hat ein Jahr — steht auf der Achse. */
  dated: Entry[];
  /** Ohne Jahr — lebt in der Erinnerungs-Wolke. */
  undated: Entry[];
}

export function splitByDate(entries: Entry[]): EntrySplit {
  const dated: Entry[] = [];
  const undated: Entry[] = [];
  for (const entry of entries) {
    if (entry.year == null) undated.push(entry);
    else dated.push(entry);
  }
  return { dated, undated };
}

/**
 * Stimmen nach Eintrag gebündelt.
 *
 * Wenn zehn Menschen „Berlinfahrt" erinnern, hängen an einem Eintrag zehn
 * Stimmen. Die Zahl entscheidet, wie groß das Wort in der Wolke steht und ob
 * am Zeitstrahl ein Zähler erscheint — deshalb wird sie einmal gebildet und
 * überall dieselbe benutzt.
 */
export interface VoiceIndex {
  /** Stimmen je Eintrag, älteste zuerst. */
  byEntry: Map<string, Voice[]>;
  /** Anzahl der Stimmen — 0, wenn niemand ergänzt hat. */
  count: (entryId: string) => number;
  /** Alle Stimmen zu einem Eintrag (nie `undefined`). */
  forEntry: (entryId: string) => Voice[];
}

const NO_VOICES: readonly Voice[] = Object.freeze([]);

export function indexVoices(voices: Voice[]): VoiceIndex {
  const byEntry = new Map<string, Voice[]>();
  for (const voice of voices) {
    const list = byEntry.get(voice.entry_id);
    if (list) list.push(voice);
    else byEntry.set(voice.entry_id, [voice]);
  }
  // Innerhalb eines Themas chronologisch: so liest es sich wie ein Gespräch.
  for (const list of byEntry.values()) {
    list.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  return {
    byEntry,
    count: (entryId) => byEntry.get(entryId)?.length ?? 0,
    forEntry: (entryId) => byEntry.get(entryId) ?? (NO_VOICES as Voice[]),
  };
}

/**
 * Wie viele MENSCHEN stecken in diesem Thema?
 *
 * Das ist nicht dasselbe wie „Stimmen plus eins". Manche Themen sind aus
 * mehreren Zetteln zusammengefasst — „Pausen" etwa. Der Eintrag ist dort nur
 * die Überschrift, hinter der die einzelnen Erinnerungen hängen; er selbst
 * gehört niemandem. Ihn mitzuzählen hätte aus vier Menschen fünf gemacht.
 *
 * Der Eintrag zählt deshalb nur mit, wenn jemand ihn unterschrieben hat —
 * dann ist er die Erinnerung dieser Person. Und mindestens einer ist es
 * immer: Auch ein namenloser Beitrag kam von jemandem.
 */
export function totalVoices(
  index: VoiceIndex,
  entry: Pick<Entry, "id" | "author_name">
): number {
  return peopleFor(entry, index.count(entry.id));
}

/** Dieselbe Regel, wenn die Zahl der Ergänzungen schon bekannt ist. */
export function peopleFor(
  entry: Pick<Entry, "author_name">,
  voices: number
): number {
  return Math.max(1, voices + (entry.author_name ? 1 : 0));
}
