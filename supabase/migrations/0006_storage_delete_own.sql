-- Eintrag-Accounts dürfen Dateien im EIGENEN Ordner löschen (Aufräumen nach
-- fehlgeschlagenem Insert). Fremde Ordner bleiben tabu; Admin darf weiterhin alles.
create policy "images_delete_own_folder" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'entry-images'
    and (select private.is_contributor())
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
