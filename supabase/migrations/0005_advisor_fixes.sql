-- Behebt Findings der Supabase-Advisors (Stand 2026-08-17):
--
-- 1) Security (WARN): `public.rls_auto_enable()` — plattformseitig vorinstallierter
--    Event-Trigger-Helper (SECURITY DEFINER), der bei CREATE TABLE in `public`
--    automatisch RLS aktiviert. Er war per Default für anon/authenticated
--    ausführbar (via /rest/v1/rpc). API-Rollen brauchen das nicht — Event-Trigger
--    laufen unabhängig von EXECUTE-Grants.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- 2) Performance (INFO): Foreign Key `entries_created_by_fkey` ohne deckenden
--    Index (relevant z. B. für Löschungen in auth.users → on delete set null).
create index entries_created_by_idx on public.entries (created_by);
