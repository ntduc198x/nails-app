-- Canonical bootstrap for a brand new Supabase project
-- Unified Supabase deploy script (single-file setup)
-- This file consolidates schema + RLS + RPC + integrity + indexes.
-- Active deploy target: run this file as the canonical setup script.


-- ===== BEGIN schema.sql =====
-- Nails App MVP schema (rÃºt gá»n Ä‘á»ƒ báº¯t Ä‘áº§u nhanh)
create extension if not exists "pgcrypto";

create table if not exists orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists branches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  timezone text not null default 'Asia/Bangkok',
  currency text not null default 'VND',
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  user_id uuid primary key,
  org_id uuid not null references orgs(id) on delete cascade,
  default_branch_id uuid references branches(id),
  display_name text,
  email text,
  phone text,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists email text;

create table if not exists user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  org_id uuid not null references orgs(id) on delete cascade,
  role text not null check (role in ('USER','OWNER','MANAGER','RECEPTION','ACCOUNTANT','TECH')),
  unique (user_id, org_id, role)
);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  phone text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists resources (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  name text not null,
  type text not null check (type in ('CHAIR','TABLE','ROOM')) default 'CHAIR',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  duration_min int not null,
  base_price numeric(12,2) not null,
  vat_rate numeric(5,4) not null default 0.10,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.services
  add column if not exists short_description text,
  add column if not exists image_url text,
  add column if not exists display_order int not null default 0,
  add column if not exists featured_in_lookbook boolean not null default false;

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  customer_id uuid references customers(id),
  staff_user_id uuid references profiles(user_id),
  resource_id uuid references resources(id),
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null check (status in ('BOOKED','CHECKED_IN','DONE','CANCELLED','NO_SHOW')),
  created_at timestamptz not null default now()
);

alter table public.appointments
  add column if not exists staff_user_id uuid references public.profiles(user_id);

alter table public.appointments
  add column if not exists resource_id uuid references public.resources(id);

alter table public.appointments
  add column if not exists checked_in_at timestamptz,
  add column if not exists overdue_alert_sent_at timestamptz;

create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  customer_id uuid references customers(id),
  appointment_id uuid references appointments(id),
  status text not null check (status in ('OPEN','CLOSED','VOID')) default 'OPEN',
  totals_json jsonb,
  created_at timestamptz not null default now()
);

create table if not exists ticket_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  ticket_id uuid not null references tickets(id) on delete cascade,
  service_id uuid references services(id),
  qty int not null default 1,
  unit_price numeric(12,2) not null,
  vat_rate numeric(5,4) not null,
  created_at timestamptz not null default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  ticket_id uuid not null references tickets(id) on delete cascade,
  method text not null check (method in ('CASH','TRANSFER')),
  amount numeric(12,2) not null,
  status text not null check (status in ('PENDING','PAID','FAILED')),
  created_at timestamptz not null default now()
);

create table if not exists receipts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  ticket_id uuid not null references tickets(id) on delete cascade,
  public_token text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  code text not null,
  created_by uuid,
  allowed_role text not null check (allowed_role in ('MANAGER','RECEPTION','ACCOUNTANT','TECH')) default 'TECH',
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  max_uses int not null default 1 check (max_uses = 1),
  used_count int not null default 0 check (used_count >= 0 and used_count <= max_uses),
  used_by uuid,
  used_at timestamptz,
  revoked_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  unique (org_id, code)
);

create table if not exists public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  customer_name text not null,
  customer_phone text not null,
  requested_service text,
  preferred_staff text,
  note text,
  requested_start_at timestamptz not null,
  requested_end_at timestamptz not null,
  source text not null default 'landing_page',
  status text not null default 'NEW' check (status in ('NEW','CONFIRMED','NEEDS_RESCHEDULE','CANCELLED','CONVERTED')),
  appointment_id uuid references public.appointments(id) on delete set null,
  telegram_message_id bigint,
  telegram_chat_id text,
  notified_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.booking_requests add column if not exists telegram_message_id bigint;
alter table public.booking_requests add column if not exists telegram_chat_id text;
alter table public.booking_requests add column if not exists notified_at timestamptz;

create index if not exists idx_services_org_active_display_order
  on public.services (org_id, active, featured_in_lookbook, display_order asc, created_at asc);

create index if not exists idx_booking_requests_org_created_at
  on public.booking_requests (org_id, created_at desc);

create index if not exists idx_booking_requests_org_status_start
  on public.booking_requests (org_id, status, requested_start_at);

-- ===== END schema.sql =====

-- ===== BEGIN rls.sql =====
-- RLS baseline cho Nails App (cháº¡y sau schema.sql)

alter table orgs enable row level security;
alter table branches enable row level security;
alter table profiles enable row level security;
alter table user_roles enable row level security;
alter table customers enable row level security;
alter table resources enable row level security;
alter table services enable row level security;
alter table appointments enable row level security;
alter table tickets enable row level security;
alter table ticket_items enable row level security;
alter table payments enable row level security;
alter table receipts enable row level security;
alter table public.invite_codes enable row level security;
alter table public.booking_requests enable row level security;

create or replace function public.my_org_id()
returns uuid
language sql
stable
as $$
  select org_id from public.profiles where user_id = auth.uid() limit 1
$$;

create or replace function public.has_role(_role text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.org_id = public.my_org_id()
      and ur.role = _role
  )
$$;

-- Generic org policies
create policy "org read resources" on resources
for select using (org_id = public.my_org_id());

create policy "owner manager reception write resources" on resources
for all using (
  org_id = public.my_org_id() and
  (public.has_role('OWNER') or public.has_role('MANAGER') or public.has_role('RECEPTION'))
)
with check (
  org_id = public.my_org_id() and
  (public.has_role('OWNER') or public.has_role('MANAGER') or public.has_role('RECEPTION'))
);

create policy "org read services" on services
for select using (org_id = public.my_org_id());

drop policy if exists "public read lookbook services" on services;
create policy "public read lookbook services" on services
for select using (
  active = true and featured_in_lookbook = true
);

create policy "owner manager reception write services" on services
for all using (
  org_id = public.my_org_id() and
  (public.has_role('OWNER') or public.has_role('MANAGER') or public.has_role('RECEPTION'))
)
with check (
  org_id = public.my_org_id() and
  (public.has_role('OWNER') or public.has_role('MANAGER') or public.has_role('RECEPTION'))
);

create policy "org read appointments" on appointments
for select using (org_id = public.my_org_id());

create policy "owner manager reception write appointments" on appointments
for all using (
  org_id = public.my_org_id() and
  (public.has_role('OWNER') or public.has_role('MANAGER') or public.has_role('RECEPTION'))
)
with check (
  org_id = public.my_org_id() and
  (public.has_role('OWNER') or public.has_role('MANAGER') or public.has_role('RECEPTION'))
);

drop policy if exists "tech update own appointments" on appointments;
create policy "tech update own appointments" on appointments
for update using (
  org_id = public.my_org_id()
  and public.has_role('TECH')
  and staff_user_id = auth.uid()
)
with check (
  org_id = public.my_org_id()
  and public.has_role('TECH')
  and staff_user_id = auth.uid()
);

create policy "org read customers" on customers
for select using (org_id = public.my_org_id());

create policy "owner manager reception write customers" on customers
for all using (
  org_id = public.my_org_id() and
  (public.has_role('OWNER') or public.has_role('MANAGER') or public.has_role('RECEPTION'))
)
with check (
  org_id = public.my_org_id() and
  (public.has_role('OWNER') or public.has_role('MANAGER') or public.has_role('RECEPTION'))
);

-- Payments/tickets: TECH khÃ´ng Ä‘Æ°á»£c Ä‘á»c
create policy "owner manager reception accountant read tickets" on tickets
for select using (
  org_id = public.my_org_id() and
  (public.has_role('OWNER') or public.has_role('MANAGER') or public.has_role('RECEPTION') or public.has_role('ACCOUNTANT'))
);

create policy "owner manager reception write tickets" on tickets
for all using (
  org_id = public.my_org_id() and
  (public.has_role('OWNER') or public.has_role('MANAGER') or public.has_role('RECEPTION'))
)
with check (
  org_id = public.my_org_id() and
  (public.has_role('OWNER') or public.has_role('MANAGER') or public.has_role('RECEPTION'))
);

create policy "owner manager reception accountant read payments" on payments
for select using (
  org_id = public.my_org_id() and
  (public.has_role('OWNER') or public.has_role('MANAGER') or public.has_role('RECEPTION') or public.has_role('ACCOUNTANT'))
);

create policy "owner manager reception write payments" on payments
for all using (
  org_id = public.my_org_id() and
  (public.has_role('OWNER') or public.has_role('MANAGER') or public.has_role('RECEPTION'))
)
with check (
  org_id = public.my_org_id() and
  (public.has_role('OWNER') or public.has_role('MANAGER') or public.has_role('RECEPTION'))
);

-- user_roles: chá»‰ OWNER chá»‰nh role nhÃ¢n sá»±
drop policy if exists "read own org roles" on user_roles;
create policy "read own org roles" on user_roles
for select using (org_id = public.my_org_id());

drop policy if exists "owner manager write roles" on user_roles;
drop policy if exists "owner write roles" on user_roles;
create policy "owner write roles" on user_roles
for all using (
  org_id = public.my_org_id() and public.has_role('OWNER')
)
with check (
  org_id = public.my_org_id() and public.has_role('OWNER')
);

drop policy if exists "owner dev read invite codes" on public.invite_codes;
drop policy if exists "owner read invite codes" on public.invite_codes;
create policy "owner read invite codes" on public.invite_codes
for select using (
  org_id = public.my_org_id() and (
    public.has_role('OWNER')
    or auth.jwt() ->> 'role' = 'service_role'
  )
);

drop policy if exists "org read booking_requests" on public.booking_requests;
create policy "org read booking_requests" on public.booking_requests
for select using (
  org_id = public.my_org_id()
  and (
    public.has_role('OWNER')
    or public.has_role('MANAGER')
    or public.has_role('RECEPTION')
  )
);

drop policy if exists "org update booking_requests" on public.booking_requests;
create policy "org update booking_requests" on public.booking_requests
for update using (
  org_id = public.my_org_id()
  and (
    public.has_role('OWNER')
    or public.has_role('MANAGER')
    or public.has_role('RECEPTION')
  )
)
with check (
  org_id = public.my_org_id()
  and (
    public.has_role('OWNER')
    or public.has_role('MANAGER')
    or public.has_role('RECEPTION')
  )
);

-- ===== END rls.sql =====

-- ===== BEGIN rls_patch_v2.sql =====
-- Patch gá»¡ káº¹t auth + ticket detail sau khi báº­t RLS
-- Cháº¡y file nÃ y trong Supabase SQL Editor

-- 1) profiles: cho phÃ©p user tá»± quáº£n lÃ½ profile cá»§a chÃ­nh há»
drop policy if exists "profiles select own" on profiles;
create policy "profiles select own" on profiles
for select using (user_id = auth.uid());

drop policy if exists "profiles insert own" on profiles;
create policy "profiles insert own" on profiles
for insert with check (user_id = auth.uid());

