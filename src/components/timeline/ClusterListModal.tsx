"use client";

import { useId } from "react";
import { categoryById } from "@/lib/categories";
import { formatEntryDate } from "@/lib/dates";
import type { Entry } from "@/lib/types";
import Modal from "./Modal";

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
          {entries.length} Einträge an dieser Stelle
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
                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-paper-line bg-paper px-3 py-2.5 text-left transition-colors hover:border-fox focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fox"
                >
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-coal">
                      {entry.is_milestone && (
                        <span className="text-fox">★ </span>
                      )}
                      {entry.title}
                    </span>
                    <span className="block text-xs text-coal-soft">
                      {formatEntryDate(entry)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Modal>
  );
}
