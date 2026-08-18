-- Mehrere Bilder pro Eintrag.
--   image_path   = Titelbild (erscheint auf dem Zeitstrahl und oben im Eintrag)
--   image_paths  = weitere Bilder der Galerie, in der gewünschten Reihenfolge
alter table public.entries
  add column if not exists image_paths text[] not null default '{}';

alter table public.entries
  add constraint entries_image_paths_max
  check (array_length(image_paths, 1) is null or array_length(image_paths, 1) <= 12);

comment on column public.entries.image_path is
  'Titelbild — wird auf dem Zeitstrahl und oben im Eintrag gezeigt.';
comment on column public.entries.image_paths is
  'Weitere Bilder (Galerie), höchstens 12, in Anzeigereihenfolge.';
