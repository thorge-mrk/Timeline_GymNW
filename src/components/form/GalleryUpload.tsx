"use client";

import { useId, useRef, useState } from "react";
import { formatBytes } from "@/lib/compressImage";
import {
  ERR_NOT_AN_IMAGE,
  imageItemName,
  looksLikeImage,
  prepareImage,
  type ImageItem,
  type PreparedImage,
} from "./imageItems";

interface GalleryUploadProps {
  /** Weitere Bilder in Anzeigereihenfolge. */
  items: ImageItem[];
  /** Höchstzahl (Vorgabe der Datenbank). */
  max: number;
  /** Gibt es schon ein Titelbild? Nur für die Hinweistexte. */
  hasCover: boolean;
  onAdd: (images: PreparedImage[]) => void;
  onRemove: (id: string) => void;
  /** −1 = ein Feld nach vorne, +1 = ein Feld nach hinten. */
  onMove: (id: string, direction: -1 | 1) => void;
  onUseAsCover: (id: string) => void;
  disabled?: boolean;
}

/** „1 Bild“ / „4 Bilder“ */
function bilder(n: number): string {
  return n === 1 ? "1 Bild" : `${n} Bilder`;
}

function PlusIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      className="h-5 w-5 text-fox"
    >
      <path d="M12 5.5v13M5.5 12h13" />
    </svg>
  );
}

function StackIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-7 w-7 text-fox"
    >
      <rect x="7.4" y="3.4" width="13.2" height="10" rx="2.2" />
      <path d="m10.4 11.2 2.6-2.8 2.2 2.3 1.7-1.5 3.7 3.6" />
      <path d="M17 17.2a2.4 2.4 0 0 1-2.4 2.4H5.8A2.4 2.4 0 0 1 3.4 17.2V8.6" />
    </svg>
  );
}

function ArrowIcon({ dir }: { dir: "left" | "right" }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4.5 w-4.5"
      style={dir === "right" ? { transform: "scaleX(-1)" } : undefined}
    >
      <path d="M14.5 5.5 8 12l6.5 6.5" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-3.5 w-3.5 shrink-0 text-fox-deep"
    >
      <path d="M12 3.6l2.42 4.9 5.41.79-3.92 3.82.93 5.39L12 15.95l-4.84 2.55.93-5.39L4.17 9.29l5.41-.79z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      className="h-4 w-4"
    >
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </svg>
  );
}

/**
 * Die Galerie: beliebig viele weitere Fotos (bis zum Limit), in der
 * Reihenfolge, in der sie später im Eintrag stehen. Sortiert wird mit
 * Pfeilknöpfen statt per Ziehen — das klappt auf dem iPad zuverlässig.
 */
