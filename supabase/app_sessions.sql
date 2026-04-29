create table if not exists public.device_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(user_id) on delete cascade,
  device_fingerprint text not null unique,
  device_info jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_device_sessions_user on public.device_sessions(user_id);
create index if not exists idx_device_sessions_fingerprint on public.device_sessions(device_fingerprint);

alter table public.device_sessions enable row level security;

drop policy if exists "service role full access device sessions" on public.device_sessions;
create policy "service role full access device sessions" on public.device_sessions
  for all to service_role using (true) with check (true);

drop policy if exists "users can view own device session" on public.device_sessions;
create policy "users can view own device session" on public.device_sessions
  for select using (user_id = auth.uid());

drop policy if exists "users can delete own device session" on public.device_sessions;
create policy "users can delete own device session" on public.device_sessions
  for delete using (user_id = auth.uid());

create or replace function public.touch_device_sessions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_device_sessions_updated_at on public.device_sessions;
create trigger trg_touch_device_sessions_updated_at
before update on public.device_sessions
for each row
execute function public.touch_device_sessions_updated_at();

create table if not exists public.app_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  session_token text not null unique,
  device_fingerprint text,
  device_info jsonb default '{}',
  expires_at timestamptz default now() + interval '7 days',
  created_at timestamptz not null default now()
);

create index if not exists idx_app_sessions_token on public.app_sessions(session_token);
create index if not exists idx_app_sessions_user on public.app_sessions(user_id);
create index if not exists idx_app_sessions_expires on public.app_sessions(expires_at);

alter table public.app_sessions enable row level security;

drop policy if exists "service role full access" on public.app_sessions;
create policy "service role full access" on public.app_sessions
  for all to service_role using (true) with check (true);

drop policy if exists "users can view own session" on public.app_sessions;
create policy "users can view own session" on public.app_sessions
  for select using (user_id = auth.uid());

create table if not exists public.online_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(user_id) on delete cascade,
  device_fingerprint text,
  device_info jsonb default '{}',
  last_heartbeat timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_online_users_user on public.online_users(user_id);

alter table public.online_users enable row level security;

drop policy if exists "service role full access online" on public.online_users;
create policy "service role full access online" on public.online_users
  for all to service_role using (true) with check (true);

drop policy if exists "users can view own online status" on public.online_users;
create policy "users can view own online status" on public.online_users
  for select using (user_id = auth.uid());

create or replace function public.check_device_conflict(p_fingerprint text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_owner_name text;
begin
  if p_fingerprint is null or btrim(p_fingerprint) = '' then
    return jsonb_build_object('conflict', false);
  end if;

  select
    ds.user_id,
    coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.email), ''), left(ds.user_id::text, 8))
  into v_owner_id, v_owner_name
  from public.device_sessions ds
  left join public.profiles p on p.user_id = ds.user_id
  where ds.device_fingerprint = p_fingerprint
  limit 1;

  if v_owner_id is null or v_owner_id = auth.uid() then
    return jsonb_build_object('conflict', false);
  end if;

  return jsonb_build_object(
    'conflict', true,
    'type', 'DEVICE_TAKEN',
    'message', 'This device is already linked to another account.',
    'owner_name', v_owner_name
  );
end;
$$;

