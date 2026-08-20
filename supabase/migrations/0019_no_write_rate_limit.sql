-- =============================================================================
-- DIE EINTRAGS-GRENZE FÄLLT WEG.
--
-- Vorher lag in der Datenbank ein Zähler: höchstens 10 Einträge je Minute und
-- 150 je Stunde pro Konto, für admin 60 und 600. Gedacht war er gegen ein
-- Konto, das durchdreht.
--
-- Gegen den Aktionstag gedacht war er nicht. Dort sitzt jemand vom Projektteam
-- am iPad und tippt ab, was ihm erzählt wird — Zettel für Zettel, eine ganze
-- Pause lang. Genau dieses Konto läuft als Erstes in die Grenze, und was es
-- dann liest, ist eine Fehlermeldung mitten im Gespräch. Eine Schranke, die
-- den erwünschten Fall trifft und den unerwünschten nur verzögert, ist keine.
--
-- Die Schule hat sich deshalb bewusst dagegen entschieden: Jedes Konto darf so
-- viele Einträge anlegen, wie es will.
--
-- Geschützt bleibt die Seite trotzdem — nur an den Stellen, wo es zählt:
--
--   * Anlegen darf nur, wer angemeldet ist (RLS). Konten gibt es
--     ausschließlich per SQL, Selbstregistrierung ist abgeschaltet.
--   * Vor der Anmeldung steht Cloudflare Turnstile, dahinter die
--     Anmelde-Bremse von Supabase — Passwörter durchprobieren geht nicht.
--   * Eintrag-Konten dürfen fremde Beiträge weder ändern noch löschen, und
--     an den eigenen weder Rang noch Bilder anfassen.
--   * Was doch danebengeht, räumt die Verwaltung in einer Minute weg: Das
--     Stift-Menü listet alle Einträge chronologisch, mit Suche und Löschen.
--
-- Die beiden Indizes bleiben stehen. Sie kamen zwar mit dem Zähler, tragen
-- aber inzwischen etwas anderes: „deine letzten 3 Einträge" im Stift-Menü ist
-- genau die Abfrage (created_by, created_at desc), auf die sie passen.
-- =============================================================================

drop trigger if exists entries_rate_limit on public.entries;
drop trigger if exists entry_voices_rate_limit on public.entry_voices;

drop function if exists private.limit_entry_inserts();
drop function if exists private.limit_voice_inserts();
