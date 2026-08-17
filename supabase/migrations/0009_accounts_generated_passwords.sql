-- ============================================================================
-- Konten anlegen mit automatisch erzeugtem Passwort.
--
-- Das Passwort wird EINMALIG als Ergebnis der Abfrage angezeigt und danach nur
-- noch verschlüsselt gespeichert — es lässt sich später nicht mehr auslesen,
-- nur neu setzen (private.reset_password).
-- ============================================================================

-- Starkes Passwort ohne verwechselbare Zeichen (kein 0/O, 1/l/I).
create or replace function private.generate_password(p_length int default 20)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_alphabet constant text :=
    'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea := extensions.gen_random_bytes(p_length);
  v_out text := '';
  i int;
begin
  for i in 0 .. p_length - 1 loop
    v_out := v_out || substr(
      v_alphabet, 1 + (get_byte(v_bytes, i) % length(v_alphabet)), 1);
  end loop;
  return v_out;
end $$;

--   select * from private.create_account('name@gym-nw.de');
create or replace function private.create_account(
  p_email    text,
  p_password text default null
) returns table (konto text, passwort text, hinweis text)
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid   uuid := gen_random_uuid();
  v_email text := lower(trim(p_email));
  v_pw    text := coalesce(nullif(trim(coalesce(p_password, '')), ''),
                           private.generate_password(20));
begin
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Keine gültige E-Mail-Adresse: %', p_email;
  end if;
  if length(v_pw) < 12 then
    raise exception 'Das Passwort muss mindestens 12 Zeichen haben.';
  end if;
  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'Es gibt bereits ein Konto mit der Adresse %', v_email;
  end if;

  perform set_config('zeitstrahl.allow_user_creation', 'on', true);

  -- Die Token-Spalten MÜSSEN leere Zeichenketten sein, nicht NULL — sonst
  -- scheitert die Anmeldung mit "Database error querying schema".
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change,
    email_change_token_new, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
    v_email, extensions.crypt(v_pw, extensions.gen_salt('bf')),
    now(),
    jsonb_build_object('provider','email','providers',jsonb_build_array('email'),
                       'app_role','admin'),
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

  konto := v_email; passwort := v_pw;
  hinweis := 'Jetzt notieren — das Passwort wird nie wieder angezeigt.';
  return next;
end $$;

--   select * from private.reset_password('name@gym-nw.de');
create or replace function private.reset_password(p_email text)
returns table (konto text, passwort text, hinweis text)
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text := lower(trim(p_email));
  v_pw    text := private.generate_password(20);
begin
  update auth.users
     set encrypted_password = extensions.crypt(v_pw, extensions.gen_salt('bf')),
         updated_at = now()
   where email = v_email;
  if not found then
    raise exception 'Kein Konto mit der Adresse %', p_email;
  end if;
  konto := v_email; passwort := v_pw;
  hinweis := 'Jetzt notieren — das Passwort wird nie wieder angezeigt.';
  return next;
end $$;

--   select * from private.list_accounts();
create or replace function private.list_accounts()
returns table (konto text, angelegt timestamptz, zuletzt_angemeldet timestamptz)
language sql stable security definer set search_path = ''
as $$
  select email::text, created_at, last_sign_in_at
  from auth.users order by created_at
$$;

-- Alte Varianten entfernen: es gibt nur noch eine Rolle und einen Weg.
drop function if exists private.create_account(text, text, text);
drop function if exists private.set_account_role(text, text);
drop function if exists private.set_account_password(text, text);

revoke execute on function private.generate_password(int)     from anon, authenticated;
revoke execute on function private.create_account(text, text) from anon, authenticated;
revoke execute on function private.reset_password(text)       from anon, authenticated;
revoke execute on function private.list_accounts()            from anon, authenticated;
