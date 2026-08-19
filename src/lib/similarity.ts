/**
 * Ähnlichkeitssuche für Eintragstitel.
 *
 * Am Aktionstag tragen viele Menschen gleichzeitig ein — und dasselbe Thema
 * mehrfach: „Berlinfahrt“, „Berlinfahrt, 12 Klasse und Coronazeiten“,
 * „Bläserklasse“ und „Bläserklasse, Young Big Band, Los Zorros“. Wer gerade
 * tippt, soll das SEHEN, solange es noch leicht ist, sich anzuschließen,
 * statt einen zweiten Punkt für dieselbe Erinnerung anzulegen.
 *
 * Ein exakter Titelvergleich hilft dabei nicht: Kaum jemand schreibt ein
 * Thema genauso wie der Mensch zwei Stunden vorher. Deshalb laufen drei
 * Signale nebeneinander und werden zusammengezählt:
 *
 *   1. Wortvergleich — welche Inhaltswörter kommen in beiden Titeln vor?
 *      Unscharf, damit „Ameirka“ noch zu „Amerika“ findet.
 *   2. Trigramme — Ähnlichkeit über Zeichendreier. Greift auch dann noch,
 *      wenn kein ganzes Wort mehr passt.
 *   3. Enthaltensein — steht der kürzere Titel wörtlich im längeren?
 *      Genau das ist der häufigste Fall („Berlinfahrt“ steckt in
 *      „Berlinfahrt, 12 Klasse und Coronazeiten“).
 *
 * Bewusst ohne zusätzliche Bibliothek: Es sind ein paar hundert Einträge,
 * alles läuft im Browser bei jedem Tastendruck, und der ganze Vergleich
 * passt in diese Datei.
 */

import type { Entry } from "./types";

export interface SimilarHit {
  entry: Entry;
  /** 0..1 — je höher, desto ähnlicher. */
  score: number;
  /** Kurze deutsche Begründung für die Anzeige, z. B. „gleiches Thema“ oder „ähnlich geschrieben“. */
  reason: string;
}

export interface FindSimilarOptions {
  /** Wie viele Treffer höchstens zurückkommen (Standard 5, die Anzeige zeigt weniger). */
  limit?: number;
  /** Ab welchem Wert ein Treffer als Treffer gilt (Standard `DEFAULT_MIN_SCORE`). */
  minScore?: number;
}

/**
 * Standardschwelle. Darunter fühlt sich ein Vorschlag wie geraten an.
 *
 * Geeicht an den echten Titeln vom Aktionstag:
 *   „Berlinfahrt“ ↔ „Berlinfahrt, 12 Klasse und Coronazeiten“  ≈ 0,82  → Treffer
 *   „Einschulung 2020“ ↔ „Einschulung 2026“                    ≈ 0,91  → Treffer
 *   „Konzerte“ ↔ „Sportfest 2024“                              = 0     → kein Treffer
 * Nebenbei sorgt sie dafür, dass beim Tippen erst ab etwa vier Zeichen
 * überhaupt etwas erscheint — vorher passt ein Wortanfang auf zu vieles.
 */
export const DEFAULT_MIN_SCORE = 0.42;

/** Kürzere Eingaben ergeben nur Rauschen. */
const MIN_QUERY_LENGTH = 3;

const DEFAULT_LIMIT = 5;

/** Gewichte der drei Signale (die ersten beiden ergeben zusammen 1). */
const W_TOKENS = 0.55;
const W_TRIGRAMS = 0.45;
/**
 * Enthaltensein zählt nicht als eigener Summand, sondern hebt das Ergebnis
 * anteilig an. So deckelt ein fehlendes Enthaltensein den Wert nicht: Zwei
 * fast gleich geschriebene Titel („Weihnachtsfeier“ / „Weinachtsfeier“)
 * können trotzdem weit oben landen.
 */
const CONTAIN_BONUS = 0.35;

