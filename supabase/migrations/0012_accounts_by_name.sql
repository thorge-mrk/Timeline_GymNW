-- ============================================================================
-- Konten werden nur noch mit dem NAMEN angelegt — die E-Mail-Adresse ergänzt
-- der Server automatisch (@zeitstrahl-gymnw.de). Passwörter bestehen aus gut
-- merkbaren Wörtern plus Zahlen und einem Sonderzeichen, z. B.
-- „Musikraum+Pausenhof46" — leicht vorzulesen und trotzdem stark.
--
--   select * from private.create_account('Anna Meyer', 'admin');
--   select * from private.create_account('iPad 1',     'editor');
-- ============================================================================

create or replace function private.account_domain() returns text
language sql immutable set search_path = '' as $$
  select 'zeitstrahl-gymnw.de'
$$;

-- „Anna Meyer" → „anna.meyer"; Umlaute werden ausgeschrieben.
create or replace function private.name_to_local(p_name text) returns text
language plpgsql immutable set search_path = ''
as $$
declare v text := lower(trim(p_name));
begin
  v := replace(v, 'ä', 'ae');
  v := replace(v, 'ö', 'oe');
  v := replace(v, 'ü', 'ue');
  v := replace(v, 'ß', 'ss');
  v := regexp_replace(v, '[^a-z0-9]+', '.', 'g');
  v := regexp_replace(v, '\.+', '.', 'g');
  v := trim(both '.' from v);
  if v = '' then
    raise exception 'Der Name ergibt keine gültige Adresse: %', p_name;
  end if;
  return v;
end $$;

-- Merkbares Passwort: zwei Wörter + Sonderzeichen + 2–3 Ziffern, mind. 10 Zeichen.
create or replace function private.generate_password(p_length int default 20)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  woerter constant text[] := array[
    'Fuchs','Aula','Turnhalle','Pausenhof','Kreide','Zeugnis','Mensa','Bibliothek',
    'Klassenfahrt','Abitur','Chemie','Physik','Sporthalle','Musikraum','Schulhof',
    'Projekt','Theater','Chor','Kollegium','Jahrgang','Zeitstrahl','Erinnerung',
    'Geschichte','Zukunft','Wulmstorf','Gymnasium','Sommerfest','Bibliothek',
    'Fahrrad','Werkraum','Kunstraum','Labor','Buehne','Fanfare','Anker','Leuchtturm'
  ];
  zeichen constant text[] := array['-','+','!','?','#','=','.','*'];
  v_bytes bytea := extensions.gen_random_bytes(6);
  w1 text := woerter[1 + (get_byte(v_bytes,0) % array_length(woerter,1))];
  w2 text := woerter[1 + (get_byte(v_bytes,1) % array_length(woerter,1))];
  sz  text := zeichen[1 + (get_byte(v_bytes,2) % array_length(zeichen,1))];
  zahl text;
  ergebnis text;
begin
  if get_byte(v_bytes,3) % 2 = 0 then
    zahl := lpad(((get_byte(v_bytes,4) * 256 + get_byte(v_bytes,5)) % 90 + 10)::text, 2, '0');
  else
    zahl := lpad(((get_byte(v_bytes,4) * 256 + get_byte(v_bytes,5)) % 900 + 100)::text, 3, '0');
  end if;
  if w2 = w1 then
    w2 := woerter[1 + ((get_byte(v_bytes,1) + 1) % array_length(woerter,1))];
  end if;
  ergebnis := w1 || sz || w2 || zahl;
  while length(ergebnis) < 10 loop
    ergebnis := ergebnis || (get_byte(extensions.gen_random_bytes(1),0) % 10)::text;
  end loop;
  return ergebnis;
end $$;

drop function if exists private.create_account(text, text, text);
create function private.create_account(
  p_name     text,
  p_role     text,
  p_password text default null
) returns table (konto text, rolle text, passwort text, hinweis text)
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid   uuid := gen_random_uuid();
  v_local text := private.name_to_local(p_name);
  v_email text := v_local || '@' || private.account_domain();
  v_role  text := lower(trim(p_role));
  v_pw    text := coalesce(nullif(trim(coalesce(p_password, '')), ''),
                           private.generate_password());
begin
  if v_role not in ('admin', 'editor') then
    raise exception
      'Die Rolle muss admin oder editor sein (angegeben: %). admin darf alles, editor darf nur neue Einträge anlegen.',
      p_role;
  end if;
  if length(v_pw) < 10 then
    raise exception 'Das Passwort muss mindestens 10 Zeichen haben.';
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
                       'app_role', v_role),
    jsonb_build_object('display_name', trim(p_name)),
    now(), now(),
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

  konto := v_email; rolle := v_role; passwort := v_pw;
  hinweis := 'Jetzt notieren — das Passwort wird nie wieder angezeigt.';
  return next;
end $$;

drop function if exists private.reset_password(text);
create function private.reset_password(p_name text)
returns table (konto text, passwort text, hinweis text)
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text := private.name_to_local(p_name) || '@' || private.account_domain();
  v_pw    text := private.generate_password();
begin
  update auth.users
     set encrypted_password = extensions.crypt(v_pw, extensions.gen_salt('bf')),
         updated_at = now()
   where email = v_email;
  if not found then
    raise exception 'Kein Konto für % (gesucht: %)', p_name, v_email;
  end if;
  konto := v_email; passwort := v_pw;
  hinweis := 'Jetzt notieren — das Passwort wird nie wieder angezeigt.';
  return next;
end $$;

drop function if exists private.set_account_role(text, text);
create function private.set_account_role(p_name text, p_role text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_role text := lower(trim(p_role));
  v_email text := private.name_to_local(p_name) || '@' || private.account_domain();
begin
  if v_role not in ('admin', 'editor') then
    raise exception 'Die Rolle muss admin oder editor sein (angegeben: %)', p_role;
  end if;
  update auth.users
     set raw_app_meta_data = raw_app_meta_data || jsonb_build_object('app_role', v_role),
         updated_at = now()
   where email = v_email;
  if not found then
    raise exception 'Kein Konto für % (gesucht: %)', p_name, v_email;
  end if;
end $$;

drop function if exists private.delete_account(text);
create function private.delete_account(p_name text) returns void
language plpgsql security definer set search_path = ''
as $$
declare v_email text := private.name_to_local(p_name) || '@' || private.account_domain();
begin
  delete from auth.users where email = v_email;
  if not found then
    raise exception 'Kein Konto für % (gesucht: %)', p_name, v_email;
  end if;
end $$;

drop function if exists private.list_accounts();
create function private.list_accounts()
returns table (name text, konto text, rolle text, angelegt timestamptz, zuletzt_angemeldet timestamptz)
language sql stable security definer set search_path = ''
as $$
  select coalesce(raw_user_meta_data->>'display_name', split_part(email, '@', 1))::text,
         email::text,
         coalesce(raw_app_meta_data->>'app_role', '(keine)')::text,
         created_at, last_sign_in_at
  from auth.users order by created_at
$$;

revoke execute on function private.account_domain()                  from anon, authenticated;
revoke execute on function private.name_to_local(text)               from anon, authenticated;
revoke execute on function private.generate_password(int)            from anon, authenticated;
revoke execute on function private.create_account(text, text, text)  from anon, authenticated;
revoke execute on function private.reset_password(text)              from anon, authenticated;
revoke execute on function private.set_account_role(text, text)      from anon, authenticated;
revoke execute on function private.delete_account(text)              from anon, authenticated;
revoke execute on function private.list_accounts()                   from anon, authenticated;
