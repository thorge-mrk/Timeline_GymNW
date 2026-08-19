-- =============================================================================
-- Bilder darf nur noch die Verwaltung hochladen.
--
-- Die Datenschutzerklärung der Schule sagt zu: „Fotos werden dem Zeitstrahl vom
-- Projektteam hinzugefügt, nicht über das öffentliche Formular." Bisher konnte
-- jedes Eintrag-Konto Bilder anhängen — die Zusage stimmte also nicht.
--
-- Statt den Text der Schule umzuschreiben, wird die Technik an die Zusage
-- angepasst: Ab hier dürfen nur Admin-Konten Bilder mitgeben. Das ist auch die
-- vorsichtigere Richtung — ein Foto zeigt Gesichter, ein Text nennt höchstens
-- einen Vornamen.
--
-- Bestehende Bilder bleiben unangetastet und öffentlich sichtbar.
-- =============================================================================

drop policy if exists entries_insert_contributor on public.entries;
create policy entries_insert_contributor on public.entries
  for insert to authenticated
  with check (
    (select private.is_contributor())
    and created_by = (select auth.uid())
    and (not is_milestone or (select private.is_admin()))
    and (audio_path is null or (select private.is_admin()))
    -- NEU: Titelbild und Galerie sind der Verwaltung vorbehalten.
    and (image_path is null or (select private.is_admin()))
    and (image_paths = '{}'::text[] or (select private.is_admin()))
  );

-- Auch der Weg über den Speicher wird geschlossen: Wer keine Bilder eintragen
-- darf, soll sie auch nicht ablegen können. Sonst lägen verwaiste Dateien im
-- Bucket, die niemand mehr zuordnen kann.
drop policy if exists "images_insert_own_folder" on storage.objects;
create policy "images_insert_admin" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'entry-images'
    and (select private.is_admin())
    -- Der eigene Ordner bleibt Pflicht: So bleibt nachvollziehbar, wer was
    -- hochgeladen hat, auch innerhalb der Verwaltung.
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
