/**
 * Die Anordnung der Erinnerungs-Wolke.
 *
 * Reine Rechnung, kein React, kein DOM: Hier entsteht aus einer Liste von
 * Themen eine Karte aus Rechtecken — wer wo steht und wie groß. Die
 * Vollansicht legt diese Karte nur noch aus.
 *
 * Drei Zusagen macht dieses Modul:
 *
 *   1. STABIL. Es kommt kein `Math.random()` vor. Wo Streuung nötig ist
 *      (Startrichtung, Schwebe-Takt), stammt sie aus der Eintrags-id über
 *      eine feste Hash-Funktion. Dieselben Daten ergeben damit Bild für Bild,
 *      Seitenaufruf für Seitenaufruf dieselbe Wolke — wer sein Thema einmal
 *      gefunden hat, findet es wieder.
 *
 *   2. ÜBERSCHNEIDUNGSFREI. Jedes Wort ist ein Rechteck. Ein neues Wort darf
 *      erst stehen bleiben, wenn es keines der bereits gesetzten berührt —
 *      inklusive `GAP` Sicherheitsabstand, der größer ist als alles, was das
 *      Schweben je an Auslenkung erzeugen kann.
 *
 *   3. VOLLSTÄNDIG. Passt bei der Wunschgröße nicht alles hinein, wird erst
 *      die Schrift kleiner gesetzt und zuletzt die Fläche größer gemacht.
 *      Weggelassen wird nie etwas — eine Erinnerung, die man nicht sieht, ist
 *      keine.
 */

/** Ein Rechteck in Weltkoordinaten (Ursprung oben links). */
export interface CloudBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Ein Thema, wie es in die Anordnung hineingeht. */
export interface CloudInput {
  id: string;
  /** Bereits auf Zeichenzahl gekürzter Anzeigetext. */
  label: string;
  /** Erinnerungen insgesamt (Eintrag + Stimmen). */
  memories: number;
  /** 0 … 1 — Stelle zwischen kleinster und größter Schrift. */
  weight: number;
}

/** Schweben: kleine, endlose Bewegung. Werte in Weltpixeln bzw. Sekunden. */
export interface CloudDrift {
  dx: number;
  dy: number;
  dur: number;
  /** Startversatz in Sekunden — jedes Wort ist woanders im Takt. */
  phase: number;
}

/** Ein fertig gesetztes Wort. */
export interface CloudPlacement {
  id: string;
  /** Kann gegenüber der Eingabe weiter gekürzt sein, wenn die Fläche eng ist. */
  label: string;
  box: CloudBox;
  /** Schriftgröße in Weltpixeln. */
  size: number;
  /** Platzierungsreihenfolge: 0 ist das lauteste Thema, ganz in der Mitte. */
  order: number;
  drift: CloudDrift;
}

export interface CloudLayout {
  words: CloudPlacement[];
  /** Fläche, auf der gesetzt wurde. Kann höher sein als der Bildschirm. */
  world: { w: number; h: number };
  /** Umschließendes Rechteck aller Wörter — Grundlage für den Einpass-Zoom. */
  box: CloudBox;
  /** Wie stark die Schrift gegenüber dem Wunsch geschrumpft wurde (1 = gar nicht). */
  fontScale: number;
}

/** Misst die Breite eines Textes in einer bestimmten Schriftgröße. */
export type Measure = (text: string, size: number) => number;

/* -------------------------------------------------------------------------- */
/*  Stellschrauben                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Mindestabstand zwischen zwei Wörtern. Er ist mit Absicht großzügig: Das
 * Schweben lenkt jedes Wort um höchstens `DRIFT_MAX * 1.3` aus, zwei Wörter
 * können sich also im schlimmsten Fall um gut 10 px annähern. Bei 16 px
 * Abstand bleibt immer Luft — Überschneidung ist damit nicht Glückssache,
 * sondern ausgeschlossen.
 */
const GAP = 16;

/** Größte Auslenkung des Schwebens in Weltpixeln. */
const DRIFT_MAX = 4;