drop policy if exists "profiles update own" on profiles;
create policy "profiles update own" on profiles
for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.update_staff_display_name_secure(
  p_user_id uuid,
  p_display_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select org_id into v_org_id
  from profiles
  where user_id = auth.uid()
  limit 1;

  if v_org_id is null then
    raise exception 'ORG_NOT_FOUND';
  end if;

  if not exists (
    select 1
    from user_roles ur
    where ur.user_id = auth.uid()
      and ur.org_id = v_org_id
      and ur.role = 'OWNER'
  ) then
    raise exception 'FORBIDDEN';
  end if;

  update profiles
  set display_name = coalesce(nullif(trim(p_display_name), ''), 'User')
  where user_id = p_user_id
    and org_id = v_org_id;
end;
$$;

grant execute on function public.update_staff_display_name_secure(uuid, text) to authenticated;

create or replace function public.list_team_members_secure()
returns table (
  id uuid,
  user_id uuid,
  role text,
  display_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select org_id into v_org_id
  from public.user_roles
  where user_id = auth.uid()
  limit 1;

  if v_org_id is null then
    raise exception 'ORG_NOT_FOUND';
  end if;

  return query
  select ur.id, ur.user_id, ur.role::text, coalesce(p.display_name, left(ur.user_id::text, 8)) as display_name
  from public.user_roles ur
  left join public.profiles p on p.user_id = ur.user_id
  where ur.org_id = v_org_id
  order by ur.role asc, ur.user_id asc;
end;
$$;

grant execute on function public.list_team_members_secure() to authenticated;

drop function if exists public.list_team_members_secure_v2();

create function public.list_team_members_secure_v2()
returns table (
  id uuid,
  user_id uuid,
  role text,
  display_name text,
  email text
)
language sql
security definer
set search_path = public
as $$
  select
    ur.id,
    ur.user_id,
    ur.role::text,
    coalesce(nullif(trim(p.display_name), ''), left(ur.user_id::text, 8)) as display_name,
    nullif(trim(p.email), '') as email
  from public.user_roles ur
  left join public.profiles p on p.user_id = ur.user_id
  where ur.org_id = (
    select org_id from public.user_roles where user_id = auth.uid() limit 1
  )
  order by ur.role asc, ur.user_id asc
$$;

grant execute on function public.list_team_members_secure_v2() to authenticated;

create or replace function public.tech_check_in_appointment_secure(
  p_appointment_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select org_id into v_org_id
  from public.user_roles
  where user_id = auth.uid()
  limit 1;

  if v_org_id is null then
    raise exception 'ORG_NOT_FOUND';
  end if;

  if not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.org_id = v_org_id
      and ur.role = 'TECH'
  ) then
    raise exception 'FORBIDDEN';
  end if;

  update public.appointments
  set status = 'CHECKED_IN'
  where id = p_appointment_id
    and org_id = v_org_id
    and staff_user_id = auth.uid()
    and status = 'BOOKED';

  if not found then
    raise exception 'APPOINTMENT_NOT_FOUND_OR_NOT_ASSIGNED';
  end if;
end;
$$;

grant execute on function public.tech_check_in_appointment_secure(uuid) to authenticated;

-- 2) orgs/branches bootstrap: táº¡m má»Ÿ cho authenticated Ä‘á»ƒ khá»Ÿi táº¡o ban Ä‘áº§u
drop policy if exists "orgs auth read" on orgs;
create policy "orgs auth read" on orgs
for select using (auth.uid() is not null);

drop policy if exists "orgs auth insert" on orgs;
create policy "orgs auth insert" on orgs
for insert with check (auth.uid() is not null);

drop policy if exists "branches auth read" on branches;
create policy "branches auth read" on branches
for select using (auth.uid() is not null);

drop policy if exists "branches auth insert" on branches;
create policy "branches auth insert" on branches
for insert with check (auth.uid() is not null);

-- 3) user_roles: cho phÃ©p user tá»± bootstrap role cho chÃ­nh há»
drop policy if exists "user_roles self bootstrap insert" on user_roles;
create policy "user_roles self bootstrap insert" on user_roles
for insert with check (user_id = auth.uid());

-- Enforce signup role rule at DB-level:
-- - first account in org => OWNER
-- - later self-signup accounts => RECEPTION
create or replace function public.normalize_user_role_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_count int;
begin
  if NEW.user_id = auth.uid() then
    select count(*)::int into v_owner_count
    from user_roles
    where org_id = NEW.org_id
      and role = 'OWNER';

    if v_owner_count = 0 then
      NEW.role := 'OWNER';
    else
      NEW.role := 'RECEPTION';
    end if;
    return NEW;
  end if;

  if exists (
    select 1 from user_roles ur
    where ur.org_id = NEW.org_id
      and ur.user_id = auth.uid()
      and ur.role = 'OWNER'
  ) then
    return NEW;
  end if;

  raise exception 'FORBIDDEN_ROLE_INSERT';
end;
$$;

drop trigger if exists trg_normalize_user_role_on_insert on public.user_roles;
create trigger trg_normalize_user_role_on_insert
before insert on public.user_roles
for each row execute function public.normalize_user_role_on_insert();

-- 4) ticket_items: cho role tÃ i chÃ­nh Ä‘á»c item, lá»… tÃ¢n/manager/owner ghi Ä‘Æ°á»£c
drop policy if exists "ticket_items role read" on ticket_items;
create policy "ticket_items role read" on ticket_items
for select using (
  org_id = public.my_org_id() and
  (public.has_role('OWNER') or public.has_role('MANAGER') or public.has_role('RECEPTION') or public.has_role('ACCOUNTANT'))
);

drop policy if exists "ticket_items reception write" on ticket_items;
create policy "ticket_items reception write" on ticket_items
for all using (
  org_id = public.my_org_id() and
  (public.has_role('OWNER') or public.has_role('MANAGER') or public.has_role('RECEPTION'))
)
with check (
  org_id = public.my_org_id() and
  (public.has_role('OWNER') or public.has_role('MANAGER') or public.has_role('RECEPTION'))
);

-- 5) receipts: cho role tÃ i chÃ­nh Ä‘á»c Ä‘Æ°á»£c token receipt
drop policy if exists "receipts role read" on receipts;
create policy "receipts role read" on receipts
for select using (
  org_id = public.my_org_id() and
  (public.has_role('OWNER') or public.has_role('MANAGER') or public.has_role('RECEPTION') or public.has_role('ACCOUNTANT'))
);

drop policy if exists "receipts reception write" on receipts;
create policy "receipts reception write" on receipts
for all using (
  org_id = public.my_org_id() and
  (public.has_role('OWNER') or public.has_role('MANAGER') or public.has_role('RECEPTION'))
)
with check (
  org_id = public.my_org_id() and
  (public.has_role('OWNER') or public.has_role('MANAGER') or public.has_role('RECEPTION'))
);

-- ===== END rls_patch_v2.sql =====

-- ===== BEGIN security_rpc.sql =====
-- Secure RPCs Ä‘á»ƒ háº¡n cháº¿ query trá»±c tiáº¿p báº£ng nháº¡y cáº£m

create or replace function public.get_ticket_detail_secure(p_ticket_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_ticket record;
  v_allowed boolean;
  v_customer jsonb;
  v_payment jsonb;
  v_receipt jsonb;
  v_items jsonb;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select t.* into v_ticket
  from tickets t
  where t.id = p_ticket_id;

  if not found then
    raise exception 'TICKET_NOT_FOUND';
  end if;

  select exists (
    select 1
    from user_roles ur
    where ur.user_id = v_uid
      and ur.org_id = v_ticket.org_id
      and ur.role in ('OWNER', 'MANAGER', 'RECEPTION', 'ACCOUNTANT')
  ) into v_allowed;

  if not v_allowed then
    raise exception 'FORBIDDEN';
  end if;

  select to_jsonb(c) into v_customer
  from (
    select name, phone
    from customers
    where id = v_ticket.customer_id
    limit 1
  ) c;

  select to_jsonb(p) into v_payment
  from (
    select method, amount, status, created_at
    from payments
    where ticket_id = v_ticket.id
    order by created_at desc
    limit 1
  ) p;

  select to_jsonb(r) into v_receipt
  from (
    select public_token, expires_at
    from receipts
    where ticket_id = v_ticket.id
    order by created_at desc
    limit 1
  ) r;

  select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) into v_items
  from (
    select
      ti.qty,
      ti.unit_price,
      ti.vat_rate,
      coalesce(s.name, '(service deleted)') as service_name
    from ticket_items ti
    left join services s on s.id = ti.service_id
    where ti.ticket_id = v_ticket.id
    order by ti.created_at asc
  ) i;

  return jsonb_build_object(
    'ticket', jsonb_build_object(
      'id', v_ticket.id,
      'created_at', v_ticket.created_at,
      'status', v_ticket.status,
      'totals_json', v_ticket.totals_json
    ),
    'customer', coalesce(v_customer, '{}'::jsonb),
    'payment', coalesce(v_payment, '{}'::jsonb),
    'receipt', coalesce(v_receipt, '{}'::jsonb),
    'items', v_items
  );
end;
$$;

grant execute on function public.get_ticket_detail_secure(uuid) to authenticated;

