"use client";

import Link from "next/link";
import { useCallback, useId, useMemo, useRef, useState } from "react";
import RichText from "@/components/RichText";
import { categoryById, categoryPillStyle } from "@/lib/categories";
import { formatEntryDate } from "@/lib/dates";
import { publicUrl, supabase } from "@/lib/supabase";
import type { Entry } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";
import ImageLightbox from "./ImageLightbox";
import Modal from "./Modal";
import "./timeline.css";

interface EntryDetailModalProps {
  entry: Entry;
  onClose: () => void;
  /** Nach erfolgreichem Löschen — der Eintrag verschwindet sofort aus dem State. */
  onDeleted: (id: string) => void;
}

/** So viele Vorschaubilder passen in eine Reihe — schmal bzw. ab `sm`. */
const TILES_NARROW = 4;
const TILES_WIDE = 6;

/** Best-effort-Aufräumen im Storage; ein Fehler darf das Löschen nicht blockieren. */
async function removeQuietly(bucket: string, paths: (string | null)[]) {
  const wanted = [...new Set(paths.filter((p): p is string => !!p))];
  if (!wanted.length) return;
  try {
    await supabase.storage.from(bucket).remove(wanted);
  } catch {
    /* ignoriert — die Datenbankzeile ist bereits weg */
  }
}

function MagnifierIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="4.3" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10.3 10.3 13.4 13.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function StackIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect
        x="4.6"
        y="2.3"
        width="9.1"
        height="7.2"
        rx="1.6"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M11.4 12.2a1.6 1.6 0 0 1-1.6 1.5H3.9a1.6 1.6 0 0 1-1.6-1.5V6.6c0-.6.4-1.1 1-1.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Detailansicht eines Eintrags.
 *
 * Aufbau von oben nach unten: schmale Farbkante der Kategorie, Titelbild,
 * Streifen mit den weiteren Bildern, Kopf (Kategorie-Badge, Titel, Datum),
 * formatierter Text, Tonaufnahme, Video — und ganz unten, nur für Admins,
 * Bearbeiten und Löschen.
 *
 * Die Fläche bleibt bewusst Papier: Farbe tragen nur die Kante und das Badge.
 */
