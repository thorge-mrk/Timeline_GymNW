-- =============================================================================
-- LÜCKE: Beim ANLEGEN durfte ein Eintrag-Konto „wichtig" setzen.
--
-- Gefunden im Abschluss-Test vor der Freigabe. Die Regel fürs Nachbessern
-- (entries_update_own_editor, Migration 0017) verbietet es sauber:
--
--     and (is_important = false or (select private.is_admin()))
--
-- In der Regel fürs Anlegen fehlte genau diese Zeile. Ein Eintrag-Konto konnte
-- seinen Beitrag also nicht nachträglich hervorheben — wohl aber gleich
-- hervorgehoben anlegen. Zwei Regeln, die dasselbe meinen und Verschiedenes
-- sagen, sind immer ein Fehler; hier war es der gefährlichere von beiden.
--
-- Über das Formular war das nicht auszulösen: Es schickt `is_important` für
-- Nicht-Admins gar nicht mit. Aber das Formular ist nicht die Grenze — die
-- Grenze ist RLS. Wer den Publishable Key aus der Seite liest (er steht dort
-- offen, so ist er gedacht) und die Anfrage von Hand stellt, umgeht jede
-- Prüfung im Browser. Halten muss es die Datenbank.
--
-- Warum das überhaupt zählt: „Wichtig" hebt einen Beitrag auf dem Zeitstrahl
-- heraus. Diese Auszeichnung soll aus der Zahl der Stimmen entstehen oder von
-- der Verwaltung kommen — nicht daraus, dass jemand sie sich selbst gibt.
-- =============================================================================

drop policy if exists entries_insert_contributor on public.entries;
create policy entries_insert_contributor on public.entries
  for insert to authenticated
  with check (
    (select private.is_contributor())
    and created_by = (select auth.uid())
    and (not is_milestone or (select private.is_admin()))
    and (is_important = false or (select private.is_admin()))
    and (image_path is null or (select private.is_admin()))
    and (image_paths = '{}'::text[] or (select private.is_admin()))
  );

comment on policy entries_insert_contributor on public.entries is
  'Anlegen darf jedes Schulkonto — unter eigenem Namen, ohne Meilenstein, ohne Hervorhebung und ohne Bilder (die ergänzt die Verwaltung).';
