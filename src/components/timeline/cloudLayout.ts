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
 *   3. LESBAR. Passt bei der Wunschgröße nicht alles hinein, wird erst die
 *      Schrift kleiner gesetzt und zuletzt die Fläche größer gemacht. Auf
 *      einem Handybildschirm gibt es dafür keinen Platz — dort setzt die
 *      Vollansicht eine Lesegrenze (`readable`), und was darunter stehen
 *      müsste, wird gar nicht erst gesetzt. Verloren geht es trotzdem nicht:
 *      Die Vollansicht führt die übrigen Themen als Liste unter der Wolke.
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

/**
 * Misst die Breite eines Textes in einer bestimmten Schriftgröße UND einem
 * bestimmten Schriftgewicht.
 *
 * Das Gewicht muss mit, seit die Wörter nicht mehr alle fett stehen: Open Sans
 * in 800 ist spürbar breiter als in 500. Wer mit einem festen Gewicht misst,
 * bekommt für die großen Wörter zu schmale Kästen — und das größte Wort der
 * Wolke, ausgerechnet, bekäme drei Auslassungspunkte verpasst.
 */
export type Measure = (text: string, size: number, weight: number) => number;

/* -------------------------------------------------------------------------- */
/*  Stellschrauben                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Mindestabstand zwischen zwei Wörtern.
 *
 * Früher waren es 16 px — nötig, solange jedes Wort in einer Pille mit
 * eigener Fläche und eigenem Rahmen saß: Zwei Flächen, die sich fast
 * berühren, sehen aus wie ein Fehler. Reine Schrift verträgt viel weniger
 * Luft; erst dadurch wird aus der Aufzählung eine Wolke.
 *
 * Die Rechnung dahinter: Das Schweben lenkt ein Wort um höchstens
 * `DRIFT_MAX` (waagerecht) bzw. `DRIFT_MAX * 1.3` (senkrecht) aus. Zwei
 * Wörter können sich also im schlimmsten Fall um 2 × 1.3 × 3 = 7.8 px
 * annähern. Bei 9 px Abstand bleibt immer Luft — Überschneidung ist damit
 * nicht Glückssache, sondern ausgeschlossen. Und weil die Buchstaben in
 * ihrem Kasten ohnehin noch rund 0.17 em Rand haben (Zeilenkasten `LINE_BOX`
 * gegen Versalhöhe), berühren sich Glyphen erst recht nie.
 */
const GAP = 9;

/** Größte Auslenkung des Schwebens in Weltpixeln. */
const DRIFT_MAX = 3;

/** Radiuszuwachs pro Umlauf der Suchspirale. Kleiner = dichter gepackt, langsamer. */
const SPIRAL_TURN = 18;

/**
 * So viele Plätze probiert ein Wort höchstens aus, bevor es aufgibt.
 *
 * Mit der engeren Spirale sind das mehr Schritte als früher: Der Abtastwinkel
 * wird weit außen auf 0.05 rad begrenzt, ein voller Weg von der Mitte bis zum
 * Rand braucht damit gut fünftausend Schritte. Wer hier zu früh aufgibt,
 * verliert kein Wort — die Anordnung fällt dann nur unnötig auf eine kleinere
 * Schrift zurück.
 */
const MAX_TRIES = 9000;

/**
 * Schriftstufen, die nacheinander versucht werden. Erst wenn auch die
 * kleinste nicht reicht, wächst die Fläche.
 */
const FONT_STEPS = [1, 0.9, 0.8, 0.72, 0.64] as const;

/** Höhenzuwachs der Fläche, wenn selbst die kleinste Schrift nicht reicht. */
const GROW_STEPS = [1, 1.4, 1.9, 2.6, 3.5] as const;

/**
 * So weit darf ein Wort unter seine eigentliche Größe rutschen, damit sein
 * Titel ungekürzt hineinpasst. 0.7 heißt: lieber etwas kleiner als
 * „Bläser…" — aber nie so klein, dass die Rangfolge kippt und ein Thema mit
 * sechs Stimmen aussieht wie eines mit einer.
 */
