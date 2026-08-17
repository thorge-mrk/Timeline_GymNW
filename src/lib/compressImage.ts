"use client";

/**
 * Bild-Komprimierung im Browser (Canvas) — läuft nur clientseitig.
 *
 * Ziel: Fotos vom iPad/Handy so weit verkleinern, dass sie unter das
 * 2-MB-Limit des Storage-Buckets `entry-images` passen und der Zeitstrahl
 * schnell lädt. Erlaubte MIME-Typen des Buckets: image/webp und image/jpeg.
 *
 * Hinweis: iPad/iPhone liefern HEIC-Fotos über den <input type="file">
 * in der Regel bereits als JPEG aus — eine HEIC-Dekodierung ist daher
 * nicht nötig.
 */

/** Längste Kante nach dem Skalieren. */
const MAX_EDGE = 1600;
/** Harte Obergrenze des Buckets `entry-images`. */
const MAX_BYTES = 2 * 1024 * 1024;

const QUALITY_WEBP = 0.82;
const QUALITY_JPEG = 0.85;
const QUALITY_RETRY = 0.65;

export interface CompressedImage {
  blob: Blob;
  ext: "webp" | "jpg";
  mime: string;
}

const ERR_UNREADABLE =
  "Dieses Bild kann nicht gelesen werden — bitte ein Foto im JPG- oder PNG-Format wählen.";
const ERR_TOO_LARGE =
  "Das Bild ist zu groß — bitte ein kleineres Foto wählen.";
const ERR_NO_CANVAS =
  "Dieses Bild kann in diesem Browser nicht verarbeitet werden — bitte die Seite neu laden oder ein JPG-Foto wählen.";

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

/**
 * Skaliert das Bild auf max. 1600 px längste Kante und komprimiert es
 * nach WebP (Fallback: JPEG für ältere Safari-Versionen).
 * Wirft deutsche Fehlermeldungen, die direkt angezeigt werden können.
 */
export async function compressImage(file: File): Promise<CompressedImage> {
  if (typeof createImageBitmap !== "function") {
    throw new Error(ERR_UNREADABLE);
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Zweiter Versuch ohne Optionen — ältere Browser kennen imageOrientation nicht.
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      throw new Error(ERR_UNREADABLE);
    }
  }

  try {
    if (!bitmap.width || !bitmap.height) throw new Error(ERR_UNREADABLE);

    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error(ERR_NO_CANVAS);
    // Weißer Grund, damit transparente PNGs im JPEG-Fallback nicht schwarz werden.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    let ext: "webp" | "jpg" = "webp";
    let mime = "image/webp";
    let blob = await canvasToBlob(canvas, mime, QUALITY_WEBP);

    if (!blob || blob.type !== "image/webp") {
      // Älteres Safari kann kein WebP schreiben und liefert stattdessen PNG.
      ext = "jpg";
      mime = "image/jpeg";
      blob = await canvasToBlob(canvas, mime, QUALITY_JPEG);
      if (!blob || blob.type !== "image/jpeg") throw new Error(ERR_NO_CANVAS);
    }

    if (blob.size > MAX_BYTES) {
      const retry = await canvasToBlob(canvas, mime, QUALITY_RETRY);
      if (retry && retry.type === mime && retry.size < blob.size) blob = retry;
    }

    if (blob.size > MAX_BYTES) throw new Error(ERR_TOO_LARGE);

    return { blob, ext, mime };
  } finally {
    bitmap.close();
  }
}

/** „0,3 MB“ — deutsche Schreibweise mit Komma. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toLocaleString("de-DE", {
      maximumFractionDigits: 0,
    })} KB`;
  }
  return `${(bytes / (1024 * 1024)).toLocaleString("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} MB`;
}