/** Radiuszuwachs pro Umlauf der Suchspirale. Kleiner = dichter gepackt, langsamer. */
const SPIRAL_TURN = 26;

/** So viele Plätze probiert ein Wort höchstens aus, bevor es aufgibt. */
const MAX_TRIES = 4000;

/**
 * Schriftstufen, die nacheinander versucht werden. Erst wenn auch die
 * kleinste nicht reicht, wächst die Fläche.
 */
const FONT_STEPS = [1, 0.9, 0.8, 0.72, 0.64] as const;

/** Höhenzuwachs der Fläche, wenn selbst die kleinste Schrift nicht reicht. */
const GROW_STEPS = [1, 1.4, 1.9, 2.6, 3.5] as const;

/** Kein Wort darf breiter werden als dieser Anteil der Fläche. */
const MAX_WORD_SHARE = 0.44;

/* -------------------------------------------------------------------------- */
/*  Streuung ohne Zufall                                                      */
/* -------------------------------------------------------------------------- */

/** FNV-1a — klein, schnell, überall gleich. */
function hash32(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Ein Streuwert 0 … 1 aus einer Eintrags-id.
 *
 * Das ist der Ersatz für `Math.random()`: Die Wolke braucht Unregelmäßigkeit,
 * damit sie nicht wie ein Diagramm aussieht — aber sie darf sich beim
 * Neuladen nicht neu würfeln. Über das `salt` bekommt derselbe Eintrag
 * mehrere unabhängige Werte (Richtung, Takt, Versatz).
 */
export function spread(id: string, salt = ""): number {
  return hash32(`${salt}:${id}`) / 4294967296;
}

function clamp(value: number, low: number, high: number): number {
  return value < low ? low : value > high ? high : value;
}

/* -------------------------------------------------------------------------- */
/*  Schriftgrößen                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Kleinste und größte Schrift für eine gegebene Fläche.
 *
 * Beides hängt an der Fläche selbst, nicht an festen Haltepunkten: Auf dem
 * Handy (390 px) ergibt das rund 16 → 41 px, auf dem Beamer (1920 px) rund
 * 24 → 72 px. Dieselbe Wolke, nur größer — und dazwischen stufenlos.
 *
 * Die Höhe geht mit ein (`h * 1.55`), weil ein sehr flaches Fenster sonst
 * riesige Wörter bekäme, die gar nicht übereinander passen.
 */
export function fontRange(w: number, h: number): { min: number; max: number } {
  const base = Math.min(w, h * 1.55);
  return {
    min: clamp(base * 0.042, 15, 24),
    max: clamp(base * 0.105, 30, 72),
  };
}

/* -------------------------------------------------------------------------- */
/*  Belegungsraster                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Wo steht schon etwas?
 *
 * Jedes gesetzte Wort wird in die Zellen eingetragen, die es berührt. Ein
 * Kandidat muss dann nur noch gegen die Wörter in SEINEN Zellen geprüft
 * werden statt gegen alle. Ohne dieses Raster wäre die Suche bei vierzig
 * Themen quadratisch — mit ihm bleibt sie auch auf einem alten Schulrechner
 * eine Sache von Millisekunden.
 */
class Field {
  private readonly cell: number;
  private readonly cols: number;
  private readonly rows: number;
  private readonly buckets: CloudBox[][];

  constructor(w: number, h: number) {
    this.cell = 72;
    this.cols = Math.max(1, Math.ceil(w / this.cell));
    this.rows = Math.max(1, Math.ceil(h / this.cell));
    this.buckets = Array.from({ length: this.cols * this.rows }, () => []);
  }

  /** Zellbereich, den ein (um `GAP` aufgeblähtes) Rechteck berührt. */
  private bounds(box: CloudBox, pad: number) {
    return {
      c0: clamp(Math.floor((box.x - pad) / this.cell), 0, this.cols - 1),
      c1: clamp(Math.floor((box.x + box.w + pad) / this.cell), 0, this.cols - 1),
      r0: clamp(Math.floor((box.y - pad) / this.cell), 0, this.rows - 1),
      r1: clamp(Math.floor((box.y + box.h + pad) / this.cell), 0, this.rows - 1),
    };
  }

  /** Ist der Platz frei — mit `GAP` Sicherheitsabstand ringsum? */
  free(box: CloudBox): boolean {
    const { c0, c1, r0, r1 } = this.bounds(box, GAP);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        for (const other of this.buckets[r * this.cols + c]) {
          if (
            box.x < other.x + other.w + GAP &&
            other.x < box.x + box.w + GAP &&
            box.y < other.y + other.h + GAP &&
            other.y < box.y + box.h + GAP
          ) {
            return false;
          }
        }
      }
    }
    return true;
  }

  add(box: CloudBox): void {
    const { c0, c1, r0, r1 } = this.bounds(box, 0);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        this.buckets[r * this.cols + c].push(box);
      }
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  Wortkasten                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Kürzt ein Wort so weit, bis seine Pille in die erlaubte Breite passt.
 *
 * „Berlinfahrt, 12 Klasse und Coronazeiten" darf die Wolke nicht sprengen.
 * Gesucht wird per Halbierung die längste Fassung, die noch passt; verloren
 * geht nichts, denn der volle Titel steht weiterhin im `title` und im
 * `aria-label`.
 */
