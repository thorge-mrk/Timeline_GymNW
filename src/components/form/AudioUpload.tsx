"use client";

import { useEffect, useId, useRef, useState } from "react";
import { formatBytes } from "@/lib/compressImage";

/** Ausgewählte Audiodatei inkl. der für den Bucket gültigen Angaben. */
export interface PreparedAudio {
  file: File;
  /** MIME-Typ, der beim Upload gesetzt wird (muss der Bucket-Whitelist entsprechen). */
  mime: string;
  ext: string;
}

interface AudioUploadProps {
  value: PreparedAudio | null;
  onChange: (value: PreparedAudio | null) => void;
  /** Bereits gespeichertes Audio (Bearbeiten-Modus). */
  existingUrl?: string | null;
  onRemoveExisting?: () => void;
  disabled?: boolean;
}

/** Bucket `entry-audio`: 25 MB, feste MIME-Whitelist. */
const MAX_BYTES = 25 * 1024 * 1024;

const ALLOWED_MIME = [
  "audio/mpeg",
  "audio/mp4",
  "audio/aac",
  "audio/x-m4a",
  "audio/wav",
  "audio/webm",
] as const;

/** Browser melden für dieselbe Datei unterschiedliche Typen — hier vereinheitlicht. */
const MIME_ALIASES: Record<string, string> = {
  "audio/mp3": "audio/mpeg",
  "audio/mpeg3": "audio/mpeg",
  "audio/x-mpeg": "audio/mpeg",
  "audio/m4a": "audio/x-m4a",
  "audio/x-wav": "audio/wav",
  "audio/wave": "audio/wav",
  "audio/vnd.wave": "audio/wav",
};

const EXT_TO_MIME: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/x-m4a",
  mp4: "audio/mp4",
  aac: "audio/aac",
  wav: "audio/wav",
  webm: "audio/webm",
};

const MIME_TO_EXT: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp4": "mp4",
  "audio/aac": "aac",
  "audio/x-m4a": "m4a",
  "audio/wav": "wav",
  "audio/webm": "webm",
};

function fileExt(name: string): string {
  const parts = name.split(".");
  if (parts.length < 2) return "";
  return (parts.pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function resolveMime(file: File): string | null {
  const ext = fileExt(file.name);
  const raw = file.type.toLowerCase().split(";")[0].trim();
  const normalized = MIME_ALIASES[raw] ?? raw;
  if ((ALLOWED_MIME as readonly string[]).includes(normalized)) return normalized;
  return EXT_TO_MIME[ext] ?? null;
}

export function AudioUpload({
  value,
  onChange,
  existingUrl = null,
  onRemoveExisting,
  disabled = false,
}: AudioUploadProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!value) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(value.file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  function handleFile(file: File | undefined | null) {
    if (!file) return;
    setError(null);

    if (file.size > MAX_BYTES) {
      setError(
        `Die Datei ist zu groß (${formatBytes(file.size)}) — erlaubt sind höchstens 25 MB.`
      );
      onChange(null);
      return;
    }

    const mime = resolveMime(file);
    if (!mime) {
      setError(
        "Dieses Audioformat wird nicht unterstützt — bitte MP3, M4A, AAC, WAV oder WebM verwenden."
      );
      onChange(null);
      return;
    }

    onChange({
      file,
      mime,
      ext: fileExt(file.name) || MIME_TO_EXT[mime] || "mp3",
    });
    if (inputRef.current) inputRef.current.value = "";
  }

  const showExisting = !value && !!existingUrl;

  return (
    <div role="group" aria-labelledby={`${inputId}-label`}>
      <span className="label" id={`${inputId}-label`}>
        Audio-Interview
      </span>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="audio/*"
        tabIndex={-1}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {!value && !showExisting && (
        <button
          type="button"
          className="btn-ghost min-h-12 w-full sm:w-auto"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          🎙️ Audiodatei auswählen
        </button>
      )}

      {(value || showExisting) && (
        <div className="rounded-2xl border border-paper-line bg-paper p-3">
          <p className="text-sm font-semibold break-all text-coal">
            {value ? value.file.name : "Bereits gespeichertes Audio-Interview"}
          </p>
          {value && <p className="hint">{formatBytes(value.file.size)}</p>}

          <audio
            controls
            preload="metadata"
            src={value ? (previewUrl ?? undefined) : (existingUrl ?? undefined)}
            className="mt-3 w-full"
          >
            Dein Browser kann diese Audiodatei nicht abspielen.
          </audio>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-ghost min-h-11"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              Andere Datei wählen
            </button>
            <button
              type="button"
              className="btn-ghost min-h-11 text-[#b3402a]"
              disabled={disabled}
              onClick={() => {
                setError(null);
                if (value) onChange(null);
                else onRemoveExisting?.();
              }}
            >
              Audio entfernen
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-xs font-semibold text-[#b3402a]">
          {error}
        </p>
      )}

      <p className="hint mt-2">
        Nur der Admin-Account kann Audio-Interviews hochladen. Max. 25 MB (MP3,
        M4A, AAC, WAV oder WebM).
      </p>
    </div>
  );
}