/**
 * Ab dieser Wortähnlichkeit gilt ein Wort als dasselbe, nur vertippt —
 * ungefähr ein Fehler auf fünf Zeichen. Lockerer darf es nicht sein: Bei 0,72
 * gälten „Weihnachtsfeier“ und „Weihnachtsbasar“ als dasselbe Wort, obwohl
 * das zwei verschiedene Feste sind.
 */
const FUZZY_MIN = 0.78;

const UMLAUTS: Record<string, string> = {
  "ä": "ae",
  "ö": "oe",
  "ü": "ue",
  "ß": "ss",
};

/** Vergleichsform: klein, ohne Umlaute/Satzzeichen, normalisierte Leerzeichen. */
export function normalizeForMatch(text: string): string {
  return (
    text
      // Erst zusammensetzen: „ä“ kann als ein Zeichen oder als a+¨ ankommen,
      // je nach Tastatur und Betriebssystem.
      .normalize("NFC")
      .toLowerCase()
      .replace(/[äöüß]/g, (c) => UMLAUTS[c] ?? c)
      // Was danach noch an Akzenten übrig ist (é, ç, …) verliert sein Zeichen.
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      // Bindestriche, Kommas, Klammern: alles wird zu einem Leerzeichen,
      // damit „Amerika-Austausch“ und „Amerika Austausch“ gleich aussehen.
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
  );
}

/**
 * Füllwörter, die nichts über das Thema sagen.
 *
 * Sie fliegen NUR aus dem Wortvergleich — in den Trigrammen bleiben sie
 * stehen, denn dort geht es um Schreibweise, nicht um Bedeutung.
 *
 * „frau“, „herr“ und ihre Kurzformen stehen bewusst mit drin: Fast jeder
 * Lehrkraft-Eintrag beginnt damit. Ohne sie würden „Frau Grewe“ und
 * „Frau Mörber in Französisch“ als verwandt gelten — das Thema trägt der
 * Nachname, nicht die Anrede.
 */
const STOPWORDS = new Set([
  "der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem",
  "einer", "eines", "und", "oder", "aber", "in", "im", "am", "an", "auf",
  "aus", "bei", "beim", "mit", "von", "vom", "zu", "zum", "zur", "fuer",
  "ueber", "unter", "nach", "vor", "seit", "um", "als", "wie", "ist", "sind",
  "war", "waren", "es", "ich", "wir", "man", "mein", "meine", "meiner",
  "unser", "unsere", "unserer", "sein", "ihre", "ihrer", "the", "of",
  "frau", "herr", "herrn", "hr", "fr",
]);

/** Vierstellige Jahreszahl — „Einschulung 2020“ und „… 2026“ sind dasselbe Thema. */
function isYearToken(t: string): boolean {
  return /^(19|20)\d{2}$/.test(t);
}

/**
 * Wie stark zählt ein Wort im Vergleich?
 *
 * Jahreszahlen fast gar nicht: Sie unterscheiden Jahrgänge, nicht Themen —
 * und zwei Jahrgänge desselben Themas sollen sich gerade FINDEN. Kurze
 * Wörter und Klassenstufen zählen wenig, lange Wörter voll.
 */
function tokenWeight(t: string): number {
  if (isYearToken(t)) return 0.2;
  if (/^\d+$/.test(t)) return 0.3; // Klassenstufen („12“), Kurzjahre („26“)
  if (t.length <= 2) return 0.3;
  if (t.length === 3) return 0.6;
  return 1;
}

/** Ein Titel, fertig aufbereitet für den Vergleich. */
interface Prepared {
  /** Vollständige Vergleichsform, mit Füllwörtern und Jahreszahlen. */
  norm: string;
  /** Dasselbe ohne Jahreszahlen — dadurch ist „Einschulung 2020“ = „Einschulung 2026“. */
  core: string;
  /** `core` ganz ohne Leerzeichen — für getrennt geschriebene Komposita. */
  squashed: string;
  /** Inhaltswörter, jedes nur einmal. */
  tokens: string[];
  /** Gewicht je Wort, gleiche Reihenfolge wie `tokens`. */
  weights: number[];
  weightSum: number;
  /** Zeichendreier über `norm`. */
  trigrams: Set<string>;
}