function fitLabel(
  label: string,
  size: number,
  maxText: number,
  measure: Measure
): string {
  if (maxText <= 0 || measure(label, size) <= maxText) return label;

  let low = 0;
  let high = label.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const trial = `${label.slice(0, mid).trimEnd()}…`;
    if (measure(trial, size) <= maxText) low = mid;
    else high = mid - 1;
  }
  if (low <= 0) return "…";
  return `${label.slice(0, low).replace(/[\s.,;:!?/–-]+$/, "")}…`;
}

/** Breite und Höhe der fertigen Pille. Alles in `em` gedacht, also mitwachsend. */
function boxSize(
  label: string,
  memories: number,
  size: number,
  measure: Measure
): { w: number; h: number } {
  const text =
    measure(label, size) +
    (memories > 1 ? measure(` · ${memories}`, size * 0.62) : 0);
  return {
    // 0.62em Polsterung links und rechts, dazu der Rahmen.
    w: Math.ceil(text + size * 1.24 + 2),
    h: Math.ceil(size * 1.72),
  };
}

/* -------------------------------------------------------------------------- */
/*  Ein Durchgang                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Setzt alle Wörter auf eine Fläche fester Größe — oder gibt auf.
 *
 * Verfahren: Jedes Wort läuft eine archimedische Spirale von der Mitte nach
 * außen ab und bleibt am ersten freien Platz stehen. Weil die größten Wörter
 * zuerst kommen, besetzen sie die Mitte; die leiseren finden ihre Lücken
 * außen herum. Genau so entsteht die typische Wolkenform — dicht innen, luftig
 * außen — ohne dass irgendwo eine Form vorgegeben wäre.
 *
 * Die Spirale ist elliptisch verzerrt (`aspect`), damit sie einem breiten
 * Bildschirm folgt statt einen Kreis in die Mitte zu setzen und links und
 * rechts alles leer zu lassen.
 *
 * Der Startwinkel jedes Wortes kommt aus seiner id. Ohne ihn liefen alle
 * Wörter in dieselbe Richtung los und die Wolke bekäme eine sichtbare Naht.
 */