export function GalleryUpload({
  items,
  max,
  hasCover,
  onAdd,
  onRemove,
  onMove,
  onUseAsCover,
  disabled = false,
}: GalleryUploadProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  /** Läuft während des Verkleinerns: „Bild 2 von 5“. */
  const [work, setWork] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const free = Math.max(0, max - items.length);
  const full = free === 0;
  const locked = disabled || work !== null;

  const fresh = items.filter((item) => item.prepared !== null);
  const freshBytes = fresh.reduce(
    (sum, item) => sum + (item.prepared?.blob.size ?? 0),
    0
  );

  function clearInput() {
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleFiles(list: FileList | File[] | null | undefined) {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    setError(null);
    setNotice(null);

    if (full) {
      setError(
        `Mehr als ${max} weitere Bilder gehen nicht — bitte zuerst eines entfernen.`
      );
      clearInput();
      return;
    }

    const images = files.filter(looksLikeImage);
    if (!images.length) {
      setError(ERR_NOT_AN_IMAGE);
      clearInput();
      return;
    }

    const take = images.slice(0, free);
    const notes: string[] = [];
    const wrongKind = files.length - images.length;
    const noRoom = images.length - take.length;
    if (wrongKind > 0) {
      notes.push(
        wrongKind === 1
          ? "Eine Datei war kein Bild und wurde übersprungen."
          : `${wrongKind} Dateien waren keine Bilder und wurden übersprungen.`
      );
    }
    if (noRoom > 0) {
      notes.push(
        `Es war nur noch Platz für ${bilder(free)} — ${
          noRoom === 1 ? "ein Foto wurde" : `${noRoom} Fotos wurden`
        } nicht übernommen.`
      );
    }

    const prepared: PreparedImage[] = [];
    const failed: string[] = [];

    for (let i = 0; i < take.length; i += 1) {
      setWork({ done: i + 1, total: take.length });
      try {
        prepared.push(await prepareImage(take[i]));
      } catch {
        failed.push(take[i].name);
      }
    }

    setWork(null);
    clearInput();

    if (prepared.length) onAdd(prepared);
    if (failed.length) {
      setError(
        `${
          failed.length === 1 ? "Dieses Foto konnte" : "Diese Fotos konnten"
        } nicht verarbeitet werden: ${failed.join(", ")}`
      );
    }
    setNotice(notes.length ? notes.join(" ") : null);
  }

  function openPicker() {
    if (locked) return;
    inputRef.current?.click();
  }

  return (
    <div role="group" aria-labelledby={`${inputId}-label`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="label" id={`${inputId}-label`}>
          Weitere Bilder
        </span>
        <span className="hint tabular-nums" aria-live="polite">
          {items.length} von {max}
        </span>
      </div>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*"
        multiple
        tabIndex={-1}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => void handleFiles(e.target.files)}
      />

      {items.length > 0 && (
        <ul className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((item, i) => (
            <li
              key={item.id}
              className="animate-pop-in rounded-2xl border border-paper-line bg-paper-sunk p-2"
            >
              <div className="relative">
                {/* Kein next/image — die Seite wird statisch exportiert. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt={imageItemName(item)}
                  className="aspect-[4/3] w-full rounded-xl bg-paper-card object-cover shadow-(--shadow-card)"
                />
                <span
                  aria-hidden
                  className="absolute top-1.5 left-1.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-navy px-1.5 text-[11px] font-bold text-paper tabular-nums"
                >
                  {i + 1}
                </span>
                <button
                  type="button"
                  className="tool-btn tool-btn--danger absolute top-1 right-1 h-11 w-11"
                  aria-label={`Bild ${i + 1} entfernen`}
                  disabled={locked}
                  onClick={() => onRemove(item.id)}
                >
                  <CloseIcon />
                </button>
              </div>

              <div className="mt-2 flex gap-1.5">
                <button
                  type="button"
                  className="tool-btn min-h-11 flex-1"
                  aria-label={`Bild ${i + 1} nach vorne schieben`}
                  disabled={locked || i === 0}
                  onClick={() => onMove(item.id, -1)}
                >
                  <ArrowIcon dir="left" />
                </button>
                <button
                  type="button"
                  className="tool-btn min-h-11 flex-1"
                  aria-label={`Bild ${i + 1} nach hinten schieben`}
                  disabled={locked || i === items.length - 1}
                  onClick={() => onMove(item.id, 1)}
                >
                  <ArrowIcon dir="right" />
                </button>
              </div>

              <button
                type="button"
                className="tool-btn mt-1.5 min-h-11 w-full gap-1.5 px-2 text-[11px] font-semibold"
                aria-label={
                  hasCover
                    ? `Bild ${i + 1} als Titelbild verwenden (tauscht mit dem bisherigen Titelbild)`
                    : `Bild ${i + 1} als Titelbild verwenden`
                }
                disabled={locked}
                onClick={() => onUseAsCover(item.id)}
              >
                <StarIcon />
                Als Titelbild
              </button>
            </li>
          ))}
        </ul>
      )}

      {full ? (
        <p
          role="status"
          className="rounded-2xl border border-paper-line bg-paper-sunk px-3.5 py-3 text-xs leading-relaxed font-semibold text-coal-soft"
        >
          Mehr als {max} weitere Bilder gehen nicht — das ist die Grenze pro
          Eintrag. Zum Austauschen bitte zuerst ein Bild entfernen.
        </p>
      ) : (
        <button
          type="button"
          onClick={openPicker}
          disabled={locked}
          data-drag={dragging}
          onDragOver={(e) => {
            e.preventDefault();
            if (!locked) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (locked) return;
            void handleFiles(e.dataTransfer.files);
          }}
          className={`dropzone flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-paper-line bg-paper px-4 text-center
            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fox
            disabled:cursor-not-allowed disabled:opacity-60 ${
              items.length ? "min-h-24 py-5" : "min-h-36 py-7"
            }`}
        >
          {work ? (
            <span className="inline-flex items-center gap-2 text-sm text-coal-soft">
              <span
                aria-hidden
                className="h-4 w-4 animate-spin rounded-full border-2 border-paper-line border-t-fox [animation-duration:0.72s]"
              />
              {work.total > 1
                ? `Bild ${work.done} von ${work.total} wird verarbeitet …`
                : "Bild wird verarbeitet …"}
            </span>
          ) : items.length ? (
            <>
              <PlusIcon />
              <span className="text-sm font-semibold text-coal">
                Weitere Fotos hinzufügen
              </span>
              <span className="text-xs text-coal-faint">
                noch Platz für {bilder(free)}
              </span>
            </>
          ) : (
            <>
              <StackIcon />
              <span className="text-sm font-semibold text-coal">
                Fotos auswählen
              </span>
              <span className="text-xs text-coal-faint">
                mehrere gleichzeitig möglich · oder Dateien hierher ziehen
              </span>
            </>
          )}
        </button>
      )}

      {error && (
        <p
          role="alert"
          className="note-enter mt-2 text-xs leading-relaxed font-semibold text-ink-bad"
        >
          {error}
        </p>
      )}

      {notice && (
        <p
          role="status"
          className="note-enter mt-2 text-xs leading-relaxed text-coal-soft"
        >
          {notice}
        </p>
      )}

      {!hasCover && items.length > 0 && (
        <p className="note-enter mt-2 text-xs leading-relaxed font-semibold text-coal-soft">
          Es gibt noch kein Titelbild — tippe bei einem Foto auf „Als
          Titelbild“, damit es auf dem Zeitstrahl zu sehen ist.
        </p>
      )}

      {fresh.length > 0 && (
        <p className="hint mt-2 leading-relaxed">
          {bilder(fresh.length)} neu ausgewählt ({formatBytes(freshBytes)}) —
          wird beim Speichern hochgeladen.
        </p>
      )}

      <p className="hint mt-2 leading-relaxed">
        Diese Fotos erscheinen im geöffneten Eintrag unter dem Titelbild — in
        genau dieser Reihenfolge. Mit den Pfeilen ← → verschiebst du ein Bild.
      </p>
    </div>
  );
}