/**
 * Zeichendreier mit Rand („  berlinfahrt “). Die zwei Leerzeichen vorn sorgen
 * dafür, dass auch der Wortanfang ein eigenes Signal ist — sonst wäre
 * „Fahrt Berlin“ genauso ähnlich wie „Berlinfahrt“.
 */
function trigramsOf(norm: string): Set<string> {
  const out = new Set<string>();
  if (!norm) return out;
  const padded = `  ${norm} `;
  for (let i = 0; i + 3 <= padded.length; i++) {
    out.add(padded.slice(i, i + 3));
  }
  return out;
}

function prepare(text: string): Prepared {
  const norm = normalizeForMatch(text);
  const all = norm ? norm.split(" ") : [];
  const tokens: string[] = [];
  const weights: number[] = [];
  let weightSum = 0;

  for (const t of all) {
    if (STOPWORDS.has(t)) continue;
    if (tokens.includes(t)) continue; // jedes Wort zählt einmal
    const w = tokenWeight(t);
    tokens.push(t);
    weights.push(w);
    weightSum += w;
  }

  const core = all.filter((t) => !isYearToken(t)).join(" ");

  return {
    norm,
    core,
    squashed: core.replace(/ /g, ""),
    tokens,
    weights,
    weightSum,
    trigrams: trigramsOf(norm),
  };
}

/**
 * Beim Tippen läuft der Vergleich bei jedem Anschlag über alle Einträge. Die
 * Aufbereitung hängt aber nur am Titel und ändert sich nie. Deshalb ein
 * kleiner Zwischenspeicher — er wird geleert, bevor er groß wird.
 */
const preparedCache = new Map<string, Prepared>();
const CACHE_LIMIT = 2000;

function preparedFor(title: string): Prepared {
  const cached = preparedCache.get(title);
  if (cached) return cached;
  if (preparedCache.size >= CACHE_LIMIT) preparedCache.clear();
  const fresh = prepare(title);
  preparedCache.set(title, fresh);
  return fresh;
}

/**
 * Abstand zweier Wörter nach „Optimal String Alignment“: Levenshtein plus
 * vertauschte Nachbarzeichen. „Ameirka“ ↔ „Amerika“ ist damit EIN Fehler und
 * nicht zwei — genau so vertippt man sich beim schnellen Schreiben.
 *
 * `max` bricht früh ab: Wörter, die ohnehin zu weit auseinanderliegen,
 * müssen nicht zu Ende gerechnet werden.
 */
function editDistance(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;

  const n = a.length;
  const m = b.length;
  if (n === 0) return m;
  if (m === 0) return n;

  let beforePrev: number[] = new Array<number>(m + 1).fill(0);
  let prev: number[] = new Array<number>(m + 1);
  for (let j = 0; j <= m; j++) prev[j] = j;

  for (let i = 1; i <= n; i++) {
    const row: number[] = new Array<number>(m + 1);
    row[0] = i;
    let rowMin = i;

    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      // Vertauschte Nachbarn („ir“ statt „ri“) kosten nur einen Schritt.
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, beforePrev[j - 2] + 1);
      }
      row[j] = v;
      if (v < rowMin) rowMin = v;
    }

    // Die beste Zelle der Zeile ist schon zu teuer — es wird nicht mehr besser.
    if (rowMin > max) return max + 1;
    beforePrev = prev;
    prev = row;
  }

  return prev[m];
}

/**
 * Wie ähnlich sind zwei Wörter? 1 = gleich, 0 = zu verschieden.
 *
 * Wörter unter vier Zeichen werden nur exakt verglichen: Bei „Rom“ und „Tor“
 * wäre ein Tippfehler nicht mehr von einem ganz anderen Wort zu unterscheiden.
 */
function tokenSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 4 || b.length < 4) return 0;

  const longer = Math.max(a.length, b.length);
  const allowed = Math.max(1, Math.floor(longer * (1 - FUZZY_MIN)));
  const sim = 1 - editDistance(a, b, allowed) / longer;
  return sim >= FUZZY_MIN ? sim : 0;
}

interface TokenResult {
  score: number;
  /** Mindestens ein Wort passte nur ungefähr — das ist ein Tippfehler-Treffer. */
  fuzzy: boolean;
}

/**
 * Wortvergleich mit unscharfen Paaren.
 *
 * Zwei Maße gemeinsam, weil sie unterschiedliche Fehler machen:
 *   · Dice bestraft Längenunterschiede — sonst wäre jedes kurze Wort zu
 *     jedem langen Titel ähnlich.
 *   · Der Überdeckungsgrad (geteilt durch die kleinere Seite) rettet genau
 *     den Fall, um den es hier geht: „Berlinfahrt“ steckt vollständig in
 *     einem viel längeren Titel.
 */
function tokenOverlap(q: Prepared, c: Prepared): TokenResult {
  if (q.weightSum === 0 || c.weightSum === 0) return { score: 0, fuzzy: false };

  const used = new Array<boolean>(c.tokens.length).fill(false);
  // Schwere Wörter zuerst: Sie sollen sich ihren Partner aussuchen dürfen.
  const order = q.tokens
    .map((_, i) => i)
    .sort((a, b) => q.weights[b] - q.weights[a]);

  let inter = 0;
  let fuzzy = false;

  for (const i of order) {
    let bestJ = -1;
    let bestSim = 0;
    for (let j = 0; j < c.tokens.length; j++) {
      if (used[j]) continue;
      const sim = tokenSimilarity(q.tokens[i], c.tokens[j]);
      if (sim > bestSim) {
        bestSim = sim;
        bestJ = j;
      }
    }
    if (bestJ < 0) continue;
    used[bestJ] = true;
    inter += Math.min(q.weights[i], c.weights[bestJ]) * bestSim;
    if (bestSim < 1) fuzzy = true;
  }

  if (inter === 0) return { score: 0, fuzzy: false };

  const dice = (2 * inter) / (q.weightSum + c.weightSum);
  const overlap = inter / Math.min(q.weightSum, c.weightSum);
  return { score: 0.5 * dice + 0.5 * overlap, fuzzy };
}

/** Trigramm-Ähnlichkeit, nach demselben Muster: Dice und Überdeckung zur Hälfte. */
function trigramOverlap(q: Prepared, c: Prepared): number {
  if (q.trigrams.size === 0 || c.trigrams.size === 0) return 0;

  const [small, large] =
    q.trigrams.size <= c.trigrams.size
      ? [q.trigrams, c.trigrams]
      : [c.trigrams, q.trigrams];

  let inter = 0;
  for (const t of small) if (large.has(t)) inter++;
  if (inter === 0) return 0;

  const dice = (2 * inter) / (q.trigrams.size + c.trigrams.size);
  const overlap = inter / small.size;
  return 0.5 * dice + 0.5 * overlap;
}

/**
 * Steckt der kürzere Titel wörtlich im längeren?
 *
 * Verglichen wird ohne Jahreszahlen, damit „Einschulung 2020“ und
 * „Einschulung 2026“ hier als identisch gelten. Unter vier Zeichen gibt es
 * gar keinen Punkt — sonst passt „Rom“ auf jedes Wort mit „rom“ darin.
 */
function containsAsText(a: string, b: string): number {
  if (!a || !b) return 0;

  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length < 4) return 0;
  if (short === long) return 1;
  if (!long.includes(short)) return 0;

  // Der ganze kurze Titel steht vorn: „Berlinfahrt, 12 Klasse und Coronazeiten“
  if (long.startsWith(`${short} `)) return 1;
  // … oder als ganzes Wort mittendrin bzw. am Ende.
  if (long.endsWith(` ${short}`) || long.includes(` ${short} `)) return 0.85;
  // … oder wenigstens als Wortanfang: „Berlin“ in „Berlinfahrt“.
  if (long.startsWith(short) || long.includes(` ${short}`)) return 0.7;
  // Irgendwo mitten im Wort — schwach, „bahn“ steckt auch in „Autobahn“.
  return 0.5;
}

