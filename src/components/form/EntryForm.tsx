"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  CATEGORIES,
  CLASS_CATEGORIES,
  categoryById,
  categoryPillStyle,
  type CategoryId,
} from "@/lib/categories";
import { parseSmartDate } from "@/lib/dates";
import { publicUrl, supabase } from "@/lib/supabase";
import type { Entry, EntryInsert } from "@/lib/types";
import { AudioUpload, type PreparedAudio } from "./AudioUpload";
import { GalleryUpload } from "./GalleryUpload";
import { ImageUpload } from "./ImageUpload";
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
import { SmartDateInput } from "./SmartDateInput";

const AUDIO_BUCKET = "entry-audio";

const TITLE_MAX = 120;
const DESCRIPTION_MAX = 3000;
const CLASS_MAX = 30;
const AUTHOR_MAX = 80;

const DATE_INPUT_ID = "entry-date";
const DEFAULT_CATEGORY: CategoryId = "schueler";

/** „10/3" → „10-3": Klasse/Zweig einheitlich mit Bindestrich statt Schrägstrich. */
function normalizeClassName(value: string) {
  return value.replace(/(\d)\s*\/\s*(\d)/g, "$1-$2");
}

/** Fehler mit bereits deutscher, anzeigbarer Meldung. */
class FriendlyError extends Error {}

/** „12.3.1996“ / „3.1996“ / „1996“ — Rekonstruktion für das Datumsfeld. */
function entryDateText(e: Pick<Entry, "year" | "month" | "day">): string {
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

/** Abschnittsüberschrift: klein, in Versalien, ruhig — nur zur Orientierung. */
function Section({
  title,
  first = false,
  children,
}: {
  title: string;
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={first ? undefined : "border-t border-paper-line pt-7"}>
      <h2 className="text-[11px] font-bold tracking-wider text-coal-faint uppercase">
        {title}
      </h2>
      <div className="mt-4 space-y-6">{children}</div>
    </section>
  );
}

function CheckIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m4.6 10.4 3.4 3.4 7.4-7.6" />
    </svg>
  );
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

type Phase = "idle" | "image" | "audio" | "saving" | "deleting";

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
}

