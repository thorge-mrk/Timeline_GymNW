-- Dreistufige Rangfolge auf dem Zeitstrahl:
--   is_milestone  große Bildkarte   — nur Admin-Konten
--   is_important  mittelgroße Karte — auch Eintrag-Konten dürfen das
--   (keins)       normale Pille
alter table public.entries
  add column if not exists is_important boolean not null default false;

comment on column public.entries.is_important is
  'Wichtiges Ereignis — größer als ein normaler Eintrag, kleiner als ein Meilenstein. Darf auch von Eintrag-Konten gesetzt werden.';

alter table public.entries
  add constraint entries_rank_exclusive
  check (not (is_milestone and is_important));

create index if not exists entries_rank_idx
  on public.entries (is_milestone, is_important);

drop policy if exists entries_insert_contributor on public.entries;
create policy entries_insert_contributor on public.entries
  for insert to authenticated
  with check (
    (select private.is_contributor())
    and created_by = (select auth.uid())
    and (not is_milestone or (select private.is_admin()))
    and (audio_path is null or (select private.is_admin()))
  );
