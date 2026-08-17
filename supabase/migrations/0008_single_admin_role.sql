-- ============================================================================
-- Vereinfachtes Rechtemodell: Es gibt nur noch EINE Rolle — 'admin'.
--
-- Jedes Konto der Schule darf alles: Einträge anlegen, bearbeiten, löschen,
-- Meilensteine setzen, Audio-Interviews hochladen. Damit können mehrere
-- Kolleginnen und Kollegen am Aktionstag gleichberechtigt arbeiten.
-- Anonyme Besucher dürfen weiterhin ausschließlich lesen.
-- ============================================================================

update auth.users
   set raw_app_meta_data = raw_app_meta_data || '{"app_role":"admin"}'::jsonb
 where coalesce(raw_app_meta_data->>'app_role','') <> 'admin';

-- Name bleibt, Bedeutung ist jetzt identisch mit is_admin() — so brechen
-- bestehende Policies nicht.
create or replace function private.is_contributor() returns boolean
language sql stable set search_path = '' as $$
  select private.jwt_role() = 'admin'
$$;

drop policy if exists entries_insert_contributor on public.entries;
create policy entries_insert_admin on public.entries
  for insert to authenticated
  with check (
    (select private.is_admin())
    and created_by = (select auth.uid())
  );

-- Storage: Upload jeweils nur in den eigenen Ordner (verhindert, dass ein
-- Konto fremde Dateien überschreibt), Audio jetzt für alle Konten.
drop policy if exists images_insert_own_folder on storage.objects;
create policy images_insert_own_folder on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'entry-images'
    and (select private.is_admin())
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists images_delete_own_folder on storage.objects;
create policy images_delete_own_folder on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'entry-images'
    and (select private.is_admin())
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists audio_insert_admin on storage.objects;
create policy audio_insert_admin on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'entry-audio'
    and (select private.is_admin())
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
