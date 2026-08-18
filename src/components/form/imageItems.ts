"use client";

import { useEffect, useRef } from "react";
import { compressImage } from "@/lib/compressImage";
import { publicUrl } from "@/lib/supabase";

/**
 * Gemeinsame Grundlage für Titelbild und Galerie.
 *
 * Ein Eintrag hat zwei Bildfelder:
 *   image_path  — das Titelbild (Zeitstrahl, Kopf des Eintrags)
 *   image_paths — weitere Bilder in Anzeigereihenfolge, höchstens 12
 *
 * Im Formular liegen beide Sorten als dieselbe kleine Struktur vor. Nur so
 * lassen sich Bilder zwischen Galerie und Titelbild tauschen, ohne dass die
 * Vorschau neu gebaut oder ein Foto doppelt hochgeladen werden muss.
 */

/** Bucket für alle Eintragsbilder. */
export const IMAGE_BUCKET = "entry-images";

/** Höchstzahl weiterer Bilder — entspricht dem CHECK-Constraint der Datenbank. */
export const GALLERY_MAX = 12;

export const ERR_NOT_AN_IMAGE =
  "Bitte eine Bilddatei auswählen (z. B. JPG oder PNG).";

/** Fertig komprimiertes Bild, bereit für den Upload. */
export interface PreparedImage {
  blob: Blob;
  ext: "webp" | "jpg";
  mime: string;
  originalName: string;
  originalSize: number;
}

/** Ein Bild im Formular — entweder frisch gewählt oder bereits gespeichert. */
export interface ImageItem {
  /** Nur für React-Keys und die Bedienknöpfe — landet nie in der Datenbank. */
  id: string;
  /** Neu ausgewählt: muss beim Speichern hochgeladen werden. */
  prepared: PreparedImage | null;
  /** Liegt schon im Storage: bleibt beim Speichern unverändert. */
  path: string | null;
  /** Anzeige-URL — Objekt-URL (neu) oder öffentliche CDN-URL (gespeichert). */
  url: string;
}

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

/** Frisch ausgewähltes Bild — erzeugt die Objekt-URL für die Vorschau. */
export function newImageItem(prepared: PreparedImage): ImageItem {
  return {
    id: nextId("neu"),
    prepared,
    path: null,
    url: URL.createObjectURL(prepared.blob),
  };
}

/** Bereits gespeichertes Bild aus dem Storage. */
export function storedImageItem(path: string): ImageItem {
  return {
    id: nextId("gespeichert"),
    prepared: null,
    path,
    url: publicUrl(IMAGE_BUCKET, path),
  };
}

/** Beschriftung für Alt-Text und Dateiangabe. */
export function imageItemName(item: ImageItem): string {
  return item.prepared ? item.prepared.originalName : "Gespeichertes Bild";
}

/** iPads liefern nicht immer einen MIME-Typ — dann zählt die Dateiendung. */
export function looksLikeImage(file: File): boolean {
  return (
    file.type.startsWith("image/") ||
    /\.(jpe?g|png|webp|gif|heic|heif|avif|bmp)$/i.test(file.name)
  );
}

/** Verkleinert das Foto und merkt sich Name und Ausgangsgröße. */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const compressed = await compressImage(file);
  return {
    ...compressed,
    originalName: file.name,
    originalSize: file.size,
  };
}

/**
 * Gibt Objekt-URLs wieder frei, sobald ein Bild nicht mehr im Formular steht
 * (entfernt, ersetzt oder nach dem Speichern durch die gespeicherte Fassung).
 * Ohne das hält der Browser jedes einmal gewählte Foto bis zum Neuladen fest —
 * auf dem iPad sind das schnell etliche Megabyte.
 */
export function useObjectUrlCleanup(items: readonly (ImageItem | null)[]): void {
  const live = useRef<Set<string>>(new Set());

  useEffect(() => {
    const current = new Set<string>();
    for (const item of items) {
      if (item?.prepared) current.add(item.url);
    }
    for (const url of live.current) {
      if (!current.has(url)) {
        URL.revokeObjectURL(url);
        live.current.delete(url);
      }
    }
    for (const url of current) live.current.add(url);
  }, [items]);

  useEffect(() => {
    const set = live.current;
    return () => {
      for (const url of set) URL.revokeObjectURL(url);
      set.clear();
    };
  }, []);
}
