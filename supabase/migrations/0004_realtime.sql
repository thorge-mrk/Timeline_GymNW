-- Realtime über "Broadcast from Database" auf dem öffentlichen Channel `timeline`.
-- Bewusst KEINE Publication / kein postgres_changes.
create or replace function private.notify_timeline() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  rec_id uuid;
begin
  if tg_op = 'DELETE' then
    rec_id := old.id;
  else
    rec_id := new.id;
  end if;
  perform realtime.send(
    jsonb_build_object('op', tg_op, 'id', rec_id),
    lower(tg_op),
    'timeline',
    false  -- öffentlicher Channel: anonyme Besucher ohne JWT dürfen empfangen
  );
  return null;
end $$;

create trigger entries_notify_timeline
  after insert or update or delete on public.entries
  for each row execute function private.notify_timeline();