/**
 * Enthaltensein, in zwei Anläufen.
 *
 * Der zweite Anlauf ist der deutsche Sonderfall: Zusammengesetzte Wörter
 * schreibt die eine Hälfte der Schule zusammen und die andere auseinander —
 * „Projektwoche“ und „Projekt Woche“, „Berlinfahrt“ und „Berlin Fahrt“. Ohne
 * Leerzeichen sind das wieder dieselben Buchstaben. Erst ab sechs Zeichen,
 * denn ohne Wortgrenzen findet sich Kurzes viel zu leicht irgendwo wieder.
 */
function containmentScore(q: Prepared, c: Prepared): number {
  const direct = containsAsText(q.core, c.core);
  if (direct === 1) return direct;
  if (q.squashed.length < 6 || c.squashed.length < 6) return direct;

  const [short, long] =
    q.squashed.length <= c.squashed.length
      ? [q.squashed, c.squashed]
      : [c.squashed, q.squashed];

  let joined = 0;
  if (short === long) joined = 0.9;
  else if (long.startsWith(short)) joined = 0.8;
  else if (long.includes(short)) joined = 0.6;

  return Math.max(direct, joined);
}

function reasonFor(
  q: Prepared,
  c: Prepared,
  tokens: TokenResult,
  trigrams: number,
  contain: number
): string {
  if (q.core === c.core) {
    return q.norm === c.norm ? "gleiches Thema" : "gleiches Thema, anderes Jahr";
  }
  if (contain >= 0.85) return "steht schon im Titel";
  if (tokens.fuzzy && tokens.score >= trigrams) return "ähnlich geschrieben";
  if (tokens.score >= 0.5) return "gleiche Wörter";
  if (trigrams > tokens.score) return "ähnlich geschrieben";
  return "ähnliches Thema";
}

/**
 * Findet zu einem eingetippten Titel die ähnlichsten vorhandenen Einträge.
 * Sortiert absteigend nach score.
 */
export function findSimilarEntries(
  query: string,
  entries: Entry[],
  options?: FindSimilarOptions
): SimilarHit[] {
  const limit = options?.limit ?? DEFAULT_LIMIT;
  const minScore = options?.minScore ?? DEFAULT_MIN_SCORE;

  const q = prepare(query);
  // Zu kurz oder nur Füllwörter: Alles wäre ein Treffer, also lieber nichts.
  if (q.norm.length < MIN_QUERY_LENGTH || q.tokens.length === 0) return [];

  const hits: SimilarHit[] = [];

  for (const entry of entries) {
    const c = preparedFor(entry.title);
    if (c.tokens.length === 0) continue;

    const tokens = tokenOverlap(q, c);
    const trigrams = trigramOverlap(q, c);
    const base = W_TOKENS * tokens.score + W_TRIGRAMS * trigrams;
    if (base === 0) continue;

    const contain = containmentScore(q, c);
    // Der Bonus hebt an, statt zu deckeln: aus 0,7 wird mit vollem
    // Enthaltensein 0,8 — nie mehr als 1.
    const raw = base + (1 - base) * CONTAIN_BONUS * contain;
    const score = Math.round(raw * 1000) / 1000;
    if (score < minScore) continue;

    hits.push({ entry, score, reason: reasonFor(q, c, tokens, trigrams, contain) });
  }

  hits.sort(
    (a, b) =>
      b.score - a.score ||
      // Gleichauf gewinnt der knappere Titel: Er ist eher das Thema selbst
      // und nicht schon jemandes ausgeschmückte Erinnerung.
      a.entry.title.length - b.entry.title.length ||
      a.entry.title.localeCompare(b.entry.title, "de")
  );

  return limit > 0 ? hits.slice(0, limit) : hits;
}
