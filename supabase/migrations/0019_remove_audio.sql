-- =============================================================================
-- AUDIO-INTERVIEWS FALLEN WEG — vollständig, nicht nur aus der Oberfläche.
--
-- Die Idee war: Gespräche mit Ehemaligen aufnehmen und anhängen. Gebaut war
-- der Abspieler, hochgeladen wurde nie eine Datei (Stand dieser Migration:
-- null Objekte im Eimer, null Zeilen mit audio_path).
--
-- Gleichzeitig war Audio der einzige Posten, der die kostenlosen Grenzen
-- wirklich hätte sprengen können: 25 MB je Datei gegen 1 GB Speicher und
-- 5 GB Traffic im Monat — zwei Dutzend Interviews, und der Zeitstrahl wäre
-- am Aktionstag stehen geblieben.
--
-- Was niemand nutzt, muss auch niemand pflegen. Es verschwindet deshalb
-- ganz: Spalte, Eimer, Policies — und im Datenschutzhinweis eine
-- Einwilligung weniger, die die Schule einholen muss.
--
-- Die Policies müssen VOR der Spalte weichen: Postgres lässt keine Spalte
-- fallen, an der noch eine Policy hängt.
-- =============================================================================

-- ------------------------------------------------------- Einträge: Policies
drop policy if exists entries_insert_contributor on public.entries;
create policy entries_insert_contributor on public.entries
  for insert to authenticated
  with check (
    (select private.is_contributor())
    and created_by = (select auth.uid())
    and (not is_milestone or (select private.is_admin()))
    and (image_path is null or (select private.is_admin()))
    and (image_paths = '{}'::text[] or (select private.is_admin()))
  );

comment on policy entries_insert_contributor on public.entries is
  'Anlegen darf jedes Schulkonto — unter eigenem Namen, ohne Meilenstein-Rang und ohne Bilder (die ergänzt die Verwaltung).';

drop policy if exists entries_update_own_editor on public.entries;
create policy entries_update_own_editor on public.entries
  for update to authenticated
  using (
    (select private.is_contributor())
    and created_by = (select auth.uid())
  )
  with check (
    (select private.is_contributor())
    and created_by = (select auth.uid())
    and (not is_milestone or (select private.is_admin()))
    and (is_important = false or (select private.is_admin()))
    and (image_path is null or (select private.is_admin()))
    and (image_paths = '{}'::text[] or (select private.is_admin()))
  );

comment on policy entries_update_own_editor on public.entries is
  'Eintrag-Konten dürfen eigene Beiträge korrigieren — ohne Rang oder Bild zu ändern. Löschen bleibt Admin.';

-- ---------------------------------------------------------- Einträge: Spalte
alter table public.entries drop column if exists audio_path;

-- ------------------------------------------------------------ Storage: Eimer
--
-- Die Policies fallen hier weg; damit kann niemand mehr etwas in den Eimer
-- legen — auch die Verwaltung nicht. Der leere Eimer selbst lässt sich per SQL
-- nicht entfernen: Supabase schützt die Storage-Tabellen gegen direktes
-- Löschen (storage.protect_delete), damit niemand versehentlich Dateien
-- verwaist zurücklässt. Er wird deshalb im Dashboard entfernt —
-- Storage → entry-audio → Delete bucket. Er ist nachweislich leer
-- (null Objekte zum Zeitpunkt dieser Migration) und ohne Policy ohnehin
-- für niemanden mehr beschreibbar. Siehe Go-Live-Checkliste im README.
drop policy if exists audio_insert_admin on storage.objects;
drop policy if exists audio_update_admin on storage.objects;
drop policy if exists audio_delete_admin on storage.objects;