create or replace function public.get_report_breakdown_secure(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_org_id uuid;
  v_allowed boolean;
  v_summary jsonb;
  v_by_service jsonb;
  v_by_payment jsonb;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select org_id into v_org_id from profiles where user_id = v_uid limit 1;
  if v_org_id is null then
    raise exception 'ORG_NOT_FOUND';
  end if;

  select exists (
    select 1 from user_roles ur
    where ur.user_id = v_uid
      and ur.org_id = v_org_id
      and ur.role in ('OWNER','MANAGER','RECEPTION','ACCOUNTANT')
  ) into v_allowed;

  if not v_allowed then
    raise exception 'FORBIDDEN';
  end if;

  select jsonb_build_object(
    'count', count(*)::int,
    'subtotal', coalesce(sum((t.totals_json->>'subtotal')::numeric), 0),
    'vat', coalesce(sum((t.totals_json->>'vat_total')::numeric), 0),
    'revenue', coalesce(sum((t.totals_json->>'grand_total')::numeric), 0)
  )
  into v_summary
  from tickets t
  where t.org_id = v_org_id
    and t.status = 'CLOSED'
    and t.created_at >= p_from
    and t.created_at < p_to;

  select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
  into v_by_service
  from (
    select coalesce(s.name, '(service deleted)') as service_name,
           sum(ti.qty)::int as qty,
           coalesce(sum(ti.qty * ti.unit_price), 0)::numeric as subtotal
    from ticket_items ti
    join tickets t on t.id = ti.ticket_id
    left join services s on s.id = ti.service_id
    where t.org_id = v_org_id
      and t.status = 'CLOSED'
      and t.created_at >= p_from
      and t.created_at < p_to
    group by coalesce(s.name, '(service deleted)')
    order by subtotal desc
  ) x;

  select coalesce(jsonb_agg(to_jsonb(y)), '[]'::jsonb)
  into v_by_payment
  from (
    select p.method,
           count(*)::int as count,
           coalesce(sum(p.amount), 0)::numeric as amount
    from payments p
    join tickets t on t.id = p.ticket_id
    where t.org_id = v_org_id
      and t.status = 'CLOSED'
      and t.created_at >= p_from
      and t.created_at < p_to
    group by p.method
    order by amount desc
  ) y;

  return jsonb_build_object(
    'summary', coalesce(v_summary, '{}'::jsonb),
    'by_service', v_by_service,
    'by_payment', v_by_payment
  );
end;
$$;

grant execute on function public.get_report_breakdown_secure(timestamptz, timestamptz) to authenticated;

-- ===== END security_rpc.sql =====

-- ===== BEGIN public_receipt_rpc.sql =====
-- Public receipt RPC for token-based online sharing (no auth required)

create or replace function public.get_receipt_public(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receipt record;
  v_ticket record;
  v_customer jsonb;
  v_payment jsonb;
  v_items jsonb;
begin
  if p_token is null or btrim(p_token) = '' then
    raise exception 'TOKEN_REQUIRED';
  end if;

  select r.ticket_id, r.expires_at
  into v_receipt
  from receipts r
  where r.public_token = p_token
    and r.expires_at > now()
  limit 1;

  if not found then
    raise exception 'RECEIPT_NOT_FOUND_OR_EXPIRED';
  end if;

  select t.id, t.created_at, t.totals_json, t.customer_id
  into v_ticket
  from tickets t
  where t.id = v_receipt.ticket_id
  limit 1;

  if not found then
    raise exception 'TICKET_NOT_FOUND';
  end if;

  select to_jsonb(c) into v_customer
  from (
    select name
    from customers
    where id = v_ticket.customer_id
    limit 1
  ) c;

  select to_jsonb(p) into v_payment
  from (
    select method, amount, status
    from payments
    where ticket_id = v_ticket.id
    order by created_at desc
    limit 1
  ) p;

  select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb)
  into v_items
  from (
    select
      ti.qty,
      ti.unit_price,
      ti.vat_rate,
      coalesce(s.name, '(service deleted)') as service_name
    from ticket_items ti
    left join services s on s.id = ti.service_id
    where ti.ticket_id = v_ticket.id
    order by ti.created_at asc
  ) i;

  return jsonb_build_object(
    'ticket', jsonb_build_object(
      'id', v_ticket.id,
      'created_at', v_ticket.created_at,
      'totals_json', v_ticket.totals_json
    ),
    'customer', coalesce(v_customer, '{}'::jsonb),
    'payment', coalesce(v_payment, '{}'::jsonb),
    'items', v_items
  );
end;
$$;

grant execute on function public.get_receipt_public(text) to anon, authenticated;

-- ===== END public_receipt_rpc.sql =====

-- ===== BEGIN invite_codes.sql =====
create or replace function public.generate_invite_code_secure(
  p_allowed_role text default 'TECH',
  p_note text default null
)
returns public.invite_codes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_role text;
  v_code text;
  v_row public.invite_codes;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select p.org_id into v_org_id
  from public.profiles p
  where p.user_id = auth.uid()
  limit 1;

  if v_org_id is null then
    raise exception 'ORG_CONTEXT_REQUIRED';
  end if;

  if not (public.has_role('OWNER')) then
    raise exception 'FORBIDDEN';
  end if;

  v_role := coalesce(nullif(trim(p_allowed_role), ''), 'TECH');
  if v_role not in ('MANAGER','RECEPTION','ACCOUNTANT','TECH') then
    raise exception 'INVALID_ROLE';
  end if;

  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    begin
      insert into public.invite_codes (org_id, code, created_by, allowed_role, expires_at, note)
      values (v_org_id, v_code, auth.uid(), v_role, now() + interval '15 minutes', nullif(trim(p_note), ''))
      returning * into v_row;
      exit;
    exception when unique_violation then
    end;
  end loop;

  return v_row;
end;
$$;

create or replace function public.revoke_invite_code_secure(
  p_invite_id uuid
)
returns public.invite_codes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_row public.invite_codes;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select p.org_id into v_org_id
  from public.profiles p
  where p.user_id = auth.uid()
  limit 1;

  if v_org_id is null then
    raise exception 'ORG_CONTEXT_REQUIRED';
  end if;

  if not (public.has_role('OWNER')) then
    raise exception 'FORBIDDEN';
  end if;

  update public.invite_codes
  set revoked_at = now()
  where id = p_invite_id
    and org_id = v_org_id
    and revoked_at is null
    and used_count < max_uses
  returning * into v_row;

  if v_row.id is null then
    raise exception 'INVITE_NOT_FOUND_OR_FINALIZED';
  end if;

  return v_row;
end;
$$;

create or replace function public.consume_invite_code_secure(
  p_code text,
  p_user_id uuid,
  p_display_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.invite_codes;
  v_branch_id uuid;
  v_display_name text;
begin
  if p_user_id is null then
    raise exception 'USER_REQUIRED';
  end if;

  select * into v_invite
  from public.invite_codes
  where code = upper(trim(p_code))
    and revoked_at is null
    and used_count < max_uses
    and expires_at > now()
  order by created_at desc
  limit 1
  for update;

  if v_invite.id is null then
    raise exception 'INVITE_INVALID';
  end if;

  update public.invite_codes
  set used_count = used_count + 1,
      used_by = p_user_id,
      used_at = now()
  where id = v_invite.id
    and used_count < max_uses;

  if not found then
    raise exception 'INVITE_ALREADY_USED';
  end if;

  select id into v_branch_id
  from public.branches
  where org_id = v_invite.org_id
  order by created_at asc
  limit 1;

  v_display_name := nullif(trim(coalesce(p_display_name, '')), '');

  insert into public.profiles (user_id, org_id, default_branch_id, display_name)
  values (p_user_id, v_invite.org_id, v_branch_id, coalesce(v_display_name, 'User'))
  on conflict (user_id) do update
    set org_id = excluded.org_id,
        default_branch_id = excluded.default_branch_id,
        display_name = coalesce(nullif(excluded.display_name, ''), public.profiles.display_name, 'User');

  insert into public.user_roles (user_id, org_id, role)
  values (p_user_id, v_invite.org_id, v_invite.allowed_role)
  on conflict (user_id, org_id, role) do nothing;

  return jsonb_build_object(
    'inviteId', v_invite.id,
    'orgId', v_invite.org_id,
    'role', v_invite.allowed_role,
    'expiresAt', v_invite.expires_at
  );
end;
$$;

grant execute on function public.generate_invite_code_secure(text, text) to authenticated;
grant execute on function public.revoke_invite_code_secure(uuid) to authenticated;
grant execute on function public.consume_invite_code_secure(text, uuid, text) to anon, authenticated;

-- ===== END invite_codes.sql =====

-- ===== BEGIN landing_booking.sql =====
create or replace function public.create_booking_request_public(
  p_customer_name text,
  p_customer_phone text,
  p_requested_service text default null,
  p_preferred_staff text default null,
  p_note text default null,
  p_requested_start_at timestamptz default null,
  p_requested_end_at timestamptz default null,
  p_source text default 'landing_page'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_branch_id uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_row public.booking_requests;
begin
  if p_customer_name is null or btrim(p_customer_name) = '' then
    raise exception 'CUSTOMER_NAME_REQUIRED';
  end if;

  if p_customer_phone is null or btrim(p_customer_phone) = '' then
    raise exception 'CUSTOMER_PHONE_REQUIRED';
  end if;

  if p_requested_start_at is null then
    raise exception 'REQUESTED_START_REQUIRED';
  end if;

  v_start := p_requested_start_at;
  v_end := coalesce(p_requested_end_at, p_requested_start_at + interval '60 minutes');

  if v_end <= v_start then
    raise exception 'INVALID_TIME_RANGE';
  end if;

  select id into v_org_id
  from public.orgs
  order by created_at asc
  limit 1;

  if v_org_id is null then
    raise exception 'ORG_NOT_READY';
  end if;

  select id into v_branch_id
  from public.branches
  where org_id = v_org_id
  order by created_at asc
  limit 1;

  if v_branch_id is null then
    raise exception 'BRANCH_NOT_READY';
  end if;

  insert into public.booking_requests (
    org_id, branch_id, customer_name, customer_phone, requested_service, preferred_staff, note, requested_start_at, requested_end_at, source
  ) values (
    v_org_id, v_branch_id, btrim(p_customer_name), btrim(p_customer_phone), nullif(btrim(coalesce(p_requested_service, '')), ''), nullif(btrim(coalesce(p_preferred_staff, '')), ''), nullif(btrim(coalesce(p_note, '')), ''), v_start, v_end, coalesce(nullif(btrim(coalesce(p_source, '')), ''), 'landing_page')
  )
  returning * into v_row;

  return jsonb_build_object(
    'id', v_row.id,
    'status', v_row.status,
    'requested_start_at', v_row.requested_start_at,
    'requested_end_at', v_row.requested_end_at
  );
end;
$$;

grant execute on function public.create_booking_request_public(
  text, text, text, text, text, timestamptz, timestamptz, text
) to anon, authenticated;

create or replace function public.convert_booking_request_to_appointment_secure(
  p_booking_request_id uuid,
  p_staff_user_id uuid default null,
  p_resource_id uuid default null,
  p_start_at timestamptz default null,
  p_end_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_org_id uuid;
  v_branch_id uuid;
  v_allowed boolean;
  v_req public.booking_requests;
  v_customer_id uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_appointment_id uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select p.org_id, p.default_branch_id into v_org_id, v_branch_id
  from public.profiles p
  where p.user_id = v_uid
  limit 1;

  if v_org_id is null then
    raise exception 'ORG_CONTEXT_REQUIRED';
  end if;

  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = v_uid
      and ur.org_id = v_org_id
      and ur.role in ('OWNER','MANAGER','RECEPTION','TECH')
  ) into v_allowed;

  if not coalesce(v_allowed, false) then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_req
  from public.booking_requests br
  where br.id = p_booking_request_id
    and br.org_id = v_org_id
  limit 1;

  if v_req.id is null then
    raise exception 'BOOKING_REQUEST_NOT_FOUND';
  end if;

  if v_req.status in ('CANCELLED', 'CONVERTED') then
    raise exception 'BOOKING_REQUEST_ALREADY_FINALIZED';
  end if;

  v_start := coalesce(p_start_at, v_req.requested_start_at);
  v_end := coalesce(p_end_at, v_req.requested_end_at, v_start + interval '60 minutes');

  if v_end <= v_start then
    raise exception 'INVALID_TIME_RANGE';
  end if;

  select c.id into v_customer_id
  from public.customers c
  where c.org_id = v_org_id
    and c.name = v_req.customer_name
    and coalesce(c.phone, '') = coalesce(v_req.customer_phone, '')
  order by c.created_at asc
  limit 1;

  if v_customer_id is null then
    insert into public.customers (org_id, name, phone, notes)
    values (
      v_org_id,
      v_req.customer_name,
      v_req.customer_phone,
      concat_ws(' | ',
        case when v_req.requested_service is not null then 'DV: ' || v_req.requested_service else null end,
        case when v_req.preferred_staff is not null then 'Thá»£ mong muá»‘n: ' || v_req.preferred_staff else null end,
        nullif(v_req.note, '')
      )
    )
    returning id into v_customer_id;
  else
    update public.customers
    set notes = concat_ws(' | ',
      nullif(notes, ''),
      case when v_req.requested_service is not null then 'DV: ' || v_req.requested_service else null end,
      case when v_req.preferred_staff is not null then 'Thá»£ mong muá»‘n: ' || v_req.preferred_staff else null end,
      nullif(v_req.note, '')
    )
    where id = v_customer_id and org_id = v_org_id;
  end if;

  insert into public.appointments (
    org_id, branch_id, customer_id, staff_user_id, resource_id, start_at, end_at, status
  ) values (
    v_org_id, coalesce(v_req.branch_id, v_branch_id), v_customer_id, p_staff_user_id, p_resource_id, v_start, v_end, 'BOOKED'
  )
  returning id into v_appointment_id;

  update public.booking_requests
  set status = 'CONVERTED',
      appointment_id = v_appointment_id
  where id = v_req.id;

  return jsonb_build_object(
    'booking_request_id', v_req.id,
    'appointment_id', v_appointment_id,
    'status', 'CONVERTED'
  );
end;
$$;

grant execute on function public.convert_booking_request_to_appointment_secure(
  uuid, uuid, uuid, timestamptz, timestamptz
) to authenticated;

-- ===== END landing_booking.sql =====

-- ===== BEGIN services_storage_setup.sql =====
insert into storage.buckets (id, name, public)
values ('service-images', 'service-images', true)
on conflict (id) do update set public = true;

drop policy if exists "service-images public read" on storage.objects;
create policy "service-images public read"
on storage.objects for select
using (bucket_id = 'service-images');

drop policy if exists "service-images authenticated insert" on storage.objects;
create policy "service-images authenticated insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'service-images');

drop policy if exists "service-images authenticated update" on storage.objects;
create policy "service-images authenticated update"
on storage.objects for update
to authenticated
using (bucket_id = 'service-images')
with check (bucket_id = 'service-images');


drop policy if exists "service-images authenticated delete" on storage.objects;
create policy "service-images authenticated delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'service-images');

-- ===== END services_storage_setup.sql =====

-- ===== BEGIN idempotency.sql =====
-- Idempotency support for checkout requests

create table if not exists public.checkout_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  idempotency_key text not null,
  ticket_id uuid references public.tickets(id) on delete set null,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (org_id, idempotency_key)
);

alter table public.checkout_requests enable row level security;

-- app uses SECURITY DEFINER RPC, deny direct table access by default

-- ===== END idempotency.sql =====

-- ===== BEGIN checkout_rpc.sql =====
-- Atomic checkout RPC (ticket + items + payment + receipt + appointment update)
-- Run after schema.sql + rls.sql + security_rpc.sql

create or replace function public.checkout_close_ticket_secure(
  p_customer_name text,
  p_payment_method text,
  p_lines jsonb,
  p_appointment_id uuid default null,
  p_dedupe_window_ms int default 15000,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_org_id uuid;
  v_branch_id uuid;
  v_allowed boolean;
  v_customer_id uuid;
  v_subtotal numeric := 0;
  v_vat_total numeric := 0;
  v_grand_total numeric := 0;
  v_ticket_id uuid;
  v_token text;
  v_expires_at timestamptz;
  v_days int := 30;
  v_duplicate_ticket_id uuid;
  v_duplicate_token text;
  v_existing_ticket_id uuid;
  v_existing_token text;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if p_customer_name is null or btrim(p_customer_name) = '' then
    raise exception 'CUSTOMER_NAME_REQUIRED';
  end if;

  if p_payment_method not in ('CASH', 'TRANSFER') then
    raise exception 'INVALID_PAYMENT_METHOD';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'CHECKOUT_LINES_REQUIRED';
  end if;

  select org_id, default_branch_id
  into v_org_id, v_branch_id
  from profiles
  where user_id = v_uid
  limit 1;

  if v_org_id is null then
    raise exception 'ORG_NOT_FOUND';
  end if;

  select exists (
    select 1
    from user_roles ur
    where ur.user_id = v_uid
      and ur.org_id = v_org_id
      and ur.role in ('OWNER', 'MANAGER', 'RECEPTION')
  ) into v_allowed;

  if not v_allowed then
    raise exception 'FORBIDDEN';
  end if;

  if v_branch_id is null then
    select b.id into v_branch_id
    from branches b
    where b.org_id = v_org_id
    order by b.created_at asc
    limit 1;
  end if;

  if v_branch_id is null then
    raise exception 'BRANCH_NOT_FOUND';
  end if;

  select c.id into v_customer_id
  from customers c
  where c.org_id = v_org_id and c.name = p_customer_name
  order by c.created_at asc
  limit 1;

  if v_customer_id is null then
    insert into customers (org_id, name)
    values (v_org_id, p_customer_name)
    returning id into v_customer_id;
  end if;

  select
    coalesce(sum((s.base_price * x.qty)), 0),
    coalesce(sum((s.base_price * x.qty * s.vat_rate)), 0)
  into v_subtotal, v_vat_total
  from (
    select
      (elem->>'serviceId')::uuid as service_id,
      greatest((elem->>'qty')::int, 1) as qty
    from jsonb_array_elements(p_lines) elem
  ) x
  join services s on s.id = x.service_id and s.org_id = v_org_id;

  if v_subtotal <= 0 then
    raise exception 'INVALID_SERVICES';
  end if;

  v_grand_total := v_subtotal + v_vat_total;

  -- strict idempotency by key within org
  if p_idempotency_key is not null and btrim(p_idempotency_key) <> '' then
    select cr.ticket_id
    into v_existing_ticket_id
    from checkout_requests cr
    where cr.org_id = v_org_id
      and cr.idempotency_key = p_idempotency_key
    limit 1;

    if v_existing_ticket_id is not null then
      select r.public_token
      into v_existing_token
      from receipts r
      where r.ticket_id = v_existing_ticket_id
      order by r.created_at desc
      limit 1;

      return jsonb_build_object(
        'ticketId', v_existing_ticket_id,
        'receiptToken', coalesce(v_existing_token, ''),
        'grandTotal', v_grand_total,
        'deduped', true
      );
    end if;
  end if;

  -- dedupe: same customer + CLOSED ticket with same grand_total in short window
  select t.id
  into v_duplicate_ticket_id
  from tickets t
  where t.org_id = v_org_id
    and t.customer_id = v_customer_id
    and t.status = 'CLOSED'
    and t.created_at >= (now() - make_interval(secs => greatest(p_dedupe_window_ms, 1000) / 1000.0))
    and abs(coalesce((t.totals_json->>'grand_total')::numeric, 0) - v_grand_total) < 0.01
  order by t.created_at desc
  limit 1;

  if v_duplicate_ticket_id is not null then
    select r.public_token
    into v_duplicate_token
    from receipts r
    where r.ticket_id = v_duplicate_ticket_id
    order by r.created_at desc
    limit 1;

    return jsonb_build_object(
      'ticketId', v_duplicate_ticket_id,
      'receiptToken', coalesce(v_duplicate_token, ''),
      'grandTotal', v_grand_total,
      'deduped', true
    );
  end if;

  insert into tickets (org_id, branch_id, customer_id, appointment_id, status, totals_json)
  values (
    v_org_id,
    v_branch_id,
    v_customer_id,
    p_appointment_id,
    'CLOSED',
    jsonb_build_object(
      'subtotal', v_subtotal,
      'discount_total', 0,
      'vat_total', v_vat_total,
      'grand_total', v_grand_total
    )
  )
  returning id into v_ticket_id;

  insert into ticket_items (org_id, ticket_id, service_id, qty, unit_price, vat_rate)
  select
    v_org_id,
    v_ticket_id,
    s.id,
    x.qty,
    s.base_price,
    s.vat_rate
  from (
    select
      (elem->>'serviceId')::uuid as service_id,
      greatest((elem->>'qty')::int, 1) as qty
    from jsonb_array_elements(p_lines) elem
  ) x
  join services s on s.id = x.service_id and s.org_id = v_org_id;

  insert into payments (org_id, ticket_id, method, amount, status)
  values (v_org_id, v_ticket_id, p_payment_method, v_grand_total, 'PAID');

  -- Avoid dependency on gen_random_bytes() availability across projects.
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_expires_at := now() + make_interval(days => v_days);

  insert into receipts (org_id, ticket_id, public_token, expires_at)
  values (v_org_id, v_ticket_id, v_token, v_expires_at);

  if p_appointment_id is not null then
    update appointments
    set status = 'DONE'
    where id = p_appointment_id
      and org_id = v_org_id;
  end if;

  if p_idempotency_key is not null and btrim(p_idempotency_key) <> '' then
    insert into checkout_requests (org_id, idempotency_key, ticket_id, created_by)
    values (v_org_id, p_idempotency_key, v_ticket_id, v_uid)
    on conflict (org_id, idempotency_key)
    do update set ticket_id = excluded.ticket_id;
  end if;

  return jsonb_build_object(
    'ticketId', v_ticket_id,
    'receiptToken', v_token,
    'grandTotal', v_grand_total,
    'deduped', false
  );
end;
$$;

grant execute on function public.checkout_close_ticket_secure(text, text, jsonb, uuid, int, text) to authenticated;

-- ===== END checkout_rpc.sql =====

-- ===== BEGIN cleanup_checkout_rpc_overloads.sql =====
-- Cleanup legacy checkout RPC overload to avoid PostgREST ambiguity

drop function if exists public.checkout_close_ticket_secure(
  text, text, jsonb, uuid, integer
);

grant execute on function public.checkout_close_ticket_secure(
  text, text, jsonb, uuid, integer, text
) to authenticated;

-- ===== END cleanup_checkout_rpc_overloads.sql =====

-- ===== BEGIN shifts.sql =====
-- Shift/Time tracking tables + RLS

create table if not exists time_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  staff_user_id uuid not null,
  clock_in timestamptz not null,
  clock_out timestamptz,
  created_at timestamptz not null default now()
);

alter table time_entries enable row level security;

drop policy if exists "time_entries role read" on time_entries;
create policy "time_entries role read" on time_entries
for select using (
  org_id = public.my_org_id() and
  (public.has_role('OWNER') or public.has_role('MANAGER') or public.has_role('RECEPTION') or public.has_role('TECH'))
);

drop policy if exists "time_entries role write" on time_entries;
create policy "time_entries role write" on time_entries
for all using (
  org_id = public.my_org_id() and
  (public.has_role('OWNER') or public.has_role('MANAGER') or public.has_role('RECEPTION') or public.has_role('TECH'))
)
with check (
  org_id = public.my_org_id() and
  (public.has_role('OWNER') or public.has_role('MANAGER') or public.has_role('RECEPTION') or public.has_role('TECH'))
);

-- ===== END shifts.sql =====

-- ===== BEGIN shift_attendance_requests_2026_04.sql =====
alter table public.time_entries
  add column if not exists effective_clock_in timestamptz,
  add column if not exists effective_clock_out timestamptz,
  add column if not exists scheduled_date date,
  add column if not exists scheduled_week_start date,
  add column if not exists scheduled_shift_type text check (scheduled_shift_type in ('MORNING', 'AFTERNOON', 'FULL_DAY', 'OFF')),
  add column if not exists scheduled_shift_label text,
  add column if not exists scheduled_start timestamptz,
  add column if not exists scheduled_end timestamptz,
  add column if not exists approval_status text not null default 'PENDING' check (approval_status in ('PENDING', 'APPROVED', 'REJECTED')),
  add column if not exists approval_note text,
  add column if not exists approved_by uuid references public.profiles(user_id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists auto_closed boolean not null default false;

create index if not exists idx_time_entries_staff_status_day
  on public.time_entries (staff_user_id, approval_status, scheduled_date desc, clock_in desc);

create index if not exists idx_time_entries_open_shift_end
  on public.time_entries (org_id, scheduled_end)
  where clock_out is null;

drop policy if exists "time_entries role write" on public.time_entries;
drop policy if exists "time_entries owner manager write" on public.time_entries;
create policy "time_entries owner manager write" on public.time_entries
for all
using (
  org_id = public.my_org_id()
  and (public.has_role('OWNER') or public.has_role('MANAGER'))
)
with check (
  org_id = public.my_org_id()
  and (public.has_role('OWNER') or public.has_role('MANAGER'))
);

drop policy if exists "time_entries staff self write" on public.time_entries;
create policy "time_entries staff self write" on public.time_entries
for all
using (
  org_id = public.my_org_id()
  and staff_user_id = auth.uid()
  and (
    public.has_role('RECEPTION')
    or public.has_role('TECH')
    or public.has_role('ACCOUNTANT')
    or public.has_role('MANAGER')
  )
)
with check (
  org_id = public.my_org_id()
  and staff_user_id = auth.uid()
  and (
    public.has_role('RECEPTION')
    or public.has_role('TECH')
    or public.has_role('ACCOUNTANT')
    or public.has_role('MANAGER')
  )
);

create table if not exists public.shift_leave_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  staff_user_id uuid not null references public.profiles(user_id) on delete cascade,
  request_type text not null check (request_type in ('DAY_OFF', 'EARLY_LEAVE')),
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  scheduled_date date,
  requested_at timestamptz not null default now(),
  requested_end_at timestamptz,
  note text,
  owner_note text,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(user_id) on delete set null,
  time_entry_id uuid references public.time_entries(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_shift_leave_requests_org_status
  on public.shift_leave_requests (org_id, status, requested_at desc);

create index if not exists idx_shift_leave_requests_staff_date
  on public.shift_leave_requests (staff_user_id, scheduled_date desc, requested_at desc);

alter table public.shift_leave_requests enable row level security;

drop policy if exists "shift_leave_requests owner manager read" on public.shift_leave_requests;
create policy "shift_leave_requests owner manager read" on public.shift_leave_requests
for select
using (
  org_id = public.my_org_id()
  and (public.has_role('OWNER') or public.has_role('MANAGER'))
);

drop policy if exists "shift_leave_requests owner manager write" on public.shift_leave_requests;
create policy "shift_leave_requests owner manager write" on public.shift_leave_requests
for all
using (
  org_id = public.my_org_id()
  and (public.has_role('OWNER') or public.has_role('MANAGER'))
)
with check (
  org_id = public.my_org_id()
  and (public.has_role('OWNER') or public.has_role('MANAGER'))
);

drop policy if exists "shift_leave_requests staff read self" on public.shift_leave_requests;
create policy "shift_leave_requests staff read self" on public.shift_leave_requests
for select
using (
  org_id = public.my_org_id()
  and staff_user_id = auth.uid()
);

drop policy if exists "shift_leave_requests staff write self" on public.shift_leave_requests;
create policy "shift_leave_requests staff write self" on public.shift_leave_requests
for insert
with check (
  org_id = public.my_org_id()
  and staff_user_id = auth.uid()
);

drop trigger if exists trg_shift_leave_requests_touch_updated_at on public.shift_leave_requests;
create trigger trg_shift_leave_requests_touch_updated_at
before update on public.shift_leave_requests
for each row
execute function public.touch_updated_at();
-- ===== END shift_attendance_requests_2026_04.sql =====

-- ===== BEGIN staff_shift_profiles_2026_04.sql =====
create table if not exists public.staff_shift_profiles (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  staff_role text not null check (staff_role in ('MANAGER', 'RECEPTION', 'TECH', 'ACCOUNTANT')),
  skills_json jsonb not null default '[]'::jsonb,
  availability_json jsonb not null default '[]'::jsonb,
  leave_dates_json jsonb not null default '[]'::jsonb,
  max_weekly_hours integer not null default 40 check (max_weekly_hours between 0 and 84),
  fairness_offset_hours integer not null default 0 check (fairness_offset_hours between 0 and 24),
  performance_score integer not null default 7 check (performance_score between 1 and 10),
  notes_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_staff_shift_profiles_org_branch
  on public.staff_shift_profiles (org_id, branch_id, staff_role);

alter table public.staff_shift_profiles enable row level security;

drop policy if exists "staff_shift_profiles owner manager read" on public.staff_shift_profiles;
create policy "staff_shift_profiles owner manager read" on public.staff_shift_profiles
for select
using (
  org_id = public.my_org_id()
  and (public.has_role('OWNER') or public.has_role('MANAGER'))
);

drop policy if exists "staff_shift_profiles owner manager write" on public.staff_shift_profiles;
create policy "staff_shift_profiles owner manager write" on public.staff_shift_profiles
for all
using (
  org_id = public.my_org_id()
  and (public.has_role('OWNER') or public.has_role('MANAGER'))
)
with check (
  org_id = public.my_org_id()
  and (public.has_role('OWNER') or public.has_role('MANAGER'))
);

drop policy if exists "staff_shift_profiles staff read self" on public.staff_shift_profiles;
create policy "staff_shift_profiles staff read self" on public.staff_shift_profiles
for select
using (
  user_id = auth.uid()
  and org_id = public.my_org_id()
);

drop trigger if exists trg_staff_shift_profiles_touch_updated_at on public.staff_shift_profiles;
create trigger trg_staff_shift_profiles_touch_updated_at
before update on public.staff_shift_profiles
for each row
execute function public.touch_updated_at();
-- ===== END staff_shift_profiles_2026_04.sql =====

-- ===== BEGIN shift_plans_2026_04.sql =====
create table if not exists public.shift_plans (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  week_start date not null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  assignments_json jsonb not null default '[]'::jsonb,
  demands_json jsonb not null default '[]'::jsonb,
  forecast_json jsonb not null default '{}'::jsonb,
  employee_summaries_json jsonb not null default '[]'::jsonb,
  day_summaries_json jsonb not null default '[]'::jsonb,
  conflicts_json jsonb not null default '[]'::jsonb,
  suggestions_json jsonb not null default '[]'::jsonb,
  notes_json jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_by uuid references public.profiles(user_id) on delete set null,
  updated_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_shift_plans_org_branch_week
  on public.shift_plans (org_id, branch_id, week_start);

create index if not exists idx_shift_plans_org_status_week
  on public.shift_plans (org_id, status, week_start desc);

alter table public.shift_plans enable row level security;

drop policy if exists "shift_plans owner manager read all" on public.shift_plans;
create policy "shift_plans owner manager read all" on public.shift_plans
for select
using (
  org_id = public.my_org_id()
  and (public.has_role('OWNER') or public.has_role('MANAGER'))
);

drop policy if exists "shift_plans owner manager write" on public.shift_plans;
create policy "shift_plans owner manager write" on public.shift_plans
for all
using (
  org_id = public.my_org_id()
  and (public.has_role('OWNER') or public.has_role('MANAGER'))
)
with check (
  org_id = public.my_org_id()
  and (public.has_role('OWNER') or public.has_role('MANAGER'))
);

drop policy if exists "shift_plans staff read published" on public.shift_plans;
create policy "shift_plans staff read published" on public.shift_plans
for select
using (
  org_id = public.my_org_id()
  and status = 'published'
  and (
    public.has_role('OWNER')
    or public.has_role('MANAGER')
    or public.has_role('RECEPTION')
    or public.has_role('TECH')
    or public.has_role('ACCOUNTANT')
  )
);

drop trigger if exists trg_shift_plans_touch_updated_at on public.shift_plans;
create trigger trg_shift_plans_touch_updated_at
before update on public.shift_plans
for each row
execute function public.touch_updated_at();
-- ===== END shift_plans_2026_04.sql =====

-- ===== BEGIN data_integrity.sql =====
-- Data integrity hardening (appointments + tickets)
-- Run this after schema.sql

-- 1) Appointment time range must be valid
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'appointments_time_range_check'
  ) THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_time_range_check
      CHECK (end_at > start_at);
  END IF;
END $$;

-- 2) Status transition guard for appointments
CREATE OR REPLACE FUNCTION public.enforce_appointment_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- only validate when status actually changes
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'BOOKED' AND NEW.status IN ('CHECKED_IN', 'DONE', 'CANCELLED', 'NO_SHOW') THEN
    RETURN NEW;
  ELSIF OLD.status = 'CHECKED_IN' AND NEW.status IN ('DONE', 'CANCELLED', 'NO_SHOW') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'INVALID_APPOINTMENT_STATUS_TRANSITION: % -> %', OLD.status, NEW.status;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_appointment_status_transition ON public.appointments;

CREATE TRIGGER trg_enforce_appointment_status_transition
BEFORE UPDATE OF status ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.enforce_appointment_status_transition();

-- 3) Prevent duplicate closed tickets for same appointment
CREATE UNIQUE INDEX IF NOT EXISTS uq_closed_ticket_per_appointment
  ON public.tickets (appointment_id)
  WHERE appointment_id IS NOT NULL AND status = 'CLOSED';

-- ===== END data_integrity.sql =====

-- ===== BEGIN perf_indexes.sql =====
-- Performance indexes cho truy váº¥n dashboard/reports/checkout

create index if not exists idx_tickets_org_created_at on tickets (org_id, created_at desc);
create index if not exists idx_tickets_org_status_created on tickets (org_id, status, created_at desc);
create index if not exists idx_appointments_org_start_at on appointments (org_id, start_at);
create index if not exists idx_appointments_org_status_start on appointments (org_id, status, start_at);
create index if not exists idx_appointments_overdue_queue on appointments (org_id, status, overdue_alert_sent_at, start_at);
create index if not exists idx_ticket_items_ticket_id on ticket_items (ticket_id);
create index if not exists idx_payments_ticket_id on payments (ticket_id);
create index if not exists idx_receipts_ticket_id on receipts (ticket_id, created_at desc);
create index if not exists idx_time_entries_org_clockin on time_entries (org_id, clock_in desc);

-- ===== END perf_indexes.sql =====

-- ===== BEGIN telegram_links.sql =====
create table if not exists public.telegram_links (
  id uuid primary key default gen_random_uuid(),
  app_user_id uuid not null references public.profiles(user_id) on delete cascade,
  telegram_user_id bigint not null,
  telegram_username text,
  telegram_first_name text,
  verified_at timestamptz not null default now(),
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

create or replace function public.generate_telegram_link_code(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_current_user_id uuid;
begin
  v_current_user_id := auth.uid();
  if v_current_user_id is null or v_current_user_id <> p_user_id then
    raise exception 'Unauthorized';
  end if;

  delete from public.telegram_link_codes
  where app_user_id = p_user_id and used_at is null;

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
  values (p_user_id, v_code, now() + interval '5 minutes');

  return jsonb_build_object('success', true, 'code', v_code);
end;
$$;

create or replace function public.confirm_telegram_link(
  p_code text,
  p_telegram_user_id bigint,
  p_telegram_username text default null,
  p_telegram_first_name text default null
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

  insert into public.telegram_links (app_user_id, telegram_user_id, telegram_username, telegram_first_name)
  values (v_link_code.app_user_id, p_telegram_user_id, p_telegram_username, p_telegram_first_name);

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
    'success', true,
    'user_id', v_link_code.app_user_id,
    'role', v_role,
    'display_name', v_display_name
  );
end;
$$;

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

create or replace function public.unlink_telegram(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_user_id uuid;
begin
  v_current_user_id := auth.uid();
  if v_current_user_id is null or v_current_user_id <> p_user_id then
    raise exception 'Unauthorized';
  end if;

  delete from public.telegram_links where app_user_id = p_user_id;
  return jsonb_build_object('success', true);
end;
$$;

revoke all on function public.generate_telegram_link_code(uuid) from public, anon;
revoke all on function public.confirm_telegram_link(text, bigint, text, text) from public, anon;
revoke all on function public.get_telegram_user_role(bigint) from public, anon;
revoke all on function public.unlink_telegram(uuid) from public, anon;

grant execute on function public.generate_telegram_link_code(uuid) to authenticated, service_role;
grant execute on function public.confirm_telegram_link(text, bigint, text, text) to authenticated, service_role;
grant execute on function public.get_telegram_user_role(bigint) to authenticated, service_role;
grant execute on function public.unlink_telegram(uuid) to authenticated, service_role;

-- ===== END telegram_links.sql =====

-- ===== BEGIN telegram_conversations.sql =====
create table if not exists public.telegram_conversations (
  telegram_user_id bigint primary key,
  step text not null,
  data_json jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_telegram_conversations_expires_at
  on public.telegram_conversations (expires_at);

alter table public.telegram_conversations enable row level security;

drop policy if exists "service role full access telegram conversations" on public.telegram_conversations;
create policy "service role full access telegram conversations" on public.telegram_conversations
  for all to service_role using (true) with check (true);

create or replace function public.touch_telegram_conversations_updated_at()
returns trigger
language plpgsql
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

-- ===== END telegram_conversations.sql =====


-- ===== BEGIN crm_patch_2026_04.sql =====
-- CRM retention MVP patch
-- Apply after deploy.sql

alter table public.customers
  add column if not exists full_name text,
  add column if not exists birthday date,
  add column if not exists gender text,
  add column if not exists first_visit_at timestamptz,
  add column if not exists last_visit_at timestamptz,
  add column if not exists total_visits int not null default 0,
  add column if not exists total_spend numeric(12,2) not null default 0,
  add column if not exists last_service_summary text,
  add column if not exists favorite_staff_user_id uuid references public.profiles(user_id),
  add column if not exists customer_status text not null default 'NEW',
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists care_note text,
  add column if not exists source text,
  add column if not exists next_follow_up_at timestamptz,
  add column if not exists last_contacted_at timestamptz,
  add column if not exists follow_up_status text not null default 'PENDING',
  add column if not exists needs_merge_review boolean not null default false,
  add column if not exists merged_into_customer_id uuid references public.customers(id);

update public.customers
set
  full_name = coalesce(nullif(trim(full_name), ''), name),
  care_note = coalesce(care_note, notes)
where
  full_name is distinct from coalesce(nullif(trim(full_name), ''), name)
  or care_note is null;

create index if not exists idx_customers_org_phone on public.customers (org_id, phone);
create index if not exists idx_customers_org_status on public.customers (org_id, customer_status, last_visit_at desc);
create index if not exists idx_customers_org_follow_up on public.customers (org_id, next_follow_up_at) where next_follow_up_at is not null;

create table if not exists public.customer_activities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  type text not null check (type in ('BOOKING_REQUEST','APPOINTMENT','CHECKOUT','FOLLOW_UP_NOTE','TELEGRAM_CONTACT')),
  channel text,
  content_summary text not null,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_customer_activities_customer_created
  on public.customer_activities (customer_id, created_at desc);

alter table public.customer_activities enable row level security;

drop policy if exists "crm read customer activities" on public.customer_activities;
create policy "crm read customer activities" on public.customer_activities
for select using (
  org_id = public.my_org_id()
  and (
    public.has_role('OWNER')
    or public.has_role('MANAGER')
    or public.has_role('RECEPTION')
    or public.has_role('TECH')
  )
);

drop policy if exists "crm write customer activities" on public.customer_activities;
create policy "crm write customer activities" on public.customer_activities
for all using (
  org_id = public.my_org_id()
  and (
    public.has_role('OWNER')
    or public.has_role('MANAGER')
    or public.has_role('RECEPTION')
  )
)
with check (
  org_id = public.my_org_id()
  and (
    public.has_role('OWNER')
    or public.has_role('MANAGER')
    or public.has_role('RECEPTION')
  )
);

create or replace function public.normalize_customer_phone(p_phone text)
returns text
language plpgsql
immutable
as $$
declare
  v_digits text;
begin
  if p_phone is null then
    return null;
  end if;

  v_digits := regexp_replace(p_phone, '\D', '', 'g');

  if v_digits = '' then
    return null;
  end if;

  if left(v_digits, 2) = '84' and length(v_digits) >= 11 then
    return '0' || substr(v_digits, 3);
  end if;

  return v_digits;
end;
$$;

create or replace function public.can_access_crm()
returns boolean
language sql
stable
as $$
  select
    public.has_role('OWNER')
    or public.has_role('MANAGER')
    or public.has_role('RECEPTION')
$$;

create or replace function public.infer_follow_up_days(p_service_summary text)
returns int
language plpgsql
immutable
as $$
declare
  v_text text := lower(coalesce(p_service_summary, ''));
begin
  if v_text like '%gel%' or v_text like '%biab%' then
    return 21;
  end if;

  if v_text like '%extension%' or v_text like '%refill%' or v_text like '%up mong%' or v_text like '%dual form%' then
    return 18;
  end if;

  return 30;
end;
$$;

create or replace function public.append_customer_activity(
  p_org_id uuid,
  p_customer_id uuid,
  p_type text,
  p_channel text,
  p_content_summary text,
  p_created_by uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_customer_id is null or p_org_id is null or p_content_summary is null or btrim(p_content_summary) = '' then
    return;
  end if;

  insert into public.customer_activities (
    org_id,
    customer_id,
    type,
    channel,
    content_summary,
    created_by
  )
  values (
    p_org_id,
    p_customer_id,
    p_type,
    p_channel,
    p_content_summary,
    p_created_by
  );
end;
$$;

create or replace function public.upsert_customer_by_identity(
  p_org_id uuid,
  p_full_name text,
  p_phone text default null,
  p_source text default null,
  p_care_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_phone text := public.normalize_customer_phone(p_phone);
begin
  if p_org_id is null then
    raise exception 'ORG_REQUIRED';
  end if;

  if p_full_name is null or btrim(p_full_name) = '' then
    raise exception 'CUSTOMER_NAME_REQUIRED';
  end if;

  if v_phone is not null then
    select id
    into v_customer_id
    from public.customers
    where org_id = p_org_id
      and public.normalize_customer_phone(phone) = v_phone
      and merged_into_customer_id is null
    order by created_at asc
    limit 1;
  end if;

  if v_customer_id is null then
    select id
    into v_customer_id
    from public.customers
    where org_id = p_org_id
      and lower(trim(coalesce(full_name, name))) = lower(trim(p_full_name))
      and merged_into_customer_id is null
    order by created_at asc
    limit 1;
  end if;

  if v_customer_id is null then
    insert into public.customers (
      org_id,
      name,
      full_name,
      phone,
      notes,
      care_note,
      source
    )
    values (
      p_org_id,
      p_full_name,
      p_full_name,
      v_phone,
      p_care_note,
      p_care_note,
      p_source
    )
    returning id into v_customer_id;
  else
    update public.customers
    set
      full_name = coalesce(nullif(trim(full_name), ''), p_full_name),
      name = coalesce(name, p_full_name),
      phone = coalesce(phone, v_phone),
      source = coalesce(source, p_source),
      care_note = case
        when p_care_note is null or btrim(p_care_note) = '' then care_note
        when care_note is null or btrim(care_note) = '' then p_care_note
        when position(p_care_note in care_note) > 0 then care_note
        else care_note || E'\n' || p_care_note
      end
    where id = v_customer_id;
  end if;

  if v_phone is null then
    update public.customers
    set needs_merge_review = true
    where id = v_customer_id;
  end if;

  return v_customer_id;
end;
$$;

create or replace function public.refresh_customer_metrics(
  p_customer_id uuid default null,
  p_org_id uuid default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer record;
  v_updated int := 0;
  v_first_visit timestamptz;
  v_last_visit timestamptz;
  v_total_visits int;
  v_total_spend numeric(12,2);
  v_last_service_summary text;
  v_favorite_staff_user_id uuid;
  v_status text;
  v_next_follow_up_at timestamptz;
begin
  for v_customer in
    select c.id, c.org_id
    from public.customers c
    where (p_customer_id is null or c.id = p_customer_id)
      and (p_org_id is null or c.org_id = p_org_id)
      and c.merged_into_customer_id is null
  loop
    select min(a.start_at), max(a.start_at)
    into v_first_visit, v_last_visit
    from public.appointments a
    where a.customer_id = v_customer.id
      and a.status in ('BOOKED','CHECKED_IN','DONE');

    select
      coalesce(count(*), 0),
      coalesce(sum((t.totals_json->>'grand_total')::numeric), 0)
    into v_total_visits, v_total_spend
    from public.tickets t
    where t.customer_id = v_customer.id
      and t.status = 'CLOSED';

    if v_total_visits = 0 then
      select count(*)
      into v_total_visits
      from public.appointments a
      where a.customer_id = v_customer.id
        and a.status in ('DONE','CHECKED_IN');
    end if;

    select string_agg(distinct s.name, ', ' order by s.name)
    into v_last_service_summary
    from public.tickets t
    join public.ticket_items ti on ti.ticket_id = t.id
    left join public.services s on s.id = ti.service_id
    where t.customer_id = v_customer.id
      and t.status = 'CLOSED'
      and t.created_at = (
        select max(t2.created_at)
        from public.tickets t2
        where t2.customer_id = v_customer.id
          and t2.status = 'CLOSED'
      );

    select a.staff_user_id
    into v_favorite_staff_user_id
    from public.tickets t
    join public.appointments a on a.id = t.appointment_id
    where t.customer_id = v_customer.id
      and t.status = 'CLOSED'
      and a.staff_user_id is not null
    group by a.staff_user_id
    order by count(*) desc, max(t.created_at) desc
    limit 1;

    if v_total_spend >= 3000000 or v_total_visits >= 8 then
      v_status := 'VIP';
    elsif v_last_visit is not null and v_last_visit < now() - interval '60 days' then
      v_status := 'LOST';
    elsif v_last_visit is not null and v_last_visit < now() - interval '30 days' then
      v_status := 'AT_RISK';
    elsif v_total_visits >= 3 then
      v_status := 'RETURNING';
    elsif v_total_visits >= 1 then
      v_status := 'ACTIVE';
    else
      v_status := 'NEW';
    end if;

    if v_last_visit is not null then
      v_next_follow_up_at := v_last_visit + make_interval(days => public.infer_follow_up_days(v_last_service_summary));
    else
      v_next_follow_up_at := null;
    end if;

    update public.customers
    set
      full_name = coalesce(nullif(trim(full_name), ''), name),
      first_visit_at = v_first_visit,
      last_visit_at = v_last_visit,
      total_visits = coalesce(v_total_visits, 0),
      total_spend = coalesce(v_total_spend, 0),
      last_service_summary = v_last_service_summary,
      favorite_staff_user_id = v_favorite_staff_user_id,
      customer_status = v_status,
      next_follow_up_at = case
        when follow_up_status = 'DONE' then next_follow_up_at
        else coalesce(next_follow_up_at, v_next_follow_up_at)
      end
    where id = v_customer.id;

    v_updated := v_updated + 1;
  end loop;

  return v_updated;
end;
$$;

create or replace function public.list_customers_crm(
  p_search text default null,
  p_status text default null,
  p_dormant_days int default null,
  p_vip_only boolean default false,
  p_source text default null
)
returns table (
  id uuid,
  org_id uuid,
  full_name text,
  phone text,
  birthday date,
  gender text,
  first_visit_at timestamptz,
  last_visit_at timestamptz,
  total_visits int,
  total_spend numeric,
  last_service_summary text,
  favorite_staff_user_id uuid,
  customer_status text,
  tags text[],
  care_note text,
  source text,
  next_follow_up_at timestamptz,
  last_contacted_at timestamptz,
  follow_up_status text,
  needs_merge_review boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if not public.can_access_crm() then
    raise exception 'FORBIDDEN';
  end if;

  select public.my_org_id() into v_org_id;
  if v_org_id is null then
    raise exception 'ORG_NOT_FOUND';
  end if;

  return query
  select
    c.id,
    c.org_id,
    coalesce(nullif(trim(c.full_name), ''), c.name) as full_name,
    c.phone,
    c.birthday,
    c.gender,
    c.first_visit_at,
    c.last_visit_at,
    c.total_visits,
    c.total_spend,
    c.last_service_summary,
    c.favorite_staff_user_id,
    c.customer_status,
    c.tags,
    coalesce(c.care_note, c.notes) as care_note,
    c.source,
    c.next_follow_up_at,
    c.last_contacted_at,
    c.follow_up_status,
    c.needs_merge_review
  from public.customers c
  where c.org_id = v_org_id
    and c.merged_into_customer_id is null
    and (
      p_search is null
      or lower(coalesce(c.full_name, c.name, '')) like '%' || lower(p_search) || '%'
      or coalesce(public.normalize_customer_phone(c.phone), '') like '%' || coalesce(public.normalize_customer_phone(p_search), p_search) || '%'
    )
    and (p_status is null or c.customer_status = p_status)
    and (p_source is null or c.source = p_source)
    and (not p_vip_only or c.customer_status = 'VIP')
    and (
      p_dormant_days is null
      or c.last_visit_at is null
      or c.last_visit_at <= now() - make_interval(days => p_dormant_days)
    )
  order by c.last_visit_at desc nulls last, c.total_spend desc, c.created_at desc;
end;
$$;

create or replace function public.get_customer_crm_detail(p_customer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_customer jsonb;
  v_appointments jsonb;
  v_tickets jsonb;
  v_booking_requests jsonb;
  v_activities jsonb;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if not public.can_access_crm() and not public.has_role('TECH') then
    raise exception 'FORBIDDEN';
  end if;

  select public.my_org_id() into v_org_id;
  if v_org_id is null then
    raise exception 'ORG_NOT_FOUND';
  end if;

  select to_jsonb(x)
  into v_customer
  from (
    select
      c.id,
      c.org_id,
      coalesce(nullif(trim(c.full_name), ''), c.name) as full_name,
      c.phone,
      c.birthday,
      c.gender,
      c.first_visit_at,
      c.last_visit_at,
      c.total_visits,
      c.total_spend,
      c.last_service_summary,
      c.favorite_staff_user_id,
      c.customer_status,
      c.tags,
      coalesce(c.care_note, c.notes) as care_note,
      c.source,
      c.next_follow_up_at,
      c.last_contacted_at,
      c.follow_up_status,
      c.needs_merge_review
    from public.customers c
    where c.id = p_customer_id
      and c.org_id = v_org_id
      and c.merged_into_customer_id is null
  ) x;

  if v_customer is null then
    raise exception 'CUSTOMER_NOT_FOUND';
  end if;

  select coalesce(jsonb_agg(to_jsonb(a) order by a.start_at desc), '[]'::jsonb)
  into v_appointments
  from (
    select id, start_at, end_at, status, staff_user_id, resource_id
    from public.appointments
    where customer_id = p_customer_id
      and org_id = v_org_id
    order by start_at desc
    limit 50
  ) a;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc), '[]'::jsonb)
  into v_tickets
  from (
    select
      t.id,
      t.status,
      t.created_at,
      t.appointment_id,
      t.totals_json,
      (
        select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc), '[]'::jsonb)
        from (
          select public_token, expires_at, created_at
          from public.receipts
          where ticket_id = t.id
          order by created_at desc
          limit 3
        ) r
      ) as receipts
    from public.tickets t
    where t.customer_id = p_customer_id
      and t.org_id = v_org_id
    order by t.created_at desc
    limit 50
  ) t;

  select coalesce(jsonb_agg(to_jsonb(b) order by b.created_at desc), '[]'::jsonb)
  into v_booking_requests
  from (
    select
      br.id,
      br.customer_name,
      br.customer_phone,
      br.requested_service,
      br.requested_start_at,
      br.requested_end_at,
      br.source,
      br.status,
      br.created_at
    from public.booking_requests br
    join public.customers c on c.id = p_customer_id
    where br.org_id = v_org_id
      and (
        public.normalize_customer_phone(br.customer_phone) = public.normalize_customer_phone(c.phone)
        or lower(trim(br.customer_name)) = lower(trim(coalesce(c.full_name, c.name)))
      )
    order by br.created_at desc
    limit 50
  ) b;

  select coalesce(jsonb_agg(to_jsonb(ca) order by ca.created_at desc), '[]'::jsonb)
  into v_activities
  from (
    select id, customer_id, type, channel, content_summary, created_by, created_at
    from public.customer_activities
    where customer_id = p_customer_id
    order by created_at desc
    limit 100
  ) ca;

  return jsonb_build_object(
    'customer', v_customer,
    'appointments', v_appointments,
    'tickets', v_tickets,
    'booking_requests', v_booking_requests,
    'activities', v_activities
  );
end;
$$;

create or replace function public.update_customer_care_note(
  p_customer_id uuid,
  p_care_note text,
  p_tags text[] default '{}'::text[],
  p_next_follow_up_at timestamptz default null,
  p_follow_up_status text default 'PENDING'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if not public.can_access_crm() then
    raise exception 'FORBIDDEN';
  end if;

  select public.my_org_id() into v_org_id;

  update public.customers
  set
    care_note = p_care_note,
    tags = coalesce(p_tags, '{}'::text[]),
    next_follow_up_at = p_next_follow_up_at,
    follow_up_status = coalesce(p_follow_up_status, 'PENDING'),
    last_contacted_at = now()
  where id = p_customer_id
    and org_id = v_org_id;

  if not found then
    raise exception 'CUSTOMER_NOT_FOUND';
  end if;

  perform public.append_customer_activity(
    v_org_id,
    p_customer_id,
    'FOLLOW_UP_NOTE',
    'MANUAL',
    coalesce(nullif(trim(p_care_note), ''), 'Cáº­p nháº­t ghi chÃº chÄƒm sÃ³c'),
    auth.uid()
  );

  return jsonb_build_object('ok', true, 'customer_id', p_customer_id);
end;
$$;

create or replace function public.list_follow_up_candidates(
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table (
  id uuid,
  org_id uuid,
  full_name text,
  phone text,
  birthday date,
  gender text,
  first_visit_at timestamptz,
  last_visit_at timestamptz,
  total_visits int,
  total_spend numeric,
  last_service_summary text,
  favorite_staff_user_id uuid,
  customer_status text,
  tags text[],
  care_note text,
  source text,
  next_follow_up_at timestamptz,
  last_contacted_at timestamptz,
  follow_up_status text,
  needs_merge_review boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if not public.can_access_crm() then
    raise exception 'FORBIDDEN';
  end if;

  select public.my_org_id() into v_org_id;

  return query
  select
    c.id,
    c.org_id,
    coalesce(nullif(trim(c.full_name), ''), c.name) as full_name,
    c.phone,
    c.birthday,
    c.gender,
    c.first_visit_at,
    c.last_visit_at,
    c.total_visits,
    c.total_spend,
    c.last_service_summary,
    c.favorite_staff_user_id,
    c.customer_status,
    c.tags,
    coalesce(c.care_note, c.notes) as care_note,
    c.source,
    c.next_follow_up_at,
    c.last_contacted_at,
    c.follow_up_status,
    c.needs_merge_review
  from public.customers c
  where c.org_id = v_org_id
    and c.next_follow_up_at is not null
    and (p_from is null or c.next_follow_up_at >= p_from)
    and (p_to is null or c.next_follow_up_at <= p_to)
    and coalesce(c.follow_up_status, 'PENDING') <> 'DONE'
  order by c.next_follow_up_at asc, c.total_spend desc;
end;
$$;

create or replace function public.crm_ticket_after_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.customer_id is not null and new.status = 'CLOSED' then
    perform public.refresh_customer_metrics(new.customer_id, null);
    perform public.append_customer_activity(
      new.org_id,
      new.customer_id,
      'CHECKOUT',
      'APP',
      'Thanh toÃ¡n thÃ nh cÃ´ng, tá»•ng bill ' || coalesce(new.totals_json->>'grand_total', '0'),
      auth.uid()
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_crm_ticket_after_insert on public.tickets;
create trigger trg_crm_ticket_after_insert
after insert on public.tickets
for each row
execute function public.crm_ticket_after_change();

create or replace function public.crm_appointment_after_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.customer_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    perform public.append_customer_activity(
      new.org_id,
      new.customer_id,
      'APPOINTMENT',
      'APP',
      'Táº¡o lá»‹ch háº¹n ' || to_char(new.start_at at time zone 'Asia/Bangkok', 'DD/MM HH24:MI'),
      auth.uid()
    );
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    perform public.append_customer_activity(
      new.org_id,
      new.customer_id,
      'APPOINTMENT',
      'APP',
      'Cáº­p nháº­t lá»‹ch háº¹n sang tráº¡ng thÃ¡i ' || new.status,
      auth.uid()
    );
  end if;

  perform public.refresh_customer_metrics(new.customer_id, null);
  return new;
end;
$$;

drop trigger if exists trg_crm_appointment_after_insert on public.appointments;
create trigger trg_crm_appointment_after_insert
after insert on public.appointments
for each row
execute function public.crm_appointment_after_change();

drop trigger if exists trg_crm_appointment_after_update on public.appointments;
create trigger trg_crm_appointment_after_update
after update of status on public.appointments
for each row
execute function public.crm_appointment_after_change();

create or replace function public.create_booking_request_public(
  p_customer_name text,
  p_customer_phone text,
  p_requested_service text default null,
  p_preferred_staff text default null,
  p_note text default null,
  p_requested_start_at timestamptz default null,
  p_requested_end_at timestamptz default null,
  p_source text default 'landing_page'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_branch_id uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_row public.booking_requests;
  v_customer_id uuid;
begin
  if p_customer_name is null or btrim(p_customer_name) = '' then
    raise exception 'CUSTOMER_NAME_REQUIRED';
  end if;

  if p_customer_phone is null or btrim(p_customer_phone) = '' then
    raise exception 'CUSTOMER_PHONE_REQUIRED';
  end if;

  if p_requested_start_at is null then
    raise exception 'REQUESTED_START_REQUIRED';
  end if;

  v_start := p_requested_start_at;
  v_end := coalesce(p_requested_end_at, p_requested_start_at + interval '60 minutes');

  if v_end <= v_start then
    raise exception 'INVALID_TIME_RANGE';
  end if;

  select id into v_org_id
  from public.orgs
  order by created_at asc
  limit 1;

  if v_org_id is null then
    raise exception 'ORG_NOT_FOUND';
  end if;

  select id into v_branch_id
  from public.branches
  where org_id = v_org_id
  order by created_at asc
  limit 1;

  if v_branch_id is null then
    raise exception 'BRANCH_NOT_FOUND';
  end if;

  insert into public.booking_requests (
    org_id,
    branch_id,
    customer_name,
    customer_phone,
    requested_service,
    preferred_staff,
    note,
    requested_start_at,
    requested_end_at,
    source,
    status
  )
  values (
    v_org_id,
    v_branch_id,
    p_customer_name,
    public.normalize_customer_phone(p_customer_phone),
    p_requested_service,
    p_preferred_staff,
    p_note,
    v_start,
    v_end,
    coalesce(nullif(trim(p_source), ''), 'landing_page'),
    'NEW'
  )
  returning * into v_row;

  v_customer_id := public.upsert_customer_by_identity(
    v_org_id,
    p_customer_name,
    p_customer_phone,
    coalesce(nullif(trim(p_source), ''), 'landing_page'),
    p_note
  );

  perform public.append_customer_activity(
    v_org_id,
    v_customer_id,
    'BOOKING_REQUEST',
    'WEB',
    'Táº¡o yÃªu cáº§u Ä‘áº·t lá»‹ch ' || to_char(v_start at time zone 'Asia/Bangkok', 'DD/MM HH24:MI'),
    null
  );

  return jsonb_build_object(
    'booking_request_id', v_row.id,
    'status', v_row.status
  );
end;
$$;

create or replace function public.convert_booking_request_to_appointment_secure(
  p_booking_request_id uuid,
  p_staff_user_id uuid default null,
  p_resource_id uuid default null,
  p_start_at timestamptz default null,
  p_end_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_org_id uuid;
  v_branch_id uuid;
  v_allowed boolean;
  v_req public.booking_requests;
  v_customer_id uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_appointment_id uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select p.org_id, p.default_branch_id into v_org_id, v_branch_id
  from public.profiles p
  where p.user_id = v_uid
  limit 1;

  if v_org_id is null then
    raise exception 'ORG_CONTEXT_REQUIRED';
  end if;

  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = v_uid
      and ur.org_id = v_org_id
      and ur.role in ('OWNER', 'MANAGER', 'RECEPTION')
  ) into v_allowed;

  if not v_allowed then
    raise exception 'FORBIDDEN';
  end if;

  select *
  into v_req
  from public.booking_requests
  where id = p_booking_request_id
    and org_id = v_org_id;

  if not found then
    raise exception 'BOOKING_REQUEST_NOT_FOUND';
  end if;

  if v_req.status = 'CONVERTED' then
    raise exception 'BOOKING_REQUEST_ALREADY_CONVERTED';
  end if;

  v_start := coalesce(p_start_at, v_req.requested_start_at);
  v_end := coalesce(p_end_at, v_req.requested_end_at, v_start + interval '60 minutes');

  if v_end <= v_start then
    raise exception 'INVALID_TIME_RANGE';
  end if;

  v_customer_id := public.upsert_customer_by_identity(
    v_org_id,
    v_req.customer_name,
    v_req.customer_phone,
    v_req.source,
    v_req.note
  );

  insert into public.appointments (
    org_id,
    branch_id,
    customer_id,
    staff_user_id,
    resource_id,
    start_at,
    end_at,
    status
  )
  values (
    v_org_id,
    coalesce(v_req.branch_id, v_branch_id),
    v_customer_id,
    p_staff_user_id,
    p_resource_id,
    v_start,
    v_end,
    'BOOKED'
  )
  returning id into v_appointment_id;

  update public.booking_requests
  set
    appointment_id = v_appointment_id,
    status = 'CONVERTED'
  where id = v_req.id;

  perform public.refresh_customer_metrics(v_customer_id, null);

  return jsonb_build_object(
    'booking_request_id', v_req.id,
    'appointment_id', v_appointment_id,
    'status', 'CONVERTED'
  );
end;
$$;

grant execute on function public.append_customer_activity(uuid, uuid, text, text, text, uuid) to authenticated, service_role;
grant execute on function public.upsert_customer_by_identity(uuid, text, text, text, text) to authenticated, service_role;
grant execute on function public.refresh_customer_metrics(uuid, uuid) to authenticated, service_role;
grant execute on function public.list_customers_crm(text, text, int, boolean, text) to authenticated;
grant execute on function public.get_customer_crm_detail(uuid) to authenticated;
grant execute on function public.update_customer_care_note(uuid, text, text[], timestamptz, text) to authenticated;
grant execute on function public.list_follow_up_candidates(timestamptz, timestamptz) to authenticated;


-- ===== BEGIN fix_convert_booking_request_secure.sql =====
create or replace function public.convert_booking_request_to_appointment_secure(
  p_booking_request_id uuid,
  p_staff_user_id uuid default null,
  p_resource_id uuid default null,
  p_start_at timestamptz default null,
  p_end_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_org_id uuid;
  v_branch_id uuid;
  v_allowed boolean;
  v_req public.booking_requests;
  v_customer_id uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_appointment_id uuid;
  v_target_branch_id uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select p.org_id, p.default_branch_id
  into v_org_id, v_branch_id
  from public.profiles p
  where p.user_id = v_uid
  limit 1;

  if v_org_id is null then
    raise exception 'ORG_CONTEXT_REQUIRED';
  end if;

  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = v_uid
      and ur.org_id = v_org_id
      and ur.role in ('OWNER', 'MANAGER', 'RECEPTION', 'TECH')
  ) into v_allowed;

  if not coalesce(v_allowed, false) then
    raise exception 'FORBIDDEN';
  end if;

  select *
  into v_req
  from public.booking_requests
  where id = p_booking_request_id
    and org_id = v_org_id
  limit 1;

  if v_req.id is null then
    raise exception 'BOOKING_REQUEST_NOT_FOUND';
  end if;

  if v_req.status in ('CANCELLED', 'CONVERTED') then
    raise exception 'BOOKING_REQUEST_ALREADY_FINALIZED';
  end if;

  v_start := coalesce(p_start_at, v_req.requested_start_at);
  v_end := coalesce(p_end_at, v_req.requested_end_at, v_start + interval '60 minutes');

  if v_start is null then
    raise exception 'BOOKING_START_REQUIRED';
  end if;

  if v_end <= v_start then
    raise exception 'INVALID_TIME_RANGE';
  end if;

  v_target_branch_id := coalesce(v_req.branch_id, v_branch_id);
  if v_target_branch_id is null then
    raise exception 'DEFAULT_BRANCH_REQUIRED';
  end if;

  v_customer_id := public.upsert_customer_by_identity(
    v_org_id,
    v_req.customer_name,
    v_req.customer_phone,
    v_req.source,
    v_req.note
  );

  update public.booking_requests
  set
    requested_start_at = v_start,
    requested_end_at = v_end,
    branch_id = v_target_branch_id
  where id = v_req.id;

  insert into public.appointments (
    org_id,
    branch_id,
    customer_id,
    staff_user_id,
    resource_id,
    start_at,
    end_at,
    status
  )
  values (
    v_org_id,
    v_target_branch_id,
    v_customer_id,
    p_staff_user_id,
    p_resource_id,
    v_start,
    v_end,
    'BOOKED'
  )
  returning id into v_appointment_id;

  update public.booking_requests
  set
    appointment_id = v_appointment_id,
    status = 'CONVERTED'
  where id = v_req.id;

  perform public.refresh_customer_metrics(v_customer_id, null);

  return jsonb_build_object(
    'booking_request_id', v_req.id,
    'appointment_id', v_appointment_id,
    'status', 'CONVERTED',
    'start_at', v_start,
    'end_at', v_end,
    'branch_id', v_target_branch_id
  );
end;
$$;

grant execute on function public.convert_booking_request_to_appointment_secure(
  uuid, uuid, uuid, timestamptz, timestamptz
) to authenticated;


-- ===== BEGIN app_sessions.sql =====
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


-- ===== BEGIN fresh_project_patch.sql =====
create or replace function public.ensure_default_workspace()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_default_org_id constant uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_default_branch_id constant uuid := '00000000-0000-0000-0000-000000000101'::uuid;
  v_org_id uuid;
  v_branch_id uuid;
begin
  select id
  into v_org_id
  from public.orgs
  where id <> v_default_org_id
  order by created_at asc, id asc
  limit 1;

  if v_org_id is null then
    select id
    into v_org_id
    from public.orgs
    order by created_at asc, id asc
    limit 1;
  end if;

  if v_org_id is null then
    v_org_id := v_default_org_id;

    insert into public.orgs (id, name)
    values (v_org_id, 'Nails App Default Org')
    on conflict (id) do update
      set name = excluded.name;
  end if;

  select id
  into v_branch_id
  from public.branches
  where org_id = v_org_id
  order by created_at asc, id asc
  limit 1;

  if v_branch_id is null then
    v_branch_id := case
      when v_org_id = v_default_org_id then v_default_branch_id
      else gen_random_uuid()
    end;

    insert into public.branches (id, org_id, name, timezone, currency)
    values (
      v_branch_id,
      v_org_id,
      case when v_org_id = v_default_org_id then 'Main Branch' else 'Primary Branch' end,
      'Asia/Bangkok',
      'VND'
    )
    on conflict (id) do update
      set
        org_id = excluded.org_id,
        name = excluded.name,
        timezone = excluded.timezone,
        currency = excluded.currency;
  end if;

  return jsonb_build_object(
    'org_id', v_org_id,
    'branch_id', v_branch_id
  );
end;
$$;

select public.ensure_default_workspace();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace jsonb;
  v_org_id uuid;
  v_branch_id uuid;
  v_role text;
  v_display_name text;
  v_phone text;
  v_registration_mode text;
  v_auth_provider text;
begin
  v_workspace := public.ensure_default_workspace();
  v_org_id := (v_workspace ->> 'org_id')::uuid;
  v_branch_id := (v_workspace ->> 'branch_id')::uuid;
  v_auth_provider := lower(coalesce(new.raw_app_meta_data ->> 'provider', 'email'));
  v_registration_mode := upper(
    coalesce(
      new.raw_user_meta_data ->> 'registration_mode',
      case
        when v_auth_provider in ('google', 'apple') then 'USER'
        else 'ADMIN'
      end
    )
  );

  v_display_name := nullif(
    trim(
      coalesce(
        new.raw_user_meta_data ->> 'display_name',
        new.raw_user_meta_data ->> 'full_name',
        ''
      )
    ),
    ''
  );

  if v_display_name is null then
    v_display_name := coalesce(nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'User');
  end if;

  v_phone := nullif(trim(coalesce(new.phone, new.raw_user_meta_data ->> 'phone', '')), '');

  insert into public.profiles (
    user_id,
    org_id,
    default_branch_id,
    display_name,
    email,
    phone
  )
  values (
    new.id,
    v_org_id,
    v_branch_id,
    v_display_name,
    new.email,
    v_phone
  )
  on conflict (user_id) do update
    set
      org_id = coalesce(public.profiles.org_id, excluded.org_id),
      default_branch_id = coalesce(public.profiles.default_branch_id, excluded.default_branch_id),
      display_name = coalesce(nullif(public.profiles.display_name, ''), excluded.display_name),
      email = coalesce(excluded.email, public.profiles.email),
      phone = coalesce(excluded.phone, public.profiles.phone);

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
  values (new.id, v_org_id, v_role)
  on conflict (user_id, org_id, role) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();


-- ===== BEGIN customer_content_feed_2026_04.sql =====
create table if not exists public.customer_content_posts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  source_platform text not null default 'telegram',
  source_message_id text,
  title text not null,
  summary text not null default '',
  body text not null default '',
  cover_image_url text,
  content_type text not null default 'trend' check (content_type in ('trend', 'care', 'news', 'offer_hint')),
  status text not null default 'draft' check (status in ('draft', 'approved', 'published', 'archived')),
  published_at timestamptz,
  priority int not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_customer_content_posts_source_message
  on public.customer_content_posts (source_platform, source_message_id)
  where source_message_id is not null;

create index if not exists idx_customer_content_posts_org_status_published
  on public.customer_content_posts (org_id, status, priority asc, published_at desc nulls last);

alter table public.customer_content_posts enable row level security;

drop policy if exists "service role full access customer content posts" on public.customer_content_posts;
create policy "service role full access customer content posts" on public.customer_content_posts
for all
to service_role
using (true)
with check (true);

drop policy if exists "authenticated read published customer content posts" on public.customer_content_posts;
create policy "authenticated read published customer content posts" on public.customer_content_posts
for select
to authenticated
using (status = 'published');

drop policy if exists "anon read published customer content posts" on public.customer_content_posts;
create policy "anon read published customer content posts" on public.customer_content_posts
for select
to anon
using (status = 'published');

drop policy if exists "authenticated read active marketing offers" on public.marketing_offers;
create policy "authenticated read active marketing offers" on public.marketing_offers
for select
to authenticated
using (
  is_active = true
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at >= now())
);

drop policy if exists "anon read active marketing offers" on public.marketing_offers;
create policy "anon read active marketing offers" on public.marketing_offers
for select
to anon
using (
  is_active = true
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at >= now())
);

drop trigger if exists trg_customer_content_posts_updated_at on public.customer_content_posts;
create trigger trg_customer_content_posts_updated_at
before update on public.customer_content_posts
for each row
execute function public.touch_updated_at();
-- ===== END customer_content_feed_2026_04.sql =====
