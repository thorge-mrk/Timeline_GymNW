create or replace function private.jwt_role() returns text
language sql stable set search_path = '' as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'app_role', '')
$$;
create or replace function private.is_admin() returns boolean
language sql stable set search_path = '' as $$
  select private.jwt_role() = 'admin'
$$;
create or replace function private.is_contributor() returns boolean
language sql stable set search_path = '' as $$
  select private.jwt_role() in ('admin','editor')
$$;

grant usage on schema private to anon, authenticated;
grant execute on all functions in schema private to anon, authenticated;

grant select on public.entries to anon, authenticated;
grant insert, update, delete on public.entries to authenticated;

create policy "entries_public_read" on public.entries
  for select to anon, authenticated using (true);

create policy "entries_insert_contributor" on public.entries
  for insert to authenticated
  with check (
    (select private.is_contributor())
    and created_by = (select auth.uid())
    and (not is_milestone or (select private.is_admin()))
    and (audio_path is null or (select private.is_admin()))
  );

create policy "entries_update_admin" on public.entries
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "entries_delete_admin" on public.entries
  for delete to authenticated
  using ((select private.is_admin()));
