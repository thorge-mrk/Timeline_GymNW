-- =============================================================================
-- Eintrag-Konten dürfen ihre EIGENEN Einträge nachbessern.
--
-- Am Aktionstag tippt jemand in dreißig Sekunden eine Erinnerung ein und sieht
-- danach den Tippfehler. Bisher musste dafür die Verwaltung kommen — für ein
-- fehlendes „h" in „Weihnachtsfeier" eine absurd hohe Hürde.
--
-- Erlaubt wird deshalb genau das und nicht mehr:
--   * nur eigene Zeilen (created_by = auth.uid())
--   * die Urheberschaft bleibt, wo sie ist (created_by unveränderlich)
--   * kein Aufstieg zum Meilenstein und keine Bilder/Ton — das bleibt
--     der Verwaltung vorbehalten, genau wie beim Anlegen
--   * LÖSCHEN weiterhin nur Admin: Eine Erinnerung verschwinden zu lassen ist
--     etwas anderes, als sie zu korrigieren
-- =============================================================================

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
    and (audio_path is null or (select private.is_admin()))
    and (image_path is null or (select private.is_admin()))
    and (image_paths = '{}'::text[] or (select private.is_admin()))
  );

comment on policy entries_update_own_editor on public.entries is
  'Eintrag-Konten dürfen eigene Beiträge korrigieren — ohne Rang, Bild oder Ton zu ändern. Löschen bleibt Admin.';