create or replace function public.register_device_session(
  p_user_id uuid,
  p_fingerprint text,
  p_device_info jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_user_id uuid := auth.uid();
  v_existing_user_id uuid;
  v_existing_owner_name text;
  v_swapped boolean := false;
begin
  if v_current_user_id is null or v_current_user_id <> p_user_id then
    raise exception 'UNAUTHORIZED';
  end if;

  if p_fingerprint is null or btrim(p_fingerprint) = '' then
    raise exception 'DEVICE_FINGERPRINT_REQUIRED';
  end if;

  perform public.ensure_current_user_profile(p_user_id);

  select
    ds.user_id,
    coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.email), ''), left(ds.user_id::text, 8))
  into v_existing_user_id, v_existing_owner_name
  from public.device_sessions ds
  left join public.profiles p on p.user_id = ds.user_id
  where ds.device_fingerprint = p_fingerprint
  limit 1;

  if v_existing_user_id is not null and v_existing_user_id <> p_user_id then
    delete from public.app_sessions where user_id = v_existing_user_id;
    delete from public.online_users where user_id = v_existing_user_id;
    delete from public.device_sessions where user_id = v_existing_user_id or device_fingerprint = p_fingerprint;
    v_swapped := true;
  end if;

  delete from public.device_sessions
  where user_id = p_user_id or device_fingerprint = p_fingerprint;

  insert into public.device_sessions (user_id, device_fingerprint, device_info)
  values (p_user_id, p_fingerprint, coalesce(p_device_info, '{}'::jsonb));

  return jsonb_build_object(
    'success', true,
    'swapped', v_swapped,
    'message', case when v_swapped then 'Device session reassigned.' else 'Device session registered.' end
  );
end;
$$;

create or replace function public.get_my_device_session()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_user_id uuid := auth.uid();
  v_session record;
begin
  if v_current_user_id is null then
    return jsonb_build_object('registered', false);
  end if;

  select *
  into v_session
  from public.device_sessions
  where user_id = v_current_user_id
  limit 1;

  if v_session.id is null then
    return jsonb_build_object('registered', false);
  end if;

  return jsonb_build_object(
    'registered', true,
    'fingerprint', v_session.device_fingerprint,
    'device_info', v_session.device_info,
    'created_at', v_session.created_at
  );
end;
$$;

create or replace function public.ensure_current_user_profile(p_user_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_current_user_id uuid := auth.uid();
  v_auth_user auth.users%rowtype;
  v_workspace jsonb;
  v_org_id uuid;
  v_branch_id uuid;
  v_display_name text;
  v_phone text;
  v_registration_mode text;
  v_auth_provider text;
  v_role text;
begin
  if v_current_user_id is null then
    raise exception 'UNAUTHORIZED';
  end if;

  if p_user_id is not null and p_user_id <> v_current_user_id then
    raise exception 'UNAUTHORIZED';
  end if;

  select *
  into v_auth_user
  from auth.users
  where id = v_current_user_id
  limit 1;

  if v_auth_user.id is null then
    raise exception 'AUTH_USER_NOT_FOUND';
  end if;

  select p.org_id, p.default_branch_id
  into v_org_id, v_branch_id
  from public.profiles p
  where p.user_id = v_current_user_id
  limit 1;

  if v_org_id is null then
    select ur.org_id
    into v_org_id
    from public.user_roles ur
    where ur.user_id = v_current_user_id
    limit 1;
  end if;

  if v_org_id is null then
    v_workspace := public.ensure_default_workspace();
    v_org_id := (v_workspace ->> 'org_id')::uuid;
    v_branch_id := coalesce(v_branch_id, (v_workspace ->> 'branch_id')::uuid);
  end if;

  if v_branch_id is null then
    select b.id
    into v_branch_id
    from public.branches b
    where b.org_id = v_org_id
    order by b.created_at asc, b.id asc
    limit 1;
  end if;

  if v_branch_id is null then
    v_workspace := coalesce(v_workspace, public.ensure_default_workspace());
    v_org_id := coalesce(v_org_id, (v_workspace ->> 'org_id')::uuid);
    v_branch_id := (v_workspace ->> 'branch_id')::uuid;
  end if;

  v_auth_provider := lower(coalesce(v_auth_user.raw_app_meta_data ->> 'provider', 'email'));
  v_registration_mode := upper(
    coalesce(
      v_auth_user.raw_user_meta_data ->> 'registration_mode',
      case
        when v_auth_provider in ('google', 'apple') then 'USER'
        else 'ADMIN'
      end
    )
  );

  v_display_name := nullif(
    trim(
      coalesce(
        v_auth_user.raw_user_meta_data ->> 'display_name',
        v_auth_user.raw_user_meta_data ->> 'full_name',
        ''
      )
    ),
    ''
  );

  if v_display_name is null then
    v_display_name := coalesce(nullif(split_part(coalesce(v_auth_user.email, ''), '@', 1), ''), 'User');
  end if;

  v_phone := nullif(trim(coalesce(v_auth_user.phone, v_auth_user.raw_user_meta_data ->> 'phone', '')), '');

  insert into public.profiles (
    user_id,
    org_id,
    default_branch_id,
    display_name,
    email,
    phone
  )
  values (
    v_current_user_id,
    v_org_id,
    v_branch_id,
    v_display_name,
    v_auth_user.email,
    v_phone
  )
  on conflict (user_id) do update
    set
      org_id = coalesce(public.profiles.org_id, excluded.org_id),
      default_branch_id = coalesce(public.profiles.default_branch_id, excluded.default_branch_id),
      display_name = coalesce(nullif(public.profiles.display_name, ''), excluded.display_name),
      email = coalesce(excluded.email, public.profiles.email),
      phone = coalesce(excluded.phone, public.profiles.phone);

  if not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = v_current_user_id
      and ur.org_id = v_org_id
  ) then
    select case
      when v_registration_mode = 'USER' then 'USER'
      when exists (
        select 1
        from public.user_roles
        where org_id = v_org_id
          and role = 'OWNER'
      ) then 'RECEPTION'
      else 'OWNER'
    end
    into v_role;

    insert into public.user_roles (user_id, org_id, role)
    values (v_current_user_id, v_org_id, v_role)
    on conflict (user_id, org_id, role) do nothing;
  end if;

  return jsonb_build_object(
    'success', true,
    'user_id', v_current_user_id,
    'org_id', v_org_id,
    'branch_id', v_branch_id
  );
