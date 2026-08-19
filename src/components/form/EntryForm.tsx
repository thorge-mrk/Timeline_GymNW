"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  CATEGORIES,
  CLASS_CATEGORIES,
  categoryById,
  categoryPillStyle,
  type CategoryId,
} from "@/lib/categories";
import { formatSmartDate, parseSmartDate } from "@/lib/dates";
import { richTextToPlain } from "@/lib/richText";
import { publicUrl, supabase } from "@/lib/supabase";
import type { Entry, EntryInsert } from "@/lib/types";
import { AudioUpload, type PreparedAudio } from "./AudioUpload";
import { ConsentCheck } from "./ConsentCheck";
import { DateChoice, type DateMode } from "./DateChoice";
import { GalleryUpload } from "./GalleryUpload";
import { ImageUpload } from "./ImageUpload";
import { KindChoice, type EntryKind } from "./KindChoice";
import {
  GALLERY_MAX,
  IMAGE_BUCKET,
  newImageItem,
  storedImageItem,
  useObjectUrlCleanup,
  type ImageItem,
  type PreparedImage,
} from "./imageItems";
import {
  RankChoice,
  rankFlags,
  rankOf,
  type EntryRank,
} from "./RankChoice";
import { RichTextInput } from "./RichTextInput";
import { SimilarPanel } from "./SimilarPanel";
import { StepProgress, type StepDef } from "./StepProgress";
import { SuccessCard } from "./SuccessCard";
import { VoiceForm } from "./VoiceForm";

const AUDIO_BUCKET = "entry-audio";

const TITLE_MAX = 120;
const DESCRIPTION_MAX = 3000;
const CLASS_MAX = 30;
const AUTHOR_MAX = 80;

/**
 * Ein Wolken-Eintrag ist ein Wort und ein Satz, kein Aufsatz. 200 Zeichen sind
 * knapp genug, dass man auf den Punkt kommt, und lang genug für den Punkt.
 */
const MOMENT_TEXT_MAX = 200;

const DATE_INPUT_ID = "entry-date";
const DEFAULT_CATEGORY: CategoryId = "schueler";

/** Die Schritte, die es überhaupt gibt — welche davon kommen, hängt vom Weg ab. */
type StepKey = "art" | "worum" | "wann" | "erzaehlen" | "medien" | "pruefen";

interface FormStep extends StepDef {
  key: StepKey;
}

/**
 * Der geführte Ablauf — und zwar in ZWEI Längen.
 *
 * Vorher war das eine einzige lange Seite mit zehn Feldern. Vor einem
 * Menschen, der in der Pause dreißig Sekunden Zeit hat, ist das zu viel auf
 * einmal — man sieht die Menge und nicht die Frage. Jetzt steht auf jedem
 * Bildschirm genau eine Frage, und man weiß immer, wie viel noch kommt.
 *
 * Ganz vorne steht seit Neuestem die Weiche: Ereignis oder bester Moment?
 * Danach folgt der Rest dem, wie Menschen erzählen — erst WAS, dann WANN, dann
 * die Geschichte, dann die Bilder, am Ende einmal drübersehen.
 *
 * Der Moment-Weg lässt WANN und die Bilder weg. Nicht aus Sparsamkeit: Ein
 * Datum gibt es dort schlicht nicht („Pausen mit meinen Freunden“), und ein
 * Wolken-Eintrag ist ein Wort, kein bebilderter Bericht. Vier Schritte statt
 * sechs — wer nur „Bläserklasse“ beitragen will, ist in einer halben Minute
 * fertig.
 *
 * „Bild und Ton“ gibt es nur für Admin-Konten. Die Datenschutzerklärung sagt
 * zu, dass Fotos ausschließlich vom Projektteam ergänzt werden, und die
 * Datenbank hält sich daran (Policy images_insert_admin, RLS auf image_path).
 * Ein Schritt, der beim Speichern abgewiesen würde, wäre ein Versprechen, das
 * das Formular nicht halten kann — deshalb fällt er ganz weg statt leer
 * dazustehen. Die Schrittzahl rechnet sich von selbst mit: Alles, was zählt,
 * springt und blättert, liest aus genau dieser Liste.
 */
function stepsFor(
  kind: EntryKind,
  wizard: boolean,
  canUpload: boolean
): readonly FormStep[] {
  const worum: FormStep =
    kind === "moment"
      ? {
          key: "worum",
          title: "Wie heißt dein Moment?",
          lead: "Ein Wort oder ein kurzer Titel genügt — genau so steht er später in der Wolke.",
        }
      : {
          key: "worum",
          title: "Worum geht es?",
          lead: "Gib dem Ereignis einen Namen — und sag, zu wem es gehört.",
        };

  const erzaehlen: FormStep =
    kind === "moment"
      ? {
          key: "erzaehlen",
          title: "Erzähl kurz davon",
          lead: "Ein, zwei Sätze — oder auch gar keine. Hier ist alles freiwillig.",
        }
      : {
          key: "erzaehlen",
          title: "Erzähl davon",
          lead: "Was ist passiert? Und wer erinnert sich daran?",
        };

  const wann: FormStep = {
    key: "wann",
    title: "Wann war das?",
    lead: "Das Jahr genügt. Und wenn du es nicht mehr weißt, ist das genauso richtig.",
  };
  const medien: FormStep = {
    key: "medien",
    title: "Bild und Ton",
    lead: "Ein Foto macht aus einem Satz eine Erinnerung. Alles hier ist freiwillig.",
  };
  const pruefen: FormStep = {
    key: "pruefen",
    title: "Prüfen und absenden",
    lead:
      kind === "moment"
        ? "Einmal drübersehen — danach steht dein Moment in der Erinnerungs-Wolke."
        : "Einmal drübersehen — danach steht es auf dem Zeitstrahl.",
  };

  // Beim Bearbeiten steht ohnehin alles offen untereinander; die Frage nach der
  // Art wäre dort sinnlos, denn der Eintrag existiert längst.
  if (!wizard) {
    return canUpload
      ? [worum, wann, erzaehlen, medien, pruefen]
      : [worum, wann, erzaehlen, pruefen];
  }

  const art: FormStep = {
    key: "art",
    title: "Was möchtest du beitragen?",
    lead: "Beides gehört zur Schulgeschichte — die Wahl bestimmt nur, wonach wir gleich fragen.",
  };

  if (kind === "moment") return [art, worum, erzaehlen, pruefen];
  return canUpload
    ? [art, worum, wann, erzaehlen, medien, pruefen]
    : [art, worum, wann, erzaehlen, pruefen];
}

/** Feste Kennung je Schritt — fürs Anspringen und für aria-labelledby. */
function panelId(key: StepKey): string {
  return `entry-step-${key}`;
}

/** „10/3“ → „10-3“: Klasse/Zweig einheitlich mit Bindestrich statt Schrägstrich. */
export function normalizeClassName(value: string) {
  return value.replace(/(\d)\s*\/\s*(\d)/g, "$1-$2");
}

/** Fehler mit bereits deutscher, anzeigbarer Meldung. */
class FriendlyError extends Error {}

