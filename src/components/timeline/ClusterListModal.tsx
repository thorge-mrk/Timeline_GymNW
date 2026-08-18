"use client";

import { useId } from "react";
import { categoryById } from "@/lib/categories";
import { formatEntryDate } from "@/lib/dates";
import type { Entry } from "@/lib/types";
import Modal from "./Modal";
import "./timeline.css";

interface ClusterListModalProps {
  entries: Entry[];
  onSelect: (entry: Entry) => void;
  onClose: () => void;
}

/**
 * Fallback für Cluster, die sich durch Zoomen nicht mehr auflösen lassen —
 * z. B. mehrere Einträge mit exakt demselben Datum. Statt vergeblich weiter
 * hineinzuzoomen bekommt man hier eine schlichte Liste.
 */
export default function ClusterListModal({
  entries,
  onSelect,
  onClose,
}: ClusterListModalProps) {
  const titleId = useId();

  return (
    <Modal titleId={titleId} onClose={onClose} maxWidthClass="max-w-md">
      <div className="p-5 sm:p-6">
        <h2 id={titleId} className="pr-10 text-lg font-bold text-coal">
          <span className="tabular-nums">{entries.length}</span> Einträge an
          dieser Stelle
        </h2>
        <p className="hint mt-1">Wähle einen Eintrag aus, um ihn zu öffnen.</p>

        <ul className="mt-4 flex flex-col gap-1.5">
          {entries.map((entry) => {
            const category = categoryById(entry.category);
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => onSelect(entry)}
                  className="tl-marker flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-paper-line bg-paper px-3 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fox"
                >
                  {/* Rang bleibt auch in der Liste sichtbar: Stern für
                      Meilensteine, Fuchs-Ring für wichtige Einträge. */}
                  {entry.is_important && !entry.is_milestone ? (
                    <span
                      aria-hidden="true"
                      className="flex h-3 w-3 shrink-0 items-center justify-center rounded-full border border-fox/70"
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                    </span>
                  ) : (
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-coal">
                      {entry.is_milestone && (
                        <span className="text-fox-deep">★ </span>
                      )}
                      {entry.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-coal-faint tabular-nums">
                      {formatEntryDate(entry)}
                    </span>
                  </span>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                    className="shrink-0 text-coal-faint"
                  >
                    <path
                      d="M6 3.5L10.5 8 6 12.5"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Modal>
  );
}