end;
$$;

create or replace function public.create_app_session(
  p_user_id uuid,
  p_device_fingerprint text default null,
  p_device_info jsonb default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
  v_existing_user_id uuid;
  v_existing_owner_name text;
  v_current_user_id uuid := auth.uid();
begin
  if v_current_user_id is null or v_current_user_id <> p_user_id then
    raise exception 'UNAUTHORIZED';
  end if;

  perform public.ensure_current_user_profile(p_user_id);

  if p_device_fingerprint is not null then
    select
      ds.user_id,
      coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.email), ''), left(ds.user_id::text, 8))
    into v_existing_user_id, v_existing_owner_name
    from public.device_sessions ds
    left join public.profiles p on p.user_id = ds.user_id
    where ds.device_fingerprint = p_device_fingerprint
    limit 1;

    if v_existing_user_id is not null and v_existing_user_id <> p_user_id then
      delete from public.app_sessions where user_id = v_existing_user_id;
      delete from public.online_users where user_id = v_existing_user_id;
      delete from public.device_sessions where user_id = v_existing_user_id or device_fingerprint = p_device_fingerprint;
    end if;

    delete from public.device_sessions
    where user_id = p_user_id or device_fingerprint = p_device_fingerprint;

    insert into public.device_sessions (user_id, device_fingerprint, device_info)
    values (p_user_id, p_device_fingerprint, coalesce(p_device_info, '{}'::jsonb));
  end if;

  delete from public.app_sessions where user_id = p_user_id;
  delete from public.online_users where user_id = p_user_id;

  -- Avoid dependency on gen_random_bytes() availability across projects.
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  insert into public.app_sessions (user_id, session_token, device_fingerprint, device_info)
  values (p_user_id, v_token, p_device_fingerprint, coalesce(p_device_info, '{}'::jsonb));

  insert into public.online_users (user_id, device_fingerprint, device_info)
  values (p_user_id, p_device_fingerprint, coalesce(p_device_info, '{}'::jsonb));

  return jsonb_build_object(
    'success', true,
    'token', v_token,
    'device_replaced', v_existing_user_id is not null and v_existing_user_id <> p_user_id,
    'replaced_user_id', case when v_existing_user_id <> p_user_id then v_existing_user_id else null end,
    'replaced_owner_name', case when v_existing_user_id <> p_user_id then v_existing_owner_name else null end,
    'message', 'Session created.'
  );
