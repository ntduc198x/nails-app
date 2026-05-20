-- Runtime patch for existing environments.
-- Purpose:
-- 1. Backfill schema required by current Telegram + booking runtime
-- 2. Keep patch idempotent so it can be rerun safely
-- 3. Preserve payments as the source of truth for payment method

begin;

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Appointments runtime columns used by manage/appointments and overdue alerts
-- -----------------------------------------------------------------------------

alter table if exists public.appointments
  add column if not exists checked_in_at timestamptz,
  add column if not exists overdue_alert_sent_at timestamptz;

create index if not exists idx_appointments_overdue_queue
  on public.appointments (org_id, status, overdue_alert_sent_at, start_at);

-- -----------------------------------------------------------------------------
-- Booking request telegram delivery metadata used by Telegram booking callbacks
-- -----------------------------------------------------------------------------

alter table if exists public.booking_requests
  add column if not exists telegram_message_id bigint,
  add column if not exists telegram_chat_id text,
  add column if not exists notified_at timestamptz;

-- -----------------------------------------------------------------------------
-- Telegram account link tables + RPCs
-- -----------------------------------------------------------------------------

create table if not exists public.telegram_links (
  app_user_id uuid primary key references public.profiles(user_id) on delete cascade,
  telegram_user_id bigint not null unique,
  telegram_username text,
  telegram_first_name text,
  telegram_last_name text,
  linked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table if exists public.telegram_links
  add column if not exists telegram_user_id bigint,
  add column if not exists telegram_username text,
  add column if not exists telegram_first_name text,
  add column if not exists telegram_last_name text,
  add column if not exists linked_at timestamptz not null default now(),
  add column if not exists created_at timestamptz not null default now();

create unique index if not exists idx_telegram_links_app_user
  on public.telegram_links (app_user_id);

create unique index if not exists idx_telegram_links_telegram_user
  on public.telegram_links (telegram_user_id);

create table if not exists public.telegram_link_codes (
  id uuid primary key default gen_random_uuid(),
  app_user_id uuid not null references public.profiles(user_id) on delete cascade,
  code text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table if exists public.telegram_link_codes
  add column if not exists app_user_id uuid references public.profiles(user_id) on delete cascade,
  add column if not exists code text,
  add column if not exists expires_at timestamptz,
  add column if not exists used_at timestamptz,
  add column if not exists created_at timestamptz not null default now();

create unique index if not exists idx_telegram_link_codes_code
  on public.telegram_link_codes (code);

create index if not exists idx_telegram_link_codes_app_user
  on public.telegram_link_codes (app_user_id);

create index if not exists idx_telegram_link_codes_expires_at
  on public.telegram_link_codes (expires_at);

alter table public.telegram_links enable row level security;
alter table public.telegram_link_codes enable row level security;

drop policy if exists "service role full access telegram" on public.telegram_links;
create policy "service role full access telegram" on public.telegram_links
  for all to service_role
  using (true)
  with check (true);

drop policy if exists "users view own link" on public.telegram_links;
create policy "users view own link" on public.telegram_links
  for select to authenticated
  using (app_user_id = auth.uid());

drop policy if exists "service role full access link codes" on public.telegram_link_codes;
create policy "service role full access link codes" on public.telegram_link_codes
  for all to service_role
  using (true)
  with check (true);

drop policy if exists "users view own codes" on public.telegram_link_codes;
create policy "users view own codes" on public.telegram_link_codes
  for select to authenticated
  using (app_user_id = auth.uid());

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
        and expires_at > now()
    );
  end loop;

  insert into public.telegram_link_codes (app_user_id, code, expires_at)
  values (p_app_user_id, v_code, now() + make_interval(mins => greatest(p_ttl_minutes, 1)));

  return v_code;
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
  v_row public.telegram_link_codes%rowtype;
  v_role text;
  v_display_name text;
begin
  select *
  into v_row
  from public.telegram_link_codes
  where code = upper(trim(p_code))
    and used_at is null
  order by created_at desc
  limit 1;

  if not found then
    if exists (
      select 1
      from public.telegram_link_codes
      where code = upper(trim(p_code))
        and used_at is not null
    ) then
      return jsonb_build_object('ok', false, 'success', false, 'reason', 'CODE_USED', 'error', 'CODE_USED');
    end if;

    return jsonb_build_object('ok', false, 'success', false, 'reason', 'INVALID_CODE', 'error', 'INVALID_CODE');
  end if;

  if v_row.expires_at <= now() then
    return jsonb_build_object('ok', false, 'success', false, 'reason', 'CODE_EXPIRED', 'error', 'CODE_EXPIRED');
  end if;

  delete from public.telegram_links
  where telegram_user_id = p_telegram_user_id;

  delete from public.telegram_links
  where app_user_id = v_row.app_user_id;

  insert into public.telegram_links (
    app_user_id,
    telegram_user_id,
    telegram_username,
    telegram_first_name,
    telegram_last_name,
    linked_at
  )
  values (
    v_row.app_user_id,
    p_telegram_user_id,
    p_telegram_username,
    p_telegram_first_name,
    p_telegram_last_name,
    now()
  );

  update public.telegram_link_codes
  set used_at = now()
  where id = v_row.id;

  select ur.role, p.display_name
  into v_role, v_display_name
  from public.user_roles ur
  left join public.profiles p on p.user_id = ur.user_id
  where ur.user_id = v_row.app_user_id
  order by
    case ur.role
      when 'OWNER' then 1
      when 'PARTNER' then 2
      when 'MANAGER' then 3
      when 'RECEPTION' then 4
      when 'ACCOUNTANT' then 5
      when 'TECH' then 6
      else 99
    end
  limit 1;

  return jsonb_build_object(
    'ok', true,
    'success', true,
    'app_user_id', v_row.app_user_id,
    'user_id', v_row.app_user_id,
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

create function public.unlink_telegram(
  p_app_user_id uuid
)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.telegram_links
  where app_user_id = p_app_user_id;
$$;

revoke all on function public.generate_telegram_link_code(uuid, int) from public, anon;
revoke all on function public.confirm_telegram_link(text, bigint, text, text, text) from public, anon;
revoke all on function public.get_telegram_user_role(bigint) from public, anon;
revoke all on function public.unlink_telegram(uuid) from public, anon;

grant execute on function public.generate_telegram_link_code(uuid, int) to authenticated, service_role;
grant execute on function public.confirm_telegram_link(text, bigint, text, text, text) to authenticated, service_role;
grant execute on function public.get_telegram_user_role(bigint) to authenticated, service_role;
grant execute on function public.unlink_telegram(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Telegram conversation state table used by bot conversation flow
-- -----------------------------------------------------------------------------

create table if not exists public.telegram_conversations (
  telegram_user_id bigint primary key,
  step text not null,
  data jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.telegram_conversations
  add column if not exists step text,
  add column if not exists data jsonb not null default '{}'::jsonb,
  add column if not exists expires_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_telegram_conversations_expires_at
  on public.telegram_conversations (expires_at);

alter table public.telegram_conversations enable row level security;

drop policy if exists "service role full access telegram conversations" on public.telegram_conversations;
create policy "service role full access telegram conversations" on public.telegram_conversations
  for all to service_role
  using (true)
  with check (true);

create or replace function public.touch_telegram_conversations_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_telegram_conversations_updated_at on public.telegram_conversations;
create trigger trg_touch_telegram_conversations_updated_at
before update on public.telegram_conversations
for each row
execute function public.touch_telegram_conversations_updated_at();

commit;