function pack(
  items: readonly CloudInput[],
  measure: Measure,
  world: { w: number; h: number },
  min: number,
  max: number
): CloudPlacement[] | null {
  const field = new Field(world.w, world.h);
  const out: CloudPlacement[] = [];

  const cx = world.w / 2;
  const cy = world.h / 2;
  const aspect = world.w / world.h;
  const growth = SPIRAL_TURN / (2 * Math.PI);
  const maxRadius = world.h * 0.78;
  const maxWordWidth = world.w * MAX_WORD_SHARE;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const size = Math.round(min + item.weight * (max - min));

    // Erst auf die erlaubte Breite kürzen, dann den Kasten ausmessen.
    const extra =
      item.memories > 1 ? measure(` · ${item.memories}`, size * 0.62) : 0;
    const label = fitLabel(
      item.label,
      size,
      maxWordWidth - size * 1.24 - 2 - extra,
      measure
    );
    const { w, h } = boxSize(label, item.memories, size, measure);
    if (w + GAP > world.w || h + GAP > world.h) return null;

    const phase = spread(item.id, "dir") * Math.PI * 2;
    // Feinheit der Suche: große Wörter dürfen gröber abtasten, sie brauchen
    // ohnehin große Lücken.
    const arc = Math.max(9, h * 0.4);

    let placed: CloudBox | null = null;
    let t = 0;
    for (let step = 0; step < MAX_TRIES; step++) {
      const r = growth * t;
      const box: CloudBox = {
        x: cx + r * Math.cos(t + phase) * aspect - w / 2,
        y: cy + r * Math.sin(t + phase) - h / 2,
        w,
        h,
      };

      if (
        box.x >= 4 &&
        box.y >= 4 &&
        box.x + w <= world.w - 4 &&
        box.y + h <= world.h - 4 &&
        field.free(box)
      ) {
        placed = box;
        break;
      }

      t += clamp(arc / Math.max(r, 1), 0.05, 0.7);
      if (r > maxRadius) break;
    }

    if (!placed) return null;

    placed.x = Math.round(placed.x);
    placed.y = Math.round(placed.y);
    field.add(placed);

    out.push({
      id: item.id,
      label,
      box: placed,
      size,
      order: i,
      drift: {
        dx: (spread(item.id, "dx") * 2 - 1) * DRIFT_MAX,
        dy: (0.4 + spread(item.id, "dy") * 0.6) * DRIFT_MAX,
        dur: 11 + spread(item.id, "dur") * 9,
        phase: spread(item.id, "ph") * 20,
      },
    });
  }

  return out;
}

/* -------------------------------------------------------------------------- */
/*  Die Anordnung                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Ordnet die Wolke an — und gibt garantiert alle Wörter zurück oder gar nichts.
 *
 * Reihenfolge der Versuche:
 *   1. Wunschgröße auf der Bildschirmfläche
 *   2. schrittweise kleinere Schrift (bis 64 %)
 *   3. höhere Fläche bei kleinster Schrift — dann ist die Wolke größer als
 *      das Fenster und man schiebt bzw. zoomt sich hindurch
 *
 * `items` muss bereits sortiert sein: das lauteste Thema zuerst.
 */
export function layoutCloud(
  items: readonly CloudInput[],
  measure: Measure,
  view: { w: number; h: number }
): CloudLayout | null {
  if (!items.length || view.w < 80 || view.h < 80) return null;

  for (const grow of GROW_STEPS) {
    const world = { w: view.w, h: Math.round(view.h * grow) };
    const range = fontRange(view.w, view.h);

    for (const step of FONT_STEPS) {
      // Wächst die Fläche, hat das Schrumpfen der Schrift seinen Zweck
      // verfehlt — dann lieber lesbar bleiben und die Fläche nutzen.
      if (grow > 1 && step !== FONT_STEPS[FONT_STEPS.length - 1]) continue;

      const words = pack(
        items,
        measure,
        world,
        range.min * step,
        range.max * step
      );
      if (!words) continue;

      let left = Infinity;
      let top = Infinity;
      let right = -Infinity;
      let bottom = -Infinity;
      for (const word of words) {
        left = Math.min(left, word.box.x);
        top = Math.min(top, word.box.y);
        right = Math.max(right, word.box.x + word.box.w);
        bottom = Math.max(bottom, word.box.y + word.box.h);
      }

      return {
        words,
        world,
        box: { x: left, y: top, w: right - left, h: bottom - top },
        fontScale: step,
      };
    }
  }

  return null;
}