export default function EntryDetailModal({
  entry,
  onClose,
  onDeleted,
}: EntryDetailModalProps) {
  const titleId = useId();
  const { isAdmin } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  /** Offenes Vollbild (Index in `imageUrls`) — `null` heißt zu. */
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  /** Das angeklickte Bild bekommt den Fokus zurück. */
  const lightboxTrigger = useRef<HTMLElement | null>(null);

  const category = categoryById(entry.category);

  // Titelbild zuerst, danach die Galerie in Anzeigereihenfolge. Doppelte Pfade
  // fliegen raus, damit die Zählung („2 / 5“) immer stimmt.
  const imagePaths = useMemo(() => {
    const all = [entry.image_path, ...(entry.image_paths ?? [])];
    return [...new Set(all.filter((p): p is string => !!p))];
  }, [entry.image_path, entry.image_paths]);

  const imageUrls = useMemo(
    () => imagePaths.map((path) => publicUrl("entry-images", path)),
    [imagePaths]
  );

  const heroUrl = imageUrls[0] ?? null;
  const tiles = imageUrls.slice(1);
  const visibleTiles = tiles.slice(0, TILES_WIDE);
  /** Wie viele Bilder der Streifen schluckt — je nach Breite unterschiedlich. */
  const restNarrow = tiles.length - TILES_NARROW;
  const restWide = tiles.length - TILES_WIDE;

  const audioUrl = entry.audio_path
    ? publicUrl("entry-audio", entry.audio_path)
    : null;

  const meta = [
    entry.class_name ? `Klasse ${entry.class_name}` : null,
    entry.author_name ? `Erzählt von ${entry.author_name}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const openLightbox = useCallback((index: number, trigger: HTMLElement) => {
    lightboxTrigger.current = trigger;
    setLightboxIndex(index);
  }, []);

  async function handleDelete() {
    const confirmed = window.confirm(
      `„${entry.title}“ wirklich für immer löschen?`
    );
    if (!confirmed) return;

    setDeleting(true);
    setDeleteError(null);

    const { error } = await supabase.from("entries").delete().eq("id", entry.id);
    if (error) {
      setDeleteError(
        "Löschen fehlgeschlagen. Bitte erneut versuchen oder neu anmelden."
      );
      setDeleting(false);
      return;
    }

    // Titelbild UND Galerie — sonst bleiben verwaiste Dateien im Storage liegen.
    await removeQuietly("entry-images", imagePaths);
    await removeQuietly("entry-audio", [entry.audio_path]);

    onDeleted(entry.id);
    onClose();
  }

  /** Ohne Titelbild sitzt der Kopf unter dem Schließen-Knopf — Platz lassen. */
  const headPad = heroUrl ? "" : "pr-12";

  return (
    <>
      <Modal titleId={titleId} onClose={onClose}>
        {/* Feine Farbkante als Deckel: die Gruppe ist sofort zu erkennen. */}
        <span
          aria-hidden="true"
          className="block h-[3px] w-full rounded-t-2xl"
          style={{ backgroundColor: category.color }}
        />

        {heroUrl && (
          <button
            type="button"
            onClick={(event) => openLightbox(0, event.currentTarget)}
            aria-label={
              imageUrls.length > 1
                ? `Bildergalerie öffnen — ${imageUrls.length} Bilder`
                : "Bild groß ansehen"
            }
            className="lb-open relative block w-full cursor-pointer overflow-hidden rounded-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-fox"
          >
            <img
              src={heroUrl}
              alt={entry.title}
              /* Sofort sichtbar, sobald der Eintrag aufgeht — „lazy" ließe das
                 Titelbild sichtbar nachpoppen. */
              loading="eager"
              className="block max-h-72 w-full bg-paper-sunk object-cover"
            />
            <span className="pointer-events-none absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-full bg-navy/60 px-2.5 py-1 text-[11px] font-semibold text-paper backdrop-blur-sm">
              {imageUrls.length > 1 ? <StackIcon /> : <MagnifierIcon />}
              {imageUrls.length > 1
                ? `${imageUrls.length} Bilder`
                : "Vergrößern"}
            </span>
          </button>
        )}

        <div className="p-5 sm:p-6">
          {/* -------------------------------------------- Weitere Bilder */}
          {visibleTiles.length > 0 && (
            <div className="mb-5 grid grid-cols-4 gap-2 sm:grid-cols-6">
              {visibleTiles.map((url, i) => {
                const position = i + 2; // 1 ist das Titelbild
                const showNarrowRest = i === TILES_NARROW - 1 && restNarrow > 0;
                const showWideRest = i === TILES_WIDE - 1 && restWide > 0;
                return (
                  <button
                    key={imagePaths[i + 1]}
                    type="button"
                    onClick={(event) => openLightbox(i + 1, event.currentTarget)}
                    aria-label={`Bild ${position} von ${imageUrls.length} groß ansehen`}
                    className={`lb-open relative aspect-square cursor-pointer overflow-hidden rounded-xl border border-paper-line bg-paper-sunk focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fox ${
                      i >= TILES_NARROW ? "hidden sm:block" : ""
                    }`}
                  >
                    <img
                      src={url}
                      alt={`${entry.title} — Bild ${position}`}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                    {showNarrowRest && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-0 flex items-center justify-center bg-navy/60 text-sm font-bold text-paper tabular-nums sm:hidden"
                      >
                        +{restNarrow}
                      </span>
                    )}
                    {showWideRest && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-0 hidden items-center justify-center bg-navy/60 text-sm font-bold text-paper tabular-nums sm:flex"
                      >
                        +{restWide}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* ---------------------------------------------------- Kopf */}
          <div className={`flex flex-wrap items-center gap-2 ${headPad}`}>
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
              style={categoryPillStyle(entry.category)}
            >
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: category.color }}
              />
              {category.label}
            </span>

            {entry.is_milestone && (
              <span className="inline-flex items-center gap-1 rounded-full border border-fox/40 bg-fox-soft px-2.5 py-1 text-[11px] font-semibold text-fox-deep">
                <span aria-hidden="true">★</span> Meilenstein
              </span>
            )}
          </div>

          <h2
            id={titleId}
            className={`mt-2.5 text-xl leading-snug font-bold text-coal ${headPad}`}
          >
            {entry.title}
          </h2>

          {/* Meta-Zeile: Datum führt, alles andere begleitet leise. */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
            <span className="font-semibold text-coal tabular-nums">
              {formatEntryDate(entry)}
            </span>
            {meta && (
              <>
                <span aria-hidden="true" className="h-3.5 w-px bg-paper-line" />
                <span className="text-coal-faint">{meta}</span>
              </>
            )}
          </div>

          {/* ----------------------------------------- Formatierter Text */}
          {entry.description && (
            <RichText text={entry.description} className="mt-4 text-coal" />
          )}

          {/* ---------------------------------------------- Tonaufnahme */}
          {audioUrl && (
            <section className="mt-5">
              <h3 className="label">Interview anhören</h3>
              <div className="rounded-xl border border-paper-line bg-paper-sunk p-3">
                <audio
                  controls
                  preload="none"
                  src={audioUrl}
                  className="block w-full"
                >
                  Dein Browser kann diese Tonaufnahme leider nicht abspielen.
                </audio>
              </div>
            </section>
          )}

          {entry.video_url && (
            <a
              href={entry.video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost mt-5 w-full"
            >
              Video ansehen
            </a>
          )}

          {isAdmin && (
            <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-paper-line pt-4">
              <Link href={`/eintragen/?id=${entry.id}`} className="btn-ghost">
                Bearbeiten
              </Link>
              <button
                type="button"
                className="btn-danger"
                onClick={() => void handleDelete()}
                disabled={deleting}
              >
                {deleting ? "Wird gelöscht …" : "Löschen"}
              </button>
              {deleteError && (
                <p className="w-full text-xs text-brick">{deleteError}</p>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Liegt über dem Eintrag und fängt `Esc` vorher ab. */}
      {lightboxIndex !== null && (
        <ImageLightbox
          images={imageUrls}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          title={entry.title}
          onClose={() => setLightboxIndex(null)}
          returnFocusRef={lightboxTrigger}
        />
      )}
    </>
  );
}