/** „12.3.1996“ / „3.1996“ / „1996“ — Rekonstruktion für das Datumsfeld. */
function entryDateText(e: Pick<Entry, "year" | "month" | "day">): string {
  if (e.year == null) return "";
  if (e.month != null && e.day != null) return `${e.day}.${e.month}.${e.year}`;
  if (e.month != null) return `${e.month}.${e.year}`;
  return String(e.year);
}

/** Lesbare Schriftfarbe auf der Kategoriefarbe (Orange braucht dunklen Text). */
function readableOn(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "var(--color-paper)";
  const toLinear = (v: number) =>
    v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  const r = toLinear(parseInt(h.slice(0, 2), 16) / 255);
  const g = toLinear(parseInt(h.slice(2, 4), 16) / 255);
  const b = toLinear(parseInt(h.slice(4, 6), 16) / 255);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.45 ? "var(--color-navy)" : "var(--color-paper)";
}

function AlertIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      className="mt-px h-4.5 w-4.5 shrink-0"
    >
      <circle cx="10" cy="10" r="7.6" />
      <path d="M10 6.1v4.6" />
      <path d="M10 13.6h.01" />
    </svg>
  );
}

function ArrowIcon({ back = false }: { back?: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-4 w-4 ${back ? "" : "-mr-0.5"}`}
    >
      {back ? <path d="M11.5 5 6.5 10l5 5" /> : <path d="M8.5 5l5 5-5 5" />}
    </svg>
  );
}

const NETWORK_MESSAGE =
  "Keine Verbindung zum Server — bitte die Internetverbindung prüfen und noch einmal versuchen.";

function looksLikeNetworkError(lower: string): boolean {
  return (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("load failed") ||
    lower.includes("network request failed")
  );
}

function describeDbError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("row-level security") || m.includes("row level security")) {
    return "Keine Berechtigung für diese Aktion — ist das Konto richtig eingerichtet?";
  }
  if (m.includes("jwt") || m.includes("token is expired")) {
    return "Die Anmeldung ist abgelaufen — bitte neu anmelden und noch einmal speichern.";
  }
  if (m.includes("check constraint") || m.includes("violates")) {
    return "Die Angaben passen nicht zu den Vorgaben — bitte Titel, Datum und Klasse prüfen.";
  }
  if (looksLikeNetworkError(m)) return NETWORK_MESSAGE;
  return `Speichern fehlgeschlagen: ${raw}`;
}

function describeUploadError(raw: string, kind: "Bild" | "Audio"): string {
  const m = raw.toLowerCase();
  if (
    m.includes("row-level security") ||
    m.includes("unauthorized") ||
    m.includes("403")
  ) {
    return `Keine Berechtigung zum Hochladen (${kind}) — ist das Konto richtig eingerichtet?`;
  }
  if (
    m.includes("maximum allowed size") ||
    m.includes("payload too large") ||
    m.includes("413") ||
    m.includes("too large")
  ) {
    return `Die Datei ist zu groß für den Upload (${kind}).`;
  }
  if (m.includes("mime") || m.includes("not supported")) {
    return `Dieses Dateiformat wird nicht akzeptiert (${kind}).`;
  }
  if (looksLikeNetworkError(m)) return NETWORK_MESSAGE;
  return `Der Upload ist fehlgeschlagen (${kind}): ${raw}`;
}

function describeUnexpected(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (looksLikeNetworkError(raw.toLowerCase())) return NETWORK_MESSAGE;
  return `Es ist ein Fehler aufgetreten: ${raw}`;
}

/** Aufräumen ist „best effort“ — Fehler dürfen den Ablauf nie stoppen. */
async function removeQuietly(bucket: string, path: string | null) {
  if (!path) return;
  try {
    await supabase.storage.from(bucket).remove([path]);
  } catch {
    /* egal */
  }
}

/** Ein fehlendes Pflichtfeld — mit dem Feld, zu dem der Cursor springen soll. */
interface StepProblem {
  message: string;
  focusId?: string;
}

type Phase = "idle" | "image" | "audio" | "saving" | "deleting";

/** Eine Zeile der Zusammenfassung im letzten Schritt. */
function SummaryRow({
  label,
  value,
  muted = false,
  onEdit,
  editLabel,
}: {
  label: string;
  value: React.ReactNode;
  /** Leere/optionale Angaben werden ruhiger gezeichnet — sie sind kein Mangel. */
  muted?: boolean;
  onEdit?: () => void;
  editLabel: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-paper-line py-2.5 last:border-0">
      <div className="min-w-0">
        <p className="text-[11px] font-bold tracking-wider text-coal-faint uppercase">
          {label}
        </p>
        <div
          className={`mt-1 text-sm leading-relaxed break-words ${
            muted ? "text-coal-faint" : "font-semibold text-coal"
          }`}
        >
          {value}
        </div>
      </div>
      {onEdit && (
        <button
          type="button"
          className="btn-ghost min-h-11 shrink-0 px-3 text-xs"
          onClick={onEdit}
        >
          Ändern
          <span className="sr-only"> — {editLabel}</span>
        </button>
      )}
    </div>
  );
}

export interface EntryFormProps {
  session: Session;
  isAdmin: boolean;
  /** Gesetzt im Bearbeiten-Modus (nur Admin). */
  entry?: Entry | null;
  /**
   * Der bearbeitete Eintrag wurde inzwischen von jemand anderem gelöscht.
   * Schreiben ist dann gesperrt — sonst meldet das Formular „Gespeichert!“,
   * obwohl die Zeile gar nicht mehr existiert. Die Eingaben bleiben stehen.
   */
  removed?: boolean;
  /** Nach jedem erfolgreichen Schreiben in die Datenbank. */
  onSaved?: (kind: "created" | "updated") => void;
  /**
   * Direkt zu einem bestehenden Thema dazuschreiben — der Weg vom Knopf
   * „Auch meine Erinnerung dazuschreiben“ im Detail-Fenster. Dann wird gar
   * kein neuer Eintrag angeboten, sondern gleich die Stimme.
   */
  voiceFor?: Entry | null;
}

export function EntryForm({
  session,
  isAdmin,
  entry = null,
  removed = false,
  onSaved,
  voiceFor = null,
}: EntryFormProps) {
  const router = useRouter();
  const isEdit = entry !== null;
  /*
   * Im Bearbeiten-Modus stehen ALLE Schritte offen untereinander.
   *
   * Wer bearbeitet, kommt mit einer klaren Absicht („die Jahreszahl stimmt
   * nicht“) und will genau dorthin — durch fünf Schritte zu klicken wäre reine
   * Schikane. Außerdem muss man beim Nachbessern sehen, was schon dasteht.
   * Der geführte Ablauf hilft beim ERSTEN Erzählen; beim Korrigieren steht er
   * im Weg.
   */
  const wizard = !isEdit;

  const titleRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const headingRefs = useRef<(HTMLHeadingElement | null)[]>([]);

  /**
   * Ereignis oder bester Moment? Die allererste Frage — sie entscheidet, wie
   * viele Schritte überhaupt kommen. Beim Bearbeiten wird sie nie gestellt.
   */
  const [kind, setKind] = useState<EntryKind>("ereignis");

  const [title, setTitle] = useState(entry?.title ?? "");
  const [dateText, setDateText] = useState(entry ? entryDateText(entry) : "");
  /**
   * „Ich weiß es“ oder „weiß ich nicht mehr“ — zwei gleichwertige Antworten.
   * Beim Bearbeiten richtet sich die Vorauswahl danach, was gespeichert ist.
   */
  const [dateMode, setDateMode] = useState<DateMode>(
    entry && entry.year == null ? "unknown" : "known"
  );
  const [category, setCategory] = useState<CategoryId>(
    entry ? categoryById(entry.category).id : DEFAULT_CATEGORY
  );
  const [rank, setRank] = useState<EntryRank>(() => rankOf(entry));
  const [className, setClassName] = useState(entry?.class_name ?? "");
  const [authorName, setAuthorName] = useState(entry?.author_name ?? "");
  const [description, setDescription] = useState(entry?.description ?? "");
  /**
   * Der kurze Text des Moment-Wegs. Bewusst ein eigenes Feld und nicht
   * dasselbe wie `description`: Sonst stünde beim Umschalten plötzlich ein
   * 800-Zeichen-Bericht in einem 200-Zeichen-Feld, und der Zähler zählte
   * rückwärts ins Minus.
   */
  const [momentText, setMomentText] = useState("");
  /**
   * Die Einwilligung im letzten Schritt. Sie gehört zu genau diesem Beitrag —
   * nach dem Speichern wird sie deshalb wieder abgefragt.
   */
  const [consent, setConsent] = useState(false);
  /** Erst nach einem Absende-Versuch die Meldung zeigen. */
  const [consentTried, setConsentTried] = useState(false);

  /** Titelbild (image_path) — neu gewählt oder schon gespeichert. */
  const [cover, setCover] = useState<ImageItem | null>(() =>
    entry?.image_path ? storedImageItem(entry.image_path) : null
  );
  /** Weitere Bilder (image_paths) in Anzeigereihenfolge. */
  const [gallery, setGallery] = useState<ImageItem[]>(() =>
    (entry?.image_paths ?? []).map((path) => storedImageItem(path))
  );
  const [audio, setAudio] = useState<PreparedAudio | null>(null);
  /** In der Datenbank aktuell gespeicherte Pfade. */
  const [storedImagePath, setStoredImagePath] = useState(
    entry?.image_path ?? null
  );
  const [storedImagePaths, setStoredImagePaths] = useState<string[]>(
    entry?.image_paths ?? []
  );
  const [storedAudioPath, setStoredAudioPath] = useState(
    entry?.audio_path ?? null
  );
  /** Pfad, der nach dem Speichern erhalten bleiben soll (null = entfernen). */
  const [keepAudioPath, setKeepAudioPath] = useState(entry?.audio_path ?? null);

  const [phase, setPhase] = useState<Phase>("idle");
  /** Fortschritt beim Hochladen der Bilder — „Bild 2 von 5“. */
  const [upload, setUpload] = useState<{ done: number; total: number } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<"created" | "updated" | null>(null);

  /** Der offene Schritt. Im Bearbeiten-Modus ohne Wirkung — dort steht alles offen. */
  const [step, setStep] = useState(0);
  /** Schon besuchte Schritte dürfen direkt angesprungen werden. */
  const [visited, setVisited] = useState<ReadonlySet<number>>(
    () => new Set([0])
  );
  /** Richtung des letzten Wechsels — nur für die Bewegungsrichtung. */
  const [dir, setDir] = useState<"fwd" | "back">("fwd");
  /**
   * Der Schritt, dessen Pflichtfelder gerade geprüft wurden. Die Meldung
   * verschwindet dadurch von selbst, sobald der Mangel behoben ist — es gibt
   * keinen zweiten Zustand, der nachgeführt werden müsste.
   */
  const [checkStep, setCheckStep] = useState<number | null>(null);

  /**
   * Ergänzen-Modus: Jemand hat gemerkt, dass es das Thema schon gibt, und
   * schreibt jetzt dorthin statt einen zweiten Punkt anzulegen. Der eigene
   * Entwurf bleibt dabei vollständig stehen — der Weg zurück ist einen Klick weit.
   */
  const [voiceTarget, setVoiceTarget] = useState<Entry | null>(voiceFor);

  const busy = phase !== "idle";
  const showClassField = CLASS_CATEGORIES.includes(category);
  /** Der kurze Weg in die Erinnerungs-Wolke — beim Bearbeiten gibt es ihn nicht. */
  const isMoment = wizard && kind === "moment";

  /** Die Schritte dieses Durchgangs — je nach Weg und Rolle vier bis sechs. */
  const steps = useMemo(
    () => stepsFor(kind, wizard, isAdmin),
    [kind, wizard, isAdmin]
  );
  const lastStep = steps.length - 1;
  /** Welcher Schritt trägt diese Kennung? −1, wenn es ihn in diesem Weg nicht gibt. */
  const indexOfStep = useCallback(
    (key: StepKey) => steps.findIndex((s) => s.key === key),
    [steps]
  );
  /** Bilder und Ton gibt es nur, wenn es den Schritt dafür gibt (Admin, kein Moment). */
  const hasMediaStep = indexOfStep("medien") >= 0;

  // Objekt-URLs der Vorschauen freigeben, sobald ein Bild aus dem Formular fällt.
  const allImages = useMemo(() => [cover, ...gallery], [cover, gallery]);
  useObjectUrlCleanup(allImages);

  const existingAudioUrl = useMemo(
    () => (keepAudioPath ? publicUrl(AUDIO_BUCKET, keepAudioPath) : null),
    [keepAudioPath]
  );

  /** Das gelesene Datum — `null` heißt „ohne Datum“, nicht „ungültig“. */
  const smartDate = useMemo(
    () => (dateMode === "known" ? parseSmartDate(dateText) : null),
    [dateMode, dateText]
  );

  /** Titelbild neu wählen — ersetzt das bisherige. */
  function pickCover(prepared: PreparedImage) {
    setCover(newImageItem(prepared));
  }

  /** Neue Fotos hinten an die Galerie hängen (Limit der Datenbank beachten). */
  function addToGallery(images: PreparedImage[]) {
    const room = Math.max(0, GALLERY_MAX - gallery.length);
    if (room === 0) return;
    const items = images.slice(0, room).map((image) => newImageItem(image));
    setGallery((current) => [...current, ...items].slice(0, GALLERY_MAX));
  }

  function removeFromGallery(id: string) {
    setGallery((current) => current.filter((item) => item.id !== id));
  }

  /** Ein Feld nach vorne (−1) oder nach hinten (+1) schieben. */
  function moveInGallery(id: string, direction: -1 | 1) {
    setGallery((current) => {
      const from = current.findIndex((item) => item.id === id);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= current.length) return current;
      const next = [...current];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
  }

  /**
   * Galeriebild zum Titelbild machen. Das bisherige Titelbild rutscht dabei
   * auf genau diesen Platz in der Galerie — es geht also nichts verloren.
   */
  function makeCover(id: string) {
    const index = gallery.findIndex((item) => item.id === id);
    if (index < 0) return;
    const picked = gallery[index];
    const next = [...gallery];
    if (cover) next[index] = cover;
    else next.splice(index, 1);
    setGallery(next);
    setCover(picked);
  }

  /* ---------------------------------------------------------------- *
   * Schritte: prüfen, springen, ankündigen
   * ---------------------------------------------------------------- */

  /** Was fehlt in diesem Schritt noch? `null` heißt: alles gut. */
  function stepProblem(index: number): StepProblem | null {
    const key = steps[index]?.key;

    if (key === "worum" && title.trim().length === 0) {
      return {
        message: isMoment
          ? "Bitte gib deinem Moment zuerst ein Wort oder einen kurzen Titel."
          : "Bitte gib dem Ereignis zuerst einen Titel.",
        focusId: "entry-title",
      };
    }
    if (key === "wann" && dateMode === "known" && parseSmartDate(dateText) === null) {
      return {
        message: dateText.trim()
          ? "Dieses Datum verstehe ich noch nicht — z. B. 1996, 3.1996 oder 12.3.1996. Sonst gern „Weiß ich nicht mehr“."
          : "Bitte ein Datum eintragen — oder „Weiß ich nicht mehr“ wählen. Beides ist gleich richtig.",
        focusId: DATE_INPUT_ID,
      };
    }
    if (key === "erzaehlen" && !isMoment && description.length > DESCRIPTION_MAX) {
      return {
        message: `Die Beschreibung ist zu lang (höchstens ${DESCRIPTION_MAX} Zeichen) — bitte etwas kürzen.`,
      };
    }
    if (key === "erzaehlen" && isMoment && momentText.length > MOMENT_TEXT_MAX) {
      return {
        message: `Für die Erinnerungs-Wolke sind höchstens ${MOMENT_TEXT_MAX} Zeichen vorgesehen — bitte etwas kürzen.`,
        focusId: "entry-moment-text",
      };
    }
    if (key === "medien" && gallery.length > GALLERY_MAX) {
      return {
        message: `Es sind höchstens ${GALLERY_MAX} weitere Bilder erlaubt — bitte ein paar entfernen.`,
      };
    }
    return null;
  }

  /** Nach dem Wechsel: Cursor setzen und den Schritt in den Blick rücken. */
  function settle(index: number, focusId?: string) {
    const key = steps[index]?.key;
    window.setTimeout(() => {
      const target = focusId
        ? document.getElementById(focusId)
        : headingRefs.current[index];
      if (target instanceof HTMLElement) target.focus({ preventScroll: true });

      const gentle =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const anchor = wizard
        ? formRef.current
        : key
          ? document.getElementById(panelId(key))
          : null;
      anchor?.scrollIntoView({
        block: "start",
        behavior: gentle ? "auto" : "smooth",
      });
    }, 0);
  }

  /**
   * Die Weiche umlegen. Was der andere Weg nicht fragt, wird dabei geleert:
   * Ein Datum oder ein Foto, das niemand mehr zu sehen bekommt, darf nicht
   * heimlich mitgespeichert werden.
   */
  function chooseKind(next: EntryKind) {
    if (next === kind) return;
    setKind(next);
    // Die Schrittzahl ändert sich — was man „schon besucht“ hat, gilt nicht mehr.
    setVisited(new Set([0]));
    setCheckStep(null);
    if (next === "moment") {
      setDateMode("known");
      setDateText("");
      setCover(null);
      setGallery([]);
      setAudio(null);
    }
  }

  /** Auf einem Schritt landen, weil dort etwas fehlt. */
  function landOn(index: number, problem: StepProblem) {
    if (index !== step) {
      setDir(index > step ? "fwd" : "back");
      setStep(index);
    }
    setVisited((current) =>
      current.has(index) ? current : new Set([...current, index])
    );
    setCheckStep(index);
    settle(index, problem.focusId);
  }

  /**
   * Zu einem Schritt springen. Rückwärts ist immer frei — vorwärts nur durch
   * vollständige Schritte hindurch. Niemand soll auf Schritt 5 erfahren, dass
   * in Schritt 1 der Titel fehlt.
   */
  function goTo(target: number) {
    if (busy) return;
    const clamped = Math.max(0, Math.min(lastStep, target));
    if (clamped === step) return;

    if (clamped > step) {
      for (let i = step; i < clamped; i++) {
        const problem = stepProblem(i);
        if (problem) {
          landOn(i, problem);
          return;
        }
      }
    }

    setDir(clamped > step ? "fwd" : "back");
    setStep(clamped);
    setVisited((current) =>
      current.has(clamped) ? current : new Set([...current, clamped])
    );
    setCheckStep(null);
    settle(clamped);
  }

  /**
   * Enter im Formular soll weiterblättern, nicht absenden. Sonst schickt ein
   * beherzter Druck auf der iPad-Tastatur einen halb fertigen Eintrag los.
   */
  function handleKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    if (!wizard || e.key !== "Enter" || e.shiftKey || step === lastStep) return;
    const target = e.target as HTMLElement | null;
    if (!target) return;
    if (target.isContentEditable) return;
    if (target instanceof HTMLTextAreaElement) return;
    if (target instanceof HTMLButtonElement) return;
    if (target instanceof HTMLAnchorElement) return;
    e.preventDefault();
    goTo(step + 1);
  }

  function failWith(message: string) {
    setError(message);
    setPhase("idle");
    setUpload(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForNext() {
    // Kategorie, Art und Datum bleiben stehen — am Aktionstag werden viele
    // Erinnerungen zum selben Jahrgang hintereinander eingetragen.
    setTitle("");
    setClassName("");
    setAuthorName("");
    setDescription("");
    setMomentText("");
    // Die Einwilligung gilt für einen Beitrag, nicht für den ganzen Nachmittag.
    setConsent(false);
    setConsentTried(false);
    setRank("normal");
    setCover(null);
    setGallery([]);
    setAudio(null);
    // Wichtig: Die gerade gespeicherten Bilder gehören jetzt zum angelegten
    // Eintrag — sie dürfen beim nächsten Speichern nicht aufgeräumt werden.
    setStoredImagePath(null);
    setStoredImagePaths([]);
    setStoredAudioPath(null);
    setKeepAudioPath(null);
    setCheckStep(null);
    setError(null);
    setSaved(null);
    setStep(0);
    setDir("back");
    setVisited(new Set([0]));
    window.scrollTo({ top: 0, behavior: "smooth" });
    // Der Cursor landet auf der Überschrift des ersten Schritts: Das Titelfeld
    // ist jetzt einen Schritt weiter hinten und gerade gar nicht sichtbar.
    window.setTimeout(() => headingRefs.current[0]?.focus(), 60);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || removed) return;

    setError(null);

    // Erst der komplette Durchgang: Beim ersten Mangel landet man dort, wo er
    // steht — mit Meldung und Cursor im richtigen Feld.
    for (let i = 0; i <= lastStep; i++) {
      const problem = stepProblem(i);
      if (problem) {
        landOn(i, problem);
        return;
      }
    }

    /*
     * Die Einwilligung ist keine Feldprüfung, sondern die letzte Handlung vor
     * dem Veröffentlichen — deshalb steht sie hier für sich. Der Absende-Knopf
     * ist ohne Haken ohnehin gesperrt; hierher kommt man nur mit der
     * Eingabetaste, und auch dann soll klar sein, woran es liegt.
     */
    if (wizard && !consent) {
      setConsentTried(true);
      document.getElementById("entry-consent")?.focus();
      return;
    }

    const cleanTitle = title.trim();
    /*
     * Ohne Datum wird ALLES leer — die Datenbank lässt einen Monat ohne Jahr
     * ausdrücklich nicht zu (entries_month_needs_year). Weil `smart` in diesem
     * Fall gar nicht erst existiert, kann so eine Kombination hier nicht
     * entstehen. Ein bester Moment hat nie ein Datum: Er lebt in der
     * Erinnerungs-Wolke, und die kennt keine Jahreszahl.
     */
    const smart = isMoment ? null : smartDate;

    const uploaded: { bucket: string; path: string }[] = [];

    try {
      // Erst alle neuen Bilder hochladen — Titelbild zuerst, dann die Galerie
      // in ihrer Reihenfolge. Schon gespeicherte Bilder bleiben, wo sie sind.
      const fresh = [cover, ...gallery].filter(
        (item): item is ImageItem => item?.prepared != null
      );
      let done = 0;

      /** Gespeicherte Bilder behalten ihren Pfad, neue werden hochgeladen. */
      async function pathOf(item: ImageItem): Promise<string> {
        if (item.path) return item.path;
        const prepared = item.prepared;
        if (!prepared) {
          throw new FriendlyError(
            "Ein Bild konnte nicht zugeordnet werden — bitte es noch einmal auswählen."
          );
        }
        done += 1;
        setPhase("image");
        setUpload({ done, total: fresh.length });
        const path = `${session.user.id}/${crypto.randomUUID()}.${prepared.ext}`;
        const { error: upErr } = await supabase.storage
          .from(IMAGE_BUCKET)
          .upload(path, prepared.blob, {
            contentType: prepared.mime,
            upsert: false,
          });
        if (upErr)
          throw new FriendlyError(describeUploadError(upErr.message, "Bild"));
        uploaded.push({ bucket: IMAGE_BUCKET, path });
        return path;
      }

      const imagePath: string | null = cover ? await pathOf(cover) : null;

      const imagePaths: string[] = [];
      for (const item of gallery) {
        imagePaths.push(await pathOf(item));
      }

      setUpload(null);

      let audioPath = keepAudioPath;
      if (audio && isAdmin) {
        setPhase("audio");
        const path = `${session.user.id}/${crypto.randomUUID()}.${audio.ext}`;
        const { error: upErr } = await supabase.storage
          .from(AUDIO_BUCKET)
          .upload(path, audio.file, {
            contentType: audio.mime,
            upsert: false,
          });
        if (upErr) throw new FriendlyError(describeUploadError(upErr.message, "Audio"));
        uploaded.push({ bucket: AUDIO_BUCKET, path });
        audioPath = path;
      }

      setPhase("saving");

      const fields = {
        title: cleanTitle,
        description: (isMoment ? momentText.trim() : description.trim()) || null,
        category,
        class_name: showClassField ? normalizeClassName(className.trim()) || null : null,
        author_name: authorName.trim() || null,
        year: smart?.year ?? null,
        month: smart?.month ?? null,
        day: smart?.day ?? null,
        /*
         * Bild- und Tonspalten fasst nur ein Admin-Konto an. Für Eintrag-Konten
         * stehen sie gar nicht erst im Datensatz: Die Datenbank weist einen
         * INSERT mit gesetztem image_path sonst ab (Migration 0016), und ein
         * mitgeschicktes „null“ wäre eine Behauptung über etwas, das dieses
         * Konto nicht entscheiden darf.
         */
        ...(isAdmin
          ? {
              image_path: imagePath,
              image_paths: imagePaths,
              audio_path: audioPath,
            }
          : {}),
      };

      if (isEdit && entry) {
        /*
         * Nur beim Bearbeiten wird noch über den Rang entschieden — die
         * Schul-Meilensteine (Gründung 1971, 50 Jahre GymNW) müssen pflegbar
         * bleiben.
         */
        const { error: dbErr } = await supabase
          .from("entries")
          .update({ ...fields, ...rankFlags(rank, isAdmin) })
          .eq("id", entry.id);
        if (dbErr) throw new FriendlyError(describeDbError(dbErr.message));
        onSaved?.("updated");
      } else {
        /*
         * Neue Einträge kommen ohne Rang auf die Welt: is_milestone und
         * is_important bleiben auf dem Standard `false` der Datenbank.
         * „Wichtig wird ein Ereignis dadurch, dass mehr Leute es teilen und
         * ihre eigene Erinnerung dazuschreiben“ — sagt die Schule, und das
         * lässt sich nicht in einem Auswahlfeld ankreuzen.
         */
        const payload: EntryInsert = { ...fields, created_by: session.user.id };
        const { error: dbErr } = await supabase.from("entries").insert(payload);
        if (dbErr) throw new FriendlyError(describeDbError(dbErr.message));
        onSaved?.("created");
      }

      // Erst nach dem erfolgreichen Schreiben: ersetzte Dateien wegräumen.
      // Bilder, die weiter im Eintrag stehen, bleiben natürlich liegen.
      const stillUsed = new Set(
        [imagePath, ...imagePaths].filter((path): path is string => !!path)
      );
      for (const path of [storedImagePath, ...storedImagePaths]) {
        if (path && !stillUsed.has(path)) {
          await removeQuietly(IMAGE_BUCKET, path);
        }
      }
      if (storedAudioPath && storedAudioPath !== audioPath) {
        await removeQuietly(AUDIO_BUCKET, storedAudioPath);
      }

      setStoredImagePath(imagePath);
      setStoredImagePaths(imagePaths);
      setStoredAudioPath(audioPath);
      setKeepAudioPath(audioPath);
      // Aus „frisch hochgeladen“ wird „gespeichert“: Die Objekt-URLs der
      // Vorschauen werden dadurch frei, die Bilder kommen jetzt vom CDN.
      setCover(imagePath ? storedImageItem(imagePath) : null);
      setGallery(imagePaths.map((path) => storedImageItem(path)));
      setAudio(null);
      setPhase("idle");
      setSaved(isEdit ? "updated" : "created");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      // Frisch hochgeladene Dateien wieder entfernen, damit keine Waisen bleiben.
      for (const item of uploaded) {
        await removeQuietly(item.bucket, item.path);
      }
      failWith(
        err instanceof FriendlyError ? err.message : describeUnexpected(err)
      );
    }
  }

  async function handleDelete() {
    if (!entry || busy || removed) return;
    const ok = window.confirm(
      `„${entry.title}“ wirklich vom Zeitstrahl löschen?\n\nDas lässt sich nicht rückgängig machen.`
    );
    if (!ok) return;

    setPhase("deleting");
    setError(null);
    try {
      const { error: delErr } = await supabase
        .from("entries")
        .delete()
        .eq("id", entry.id);
      if (delErr) throw new FriendlyError(describeDbError(delErr.message));

      await removeQuietly(IMAGE_BUCKET, storedImagePath);
      for (const path of storedImagePaths) {
        await removeQuietly(IMAGE_BUCKET, path);
      }
      await removeQuietly(AUDIO_BUCKET, storedAudioPath);
      router.replace("/");
    } catch (err) {
      failWith(
        err instanceof FriendlyError ? err.message : describeUnexpected(err)
      );
    }
  }

  /* ---------------------------------------------------------------- *
   * Sonderansichten: Ergänzen-Modus und Erfolgsmeldung
   * ---------------------------------------------------------------- */

  if (voiceTarget) {
    return (
      <VoiceForm
        entry={voiceTarget}
        session={session}
        normalizeClass={normalizeClassName}
        onBack={() => setVoiceTarget(null)}
      />
    );
  }

  if (saved) {
    return (
      <SuccessCard
        title="Gespeichert!"
        text={
          saved === "created"
            ? isMoment
              ? "Dein Moment ist jetzt live — er steht in der Erinnerungs-Wolke. Danke fürs Erinnern."
              : smartDate
                ? "Der Eintrag ist jetzt live auf dem Zeitstrahl — danke fürs Erinnern."
                : "Die Erinnerung ist jetzt live — ohne Datum steht sie in der Erinnerungs-Wolke. Danke fürs Erinnern."
            : "Die Änderungen sind jetzt auf dem Zeitstrahl."
        }
      >
        {saved === "created" ? (
          <button
            type="button"
            className="btn-accent min-h-12 text-base"
            onClick={resetForNext}
          >
            Weiteren Eintrag anlegen
          </button>
        ) : (
          <button
            type="button"
            className="btn-ghost min-h-12"
            onClick={() => setSaved(null)}
          >
            Weiter bearbeiten
          </button>
        )}
        <Link href="/" className="btn-primary min-h-12">
          Zum Zeitstrahl
        </Link>
      </SuccessCard>
    );
  }

  const submitLabel =
    phase === "image"
      ? upload && upload.total > 1
        ? `Bild ${upload.done} von ${upload.total} wird hochgeladen …`
        : "Bild wird hochgeladen …"
      : phase === "audio"
        ? "Audio wird hochgeladen …"
        : phase === "saving"
          ? "Wird gespeichert …"
          : isEdit
            ? "Änderungen speichern"
            : isMoment
              ? "In die Erinnerungs-Wolke!"
              : "Auf den Zeitstrahl!";

  const checkKey = checkStep === null ? null : steps[checkStep]?.key;
  const titleMissing = checkKey === "worum" && title.trim().length === 0;
  const dateSummary = smartDate
    ? formatSmartDate(smartDate)
    : "Ohne Datum — steht in der Erinnerungs-Wolke";
  const descriptionPlain = isMoment
    ? momentText.trim()
    : richTextToPlain(description).trim();
  const imageCount = (cover ? 1 : 0) + gallery.length;
  const momentLeft = MOMENT_TEXT_MAX - momentText.length;

  /* ---------------------------------------------------------------- *
   * Der Inhalt je Schritt
   * ---------------------------------------------------------------- */

  function stepContent(key: StepKey): React.ReactNode {
    switch (key) {
      case "art":
        return <KindChoice value={kind} onChange={chooseKind} disabled={busy} />;

      case "worum":
        return (
          <>
            {/* 1 — Titel */}
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <label className="label" htmlFor="entry-title">
                  {isMoment ? "Dein Wort oder Thema" : "Titel"}{" "}
                  <span aria-hidden className="font-bold text-fox-deep">*</span>
                  <span className="sr-only">(Pflichtfeld)</span>
                </label>
                <span aria-hidden className="hint tabular-nums">
                  noch {TITLE_MAX - title.length}
                </span>
              </div>
              <input
                id="entry-title"
                ref={titleRef}
                type="text"
                className="input min-h-12"
                placeholder={
                  isMoment
                    ? "z. B. Meine Einschulung"
                    : "z. B. Einweihung der neuen Sporthalle"
                }
                maxLength={TITLE_MAX}
                value={title}
                disabled={busy}
                aria-required="true"
                aria-invalid={titleMissing}
                onChange={(e) => setTitle(e.target.value)}
              />
              {/* Platz ist reserviert — die Meldung schiebt nichts nach unten. */}
              <div className="mt-1.5 min-h-4.5">
                {titleMissing && (
                  <p
                    role="alert"
                    className="note-enter text-xs font-semibold text-ink-bad"
                  >
                    {isMoment
                      ? "Bitte ein Wort oder einen kurzen Titel eingeben."
                      : "Bitte einen Titel eingeben."}
                  </p>
                )}
              </div>
            </div>

            {/*
              2 — „Gibt es das schon?“ Steht direkt unter dem Titel, weil genau
              dort die Doppelung entsteht. Beim Bearbeiten wäre der Hinweis
              sinnlos — man ist ja schon im richtigen Eintrag.
            */}
            {wizard && (
              <SimilarPanel query={title} onChoose={(hit) => setVoiceTarget(hit)} />
            )}

            {/* 3 — Kategorie */}
            <div>
              <span className="label" id="entry-category-label">
                Kategorie <span aria-hidden className="font-bold text-fox-deep">*</span>
              </span>
              <div
                role="radiogroup"
                aria-labelledby="entry-category-label"
                className="flex flex-wrap gap-2.5"
              >
                {CATEGORIES.map((c) => {
                  const active = category === c.id;
                  const fg = readableOn(c.color);
                  return (
                    <label
                      key={c.id}
                      title={c.description}
                      data-on={active}
                      data-locked={busy}
                      className={`chip chip-choice min-h-11 px-4 py-2.5 text-sm
                        has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-fox ${
                          busy ? "cursor-not-allowed opacity-60" : ""
                        }`}
                      /* Ruhend: helle Kategoriefläche mit farbigem Rahmen.
                         Gewählt: dieselbe Farbe, aber kräftig ausgefüllt. */
                      style={
                        active
                          ? {
                              backgroundColor: c.color,
                              borderColor: c.color,
                              color: fg,
                            }
                          : categoryPillStyle(c.id)
                      }
                    >
                      <input
                        type="radio"
                        name="entry-category"
                        value={c.id}
                        className="sr-only"
                        checked={active}
                        disabled={busy}
                        onChange={() => setCategory(c.id)}
                      />
                      <span
                        aria-hidden
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: active ? fg : c.color }}
                      />
                      {c.label}
                    </label>
                  );
                })}
              </div>
              <p className="hint mt-2.5 leading-relaxed">
                {categoryById(category).description}
              </p>
            </div>
          </>
        );

      case "wann":
        return (
          <DateChoice
            mode={dateMode}
            onModeChange={setDateMode}
            value={dateText}
            onChange={setDateText}
            inputId={DATE_INPUT_ID}
            disabled={busy}
            showRequiredError={checkKey === "wann"}
          />
        );

      case "erzaehlen":
        return (
          <>
            {/*
              4 — Der Text. Zwei Wege, zwei Felder: Ein Ereignis darf ein
              kleiner Aufsatz werden, ein Wolken-Eintrag bleibt ein Satz.
              Deshalb hier keine Formatier-Werkzeuge und ein harter Deckel.
            */}
            {isMoment ? (
              <div>
                <div className="flex items-baseline justify-between gap-3">
                  <label className="label" htmlFor="entry-moment-text">
                    Deine Erinnerung
                  </label>
                  <span aria-hidden className="hint tabular-nums">
                    noch {momentLeft} Zeichen
                  </span>
                </div>
                <textarea
                  id="entry-moment-text"
                  rows={4}
                  className="input min-h-28 leading-relaxed"
                  placeholder="z. B. Der erste Schultag mit der Zuckertüte im Regen."
                  maxLength={MOMENT_TEXT_MAX}
                  value={momentText}
                  disabled={busy}
                  onChange={(e) => setMomentText(e.target.value)}
                />
                <p className="hint mt-1.5 leading-relaxed">
                  Freiwillig und bewusst kurz: In der Wolke zählt vor allem dein
                  Wort — {MOMENT_TEXT_MAX} Zeichen sind das Höchste.
                </p>
              </div>
            ) : (
              <RichTextInput
                id="entry-description"
                label="Beschreibung"
                value={description}
                onChange={setDescription}
                maxLength={DESCRIPTION_MAX}
                placeholder="Was ist passiert? Woran erinnerst du dich besonders gern?"
                disabled={busy}
              />
            )}

            {/* 5 — Autor */}
            <div>
              <label className="label" htmlFor="entry-author">
                Wer erinnert sich?
              </label>
              <input
                id="entry-author"
                type="text"
                className="input min-h-12"
                placeholder="z. B. Maria K., Abi 1998"
                maxLength={AUTHOR_MAX}
                autoComplete="name"
                value={authorName}
                disabled={busy}
                onChange={(e) => setAuthorName(e.target.value)}
              />
              <p className="hint mt-1.5">
                Optional — der Name steht später an der Erinnerung.
              </p>
            </div>

            {/* 6 — Klasse (nur bei Schüler/Ehemalige) */}
            {showClassField && (
              <div className="animate-fade-up">
                <label className="label" htmlFor="entry-class">
                  Klasse
                </label>
                <input
                  id="entry-class"
                  type="text"
                  className="input min-h-12"
                  placeholder="z. B. 8a oder Abi 1996"
                  maxLength={CLASS_MAX}
                  value={className}
                  disabled={busy}
                  onChange={(e) => setClassName(e.target.value)}
                />
                <p className="hint mt-1.5">
                  Optional — damit lässt sich später nach Jahrgängen filtern.
                </p>
              </div>
            )}
          </>
        );

      case "medien":
        /*
         * Doppelt gesichert: Den Schritt gibt es für Eintrag-Konten gar nicht
         * erst (stepsFor), und selbst wenn er auftauchte, käme hier nichts.
         * Fotos ergänzt laut Datenschutzerklärung nur das Projektteam — die
         * Datenbank weist alles andere ohnehin ab.
         */
        if (!isAdmin) return null;
        return (
          <>
            {/* 7 — Titelbild */}
            <ImageUpload
              value={cover}
              onPick={pickCover}
              onRemove={() => setCover(null)}
              disabled={busy}
            />

            {/* 8 — Galerie */}
            <GalleryUpload
              items={gallery}
              max={GALLERY_MAX}
              hasCover={cover !== null}
              onAdd={addToGallery}
              onRemove={removeFromGallery}
              onMove={moveInGallery}
              onUseAsCover={makeCover}
              disabled={busy}
            />

            {/* 9 — Audio (wie Bilder: Projektteam) */}
            {isAdmin && (
              <AudioUpload
                value={audio}
                onChange={setAudio}
                existingUrl={existingAudioUrl}
                onRemoveExisting={() => setKeepAudioPath(null)}
                disabled={busy}
              />
            )}
          </>
        );

      default: {
        /** Zu welchem Schritt führt „Ändern“? Im Moment-Weg gibt es weniger davon. */
        const jump = (target: StepKey) => {
          const at = indexOfStep(target);
          return wizard && at >= 0 ? () => goTo(at) : undefined;
        };
        /** „Schritt 3“ in der Vorlesehilfe — die Nummer hängt vom Weg ab. */
        const stepLabel = (target: StepKey) => {
          const at = indexOfStep(target);
          return at >= 0 ? `Schritt ${at + 1}` : "diesen Schritt";
        };

        return (
          <>
            {/*
              10 — Zusammenfassung: genau eine Zeile je vorangegangenem
              Schritt. Eine Zeile pro Feld wäre ehrlicher, würde die Karte auf
              dem Handy aber über zwei Bildschirme strecken — und man denkt
              ohnehin in Schritten, nicht in Feldern.
            */}
            <div className="rounded-xl border border-paper-line bg-paper-sunk px-4 py-1">
              <SummaryRow
                label={isMoment ? "Dein Moment" : "Worum es geht"}
                value={
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                    <span>{title.trim() || "Ohne Titel"}</span>
                    <span
                      className="chip cursor-default"
                      style={categoryPillStyle(category)}
                    >
                      {categoryById(category).label}
                    </span>
                  </span>
                }
                muted={!title.trim()}
                editLabel={stepLabel("worum")}
                onEdit={jump("worum")}
              />
              {/* Ein bester Moment hat kein Datum — dann fällt die Zeile weg,
                  statt „ohne Datum“ wie einen Mangel auszustellen. */}
              {!isMoment && (
                <SummaryRow
                  label="Wann"
                  value={dateSummary}
                  muted={!smartDate}
                  editLabel={stepLabel("wann")}
                  onEdit={jump("wann")}
                />
              )}
              <SummaryRow
                label={isMoment ? "Deine Erinnerung" : "Erzählung"}
                value={
                  <>
                    <span className={descriptionPlain ? "" : "text-coal-faint"}>
                      {descriptionPlain
                        ? `${descriptionPlain.slice(0, 140)}${descriptionPlain.length > 140 ? " …" : ""}`
                        : "Noch nichts geschrieben"}
                    </span>
                    {/* Die Klasse steht hier schon so, wie sie gespeichert wird. */}
                    <span className="mt-0.5 block font-normal text-coal-soft">
                      {[
                        authorName.trim(),
                        showClassField
                          ? normalizeClassName(className.trim())
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Ohne Namen"}
                    </span>
                  </>
                }
                muted={!descriptionPlain && !authorName.trim()}
                editLabel={stepLabel("erzaehlen")}
                onEdit={jump("erzaehlen")}
              />
              {hasMediaStep && (
                <SummaryRow
                  label="Bild und Ton"
                  value={
                    imageCount === 0 && !audio && !keepAudioPath
                      ? "Keine Bilder"
                      : [
                          imageCount === 1
                            ? "1 Bild"
                            : imageCount > 1
                              ? `${imageCount} Bilder`
                              : "",
                          audio || keepAudioPath ? "Tonaufnahme" : "",
                        ]
                          .filter(Boolean)
                          .join(" · ")
                  }
                  muted={imageCount === 0 && !audio && !keepAudioPath}
                  editLabel={stepLabel("medien")}
                  onEdit={jump("medien")}
                />
              )}
            </div>

            {/*
              11 — Rangstufe NUR beim Bearbeiten.
              Beim Neuanlegen gibt es sie nicht mehr: „Ereignisse werden
              wichtiger, wenn mehr Leute sie teilen und ihre eigene Erinnerung
              hinzufügen“ — die Bedeutung wächst also aus den Stimmen und wird
              nicht vorab angekreuzt. Beim Bearbeiten bleibt sie, sonst ließen
              sich die Schul-Meilensteine (Gründung 1971, 50 Jahre GymNW) nicht
              mehr pflegen.
            */}
            {isEdit && (
              <RankChoice
                value={rank}
                onChange={setRank}
                allowMilestone={isAdmin}
                disabled={busy}
              />
            )}

            {/* 12 — Einwilligung, direkt über dem Absende-Knopf. */}
            {wizard && (
              <ConsentCheck
                checked={consent}
                onChange={(next) => {
                  setConsent(next);
                  if (next) setConsentTried(false);
                }}
                disabled={busy}
                showError={consentTried}
                note={
                  isMoment
                    ? "Dein Beitrag ist danach für alle Besucherinnen und Besucher der Website öffentlich sichtbar — in der Erinnerungs-Wolke, mit allem, was du hier eingetragen hast."
                    : "Dein Beitrag ist danach für alle Besucherinnen und Besucher der Website öffentlich sichtbar — mit Titel, Text, Namen und Bildern, die du hier eingetragen hast."
                }
              />
            )}
          </>
        );
      }
    }
  }

  return (
    <form
      noValidate
      ref={formRef}
      onSubmit={(e) => void handleSubmit(e)}
      onKeyDown={handleKeyDown}
      className="card animate-fade-up space-y-7 p-5 shadow-(--shadow-card-lg) sm:p-7"
    >
      {error && (
        <div
          role="alert"
          className="animate-pop-in flex items-start gap-2.5 rounded-2xl border border-brick/25 bg-brick/8 p-4 text-sm font-semibold text-ink-bad"
        >
          <AlertIcon />
          <span>{error}</span>
        </div>
      )}

      {wizard && (
        <>
          <StepProgress
            steps={steps}
            current={step}
            visited={visited}
            onGo={goTo}
            disabled={busy}
          />
          {/* Für Screenreader: Der Titel des Schritts kommt über den Fokus. */}
          <p aria-live="polite" className="sr-only">
            Schritt {step + 1} von {steps.length}
          </p>
        </>
      )}

      <div className="step-flow" data-dir={wizard ? dir : undefined}>
        {steps.map((definition, index) => {
          const problem = checkStep === index ? stepProblem(index) : null;
          const open = !wizard || index === step;
          return (
            <section
              key={definition.key}
              id={panelId(definition.key)}
              hidden={!open}
              className={
                wizard
                  ? "step-panel"
                  : "step-panel border-t border-paper-line pt-7 first:border-0 first:pt-0"
              }
              aria-labelledby={`${panelId(definition.key)}-title`}
            >
              <h2
                id={`${panelId(definition.key)}-title`}
                ref={(node) => {
                  headingRefs.current[index] = node;
                }}
                tabIndex={-1}
                className="text-lg font-bold tracking-tight text-coal outline-none sm:text-xl"
              >
                {definition.title}
              </h2>
              <p className="hint mt-1 leading-relaxed">{definition.lead}</p>

              <div className="mt-5 space-y-6">{stepContent(definition.key)}</div>

              {problem && (
                <p
                  role="alert"
                  className="note-enter mt-5 flex items-start gap-2.5 rounded-xl border border-brick/25 bg-brick/8 p-3.5 text-sm font-semibold text-ink-bad"
                >
                  <AlertIcon />
                  <span>{problem.message}</span>
                </p>
              )}

              {wizard && (
                <div className="mt-7 flex items-center gap-2.5 border-t border-paper-line pt-6">
                  {index > 0 && (
                    <button
                      type="button"
                      className="btn-ghost min-h-12 shrink-0"
                      disabled={busy}
                      onClick={() => goTo(index - 1)}
                    >
                      <ArrowIcon back />
                      Zurück
                    </button>
                  )}
                  {index < lastStep ? (
                    <button
                      type="button"
                      className="btn-accent min-h-12 flex-1 text-base"
                      disabled={busy}
                      onClick={() => goTo(index + 1)}
                    >
                      Weiter
                      <ArrowIcon />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="btn-accent min-h-12 flex-1 text-base"
                      disabled={busy || removed || !consent}
                      aria-describedby={!consent ? "entry-submit-grund" : undefined}
                    >
                      {busy && phase !== "deleting" && (
                        <span
                          aria-hidden
                          className="h-4 w-4 animate-spin rounded-full border-2 border-navy/25 border-t-navy [animation-duration:0.72s]"
                        />
                      )}
                      {submitLabel}
                    </button>
                  )}
                </div>
              )}

              {/*
                Ein grauer Knopf ohne Begründung ist eine Sackgasse — vor allem
                auf dem Handy, wo der Haken zwei Fingerbreit darüber steht.
              */}
              {wizard && index === lastStep && !consent && (
                <p id="entry-submit-grund" className="hint mt-2.5 leading-relaxed">
                  Der Knopf wird aktiv, sobald du oben zugestimmt hast.
                </p>
              )}
            </section>
          );
        })}
      </div>

      {/* Im Bearbeiten-Modus steht der Absende-Knopf einmal unter allem. */}
      {!wizard && (
        <div className="border-t border-paper-line pt-7">
          <button
            type="submit"
            className="btn-accent min-h-12 w-full text-base sm:w-auto sm:px-10"
            disabled={busy || removed}
          >
            {busy && phase !== "deleting" && (
              <span
                aria-hidden
                className="h-4 w-4 animate-spin rounded-full border-2 border-navy/25 border-t-navy [animation-duration:0.72s]"
              />
            )}
            {submitLabel}
          </button>
          <p className="hint mt-3">
            Mit <span className="font-bold text-fox-deep">*</span> markierte
            Felder sind Pflichtfelder.
          </p>
        </div>
      )}

      {wizard && step === lastStep && (
        <p className="hint">
          Mit <span className="font-bold text-fox-deep">*</span> markierte Felder
          sind Pflichtfelder.
        </p>
      )}

      {isEdit && isAdmin && (
        <div className="border-t border-paper-line pt-7">
          <button
            type="button"
            className="btn-danger min-h-12"
            disabled={busy || removed}
            onClick={() => void handleDelete()}
          >
            {phase === "deleting" && (
              <span
                aria-hidden
                className="h-4 w-4 animate-spin rounded-full border-2 border-paper/30 border-t-paper [animation-duration:0.72s]"
              />
            )}
            {phase === "deleting" ? "Wird gelöscht …" : "Eintrag löschen"}
          </button>
          <p className="hint mt-3">
            Löscht den Eintrag samt Bild und Audio dauerhaft.
          </p>
        </div>
      )}
    </form>
  );
}
