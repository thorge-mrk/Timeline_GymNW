"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { categoryById, categoryPillStyle } from "@/lib/categories";
import { entryToSmartDate, formatSmartDate } from "@/lib/dates";
import { supabase } from "@/lib/supabase";

/**
 * „Deine letzten Einträge“ — der Weg zurück zum eigenen Beitrag.
 *
 * Seit Neuestem dürfen Eintrag-Konten ihre eigenen Beiträge korrigieren
 * (Policy entries_update_own_editor). Nur: Bisher führte kein Weg dorthin. Wer
 * den Tippfehler eine Minute nach dem Absenden bemerkte, musste ihn auf dem
 * Zeitstrahl zwischen 58 anderen Punkten wiederfinden — bei einer Erinnerung
 * ohne Datum in der Wolke sogar noch schwerer.
 *
 * Deshalb stehen die drei jüngsten eigenen Einträge direkt über dem Formular,
 * dort, wo man nach dem Speichern ohnehin wieder landet. Drei, nicht zehn: Es
 * ist eine Korrekturhilfe für das, was man gerade eingetragen hat, und kein
 * zweiter Zeitstrahl.
 *
 * Wer noch nichts eingetragen hat, sieht hier gar nichts — eine leere Liste
 * mit der Überschrift „Deine letzten Einträge“ wäre beim allerersten Besuch
 * eine Ansage über etwas, das man noch gar nicht tun konnte.
 *
 * Gelesen wird streng das Eigene (created_by = eigene Kennung). Das ist
 * Komfort, keine Sicherung: Was jemand ändern darf, entscheidet ohnehin die
 * Datenbank.
 */

/** Nur die Spalten, die in der Zeile auch wirklich vorkommen. */
interface OwnEntry {
  id: string;
  title: string;
  category: string;
  year: number | null;
  month: number | null;
  day: number | null;
}

/** Drei Zeilen sind eine Hilfe, zehn wären eine Liste zum Durchsuchen. */
const LIMIT = 3;

function PencilIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
    >
      <path d="M12.6 3.9 16 7.3 7.3 16H3.9v-3.4z" />
      <path d="m11 5.5 3.4 3.4" />
    </svg>
  );
}

export interface RecentEntriesProps {
  /** Die eigene Kennung — nur eigene Zeilen werden geladen. */
  userId: string;
  /**
   * Zählt die eigenen Speichervorgänge. Nach dem Absenden steht der frische
   * Beitrag ganz oben in der Liste — genau dann fällt der Tippfehler auf.
   */
  refreshKey?: number;
}

export function RecentEntries({ userId, refreshKey = 0 }: RecentEntriesProps) {
  const [rows, setRows] = useState<readonly OwnEntry[]>([]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data, error } = await supabase
        .from("entries")
        .select("id,title,category,year,month,day")
        .eq("created_by", userId)
        .order("created_at", { ascending: false })
        .limit(LIMIT);
      // Geht das schief, bleibt die Liste einfach weg. Sie ist eine Abkürzung,
      // kein Teil des Formulars — eine Fehlermeldung wäre hier nur im Weg.
      if (!active || error || !data) return;
      setRows(data);
    })();
    return () => {
      active = false;
    };
  }, [userId, refreshKey]);

  if (rows.length === 0) return null;

  return (
    <section
      aria-labelledby="eigene-eintraege"
      className="card animate-fade-up mb-6 p-4 sm:p-5"
    >
      <h2 id="eigene-eintraege" className="text-sm font-bold text-coal">
        Deine letzten Einträge
      </h2>
      <p className="hint mt-1 leading-relaxed">
        Etwas vergessen oder ein Tippfehler? Du kannst deine eigenen Beiträge
        ändern.
      </p>

      <ul className="mt-3 space-y-2">
        {rows.map((row) => {
          const date = entryToSmartDate(row);
          return (
            <li
              key={row.id}
              className="flex items-center justify-between gap-3 rounded-xl border
                border-paper-line bg-paper-sunk px-3.5 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-coal">
                  {row.title}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span
                    className="chip cursor-default"
                    style={categoryPillStyle(row.category)}
                  >
                    {categoryById(row.category).label}
                  </span>
                  <span className="hint">
                    {date ? formatSmartDate(date) : "Ohne Datum"}
                  </span>
                </p>
              </div>
              {/* 44 px hoch — auf dem Schul-iPad wird das mit dem Daumen getroffen. */}
              <Link
                href={`/eintragen/?id=${row.id}`}
                className="btn-ghost min-h-11 shrink-0 px-3.5 text-xs"
              >
                <PencilIcon />
                Ändern
                <span className="sr-only"> — {row.title}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
