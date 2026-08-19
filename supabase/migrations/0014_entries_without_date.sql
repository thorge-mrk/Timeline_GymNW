-- =============================================================================
-- Einträge OHNE Datum erlauben.
--
-- Am Aktionstag erinnern sich viele Menschen an etwas, ohne zu wissen, wann es
-- war: „meine Einschulung", „der Austausch nach Amerika", „die eine Klassenfahrt".
-- Bisher erzwang das Schema ein Jahr — damit wären genau die Erinnerungen
-- verloren gegangen, die am häufigsten kommen.
--
-- Ein Eintrag ohne Jahr steht deshalb NICHT auf der Achse, sondern in der
-- Erinnerungs-Wolke. `sort_date` wird dabei von allein NULL, weil make_date()
-- STRICT ist — kein Sonderfall nötig.
-- =============================================================================

alter table public.entries alter column year drop not null;

-- Die alte Prüfung galt nur für gesetzte Jahre; ohne NOT NULL muss sie NULL
-- ausdrücklich durchlassen.
alter table public.entries drop constraint if exists entries_year_check;
alter table public.entries
  add constraint entries_year_check
  check (year is null or year between 1900 and 2100);

-- Ein Monat ohne Jahr ergibt keinen Sinn (und ein Tag ohne Monat ebenso wenig —
-- das prüft die bestehende Bedingung bereits).
alter table public.entries
  add constraint entries_month_needs_year
  check (month is null or year is not null);

comment on column public.entries.year is
  'Jahr des Ereignisses. NULL = „weiß ich nicht" — der Eintrag lebt dann in der Erinnerungs-Wolke statt auf der Achse.';

-- Für die Wolke werden genau die datumslosen Einträge gebraucht.
create index if not exists entries_undated_idx
  on public.entries (created_at desc)
  where year is null;
