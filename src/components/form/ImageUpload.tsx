"use client";

import { useEffect, useId, useRef, useState } from "react";
import { compressImage, formatBytes } from "@/lib/compressImage";

/** Fertig komprimiertes Bild, bereit für den Upload. */
export interface PreparedImage {
  blob: Blob;
  ext: "webp" | "jpg";
  mime: string;
  originalName: string;
  originalSize: number;
}

interface ImageUploadProps {
  value: PreparedImage | null;
  onChange: (value: PreparedImage | null) => void;
  /** Bereits gespeichertes Bild (Bearbeiten-Modus). */
  existingUrl?: string | null;
  /** Wird aufgerufen, wenn das gespeicherte Bild entfernt werden soll. */
  onRemoveExisting?: () => void;
  disabled?: boolean;
}

const ERR_NOT_AN_IMAGE = "Bitte eine Bilddatei auswählen (z. B. JPG oder PNG).";

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

export function ImageUpload({
  value,
  onChange,
  existingUrl = null,
  onRemoveExisting,
  disabled = false,
}: ImageUploadProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Objekt-URL nur im Browser erzeugen und beim Wechsel/Unmount wieder freigeben.
  useEffect(() => {
    if (!value) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(value.blob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  async function handleFile(file: File | undefined | null) {
    if (!file) return;
    setError(null);

    const looksLikeImage =
      file.type.startsWith("image/") ||
      /\.(jpe?g|png|webp|gif|heic|heif|avif|bmp)$/i.test(file.name);
    if (!looksLikeImage) {
      setError(ERR_NOT_AN_IMAGE);
      return;
    }

    setBusy(true);
    try {
      const compressed = await compressImage(file);
      onChange({
        ...compressed,
        originalName: file.name,
        originalSize: file.size,
      });
    } catch (e) {
      onChange(null);
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

  const showExisting = !value && !!existingUrl;
  const shownUrl = value ? previewUrl : existingUrl;

  return (
    <div role="group" aria-labelledby={`${inputId}-label`}>
      <span className="label" id={`${inputId}-label`}>
        Bild
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

      {!value && !showExisting && (
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
                Foto auswählen
              </span>
              <span className="text-xs text-coal-faint">
                oder Datei einfach hierher ziehen · JPG oder PNG
              </span>
            </>
          )}
        </button>
      )}

      {(value || showExisting) && (
        <div className="animate-fade-up rounded-2xl border border-paper-line bg-paper-sunk p-3">
          {shownUrl ? (
            // Kein next/image — die Seite wird statisch exportiert.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shownUrl}
              alt={
                value
                  ? "Vorschau des ausgewählten Bildes"
                  : "Aktuell gespeichertes Bild"
              }
              className="max-h-64 w-full rounded-xl bg-paper-card object-contain shadow-(--shadow-card)"
            />
          ) : (
            <div className="flex h-32 items-center justify-center rounded-xl bg-paper-card">
              <span className="hint">Vorschau wird erstellt …</span>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <p className="min-w-0 text-xs leading-relaxed break-words text-coal-faint">
              {value ? (
                <>
                  <span className="font-semibold text-coal-soft">
                    {value.originalName}
                  </span>
                  {" · komprimiert: "}
                  {formatBytes(value.blob.size)}
                  {value.originalSize > value.blob.size && (
                    <> (vorher {formatBytes(value.originalSize)})</>
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
                  if (value) onChange(null);
                  else onRemoveExisting?.();
                }}
              >
                Bild entfernen
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
        Wird automatisch verkleinert (max. 1600 px) — Querformat wirkt auf dem
        Zeitstrahl am besten.
      </p>
    </div>
  );
}