end;
$$;

create or replace function public.validate_app_session(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
  v_device_session record;
  v_current_user_id uuid := auth.uid();
begin
  select
    s.id,
    s.user_id,
    s.device_fingerprint,
    s.device_info,
    s.created_at,
    coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.email), ''), left(s.user_id::text, 8)) as owner_name
  into v_session
  from public.app_sessions s
  left join public.profiles p on p.user_id = s.user_id
  where s.session_token = p_token
    and s.expires_at > now()
  limit 1;

  if v_session.id is null then
    return jsonb_build_object(
      'valid', false,
      'reason', 'INVALID_TOKEN',
      'message', 'Session token is invalid or expired.'
    );
  end if;

  if v_current_user_id is not null and v_session.user_id <> v_current_user_id then
    return jsonb_build_object(
      'valid', false,
      'reason', 'INVALID_TOKEN',
      'message', 'Session token does not belong to the current user.'
    );
  end if;

  if not exists (select 1 from public.online_users where user_id = v_session.user_id) then
    return jsonb_build_object(
      'valid', false,
      'reason', 'SESSION_REPLACED',
      'message', 'Session was replaced by a newer login.'
    );
  end if;

  if v_session.device_fingerprint is not null then
    select *
    into v_device_session
    from public.device_sessions
    where user_id = v_session.user_id
    limit 1;

    if v_device_session.id is null then
      return jsonb_build_object(
        'valid', false,
        'reason', 'SESSION_REPLACED',
        'message', 'Device session is no longer active.'
      );
    end if;

    if v_device_session.device_fingerprint <> v_session.device_fingerprint then
      return jsonb_build_object(
        'valid', false,
        'reason', 'SESSION_REPLACED',
        'message', 'Device session changed after login.'
      );
    end if;
  end if;

  update public.app_sessions
  set expires_at = now() + interval '7 days'
  where id = v_session.id;

  update public.online_users
  set last_heartbeat = now()
  where user_id = v_session.user_id;

  return jsonb_build_object(
    'valid', true,
    'user_id', v_session.user_id,
    'device_fingerprint', v_session.device_fingerprint,
    'device_info', v_session.device_info,
    'owner_name', v_session.owner_name
  );
end;
$$;

create or replace function public.revoke_app_session(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  select user_id into v_user_id
  from public.app_sessions
  where session_token = p_token
  limit 1;

  delete from public.app_sessions where session_token = p_token;

  if v_user_id is not null then
    delete from public.online_users where user_id = v_user_id;
  end if;

  return jsonb_build_object('success', true);
end;
$$;

create or replace function public.revoke_all_user_sessions(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.app_sessions where user_id = p_user_id;
  delete from public.online_users where user_id = p_user_id;
  return jsonb_build_object('success', true);
end;
$$;

create or replace function public.heartbeat_online_user(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.online_users
  set last_heartbeat = now()
  where user_id = p_user_id;

  return jsonb_build_object('success', true);
end;
$$;

grant execute on function public.check_device_conflict(text) to authenticated;
grant execute on function public.register_device_session(uuid, text, jsonb) to authenticated;
grant execute on function public.get_my_device_session() to authenticated;
grant execute on function public.ensure_current_user_profile(uuid) to authenticated;
grant execute on function public.create_app_session(uuid, text, jsonb) to authenticated;
grant execute on function public.validate_app_session(text) to authenticated;
grant execute on function public.revoke_app_session(text) to authenticated;
grant execute on function public.revoke_all_user_sessions(uuid) to authenticated;
grant execute on function public.heartbeat_online_user(uuid) to authenticated;

grant select, delete on public.device_sessions to authenticated;
grant select, insert, update, delete on public.online_users to authenticated;
