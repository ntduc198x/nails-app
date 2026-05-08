-- Customer mobile schema extension
-- Apply after:
--   1. bootstrap.sql
--   2. crm_patch_2026_04.sql
--   3. app_sessions.sql (or deploy.sql if it already includes app sessions)
--
-- Purpose:
-- - Keep the current staff/CRM schema intact
-- - Add customer-facing entities used by app/(customer)
-- - Bridge auth profiles with CRM customers through a stable mapping table

create extension if not exists "pgcrypto";

alter table public.profiles
  add column if not exists birth_date date,
  add column if not exists address text,
  add column if not exists avatar_url text,
  add column if not exists marketing_opt_in boolean not null default false,
  add column if not exists push_opt_in boolean not null default true;

create table if not exists public.customer_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(user_id) on delete cascade,
  customer_id uuid not null unique references public.customers(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  linked_by text not null default 'PHONE_MATCH' check (linked_by in ('MANUAL','PHONE_MATCH','EMAIL_MATCH','ADMIN')),
  created_at timestamptz not null default now(),
  constraint customer_accounts_org_match
    check (org_id is not null)
);

create index if not exists idx_customer_accounts_org_customer
  on public.customer_accounts (org_id, customer_id);

create table if not exists public.customer_notification_preferences (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  push_enabled boolean not null default true,
  sound_enabled boolean not null default true,
  vibration_enabled boolean not null default false,
  dark_mode_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  label text not null,
  contact_name text,
  contact_phone text,
  address_line_1 text not null,
  address_line_2 text,
  ward text,
  district text,
  city text,
  postal_code text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_customer_addresses_user_default
  on public.customer_addresses (user_id, is_default desc, created_at desc);

create table if not exists public.customer_payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  provider text not null check (provider in ('CASH','BANK_TRANSFER','MOMO','ZALOPAY','VNPAY','CARD')),
  label text not null,
  masked_value text,
  holder_name text,
  expires_at date,
  is_default boolean not null default false,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_customer_payment_methods_user
  on public.customer_payment_methods (user_id, is_default desc, created_at desc);

create table if not exists public.customer_favorite_services (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, service_id)
);

create index if not exists idx_customer_favorite_services_org_service
  on public.customer_favorite_services (org_id, service_id);

create table if not exists public.customer_service_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  org_id uuid not null references public.orgs(id) on delete cascade,
  appointment_id uuid unique references public.appointments(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  rating int not null check (rating between 1 and 5),
  title text,
  content text,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_customer_service_reviews_user_created
  on public.customer_service_reviews (user_id, created_at desc);

create table if not exists public.membership_tiers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  spending_threshold numeric(12,2) not null default 0,
  visit_threshold int not null default 0,
  accent_color text,
  perks jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (org_id, code)
);

create table if not exists public.customer_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(user_id) on delete cascade,
  customer_id uuid unique references public.customers(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  tier_id uuid not null references public.membership_tiers(id) on delete restrict,
  points_balance int not null default 0,
  lifetime_points int not null default 0,
  total_spent numeric(12,2) not null default 0,
  total_visits int not null default 0,
  joined_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_customer_memberships_org_tier
  on public.customer_memberships (org_id, tier_id);

create table if not exists public.marketing_offers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  title text not null,
  description text,
  image_url text,
  badge text,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  offer_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_marketing_offers_org_active
  on public.marketing_offers (org_id, is_active, starts_at desc nulls last);

create table if not exists public.customer_offer_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  offer_id uuid not null references public.marketing_offers(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  status text not null default 'SAVED' check (status in ('SAVED','CLAIMED','USED','EXPIRED','CANCELLED')),
  claimed_at timestamptz,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, offer_id)
);