const SHRINK_FLOOR = 0.7;

/** Absolute Untergrenze: darunter liest es auf drei Meter niemand mehr. */
const MIN_SIZE = 13;

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
 * Der Abstand zwischen beiden ist mit Absicht groß — das ist der Unterschied
 * zwischen einer Liste und einer Wolke. Auf dem Handy (390 px) ergibt das
 * rund 14 → 45 px (Faktor 3.2), auf dem Laptop (1440 px) rund 21 → 104 px
 * (Faktor 5). Das lauteste Thema ist damit kein „etwas größeres" Wort mehr,
 * sondern das Erste, was man sieht; die leisen treten weit zurück, bleiben
 * aber über `MIN_SIZE` lesbar.
 *
 * Die Höhe geht mit ein (`h * 1.55`), weil ein sehr flaches Fenster sonst
 * riesige Wörter bekäme, die gar nicht übereinander passen.
 */
export function fontRange(w: number, h: number): { min: number; max: number } {
  const base = Math.min(w, h * 1.55);
  return {
    min: clamp(base * 0.028, 14, 21),
    max: clamp(base * 0.115, 34, 104),
  };
}

/**
 * Wie breit darf ein einzelnes Wort werden?
 *
 * Großzügiger als zur Pillenzeit: Eine Fläche über die halbe Bildschirmbreite
 * war ein Banner, blanke Schrift über dieselbe Breite ist einfach ein großes
 * Wort. Und das größte Wort DARF jetzt groß sein — sonst rutscht es über
 * `SHRINK_FLOOR` wieder auf Zweitplatz-Größe und die ganze Staffelung ist
 * dahin. Ein hochkantes Handy hat diese Wahl ohnehin nicht: Dort ist die
 * Wolke eher eine Säule, und ein Wort darf fast die volle Breite nehmen.
 */
function wordShare(aspect: number): number {
  if (aspect >= 1.2) return 0.56;
  if (aspect >= 0.8) return 0.68;
  return 0.86;
}

/* -------------------------------------------------------------------------- */
/*  Maße eines Wortes                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Höhe des Wortkastens in `em`.
 *
 * Kein Pillenmaß mehr (das waren 1.72 em für Polsterung und Rahmen), sondern
 * knapp der natürliche Zeilenkasten. Die Buchstaben stehen darin mittig, es
 * bleiben oben und unten rund 0.17 em Luft — genau die Reserve, die zusammen
 * mit `GAP` dafür sorgt, dass sich schwebende Wörter nie berühren.
 */
const LINE_BOX = 1.34;

/** Luft links und rechts in `em` — für den Fokusring und Glyphen-Überhang. */
const SIDE_PAD = 0.1;

/**
 * Schriftgewicht der Wörter, leise → laut.
 *
 * Steht hier und nicht in der Komponente, weil die Anordnung es kennen MUSS:
 * Breite hängt am Gewicht, und die Kästen müssen zu den Buchstaben passen.
 * Open Sans ist eine variable Schrift, die Zwischenstufen gibt es wirklich.
 */
const WEIGHT_MIN = 500;
const WEIGHT_MAX = 800;

/** Schriftgewicht eines Wortes aus seiner Gewichtung (0 … 1). */
export function wordFontWeight(weight: number): number {
  return Math.round(WEIGHT_MIN + clamp(weight, 0, 1) * (WEIGHT_MAX - WEIGHT_MIN));
}

/** Gewicht der hochgestellten Zahl — sie bleibt immer gleich (siehe CSS). */
const COUNT_WEIGHT = 600;

/** Größe der hochgestellten Erinnerungszahl, als Anteil der Wortgröße. */
const COUNT_SCALE = 0.42;

/** Abstand zwischen Wort und hochgestellter Zahl in `em`. */
const COUNT_GAP = 0.14;

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
 * Kürzt ein Wort so weit, bis es in die erlaubte Breite passt.
 *
 * „Berlinfahrt, 12 Klasse und Coronazeiten" darf die Wolke nicht sprengen.
 * Gesucht wird per Halbierung die längste Fassung, die noch passt; verloren
 * geht nichts, denn der volle Titel steht weiterhin im `title` und im
 * `aria-label`.
 */
