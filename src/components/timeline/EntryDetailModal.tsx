"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { categoryById } from "@/lib/categories";
import { formatEntryDate } from "@/lib/dates";
import { publicUrl, supabase } from "@/lib/supabase";
import type { Entry } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";
import Modal from "./Modal";

interface EntryDetailModalProps {
  entry: Entry;
  onClose: () => void;
  /** Nach erfolgreichem Löschen — der Eintrag verschwindet sofort aus dem State. */
  onDeleted: (id: string) => void;
}

/** Best-effort-Aufräumen im Storage; ein Fehler darf das Löschen nicht blockieren. */
async function removeQuietly(bucket: string, path: string | null) {
  if (!path) return;
  try {
    await supabase.storage.from(bucket).remove([path]);
  } catch {
    /* ignoriert — die Datenbankzeile ist bereits weg */
  }
}

export default function EntryDetailModal({
  entry,
  onClose,
  onDeleted,
}: EntryDetailModalProps) {
  const titleId = useId();
  const { isAdmin } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const category = categoryById(entry.category);
  const imageUrl = entry.image_path
    ? publicUrl("entry-images", entry.image_path)
    : null;
  const audioUrl = entry.audio_path
    ? publicUrl("entry-audio", entry.audio_path)
    : null;

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

    await removeQuietly("entry-images", entry.image_path);
    await removeQuietly("entry-audio", entry.audio_path);

    onDeleted(entry.id);
    onClose();
  }

  return (
    <Modal titleId={titleId} onClose={onClose}>
      {imageUrl && (
        <img
          src={imageUrl}
          alt={entry.title}
          loading="lazy"
          className="max-h-72 w-full rounded-t-2xl bg-paper-sunk object-cover"
        />
      )}

      <div className="p-5 sm:p-6">
        <h2 id={titleId} className="pr-10 text-xl leading-snug font-bold text-coal">
          {entry.title}
        </h2>

        {/* Meta-Zeile: Datum führt, alles andere begleitet leise. */}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-2 text-xs">
          <span className="font-semibold text-coal tabular-nums">
            {formatEntryDate(entry)}
          </span>

          <span aria-hidden="true" className="h-3.5 w-px bg-paper-line" />

          <span className="inline-flex items-center gap-1.5 text-coal-soft">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: category.color }}
            />
            {category.label}
          </span>

          {entry.is_milestone && (
            <span className="inline-flex items-center gap-1 rounded-full bg-fox-soft px-2 py-0.5 text-[11px] font-semibold text-fox-deep">
              <span aria-hidden="true">★</span> Meilenstein
            </span>
          )}
        </div>

        {(entry.class_name || entry.author_name) && (
          <p className="mt-1.5 text-xs text-coal-faint">
            {[
              entry.class_name ? `Klasse ${entry.class_name}` : null,
              entry.author_name ? `Erzählt von ${entry.author_name}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}

        {entry.description && (
          <p className="mt-4 text-sm leading-relaxed whitespace-pre-wrap text-coal">
            {entry.description}
          </p>
        )}

        {audioUrl && (
          <div className="mt-5">
            <p className="label">Tonaufnahme</p>
            <audio controls preload="none" src={audioUrl} className="w-full">
              Dein Browser kann diese Tonaufnahme leider nicht abspielen.
            </audio>
          </div>
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
  );
}
