"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  CATEGORIES,
  CLASS_CATEGORIES,
  categoryById,
  type CategoryId,
} from "@/lib/categories";
import { parseSmartDate } from "@/lib/dates";
import { publicUrl, supabase } from "@/lib/supabase";
import type { Entry, EntryInsert } from "@/lib/types";
import { AudioUpload, type PreparedAudio } from "./AudioUpload";
import { ImageUpload, type PreparedImage } from "./ImageUpload";
import { SmartDateInput } from "./SmartDateInput";

const IMAGE_BUCKET = "entry-images";
const AUDIO_BUCKET = "entry-audio";

const TITLE_MAX = 120;
const DESCRIPTION_MAX = 3000;
const CLASS_MAX = 30;
const AUTHOR_MAX = 80;

const DATE_INPUT_ID = "entry-date";
const DEFAULT_CATEGORY: CategoryId = "schueler";

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

function StarIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-4 w-4 shrink-0 text-fox"
    >
      <path d="M12 3.6l2.42 4.9 5.41.79-3.92 3.82.93 5.39L12 15.95l-4.84 2.55.93-5.39L4.17 9.29l5.41-.79z" />
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
}

export function EntryForm({ session, isAdmin, entry = null }: EntryFormProps) {
  const router = useRouter();
  const isEdit = entry !== null;
  const titleRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(entry?.title ?? "");
  const [dateText, setDateText] = useState(entry ? entryDateText(entry) : "");
  const [category, setCategory] = useState<CategoryId>(
    entry ? categoryById(entry.category).id : DEFAULT_CATEGORY
  );
  const [isMilestone, setIsMilestone] = useState(entry?.is_milestone ?? false);
  const [className, setClassName] = useState(entry?.class_name ?? "");
  const [authorName, setAuthorName] = useState(entry?.author_name ?? "");
  const [description, setDescription] = useState(entry?.description ?? "");

  const [image, setImage] = useState<PreparedImage | null>(null);
  const [audio, setAudio] = useState<PreparedAudio | null>(null);
  /** In der Datenbank aktuell gespeicherte Pfade. */
  const [storedImagePath, setStoredImagePath] = useState(
    entry?.image_path ?? null
  );
  const [storedAudioPath, setStoredAudioPath] = useState(
    entry?.audio_path ?? null
  );
  /** Pfade, die nach dem Speichern erhalten bleiben sollen (null = entfernen). */
  const [keepImagePath, setKeepImagePath] = useState(entry?.image_path ?? null);
  const [keepAudioPath, setKeepAudioPath] = useState(entry?.audio_path ?? null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [saved, setSaved] = useState<"created" | "updated" | null>(null);

  const busy = phase !== "idle";
  const showClassField = CLASS_CATEGORIES.includes(category);
  const titleMissing = triedSubmit && title.trim().length === 0;

  const existingImageUrl = useMemo(
    () => (keepImagePath ? publicUrl(IMAGE_BUCKET, keepImagePath) : null),
    [keepImagePath]
  );
  const existingAudioUrl = useMemo(
    () => (keepAudioPath ? publicUrl(AUDIO_BUCKET, keepAudioPath) : null),
    [keepAudioPath]
  );

  function failWith(message: string) {
    setError(message);
    setPhase("idle");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForNext() {
    // Kategorie und Datum bleiben stehen — am Aktionstag werden viele
    // Erinnerungen zum selben Jahrgang hintereinander eingetragen.
    setTitle("");
    setClassName("");
    setAuthorName("");
    setDescription("");
    setIsMilestone(false);
    setImage(null);
    setAudio(null);
    setStoredImagePath(null);
    setStoredAudioPath(null);
    setKeepImagePath(null);
    setKeepAudioPath(null);
    setTriedSubmit(false);
    setError(null);
    setSaved(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.setTimeout(() => titleRef.current?.focus(), 60);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;

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

    const uploaded: { bucket: string; path: string }[] = [];

    try {
      let imagePath = keepImagePath;
      if (image) {
        setPhase("image");
        const path = `${session.user.id}/${crypto.randomUUID()}.${image.ext}`;
        const { error: upErr } = await supabase.storage
          .from(IMAGE_BUCKET)
          .upload(path, image.blob, {
            contentType: image.mime,
            upsert: false,
          });
        if (upErr) throw new FriendlyError(describeUploadError(upErr.message, "Bild"));
        uploaded.push({ bucket: IMAGE_BUCKET, path });
        imagePath = path;
      }

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
        class_name: showClassField ? className.trim() || null : null,
        author_name: authorName.trim() || null,
        year: smart.year,
        month: smart.month ?? null,
        day: smart.day ?? null,
        is_milestone: isAdmin ? isMilestone : false,
        image_path: imagePath,
        audio_path: audioPath,
      };

      if (isEdit && entry) {
        const { error: dbErr } = await supabase
          .from("entries")
          .update(fields)
          .eq("id", entry.id);
        if (dbErr) throw new FriendlyError(describeDbError(dbErr.message));
      } else {
        const payload: EntryInsert = { ...fields, created_by: session.user.id };
        const { error: dbErr } = await supabase.from("entries").insert(payload);
        if (dbErr) throw new FriendlyError(describeDbError(dbErr.message));
      }

      // Erst nach dem erfolgreichen Schreiben: ersetzte Dateien wegräumen.
      if (storedImagePath && storedImagePath !== imagePath) {
        await removeQuietly(IMAGE_BUCKET, storedImagePath);
      }
      if (storedAudioPath && storedAudioPath !== audioPath) {
        await removeQuietly(AUDIO_BUCKET, storedAudioPath);
      }

      setStoredImagePath(imagePath);
      setStoredAudioPath(audioPath);
      setKeepImagePath(imagePath);
      setKeepAudioPath(audioPath);
      setImage(null);
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
    if (!entry || busy) return;
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
      ? "Bild wird hochgeladen …"
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
                      active
                        ? "border-transparent"
                        : "border-paper-line bg-paper-card text-coal"
                    } ${busy ? "cursor-not-allowed opacity-60" : ""}`}
                  style={
                    active
                      ? {
                          backgroundColor: c.color,
                          borderColor: c.color,
                          color: fg,
                        }
                      : undefined
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

        {isAdmin && (
          <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-paper-line bg-paper-sunk p-3.5">
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5 shrink-0 accent-fox"
              checked={isMilestone}
              disabled={busy}
              onChange={(e) => setIsMilestone(e.target.checked)}
            />
            <span className="text-sm">
              <span className="flex items-center gap-1.5 font-semibold text-coal">
                <StarIcon />
                Als Meilenstein hervorheben
              </span>
              <span className="hint mt-0.5 block">
                Große Karte mit Bild auf dem Zeitstrahl.
              </span>
            </span>
          </label>
        )}

        {/* 4 — Klasse (nur bei Schüler/Ehemalige) */}
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

        {/* 6 — Beschreibung */}
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <label className="label" htmlFor="entry-description">
              Beschreibung
            </label>
            <span aria-hidden className="hint tabular-nums">
              noch {DESCRIPTION_MAX - description.length}
            </span>
          </div>
          <textarea
            id="entry-description"
            rows={5}
            className="input resize-y leading-relaxed"
            placeholder="Was ist passiert? Woran erinnerst du dich besonders gern?"
            maxLength={DESCRIPTION_MAX}
            value={description}
            disabled={busy}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </Section>

      <Section title="Bild & Ton">
        {/* 7 — Bild */}
        <ImageUpload
          value={image}
          onChange={setImage}
          existingUrl={existingImageUrl}
          onRemoveExisting={() => setKeepImagePath(null)}
          disabled={busy}
        />

        {/* 8 — Audio (nur Admin) */}
        {isAdmin && (
          <AudioUpload
            value={audio}
            onChange={setAudio}
            existingUrl={existingAudioUrl}
            onRemoveExisting={() => setKeepAudioPath(null)}
            disabled={busy}
          />
        )}
      </Section>

      {/* Absenden */}
      <div className="border-t border-paper-line pt-7">
        <button
          type="submit"
          className="btn-accent min-h-12 w-full text-base sm:w-auto sm:px-10"
          disabled={busy}
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
            disabled={busy}
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
