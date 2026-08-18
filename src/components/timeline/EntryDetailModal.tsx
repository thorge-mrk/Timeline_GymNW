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

/**
 * Rang des Eintrags — drei Stufen, die sich gegenseitig ausschließen (die
 * Datenbank erzwingt das per CHECK, hier sichert die if-Kette es zusätzlich ab):
 *
 *   Meilenstein  nur Admin-Konten — Stern in Fuchs, das lauteste Zeichen
 *   Wichtig      auch Eintrag-Konten — dieselbe Farbfamilie, aber leiser:
 *                Punkt statt Stern, zurückhaltender Rahmen
 *   normal       gar kein Badge — Ruhe ist der Regelfall
 */
function RankBadge({ entry }: { entry: Entry }) {
  if (entry.is_milestone) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-fox/40 bg-fox-soft px-2.5 py-1 text-[11px] font-semibold text-fox-deep">
        <span aria-hidden="true">★</span> Meilenstein
      </span>
    );
  }
  if (entry.is_important) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-fox/20 bg-fox-soft px-2.5 py-1 text-[11px] font-semibold text-fox-deep">
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full bg-fox-deep"
        />
        Wichtig
      </span>
    );
  }
  return null;
}

/**
 * Detailansicht eines Eintrags.
 *
 * Aufbau von oben nach unten: randloses Titelbild, Kopf (Kategorie-Badge und
 * ggf. Rang-Badge, Titel, Datum, Klasse/Autor), Text, weitere Bilder, Ton,
 * Video — und ganz unten, nur für Admins, Bearbeiten und Löschen.
 *
 * Das Titelbild ist ein Button und öffnet die Galerie; auf dem Bild klebt
 * bewusst nichts — ein Bild, das man antippen kann, erklärt sich selbst. Die
 * Bildanzahl steht unauffällig über den Vorschau-Kacheln.
 *
 * Die Fläche bleibt Papier: Farbe tragen nur die Badges im Kopf.
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
        {/* ---------------------------------------------------- Titelbild */}
        {/*
          Randlos: keine eigene Rundung, kein Rahmen, kein Abstand. Beschnitten
          wird das Bild vom Modal selbst (`overflow-hidden` + `rounded-2xl`),
          deshalb schließt es oben bündig mit den Ecken ab.
        */}
        {heroUrl && (
          <button
            type="button"
            onClick={(event) => openLightbox(0, event.currentTarget)}
            aria-label={
              imageUrls.length > 1
                ? `Bildergalerie öffnen — ${imageUrls.length} Bilder`
                : "Bild groß ansehen"
            }
            className="lb-open lb-hero block w-full cursor-pointer overflow-hidden"
          >
            <img
              src={heroUrl}
              alt={entry.title}
              /* Sofort sichtbar, sobald der Eintrag aufgeht — „lazy“ ließe das
                 Titelbild sichtbar nachpoppen. */
              loading="eager"
              className="block max-h-72 w-full bg-paper-sunk object-cover"
            />
          </button>
        )}

        <div className="p-5 sm:p-6">
          {/* --------------------------------------------------------- Kopf */}
          {/* Titel führt, Datum begleitet, Herkunft flüstert. */}
          <header className={headPad}>
            <div className="flex flex-wrap items-center gap-2">
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

              <RankBadge entry={entry} />
            </div>

            <h2
              id={titleId}
              className="mt-3 text-xl leading-snug font-bold text-coal"
            >
              {entry.title}
            </h2>

            <p className="mt-1.5 text-sm font-semibold text-coal-soft tabular-nums">
              {formatEntryDate(entry)}
            </p>

            {meta && <p className="mt-1 text-xs text-coal-faint">{meta}</p>}
          </header>

          {/* ----------------------------------------- Formatierter Text */}
          {entry.description && (
            <RichText text={entry.description} className="mt-5 text-coal" />
          )}

          {/* ------------------------------------------- Weitere Bilder */}
          {visibleTiles.length > 0 && (
            <section className="mt-6">
              {/* Die Anzahl steht hier — leise unter dem Bild statt darauf. */}
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h3 className="label mb-0">Weitere Bilder</h3>
                <span className="hint tabular-nums">
                  {imageUrls.length} Bilder
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {visibleTiles.map((url, i) => {
                  const position = i + 2; // 1 ist das Titelbild
                  const showNarrowRest =
                    i === TILES_NARROW - 1 && restNarrow > 0;
                  const showWideRest = i === TILES_WIDE - 1 && restWide > 0;
                  return (
                    <button
                      key={imagePaths[i + 1]}
                      type="button"
                      onClick={(event) =>
                        openLightbox(i + 1, event.currentTarget)
                      }
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
            </section>
          )}

          {/* ---------------------------------------------- Tonaufnahme */}
          {audioUrl && (
            <section className="mt-6">
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
              className="btn-ghost mt-6 w-full"
            >
              Video ansehen
            </a>
          )}

          {/* ------------------------------------- Admin-Aktionen (nur Admin) */}
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
