insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('entry-images', 'entry-images', true, 2097152,
   array['image/webp','image/jpeg']),
  ('entry-audio', 'entry-audio', true, 26214400,
   array['audio/mpeg','audio/mp4','audio/aac','audio/x-m4a','audio/wav','audio/webm'])
on conflict (id) do nothing;

create policy "images_insert_own_folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'entry-images'
    and (select private.is_contributor())
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "images_update_admin" on storage.objects
  for update to authenticated
  using (bucket_id = 'entry-images' and (select private.is_admin()))
  with check (bucket_id = 'entry-images' and (select private.is_admin()));
create policy "images_delete_admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'entry-images' and (select private.is_admin()));

create policy "audio_insert_admin" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'entry-audio' and (select private.is_admin()));
create policy "audio_update_admin" on storage.objects
  for update to authenticated
  using (bucket_id = 'entry-audio' and (select private.is_admin()))
  with check (bucket_id = 'entry-audio' and (select private.is_admin()));
create policy "audio_delete_admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'entry-audio' and (select private.is_admin()));
