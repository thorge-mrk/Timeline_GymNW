-- ============================================================================
-- Zurück zu ZWEI Rollen — ersetzt die Vereinfachung aus 0008.
--
--   admin   darf alles: Einträge anlegen, bearbeiten, löschen,
--           Meilensteine setzen, Audio-Interviews hochladen
--   editor  darf ausschließlich neue Einträge anlegen
--           (die Rolle für die iPads am Aktionstag)
--
-- Anonyme Besucher dürfen weiterhin ausschließlich lesen.
-- ============================================================================

create or replace function private.is_contributor() returns boolean
language sql stable set search_path = '' as $$
  select private.jwt_role() in ('admin', 'editor')
$$;

drop policy if exists entries_insert_admin on public.entries;
drop policy if exists entries_insert_contributor on public.entries;
create policy entries_insert_contributor on public.entries
  for insert to authenticated
  with check (
    (select private.is_contributor())
    and created_by = (select auth.uid())
    and (not is_milestone or (select private.is_admin()))
    and (audio_path is null or (select private.is_admin()))
  );

-- Bilder: beide Rollen, aber jeweils nur im EIGENEN Ordner.
drop policy if exists images_insert_own_folder on storage.objects;
create policy images_insert_own_folder on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'entry-images'
    and (select private.is_contributor())
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists images_delete_own_folder on storage.objects;
create policy images_delete_own_folder on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'entry-images'
    and (select private.is_contributor())
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Audio: ausschließlich admin.
drop policy if exists audio_insert_admin on storage.objects;
create policy audio_insert_admin on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'entry-audio'
    and (select private.is_admin())
  );

-- ---------------------------------------------------------------------------
-- Konto anlegen — die Rolle muss BEWUSST angegeben werden, damit niemand
-- versehentlich ein Konto mit zu vielen Rechten erzeugt.
--   select * from private.create_account('name@gym-nw.de',  'admin');
--   select * from private.create_account('ipad1@gym-nw.de', 'editor');
-- ---------------------------------------------------------------------------
drop function if exists private.create_account(text, text);
drop function if exists private.create_account(text, text, text);
drop function if exists private.list_accounts();

create function private.create_account(
  p_email    text,
  p_role     text,
  p_password text default null
) returns table (konto text, rolle text, passwort text, hinweis text)
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid   uuid := gen_random_uuid();
  v_email text := lower(trim(p_email));
  v_role  text := lower(trim(p_role));
  v_pw    text := coalesce(nullif(trim(coalesce(p_password, '')), ''),
                           private.generate_password(20));
begin
  if v_role not in ('admin', 'editor') then
    raise exception
      'Die Rolle muss admin oder editor sein (angegeben: %). admin darf alles, editor darf nur neue Einträge anlegen.',
      p_role;
  end if;
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
                       'app_role', v_role),
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

  konto := v_email; rolle := v_role; passwort := v_pw;
  hinweis := 'Jetzt notieren — das Passwort wird nie wieder angezeigt.';
  return next;
end $$;

-- Rolle wechseln (die Person muss sich danach einmal neu anmelden).
create or replace function private.set_account_role(p_email text, p_role text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_role text := lower(trim(p_role));
begin
  if v_role not in ('admin', 'editor') then
    raise exception 'Die Rolle muss admin oder editor sein (angegeben: %)', p_role;
  end if;
  update auth.users
     set raw_app_meta_data = raw_app_meta_data || jsonb_build_object('app_role', v_role),
         updated_at = now()
   where email = lower(trim(p_email));
  if not found then
    raise exception 'Kein Konto mit der Adresse %', p_email;
  end if;
end $$;

create function private.list_accounts()
returns table (konto text, rolle text, angelegt timestamptz, zuletzt_angemeldet timestamptz)
language sql stable security definer set search_path = ''
as $$
  select email::text,
         coalesce(raw_app_meta_data->>'app_role', '(keine)')::text,
         created_at, last_sign_in_at
  from auth.users order by created_at
$$;

revoke execute on function private.create_account(text, text, text) from anon, authenticated;
revoke execute on function private.set_account_role(text, text)     from anon, authenticated;
revoke execute on function private.list_accounts()                  from anon, authenticated;
