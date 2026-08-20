-- =============================================================================
-- EINTRAGS-LIMIT: ein Konto, das durchdreht, darf die Zeitachse nicht fluten.
--
-- Die Anmeldeseite ist öffentlich erreichbar — das lässt sich bei einer
-- statischen Website nicht ändern. Wer ein Passwort erraten hat oder ein
-- unbeaufsichtigtes iPad mitnimmt, säße bisher an einem offenen Ventil.
--
-- Deshalb eine Grenze dort, wo sie niemand umgehen kann: in der Datenbank.
-- Sie liegt weit über allem, was ein Mensch im Gespräch tippt (ein Eintrag
-- dauert eine halbe Minute), und weit unter dem, was ein Skript anrichtet.
--
-- Die Verwaltung ist NICHT ausgenommen, sondern bekommt nur mehr Luft: Wer
-- zwanzig Meilensteine am Stück nachträgt, tut das mit Absicht — aber eine
-- Grenze, die für das mächtigste Konto nicht gilt, schützt am Ende nichts.
-- (Und genau das wäre hier passiert: Stand August 2026 tragen alle
-- eingerichteten Konten die Rolle admin.)
--
-- Die Meldungen stehen bewusst auf Deutsch in der Datenbank: Sie kommen
-- unverändert im Formular an und sind das Erste, was jemand am Aktionstag
-- liest, wenn etwas klemmt.
-- =============================================================================

-- Ohne diesen Index würde jeder Eintrag die ganze Tabelle zählen lassen.
create index if not exists entries_author_recent_idx
  on public.entries (created_by, created_at desc);
create index if not exists entry_voices_author_recent_idx
  on public.entry_voices (created_by, created_at desc);

create or replace function private.limit_entry_inserts() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  verwaltung boolean := (select private.is_admin());
  je_minute int := case when verwaltung then 60 else 10 end;
  je_stunde int := case when verwaltung then 600 else 150 end;
  bisher int;
begin
  if actor is null then
    return new;   -- ohne Konto kommt hier ohnehin niemand vorbei (RLS)
  end if;

  select count(*) into bisher
    from public.entries
   where created_by = actor
     and created_at > now() - interval '1 minute';
  if bisher >= je_minute then
    raise exception
      'Zu viele Einträge in kurzer Zeit. Bitte eine Minute warten und noch einmal speichern — das Getippte bleibt stehen.'
      using errcode = 'P0001';
  end if;

  select count(*) into bisher
    from public.entries
   where created_by = actor
     and created_at > now() - interval '1 hour';
  if bisher >= je_stunde then
    raise exception
      'Dieses Konto hat in der letzten Stunde sehr viele Einträge angelegt. Bitte kurz Pause machen oder die Verwaltung ansprechen.'
      using errcode = 'P0001';
  end if;

  return new;
end $$;

comment on function private.limit_entry_inserts() is
  'Begrenzt neue Einträge je Konto: 10/Minute und 150/Stunde, für admin 60/Minute und 600/Stunde.';

create or replace function private.limit_voice_inserts() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  verwaltung boolean := (select private.is_admin());
  -- Stimmen sind kürzer; da tippt man schneller
  je_minute int := case when verwaltung then 90 else 20 end;
  je_stunde int := case when verwaltung then 900 else 300 end;
  bisher int;
begin
  if actor is null then
    return new;
  end if;

  select count(*) into bisher
    from public.entry_voices
   where created_by = actor
     and created_at > now() - interval '1 minute';
  if bisher >= je_minute then
    raise exception
      'Zu viele Erinnerungen in kurzer Zeit. Bitte eine Minute warten und noch einmal speichern — das Getippte bleibt stehen.'
      using errcode = 'P0001';
  end if;

  select count(*) into bisher
    from public.entry_voices
   where created_by = actor
     and created_at > now() - interval '1 hour';
  if bisher >= je_stunde then
    raise exception
      'Dieses Konto hat in der letzten Stunde sehr viele Erinnerungen angelegt. Bitte kurz Pause machen oder die Verwaltung ansprechen.'
      using errcode = 'P0001';
  end if;

  return new;
end $$;

comment on function private.limit_voice_inserts() is
  'Begrenzt neue Stimmen je Konto: 20/Minute und 300/Stunde, für admin 90/Minute und 900/Stunde.';

drop trigger if exists entries_rate_limit on public.entries;
create trigger entries_rate_limit before insert on public.entries
  for each row execute function private.limit_entry_inserts();

drop trigger if exists entry_voices_rate_limit on public.entry_voices;
create trigger entry_voices_rate_limit before insert on public.entry_voices
  for each row execute function private.limit_voice_inserts();