create table if not exists public.customer_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  title text not null,
  body text not null,
  kind text not null default 'GENERAL' check (kind in ('GENERAL','BOOKING','PROMOTION','MEMBERSHIP','PAYMENT')),
  related_offer_id uuid references public.marketing_offers(id) on delete set null,
  related_appointment_id uuid references public.appointments(id) on delete set null,
  is_read boolean not null default false,
  sent_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists idx_customer_notifications_user_sent
  on public.customer_notifications (user_id, is_read, sent_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_customer_notification_preferences_updated_at on public.customer_notification_preferences;
create trigger trg_customer_notification_preferences_updated_at
before update on public.customer_notification_preferences
for each row
execute function public.touch_updated_at();

drop trigger if exists trg_customer_addresses_updated_at on public.customer_addresses;
create trigger trg_customer_addresses_updated_at
before update on public.customer_addresses
for each row
execute function public.touch_updated_at();

drop trigger if exists trg_customer_payment_methods_updated_at on public.customer_payment_methods;
create trigger trg_customer_payment_methods_updated_at
before update on public.customer_payment_methods
for each row
execute function public.touch_updated_at();

drop trigger if exists trg_customer_service_reviews_updated_at on public.customer_service_reviews;
create trigger trg_customer_service_reviews_updated_at
before update on public.customer_service_reviews
for each row
execute function public.touch_updated_at();

drop trigger if exists trg_customer_memberships_updated_at on public.customer_memberships;
create trigger trg_customer_memberships_updated_at
before update on public.customer_memberships
for each row
execute function public.touch_updated_at();

create or replace function public.my_customer_id()
returns uuid
language sql
stable
as $$
  select ca.customer_id
  from public.customer_accounts ca
  where ca.user_id = auth.uid()
  limit 1
$$;

create or replace function public.link_customer_account_by_phone()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_customer_id uuid;
  v_existing_account_id uuid;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select *
  into v_profile
  from public.profiles
  where user_id = auth.uid()
  limit 1;

  if v_profile.user_id is null then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  select id
  into v_customer_id
  from public.customers
  where org_id = v_profile.org_id
    and public.normalize_customer_phone(phone) = public.normalize_customer_phone(v_profile.phone)
    and merged_into_customer_id is null
  order by total_visits desc, total_spend desc, created_at asc
  limit 1;

  if v_customer_id is null then
    insert into public.customers (
      org_id,
      name,
      full_name,
      phone,
      source
    )
    values (
      v_profile.org_id,
      coalesce(nullif(trim(v_profile.display_name), ''), coalesce(v_profile.email, 'Customer')),
      coalesce(nullif(trim(v_profile.display_name), ''), coalesce(v_profile.email, 'Customer')),
      public.normalize_customer_phone(v_profile.phone),
      'APP_SIGNUP'
    )
    returning id into v_customer_id;
  end if;

  select id
  into v_existing_account_id
  from public.customer_accounts
  where user_id = v_profile.user_id
     or customer_id = v_customer_id
  order by case when user_id = v_profile.user_id then 0 else 1 end, created_at asc
  limit 1;

  if v_existing_account_id is not null then
    update public.customer_accounts
    set
      user_id = v_profile.user_id,
      customer_id = v_customer_id,
      org_id = v_profile.org_id,
      linked_by = 'PHONE_MATCH'
    where id = v_existing_account_id;
  else
    insert into public.customer_accounts (
      user_id,
      customer_id,
      org_id,
      linked_by
    )
    values (
      v_profile.user_id,
      v_customer_id,
      v_profile.org_id,
      'PHONE_MATCH'
    );
  end if;

  return v_customer_id;
end;
$$;

alter table public.customer_accounts enable row level security;
alter table public.customer_notification_preferences enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.customer_payment_methods enable row level security;
alter table public.customer_favorite_services enable row level security;
alter table public.customer_service_reviews enable row level security;
alter table public.customer_memberships enable row level security;
alter table public.membership_tiers enable row level security;
alter table public.marketing_offers enable row level security;
alter table public.customer_offer_claims enable row level security;
alter table public.customer_notifications enable row level security;

drop policy if exists "customer accounts own select" on public.customer_accounts;
create policy "customer accounts own select" on public.customer_accounts
for select using (user_id = auth.uid());

drop policy if exists "customer notification preferences own all" on public.customer_notification_preferences;
create policy "customer notification preferences own all" on public.customer_notification_preferences
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "customer addresses own all" on public.customer_addresses;
create policy "customer addresses own all" on public.customer_addresses
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "customer payment methods own all" on public.customer_payment_methods;
create policy "customer payment methods own all" on public.customer_payment_methods
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "customer favorites own all" on public.customer_favorite_services;
create policy "customer favorites own all" on public.customer_favorite_services
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "customer reviews own all" on public.customer_service_reviews;
create policy "customer reviews own all" on public.customer_service_reviews
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "customer memberships own read" on public.customer_memberships;
create policy "customer memberships own read" on public.customer_memberships
for select using (user_id = auth.uid());

drop policy if exists "customer offers own all" on public.customer_offer_claims;
create policy "customer offers own all" on public.customer_offer_claims
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "customer notifications own read update" on public.customer_notifications;
create policy "customer notifications own read update" on public.customer_notifications
for select using (user_id = auth.uid());

drop policy if exists "customer notifications own update" on public.customer_notifications;
create policy "customer notifications own update" on public.customer_notifications
for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "customer can read active tiers" on public.membership_tiers;
create policy "customer can read active tiers" on public.membership_tiers
for select using (is_active = true);

drop policy if exists "customer can read active offers" on public.marketing_offers;
create policy "customer can read active offers" on public.marketing_offers
for select using (is_active = true and (ends_at is null or ends_at >= now()));

grant execute on function public.link_customer_account_by_phone() to authenticated;

