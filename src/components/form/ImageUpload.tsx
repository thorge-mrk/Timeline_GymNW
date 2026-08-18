"use client";

import { useId, useRef, useState } from "react";
import { formatBytes } from "@/lib/compressImage";
import {
  ERR_NOT_AN_IMAGE,
  looksLikeImage,
  prepareImage,
  type ImageItem,
  type PreparedImage,
} from "./imageItems";

interface ImageUploadProps {
  /** Aktuelles Titelbild — neu gewählt oder bereits gespeichert. */
  value: ImageItem | null;
  /** Ein neues Foto wurde gewählt und ist fertig verkleinert. */
  onPick: (image: PreparedImage) => void;
  /** Titelbild entfernen (gespeicherte Bilder verschwinden erst beim Speichern). */
  onRemove: () => void;
  disabled?: boolean;
}

/** Kamera-Symbol — als Vektor, damit es in jeder Größe scharf bleibt. */
function CameraIcon() {
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
      <path d="M3 9.2A2.4 2.4 0 0 1 5.4 6.8h1.3a1.6 1.6 0 0 0 1.35-.74l.7-1.1a1.6 1.6 0 0 1 1.35-.74h3.8a1.6 1.6 0 0 1 1.35.74l.7 1.1a1.6 1.6 0 0 0 1.35.74h1.3A2.4 2.4 0 0 1 21 9.2v7.4a2.4 2.4 0 0 1-2.4 2.4H5.4A2.4 2.4 0 0 1 3 16.6z" />
      <circle cx="12" cy="12.6" r="3.6" />
    </svg>
  );
}

/**
 * Das Titelbild: genau ein Foto. Es steht auf dem Zeitstrahl (bei Meilensteinen
 * groß auf der Karte) und ganz oben im geöffneten Eintrag.
 */
export function ImageUpload({
  value,
  onPick,
  onRemove,
  disabled = false,
}: ImageUploadProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined | null) {
    if (!file) return;
    setError(null);

    if (!looksLikeImage(file)) {
      setError(ERR_NOT_AN_IMAGE);
      return;
    }

    setBusy(true);
    try {
      onPick(await prepareImage(file));
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Das Bild konnte nicht verarbeitet werden — bitte ein anderes Foto wählen."
      );
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function openPicker() {
    if (disabled || busy) return;
    inputRef.current?.click();
  }

  return (
    <div role="group" aria-labelledby={`${inputId}-label`}>
      <span className="label" id={`${inputId}-label`}>
        Titelbild
      </span>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*"
        tabIndex={-1}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      {!value && (
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled || busy}
          data-drag={dragging}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled && !busy) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (disabled || busy) return;
            void handleFile(e.dataTransfer.files?.[0]);
          }}
          className="dropzone flex min-h-36 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-paper-line bg-paper px-4 py-7 text-center
            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fox
            disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? (
            <span className="inline-flex items-center gap-2 text-sm text-coal-soft">
              <span
                aria-hidden
                className="h-4 w-4 animate-spin rounded-full border-2 border-paper-line border-t-fox [animation-duration:0.72s]"
              />
              Bild wird verarbeitet …
            </span>
          ) : (
            <>
              <CameraIcon />
              <span className="text-sm font-semibold text-coal">
                Titelbild auswählen
              </span>
              <span className="text-xs text-coal-faint">
                oder Datei einfach hierher ziehen · JPG oder PNG
              </span>
            </>
          )}
        </button>
      )}

      {value && (
        <div className="animate-fade-up rounded-2xl border border-paper-line bg-paper-sunk p-3">
          {/* Kein next/image — die Seite wird statisch exportiert. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value.url}
            alt={
              value.prepared
                ? "Vorschau des ausgewählten Titelbildes"
                : "Aktuell gespeichertes Titelbild"
            }
            className="max-h-64 w-full rounded-xl bg-paper-card object-contain shadow-(--shadow-card)"
          />

          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <p className="min-w-0 text-xs leading-relaxed break-words text-coal-faint">
              {value.prepared ? (
                <>
                  <span className="font-semibold text-coal-soft">
                    {value.prepared.originalName}
                  </span>
                  {" · komprimiert: "}
                  {formatBytes(value.prepared.blob.size)}
                  {value.prepared.originalSize > value.prepared.blob.size && (
                    <> (vorher {formatBytes(value.prepared.originalSize)})</>
                  )}
                </>
              ) : (
                "Bereits gespeichertes Bild"
              )}
            </p>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-ghost min-h-11"
                onClick={openPicker}
                disabled={disabled || busy}
              >
                {busy ? "Bild wird verarbeitet …" : "Anderes Bild wählen"}
              </button>
              <button
                type="button"
                className="btn-ghost btn-quiet min-h-11"
                disabled={disabled || busy}
                onClick={() => {
                  setError(null);
                  onRemove();
                }}
              >
                Titelbild entfernen
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="note-enter mt-2 text-xs font-semibold text-ink-bad"
        >
          {error}
        </p>
      )}

      <p className="hint mt-2 leading-relaxed">
        Titelbild — erscheint auf dem Zeitstrahl. Wird automatisch verkleinert
        (max. 1600 px); Querformat wirkt am besten.
      </p>
    </div>
  );
}