function fitLabel(
  label: string,
  size: number,
  weight: number,
  maxText: number,
  measure: Measure
): string {
  if (maxText <= 0 || measure(label, size, weight) <= maxText) return label;

  let low = 0;
  let high = label.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const trial = `${label.slice(0, mid).trimEnd()}…`;
    if (measure(trial, size, weight) <= maxText) low = mid;
    else high = mid - 1;
  }
  if (low <= 0) return "…";
  return `${label.slice(0, low).replace(/[\s.,;:!?/–-]+$/, "")}…`;
}

/**
 * Breite der hochgestellten Zahl samt Abstand — 0, wenn es nur eine
 * Erinnerung gibt und die Zahl deshalb gar nicht erscheint.
 */
function countWidth(memories: number, size: number, measure: Measure): number {
  if (memories <= 1) return 0;
  return (
    measure(String(memories), size * COUNT_SCALE, COUNT_WEIGHT) +
    size * COUNT_GAP
  );
}

/** Breite und Höhe des Wortkastens. Alles in `em` gedacht, also mitwachsend. */
function boxSize(
  label: string,
  memories: number,
  size: number,
  weight: number,
  measure: Measure
): { w: number; h: number } {
  const text =
    measure(label, size, weight) + countWidth(memories, size, measure);
  return {
    w: Math.ceil(text + size * SIDE_PAD * 2),
    h: Math.ceil(size * LINE_BOX),
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
  max: number,
  /** Untergrenze der Schriftgröße für dieses Wort. */
  floor: number,
  /**
   * Darf der Durchgang unvollständig enden?
   *
   * Normalerweise nicht: Findet ein Wort keinen Platz, war der ganze Versuch
   * umsonst und es wird mit kleinerer Schrift neu begonnen. Auf einem Handy
   * gilt das Gegenteil — dort ist die Schrift schon an der Lesegrenze, und
   * dann bricht die Anordnung an der ersten vollen Stelle ab und gibt
   * zurück, was bis dahin steht. Weil die lautesten Themen zuerst gesetzt
   * werden, sind das genau die, die man sehen will.
   */
  partial: boolean
): CloudPlacement[] | null {
  const field = new Field(world.w, world.h);
  const out: CloudPlacement[] = [];

  const cx = world.w / 2;
  const cy = world.h / 2;
  const aspect = world.w / world.h;
  const growth = SPIRAL_TURN / (2 * Math.PI);
  const maxRadius = world.h * 0.78;
  const maxWordWidth = world.w * wordShare(aspect);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    /*
     * Größe eines Wortes — zwei Stimmen reden mit.
     *
     * Erstens die Zahl der Erinnerungen (`weight`); sie führt. Zweitens die
     * Länge des Titels: „Der Kastanienbaum auf dem Schulhof" bräuchte in
     * voller Größe die halbe Wand. Statt ihn wegzuschneiden, wird er eine
     * Nummer kleiner gesetzt — aber höchstens bis `SHRINK_FLOOR`, damit ein
     * lautes Thema laut bleibt. Erst wenn auch das nicht reicht, wird gekürzt.
     *
     * Weil Breiten linear mit der Schriftgröße wachsen, lässt sich die
     * passende Größe direkt ausrechnen statt zu probieren: `unit` ist die
     * Breite des Titels bei Schriftgröße 1.
     */
    const wanted = min + item.weight * (max - min);
    const weight = wordFontWeight(item.weight);
    const unit =
      (measure(item.label, 100, weight) + countWidth(item.memories, 100, measure)) /
      100;
    const roomy = maxWordWidth / (unit + SIDE_PAD * 2);
    // Abgerundet, nicht gerundet: Ein einziges Pixel zu viel würde den Kasten
    // über die erlaubte Breite schieben und den Titel doch wieder anschneiden.
    const size = Math.max(
      floor,
      Math.floor(Math.max(wanted * SHRINK_FLOOR, Math.min(wanted, roomy)))
    );

    // Was jetzt immer noch zu breit ist, wird gekürzt — der volle Titel bleibt
    // im `title` und im `aria-label` erhalten.
    const label = fitLabel(
      item.label,
      size,
      weight,
      maxWordWidth - size * SIDE_PAD * 2 - countWidth(item.memories, size, measure),
      measure
    );
    const { w, h } = boxSize(label, item.memories, size, weight, measure);
    if (w + GAP > world.w || h + GAP > world.h) return partial ? out : null;

    const phase = spread(item.id, "dir") * Math.PI * 2;
    // Feinheit der Suche: große Wörter dürfen gröber abtasten, sie brauchen
    // ohnehin große Lücken.
    const arc = Math.max(7, h * 0.4);

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

    if (!placed) return partial ? out : null;

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

/** Umschließendes Rechteck aller Wörter — Grundlage für den Einpass-Zoom. */
function hull(words: readonly CloudPlacement[]): CloudBox {
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
  return { x: left, y: top, w: right - left, h: bottom - top };
}

/**
 * Ordnet die Wolke an.
 *
 * Reihenfolge der Versuche:
 *   1. Wunschgröße auf der Bildschirmfläche
 *   2. schrittweise kleinere Schrift (bis 64 %)
 *   3. höhere Fläche bei kleinster Schrift — dann ist die Wolke größer als
 *      das Fenster und man schiebt bzw. zoomt sich hindurch
 *
 * `items` muss bereits sortiert sein: das lauteste Thema zuerst.
 *
 * `readable` ist die Lesegrenze in Pixeln, und sie kehrt die Regel um: Statt
 * die Schrift immer weiter zu schrumpfen, bis alle zwanzig Themen auf ein
 * Handy passen, bleibt die Schrift stehen und die Wolke hört auf, wenn die
 * Fläche voll ist. Zurück kommen dann WENIGER Wörter als hineingegeben —
 * immer die lautesten, und wie viele es sind, entscheidet allein der Platz.
 * 0 schaltet die Grenze ab; dann verhält sich alles wie auf dem Laptop, wo
 * ohnehin genug Fläche für alle da ist.
 */
export function layoutCloud(
  items: readonly CloudInput[],
  measure: Measure,
  view: { w: number; h: number },
  readable = 0
): CloudLayout | null {
  if (!items.length || view.w < 80 || view.h < 80) return null;

  if (readable > 0) {
    const range = fontRange(view.w, view.h);
    const span = range.max - range.min;

    /*
     * Die Auswahl trifft die Schriftgröße selbst.
     *
     * Jedes Thema hat aus seiner Gewichtung heraus eine Größe, die ihm
     * zusteht — auf 390 px reicht die Spanne von 14 px (eine Erinnerung) bis
     * 45 px (fünf). Wem weniger als `readable` zusteht, der wäre in der Wolke
     * nur noch Kleingedrucktes, das aussieht wie alle anderen. Der fliegt
     * raus, und zwar OHNE dass dafür an der Spanne gedreht wird: Die
     * bleibenden Themen behalten genau die Größe, die sie ohnehin hätten.
     *
     * `items` ist nach Erinnerungen sortiert, die Grenze schneidet also immer
     * hinten ab — es bleiben die lautesten. Wie viele das sind, entscheidet
     * `fontRange` und damit die Fläche: Auf einem großen Bildschirm liegt
     * schon die kleinste Schrift über der Grenze und es fliegt niemand raus.
     */
    const keep = items.filter(
      (item) => range.min + item.weight * span >= readable
    );
    // Das lauteste Thema bleibt immer — eine leere Wolke wäre keine Antwort.
    const list = keep.length ? keep : items.slice(0, 1);
    const world = { w: view.w, h: view.h };
    const words = pack(
      list,
      measure,
      world,
      range.min,
      range.max,
      readable,
      true
    );
    if (words && words.length) {
      return { words, world, box: hull(words), fontScale: 1 };
    }
  }

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
        range.max * step,
        MIN_SIZE,
        false
      );
      if (!words) continue;

      return { words, world, box: hull(words), fontScale: step };
    }
  }

  return null;
}
