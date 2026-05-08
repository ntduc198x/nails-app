-- Split deploy for Telegram link + RPC setup.
-- Kept in sync with the Telegram sections inside deploy.sql.

create table if not exists public.telegram_links (
  id uuid primary key default gen_random_uuid(),
  app_user_id uuid not null references public.profiles(user_id) on delete cascade,
  telegram_user_id bigint not null,
  telegram_username text,
  telegram_first_name text,
  telegram_last_name text,
  linked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists idx_telegram_links_app_user on public.telegram_links(app_user_id);
create unique index if not exists idx_telegram_links_telegram_user on public.telegram_links(telegram_user_id);

alter table public.telegram_links enable row level security;

drop policy if exists "service role full access telegram" on public.telegram_links;
create policy "service role full access telegram" on public.telegram_links
  for all to service_role using (true) with check (true);

drop policy if exists "users view own link" on public.telegram_links;
create policy "users view own link" on public.telegram_links
  for select using (app_user_id = auth.uid());

create table if not exists public.telegram_link_codes (
  id uuid primary key default gen_random_uuid(),
  app_user_id uuid not null references public.profiles(user_id) on delete cascade,
  code text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_telegram_link_codes_code on public.telegram_link_codes(code);
create index if not exists idx_telegram_link_codes_app_user_created_at on public.telegram_link_codes(app_user_id, created_at desc);

alter table public.telegram_link_codes enable row level security;

drop policy if exists "service role full access link codes" on public.telegram_link_codes;
create policy "service role full access link codes" on public.telegram_link_codes
  for all to service_role using (true) with check (true);

drop policy if exists "users view own codes" on public.telegram_link_codes;
create policy "users view own codes" on public.telegram_link_codes
  for select using (app_user_id = auth.uid());

create or replace function public.generate_telegram_link_code(
  p_app_user_id uuid,
  p_ttl_minutes int default 5
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  delete from public.telegram_link_codes
  where app_user_id = p_app_user_id
    and (used_at is not null or expires_at <= now());

  loop
    v_code := lpad(floor(random() * 1000000)::text, 6, '0');
    exit when not exists (
      select 1
      from public.telegram_link_codes
      where code = v_code
        and used_at is null
        and expires_at >= now()
    );
  end loop;

  insert into public.telegram_link_codes (app_user_id, code, expires_at)
  values (p_app_user_id, v_code, now() + make_interval(mins => greatest(p_ttl_minutes, 1)));

  return v_code;
end;
$$;

create or replace function public.generate_telegram_link_code(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_user_id uuid;
  v_code text;
begin
  v_current_user_id := auth.uid();
  if v_current_user_id is null or v_current_user_id <> p_user_id then
    raise exception 'Unauthorized';
  end if;

  v_code := public.generate_telegram_link_code(p_user_id, 5);
  return jsonb_build_object('success', true, 'code', v_code);
end;
$$;

drop function if exists public.confirm_telegram_link(text, bigint, text, text);
drop function if exists public.confirm_telegram_link(text, bigint, text, text, text);

create or replace function public.confirm_telegram_link(
  p_code text,
  p_telegram_user_id bigint,
  p_telegram_username text default null,
  p_telegram_first_name text default null,
  p_telegram_last_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link_code record;
  v_role text;
  v_display_name text;
begin
  select id, app_user_id, expires_at, used_at
  into v_link_code
  from public.telegram_link_codes
  where code = p_code
    and used_at is null
  order by created_at desc
  limit 1;

  if v_link_code.id is null then
    if exists (
      select 1
      from public.telegram_link_codes
      where code = p_code
        and used_at is not null
    ) then
      return jsonb_build_object('success', false, 'error', 'CODE_USED');
    end if;

    if exists (
      select 1
      from public.telegram_link_codes
      where code = p_code
        and used_at is null
        and expires_at < now()
    ) then
      return jsonb_build_object('success', false, 'error', 'CODE_EXPIRED');
    end if;

    return jsonb_build_object('success', false, 'error', 'INVALID_CODE');
  end if;

  if v_link_code.expires_at < now() then
    return jsonb_build_object('success', false, 'error', 'CODE_EXPIRED');
  end if;

  delete from public.telegram_links
  where app_user_id = v_link_code.app_user_id;

  delete from public.telegram_links
  where telegram_user_id = p_telegram_user_id;

  insert into public.telegram_links (
    app_user_id,
    telegram_user_id,
    telegram_username,
    telegram_first_name,
    telegram_last_name,
    linked_at
  )
  values (
    v_link_code.app_user_id,
    p_telegram_user_id,
    p_telegram_username,
    p_telegram_first_name,
    p_telegram_last_name,
    now()
  );

  update public.telegram_link_codes
  set used_at = now()
  where id = v_link_code.id;

  select r.role, p.display_name
  into v_role, v_display_name
  from public.user_roles r
  left join public.profiles p on p.user_id = r.user_id
  where r.user_id = v_link_code.app_user_id
  limit 1;

  return jsonb_build_object(
    'ok', true,
    'success', true,
    'app_user_id', v_link_code.app_user_id,
    'user_id', v_link_code.app_user_id,
    'role', coalesce(v_role, 'STAFF'),
    'display_name', coalesce(v_display_name, p_telegram_first_name, p_telegram_username, 'Tai khoan')
  );
end;
$$;

drop function if exists public.get_telegram_user_role(bigint);

create or replace function public.get_telegram_user_role(p_telegram_user_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app_user_id uuid;
  v_role text;
  v_display_name text;
  v_org_id uuid;
begin
  select tl.app_user_id
  into v_app_user_id
  from public.telegram_links tl
  where tl.telegram_user_id = p_telegram_user_id
  limit 1;

  if v_app_user_id is null then
    return jsonb_build_object('linked', false);
  end if;

  select r.role, r.org_id
  into v_role, v_org_id
  from public.user_roles r
  where r.user_id = v_app_user_id
  limit 1;

  select p.display_name
  into v_display_name
  from public.profiles p
  where p.user_id = v_app_user_id;

  return jsonb_build_object(
    'linked', true,
    'user_id', v_app_user_id,
    'role', v_role,
    'display_name', v_display_name,
    'org_id', v_org_id
  );
end;
$$;

drop function if exists public.unlink_telegram(uuid);

create or replace function public.unlink_telegram(p_app_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_user_id uuid;
begin
  v_current_user_id := auth.uid();
  if v_current_user_id is null or v_current_user_id <> p_app_user_id then
    raise exception 'Unauthorized';
  end if;

  delete from public.telegram_links where app_user_id = p_app_user_id;
  return jsonb_build_object('success', true);
end;
$$;

revoke all on function public.generate_telegram_link_code(uuid) from public, anon;
revoke all on function public.generate_telegram_link_code(uuid, int) from public, anon;
revoke all on function public.confirm_telegram_link(text, bigint, text, text, text) from public, anon;
revoke all on function public.get_telegram_user_role(bigint) from public, anon;
revoke all on function public.unlink_telegram(uuid) from public, anon;

grant execute on function public.generate_telegram_link_code(uuid) to authenticated, service_role;
grant execute on function public.generate_telegram_link_code(uuid, int) to authenticated, service_role;
grant execute on function public.confirm_telegram_link(text, bigint, text, text, text) to authenticated, service_role;
grant execute on function public.get_telegram_user_role(bigint) to authenticated, service_role;
grant execute on function public.unlink_telegram(uuid) to authenticated, service_role;
