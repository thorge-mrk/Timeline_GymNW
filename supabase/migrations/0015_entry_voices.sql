-- =============================================================================
-- STIMMEN: mehrere Menschen erinnern sich an dieselbe Sache.
--
-- Wenn zehn Leute „Amerika-Austausch" eintragen, sollen daraus nicht zehn
-- gleich aussehende Einträge werden, sondern EIN Thema, an dem zehn Stimmen
-- hängen — jede mit eigenem Text und eigenem Namen. Auf dem Zeitstrahl wächst
-- das Thema dadurch sichtbar, und beim Öffnen liest man alle Erinnerungen
-- untereinander.
--
-- Rechte (ausdrücklicher Wunsch der Schule): Wer eintragen darf, darf
-- HINZUFÜGEN — aber niemand außer der Verwaltung darf etwas wegnehmen.
-- =============================================================================

create table public.entry_voices (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  author_name text check (char_length(author_name) <= 80),
  class_name text check (char_length(class_name) <= 30),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.entry_voices is
  'Weitere Erinnerungen zu einem bestehenden Eintrag. Eintrag-Konten dürfen anlegen, nur Admin darf ändern/löschen.';

create index entry_voices_entry_idx on public.entry_voices (entry_id, created_at);

create trigger entry_voices_set_updated_at before update on public.entry_voices
  for each row execute function private.set_updated_at();

alter table public.entry_voices enable row level security;

grant select on public.entry_voices to anon, authenticated;
grant insert, update, delete on public.entry_voices to authenticated;

-- Lesen darf jeder — der Zeitstrahl ist öffentlich.
create policy entry_voices_public_read on public.entry_voices
  for select to anon, authenticated using (true);

-- Anlegen darf jedes Schulkonto, aber nur unter eigenem Namen.
create policy entry_voices_insert_contributor on public.entry_voices
  for insert to authenticated
  with check (
    (select private.is_contributor())
    and created_by = (select auth.uid())
  );

-- Ändern und Löschen bleibt der Verwaltung vorbehalten: Eine fremde Erinnerung
-- anzufassen ist etwas anderes, als eine eigene dazuzustellen.
create policy entry_voices_update_admin on public.entry_voices
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy entry_voices_delete_admin on public.entry_voices
  for delete to authenticated
  using ((select private.is_admin()));

-- Stimmen sollen genauso live ankommen wie Einträge. Gemeldet wird die
-- ID des ZUGEHÖRIGEN EINTRAGS, damit der Client schlicht diesen Eintrag samt
-- Stimmen neu lädt — RLS-geprüft, wie bei allem anderen auch.
create or replace function private.notify_timeline_voice() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  target uuid;
begin
  if tg_op = 'DELETE' then
    target := old.entry_id;
  else
    target := new.entry_id;
  end if;
  perform realtime.send(
    jsonb_build_object('op', tg_op, 'id', target, 'kind', 'voice'),
    'voice',
    'timeline',
    false  -- öffentlicher Channel, wie bei den Einträgen
  );
  return null;
end $$;

create trigger entry_voices_notify_timeline
  after insert or update or delete on public.entry_voices
  for each row execute function private.notify_timeline_voice();