export function EntryForm({
  session,
  isAdmin,
  entry = null,
  removed = false,
  onSaved,
}: EntryFormProps) {
  const router = useRouter();
  const isEdit = entry !== null;
  const titleRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(entry?.title ?? "");
  const [dateText, setDateText] = useState(entry ? entryDateText(entry) : "");
  const [category, setCategory] = useState<CategoryId>(
    entry ? categoryById(entry.category).id : DEFAULT_CATEGORY
  );
  const [rank, setRank] = useState<EntryRank>(() => rankOf(entry));
  const [className, setClassName] = useState(entry?.class_name ?? "");
  const [authorName, setAuthorName] = useState(entry?.author_name ?? "");
  const [description, setDescription] = useState(entry?.description ?? "");

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
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [saved, setSaved] = useState<"created" | "updated" | null>(null);

  const busy = phase !== "idle";
  const showClassField = CLASS_CATEGORIES.includes(category);
  const titleMissing = triedSubmit && title.trim().length === 0;

  // Objekt-URLs der Vorschauen freigeben, sobald ein Bild aus dem Formular fällt.
  const allImages = useMemo(() => [cover, ...gallery], [cover, gallery]);
  useObjectUrlCleanup(allImages);

  const existingAudioUrl = useMemo(
    () => (keepAudioPath ? publicUrl(AUDIO_BUCKET, keepAudioPath) : null),
    [keepAudioPath]
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

  function failWith(message: string) {
    setError(message);
    setPhase("idle");
    setUpload(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForNext() {
    // Kategorie und Datum bleiben stehen — am Aktionstag werden viele
    // Erinnerungen zum selben Jahrgang hintereinander eingetragen.
    setTitle("");
    setClassName("");
    setAuthorName("");
    setDescription("");
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
    setTriedSubmit(false);
    setError(null);
    setSaved(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.setTimeout(() => titleRef.current?.focus(), 60);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || removed) return;

    setTriedSubmit(true);
    setError(null);

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      failWith("Bitte einen Titel eingeben.");
      titleRef.current?.focus();
      return;
    }

    const smart = parseSmartDate(dateText);
    if (!smart) {
      failWith(
        "Bitte ein gültiges Datum eingeben — z. B. 1996, 3.1996 oder 12.3.1996."
      );
      const dateEl = document.getElementById(DATE_INPUT_ID);
      if (dateEl instanceof HTMLInputElement) dateEl.focus();
      return;
    }

    if (gallery.length > GALLERY_MAX) {
      failWith(
        `Es sind höchstens ${GALLERY_MAX} weitere Bilder erlaubt — bitte ein paar entfernen.`
      );
      return;
    }

    // Die Datenbank lässt nicht mehr zu — hier steht wenigstens ein Satz, mit
    // dem man etwas anfangen kann.
    if (description.length > DESCRIPTION_MAX) {
      failWith(
        `Die Beschreibung ist zu lang (höchstens ${DESCRIPTION_MAX} Zeichen) — bitte etwas kürzen.`
      );
      return;
    }

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
        description: description.trim() || null,
        category,
        class_name: showClassField ? normalizeClassName(className.trim()) || null : null,
        author_name: authorName.trim() || null,
        year: smart.year,
        month: smart.month ?? null,
        day: smart.day ?? null,
        ...rankFlags(rank, isAdmin),
        image_path: imagePath,
        image_paths: imagePaths,
        audio_path: audioPath,
      };

      if (isEdit && entry) {
        const { error: dbErr } = await supabase
          .from("entries")
          .update(fields)
          .eq("id", entry.id);
        if (dbErr) throw new FriendlyError(describeDbError(dbErr.message));
        onSaved?.("updated");
      } else {
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

  if (saved) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="card animate-pop-in border-moss/30 bg-moss/8 p-7 text-center shadow-(--shadow-card-lg) sm:p-9"
      >
        <span
          aria-hidden
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-moss text-paper shadow-(--shadow-card)"
        >
          <CheckIcon className="h-7 w-7" />
        </span>
        <p className="mt-5 text-xl font-bold tracking-tight text-coal">
          Gespeichert!
        </p>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-coal-soft">
          {saved === "created"
            ? "Der Eintrag ist jetzt live auf dem Zeitstrahl — danke fürs Erinnern."
            : "Die Änderungen sind jetzt auf dem Zeitstrahl."}
        </p>
        <div className="mt-7 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
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
        </div>
      </div>
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
            : "Auf den Zeitstrahl!";

  return (
    <form
      noValidate
      onSubmit={(e) => void handleSubmit(e)}
      className="card animate-fade-up space-y-8 p-5 shadow-(--shadow-card-lg) sm:p-7"
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

      <Section title="Die Erinnerung" first>
        {/* 1 — Titel */}
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <label className="label" htmlFor="entry-title">
              Titel <span aria-hidden className="font-bold text-fox-deep">*</span>
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
            placeholder="z. B. Einweihung der neuen Sporthalle"
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
                Bitte einen Titel eingeben.
              </p>
            )}
          </div>
        </div>

        {/* 2 — Datum */}
        <SmartDateInput
          id={DATE_INPUT_ID}
          value={dateText}
          onChange={setDateText}
          disabled={busy}
          showRequiredError={triedSubmit}
        />
      </Section>

      <Section title="Einordnung">
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

        {/* 4 — Rangstufe: normal · wichtig · Meilenstein (nur Admin) */}
        <RankChoice
          value={rank}
          onChange={setRank}
          allowMilestone={isAdmin}
          disabled={busy}
        />

        {/* 5 — Klasse (nur bei Schüler/Ehemalige) */}
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
      </Section>

      <Section title="Erzählung">
        {/* 6 — Autor */}
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

        {/* 7 — Beschreibung mit Formatier-Werkzeugen */}
        <RichTextInput
          id="entry-description"
          label="Beschreibung"
          value={description}
          onChange={setDescription}
          maxLength={DESCRIPTION_MAX}
          placeholder="Was ist passiert? Woran erinnerst du dich besonders gern?"
          disabled={busy}
        />
      </Section>

      <Section title="Bilder">
        {/* 8 — Titelbild */}
        <ImageUpload
          value={cover}
          onPick={pickCover}
          onRemove={() => setCover(null)}
          disabled={busy}
        />

        {/* 9 — Galerie */}
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
      </Section>

      {/* 10 — Audio (nur Admin) */}
      {isAdmin && (
        <Section title="Ton">
          <AudioUpload
            value={audio}
            onChange={setAudio}
            existingUrl={existingAudioUrl}
            onRemoveExisting={() => setKeepAudioPath(null)}
            disabled={busy}
          />
        </Section>
      )}

      {/* Absenden */}
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
          Mit <span className="font-bold text-fox-deep">*</span> markierte Felder
          sind Pflichtfelder.
        </p>
      </div>

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
