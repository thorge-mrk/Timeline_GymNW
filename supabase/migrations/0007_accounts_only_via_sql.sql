-- ============================================================================
-- Konten dürfen AUSSCHLIESSLICH per SQL angelegt werden.
--
-- Ohne diese Sperre kann sich über die öffentliche Auth-Schnittstelle jeder
-- selbst ein Konto anlegen (die Einstellung im Dashboard ist nur ein Schalter
-- und lässt sich versehentlich wieder aktivieren). Die Sperre hier wirkt eine
-- Ebene tiefer: in der Datenbank. Sie gilt damit für JEDEN Weg — öffentliche
-- Registrierung, Magic Link, OAuth, Einladungen.
--
-- Neue Konten entstehen nur noch über private.create_account(); diese Funktion
-- hebt die Sperre für die Dauer ihrer eigenen Transaktion auf.
-- ============================================================================

-- Erlaubt das Anlegen nur, wenn der Schalter in DIESER Transaktion gesetzt ist.
create or replace function private.guard_user_creation() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if coalesce(
       current_setting('zeitstrahl.allow_user_creation', true), 'off'
     ) <> 'on'
  then
    raise exception
      'Konten für den Zeitstrahl können nur von der Schule per SQL angelegt werden (private.create_account).'
      using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists zeitstrahl_guard_user_creation on auth.users;
create trigger zeitstrahl_guard_user_creation
  before insert on auth.users
  for each row execute function private.guard_user_creation();

-- ---------------------------------------------------------------------------
-- Konto anlegen. Beispiel:
--   select private.create_account('admin@gym-nw.de', 'langes-passwort', 'admin');
-- Rollen: 'admin' (alles) oder 'editor' (nur neue Einträge anlegen).
-- ---------------------------------------------------------------------------
create or replace function private.create_account(
  p_email    text,
  p_password text,
  p_role     text default 'editor'
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid   uuid := gen_random_uuid();
  v_email text := lower(trim(p_email));
begin
  if p_role not in ('admin', 'editor') then
    raise exception 'Rolle muss admin oder editor sein, war: %', p_role;
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Keine gültige E-Mail-Adresse: %', p_email;
  end if;
  -- Kurze Passwörter sind bei nur vier Konten das größte Risiko.
  if length(p_password) < 12 then
    raise exception 'Das Passwort muss mindestens 12 Zeichen haben.';
  end if;
  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'Es gibt bereits ein Konto mit der Adresse %', v_email;
  end if;

  -- Schalter nur für diese Transaktion öffnen.
  perform set_config('zeitstrahl.allow_user_creation', 'on', true);

  -- Die Token-Spalten MÜSSEN leere Zeichenketten sein, nicht NULL: der
  -- Anmeldedienst liest sie als Text und scheitert sonst beim Anmelden
  -- ("Database error querying schema").
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change,
    email_change_token_new, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
    v_email, extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(),
    jsonb_build_object(
      'provider', 'email', 'providers', jsonb_build_array('email'),
      'app_role', p_role
    ),
    '{}'::jsonb, now(), now(),
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (
    provider_id, user_id, identity_data, provider, last_sign_in_at,
    created_at, updated_at
  ) values (
    v_uid::text, v_uid,
    jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
    'email', now(), now(), now()
  );

  perform set_config('zeitstrahl.allow_user_creation', 'off', true);
  return v_uid;
end $$;

-- Passwort ändern:  select private.set_account_password('admin@gym-nw.de', 'neues-langes-passwort');
create or replace function private.set_account_password(
  p_email text, p_password text
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if length(p_password) < 12 then
    raise exception 'Das Passwort muss mindestens 12 Zeichen haben.';
  end if;
  update auth.users
     set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
         updated_at = now()
   where email = lower(trim(p_email));
  if not found then
    raise exception 'Kein Konto mit der Adresse %', p_email;
  end if;
end $$;

-- Rolle wechseln:  select private.set_account_role('lehrer@gym-nw.de', 'admin');
-- Achtung: Die Rolle steckt im Anmelde-Token — betroffene Person muss sich neu anmelden.
create or replace function private.set_account_role(
  p_email text, p_role text
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_role not in ('admin', 'editor') then
    raise exception 'Rolle muss admin oder editor sein, war: %', p_role;
  end if;
  update auth.users
     set raw_app_meta_data = raw_app_meta_data || jsonb_build_object('app_role', p_role),
         updated_at = now()
   where email = lower(trim(p_email));
  if not found then
    raise exception 'Kein Konto mit der Adresse %', p_email;
  end if;
end $$;

-- Konto löschen:  select private.delete_account('alt@gym-nw.de');
-- Die Einträge der Person bleiben erhalten (created_by wird zu NULL).
create or replace function private.delete_account(p_email text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  delete from auth.users where email = lower(trim(p_email));
  if not found then
    raise exception 'Kein Konto mit der Adresse %', p_email;
  end if;
end $$;

-- Diese Funktionen gehören ausschließlich der Schulverwaltung im SQL-Editor.
-- Weder anonyme Besucher noch angemeldete Konten dürfen sie aufrufen.
revoke execute on function private.create_account(text, text, text)   from anon, authenticated;
revoke execute on function private.set_account_password(text, text)   from anon, authenticated;
revoke execute on function private.set_account_role(text, text)       from anon, authenticated;
revoke execute on function private.delete_account(text)               from anon, authenticated;
revoke execute on function private.guard_user_creation()              from anon, authenticated;
