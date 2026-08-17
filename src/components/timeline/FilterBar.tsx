"use client";

import { CATEGORIES, type CategoryId } from "@/lib/categories";

/** „alle" · „meilensteine" · eine der fünf Kategorien. */
export type CategoryFilter = "alle" | "meilensteine" | CategoryId;

export interface FilterState {
  category: CategoryFilter;
  /** Nur bei den Klassen-Kategorien relevant. */
  className: string | null;
}

export const INITIAL_FILTER: FilterState = { category: "alle", className: null };

/** Kategorien, für die das Klassen-Dropdown eingeblendet wird. */
export function usesClassFilter(category: CategoryFilter): boolean {
  return category === "schueler" || category === "ehemalige";
}

interface FilterBarProps {
  filter: FilterState;
  onChange: (filter: FilterState) => void;
  /** Alphabetisch sortierte Klassen der aktiven Kategorie. */
  classOptions: string[];
  /** Anzahl der Einträge nach Filterung. */
  count: number;
}

/**
 * Relative Helligkeit — entscheidet, ob auf einer Kategoriefarbe heller oder
 * dunkler Text besser lesbar ist (Schul-Orange braucht dunkle Schrift).
 */
function isLight(hex: string): boolean {
  const value = hex.replace("#", "");
  if (value.length !== 6) return false;
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 0.6;
}

export default function FilterBar({
  filter,
  onChange,
  classOptions,
  count,
}: FilterBarProps) {
  const showClasses = usesClassFilter(filter.category);

  function selectCategory(category: CategoryFilter) {
    onChange({ category, className: null });
  }

  return (
    <div className="border-b border-paper-line bg-paper px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="order-1 flex w-full items-center gap-2 overflow-x-auto pb-0.5 sm:w-auto sm:flex-1">
          <button
            type="button"
            aria-pressed={filter.category === "alle"}
            onClick={() => selectCategory("alle")}
            className={`chip shrink-0 ${
              filter.category === "alle"
                ? "border-navy bg-navy text-paper"
                : "border-paper-line bg-paper-card text-coal hover:border-coal-soft/40"
            }`}
          >
            Alle
          </button>

          {CATEGORIES.map((category) => {
            const active = filter.category === category.id;
            return (
              <button
                key={category.id}
                type="button"
                aria-pressed={active}
                onClick={() => selectCategory(category.id)}
                className={`chip shrink-0 ${
                  active
                    ? ""
                    : "border-paper-line bg-paper-card text-coal hover:border-coal-soft/40"
                }`}
                style={
                  active
                    ? {
                        backgroundColor: category.color,
                        borderColor: category.color,
                        color: isLight(category.color) ? "#0b1338" : "#f8f5ef",
                      }
                    : undefined
                }
              >
                <span
                  aria-hidden="true"
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: active ? "currentColor" : category.color,
                  }}
                />
                {category.label}
              </button>
            );
          })}

          <button
            type="button"
            aria-pressed={filter.category === "meilensteine"}
            onClick={() => selectCategory("meilensteine")}
            className={`chip shrink-0 ${
              filter.category === "meilensteine"
                ? "border-fox bg-fox text-navy"
                : "border-paper-line bg-paper-card text-coal hover:border-coal-soft/40"
            }`}
          >
            ★ Meilensteine
          </button>
        </div>

        {showClasses && (
          <label className="order-2 flex shrink-0 items-center gap-2">
            <span className="sr-only">Klasse</span>
            <select
              className="input w-auto max-w-40 py-1.5 text-xs"
              value={filter.className ?? ""}
              onChange={(event) =>
                onChange({
                  category: filter.category,
                  className: event.target.value || null,
                })
              }
            >
              <option value="">Alle Klassen</option>
              {classOptions.map((name) => (
                <option key={name} value={name}>
                  Klasse {name}
                </option>
              ))}
            </select>
          </label>
        )}

        <span
          aria-live="polite"
          className="order-3 ml-auto shrink-0 text-xs whitespace-nowrap text-coal-faint tabular-nums"
        >
          {count === 1 ? "1 Eintrag" : `${count} Einträge`}
        </span>
      </div>
    </div>
  );
}
