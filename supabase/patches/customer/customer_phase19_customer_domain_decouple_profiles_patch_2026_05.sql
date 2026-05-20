-- Phase 19 customer domain decouple profiles patch
-- Goal: all customer-facing runtime tables must anchor on customers/customer_accounts,
-- not on public.profiles. auth.users is only for login identity mapping.

begin;

-- 1) customer_accounts stays as the auth<->customer bridge, but must never depend on profiles.
alter table public.customer_accounts
  drop constraint if exists customer_accounts_user_id_fkey;

alter table public.customer_accounts
  add constraint customer_accounts_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

-- 2) customer_memberships: customer_id is the business key. user_id becomes optional legacy metadata.
alter table public.customer_memberships
  add column if not exists customer_id uuid references public.customers(id) on delete cascade;

update public.customer_memberships cm
set customer_id = ca.customer_id
from public.customer_accounts ca
where cm.customer_id is null
  and ca.user_id = cm.user_id
  and ca.org_id = cm.org_id;

alter table public.customer_memberships
  drop constraint if exists customer_memberships_user_id_key;

alter table public.customer_memberships
  alter column customer_id set not null;

alter table public.customer_memberships
  drop constraint if exists customer_memberships_customer_id_key;

create unique index if not exists idx_customer_memberships_customer_unique
  on public.customer_memberships (customer_id);

alter table public.customer_memberships
  drop constraint if exists customer_memberships_user_id_fkey;

alter table public.customer_memberships
  alter column user_id drop not null;

-- 3) customer_notification_preferences: customer_id is the business key.
alter table public.customer_notification_preferences
  add column if not exists customer_id uuid references public.customers(id) on delete cascade,
  add column if not exists language text not null default 'vi';

update public.customer_notification_preferences cnp
set customer_id = ca.customer_id
from public.customer_accounts ca
where cnp.customer_id is null
  and ca.user_id = cnp.user_id
  and ca.org_id = cnp.org_id;

alter table public.customer_notification_preferences
  alter column customer_id set not null;

alter table public.customer_notification_preferences
  drop constraint if exists customer_notification_preferences_pkey;

alter table public.customer_notification_preferences
  add constraint customer_notification_preferences_pkey primary key (customer_id);

alter table public.customer_notification_preferences
  drop constraint if exists customer_notification_preferences_user_id_fkey;

alter table public.customer_notification_preferences
  alter column user_id drop not null;

create unique index if not exists idx_customer_notification_preferences_customer_unique
  on public.customer_notification_preferences (customer_id);

-- 4) customer_offer_claims: customer_id is the ownership key; user_id optional for auth trace only.
alter table public.customer_offer_claims
  add column if not exists customer_id uuid references public.customers(id) on delete cascade;

update public.customer_offer_claims coc
set customer_id = ca.customer_id
from public.customer_accounts ca
where coc.customer_id is null
  and ca.user_id = coc.user_id
  and ca.org_id = coc.org_id;

with offer_claim_dupes as (
  select ctid,
         row_number() over (
           partition by customer_id, offer_id
           order by created_at asc, id asc
         ) as rn
  from public.customer_offer_claims
  where customer_id is not null
)
delete from public.customer_offer_claims target
using offer_claim_dupes d
where target.ctid = d.ctid
  and d.rn > 1;

alter table public.customer_offer_claims
  alter column customer_id set not null;

alter table public.customer_offer_claims
  drop constraint if exists customer_offer_claims_user_id_offer_id_key;

alter table public.customer_offer_claims
  drop constraint if exists customer_offer_claims_user_id_fkey;

alter table public.customer_offer_claims
  alter column user_id drop not null;

create unique index if not exists idx_customer_offer_claims_customer_offer_unique
  on public.customer_offer_claims (customer_id, offer_id);

-- 5) customer_notifications: customer_id is mandatory; user_id stays nullable only for delivery tracing.
alter table public.customer_notifications
  add column if not exists customer_id uuid references public.customers(id) on delete cascade;

update public.customer_notifications cn
set customer_id = ca.customer_id
from public.customer_accounts ca
where cn.customer_id is null
  and cn.user_id = ca.user_id
  and cn.org_id = ca.org_id;

alter table public.customer_notifications
  alter column customer_id set not null;

alter table public.customer_notifications
  drop constraint if exists customer_notifications_user_id_fkey;

alter table public.customer_notifications
  alter column user_id drop not null;

create index if not exists idx_customer_notifications_customer_sent
  on public.customer_notifications (customer_id, is_read, sent_at desc);

-- 6) customer_addresses / payment methods / reviews move to customer ownership.
alter table public.customer_addresses
  add column if not exists customer_id uuid references public.customers(id) on delete cascade;

update public.customer_addresses a
set customer_id = ca.customer_id
from public.customer_accounts ca
where a.customer_id is null
  and a.user_id = ca.user_id
  and a.org_id = ca.org_id;

alter table public.customer_addresses
  alter column customer_id set not null;

alter table public.customer_addresses
  drop constraint if exists customer_addresses_user_id_fkey;

alter table public.customer_addresses
  alter column user_id drop not null;

create index if not exists idx_customer_addresses_customer_default
  on public.customer_addresses (customer_id, is_default desc, created_at desc);

alter table public.customer_payment_methods
  add column if not exists customer_id uuid references public.customers(id) on delete cascade;

update public.customer_payment_methods pm
set customer_id = ca.customer_id
from public.customer_accounts ca
where pm.customer_id is null
  and pm.user_id = ca.user_id
  and pm.org_id = ca.org_id;

alter table public.customer_payment_methods
  alter column customer_id set not null;

alter table public.customer_payment_methods
  drop constraint if exists customer_payment_methods_user_id_fkey;

alter table public.customer_payment_methods
  alter column user_id drop not null;

create index if not exists idx_customer_payment_methods_customer
  on public.customer_payment_methods (customer_id, is_default desc, created_at desc);

alter table public.customer_service_reviews
  add column if not exists customer_id uuid references public.customers(id) on delete set null;

update public.customer_service_reviews sr
set customer_id = ca.customer_id
from public.customer_accounts ca
where sr.customer_id is null
  and sr.user_id = ca.user_id
  and sr.org_id = ca.org_id;

alter table public.customer_service_reviews
  drop constraint if exists customer_service_reviews_user_id_fkey;

alter table public.customer_service_reviews
  alter column user_id drop not null;

create index if not exists idx_customer_service_reviews_customer_created
  on public.customer_service_reviews (customer_id, created_at desc);

-- 7) customer_favorite_services: align fully with customer_id.
alter table public.customer_favorite_services
  add column if not exists customer_id uuid references public.customers(id) on delete cascade;

update public.customer_favorite_services cfs
set customer_id = ca.customer_id
from public.customer_accounts ca
where cfs.customer_id is null
  and ca.user_id = cfs.user_id
  and ca.org_id = cfs.org_id;

alter table public.customer_favorite_services
  alter column customer_id set not null;

alter table public.customer_favorite_services
  drop constraint if exists customer_favorite_services_user_id_fkey;

create unique index if not exists idx_customer_favorite_services_customer_service_unique
  on public.customer_favorite_services (customer_id, service_id);

-- 8) RLS/policies must resolve ownership through customer_accounts -> customer_id.
alter table public.customer_memberships enable row level security;
alter table public.customer_notification_preferences enable row level security;
alter table public.customer_offer_claims enable row level security;
alter table public.customer_notifications enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.customer_payment_methods enable row level security;
alter table public.customer_service_reviews enable row level security;
alter table public.customer_favorite_services enable row level security;

drop policy if exists "customer memberships own read" on public.customer_memberships;
create policy "customer memberships own read" on public.customer_memberships
for select
using (
  exists (
    select 1
    from public.customer_accounts ca
    where ca.user_id = auth.uid()
      and ca.org_id = customer_memberships.org_id
      and ca.customer_id = customer_memberships.customer_id
  )
);

drop policy if exists "customer notification preferences own all" on public.customer_notification_preferences;
create policy "customer notification preferences own all" on public.customer_notification_preferences
for all
using (
  exists (
    select 1
    from public.customer_accounts ca
    where ca.user_id = auth.uid()
      and ca.org_id = customer_notification_preferences.org_id
      and ca.customer_id = customer_notification_preferences.customer_id
  )
)
with check (
  exists (
    select 1
    from public.customer_accounts ca
    where ca.user_id = auth.uid()
      and ca.org_id = customer_notification_preferences.org_id
      and ca.customer_id = customer_notification_preferences.customer_id
  )
);

drop policy if exists "customer offers own all" on public.customer_offer_claims;
create policy "customer offers own all" on public.customer_offer_claims
for all
using (
  exists (
    select 1
    from public.customer_accounts ca
    where ca.user_id = auth.uid()
      and ca.org_id = customer_offer_claims.org_id
      and ca.customer_id = customer_offer_claims.customer_id
  )
)
with check (
  exists (
    select 1
    from public.customer_accounts ca
    where ca.user_id = auth.uid()
      and ca.org_id = customer_offer_claims.org_id
      and ca.customer_id = customer_offer_claims.customer_id
  )
);

drop policy if exists "customer notifications own read update" on public.customer_notifications;
drop policy if exists "customer notifications own update" on public.customer_notifications;
create policy "customer notifications own read update" on public.customer_notifications
for select
using (
  exists (
    select 1
    from public.customer_accounts ca
    where ca.user_id = auth.uid()
      and ca.org_id = customer_notifications.org_id
      and ca.customer_id = customer_notifications.customer_id
  )
);

create policy "customer notifications own update" on public.customer_notifications
for update
using (
  exists (
    select 1
    from public.customer_accounts ca
    where ca.user_id = auth.uid()
      and ca.org_id = customer_notifications.org_id
      and ca.customer_id = customer_notifications.customer_id
  )
)
with check (
  exists (
    select 1
    from public.customer_accounts ca
    where ca.user_id = auth.uid()
      and ca.org_id = customer_notifications.org_id
      and ca.customer_id = customer_notifications.customer_id
  )
);

drop policy if exists "customer favorites own all" on public.customer_favorite_services;
create policy "customer favorites own all" on public.customer_favorite_services
for all
using (
  exists (
    select 1
    from public.customer_accounts ca
    where ca.user_id = auth.uid()
      and ca.org_id = customer_favorite_services.org_id
      and ca.customer_id = customer_favorite_services.customer_id
  )
)
with check (
  exists (
    select 1
    from public.customer_accounts ca
    where ca.user_id = auth.uid()
      and ca.org_id = customer_favorite_services.org_id
      and ca.customer_id = customer_favorite_services.customer_id
  )
);

-- 9) Booking RPC must reserve offers by customer_id, not by profile/user row existence.
create or replace function public.create_booking_request_public(
  p_customer_name text,
  p_customer_phone text,
  p_requested_service text default null,
  p_preferred_staff text default null,
  p_note text default null,
  p_requested_start_at timestamptz default null,
  p_requested_end_at timestamptz default null,
  p_source text default 'landing_page',
  p_applied_offer_id uuid default null,
  p_applied_offer_claim_id uuid default null,
  p_applied_offer_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_org_id uuid;
  v_branch_id uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_row public.booking_requests;
  v_customer_id uuid;
  v_customer_account_id uuid;
  v_source text := coalesce(nullif(trim(p_source), ''), 'landing_page');
  v_normalized_phone text := public.normalize_customer_phone(p_customer_phone);
  v_claim public.customer_offer_claims;
  v_offer public.marketing_offers;
  v_offer_code text;
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

  if v_auth_user_id is not null then
    select ca.id, ca.org_id, ca.customer_id
    into v_customer_account_id, v_org_id, v_customer_id
    from public.customer_accounts ca
    where ca.user_id = v_auth_user_id
    order by ca.created_at asc
    limit 1;

    if v_customer_id is null then
      begin
        perform public.link_customer_account_for_current_user();
      exception when others then null;
      end;

      select ca.id, ca.org_id, ca.customer_id
      into v_customer_account_id, v_org_id, v_customer_id
      from public.customer_accounts ca
      where ca.user_id = v_auth_user_id
      order by ca.created_at asc
      limit 1;
    end if;
  end if;

  if v_org_id is null then
    select id into v_org_id from public.orgs order by created_at asc limit 1;
  end if;

  if v_org_id is null then
    raise exception 'ORG_NOT_FOUND';
  end if;

  if v_customer_id is not null then
    perform 1 from public.customers c
    where c.id = v_customer_id and c.org_id = v_org_id and c.merged_into_customer_id is null;
    if not found then v_customer_id := null; end if;
  end if;

  if v_customer_id is null then
    v_customer_id := public.upsert_customer_by_identity(v_org_id, p_customer_name, p_customer_phone, v_source, p_note);
  else
    update public.customers
    set full_name = case when full_name is null or btrim(full_name) = '' then p_customer_name else full_name end,
        name = case when name is null or btrim(name) = '' then p_customer_name else name end,
        phone = case when (phone is null or btrim(phone) = '') and v_normalized_phone is not null then v_normalized_phone else phone end,
        source = coalesce(source, v_source)
    where id = v_customer_id and org_id = v_org_id;
  end if;

  if v_auth_user_id is not null and v_customer_id is not null and v_customer_account_id is null then
    insert into public.customer_accounts (user_id, customer_id, org_id, linked_by)
    values (v_auth_user_id, v_customer_id, v_org_id, 'BOOKING_PHONE_SYNC')
    returning id into v_customer_account_id;
  end if;

  if p_applied_offer_id is not null then
    select * into v_offer
    from public.marketing_offers mo
    where mo.id = p_applied_offer_id
      and mo.org_id = v_org_id
      and mo.is_active = true
      and (mo.starts_at is null or mo.starts_at <= now())
      and (mo.ends_at is null or mo.ends_at >= now())
    limit 1;

    if v_offer.id is null then
      raise exception 'OFFER_NOT_AVAILABLE';
    end if;

    if v_customer_id is null then
      raise exception 'OFFER_REQUIRES_LINKED_CUSTOMER';
    end if;

    v_offer_code := coalesce(nullif(trim(p_applied_offer_code), ''), nullif(trim(v_offer.offer_metadata ->> 'code'), ''));

    if p_applied_offer_claim_id is not null then
      select * into v_claim
      from public.customer_offer_claims coc
      where coc.id = p_applied_offer_claim_id
        and coc.customer_id = v_customer_id
        and coc.offer_id = p_applied_offer_id
        and coc.org_id = v_org_id
      limit 1;
    end if;

    if v_claim.id is null then
      select * into v_claim
      from public.customer_offer_claims coc
      where coc.customer_id = v_customer_id
        and coc.offer_id = p_applied_offer_id
        and coc.org_id = v_org_id
      limit 1;
    end if;

    if v_claim.id is not null and v_claim.status in ('CLAIMED', 'USED', 'EXPIRED') then
      raise exception 'OFFER_ALREADY_USED_OR_RESERVED';
    end if;

    if v_claim.id is null then
      insert into public.customer_offer_claims (
        user_id,
        customer_id,
        offer_id,
        org_id,
        status,
        claimed_at,
        reservation_expires_at
      ) values (
        v_auth_user_id,
        v_customer_id,
        p_applied_offer_id,
        v_org_id,
        'CLAIMED',
        now(),
        v_end + interval '6 hours'
      )
      returning * into v_claim;
    else
      update public.customer_offer_claims
      set status = 'CLAIMED',
          customer_id = v_customer_id,
          user_id = coalesce(user_id, v_auth_user_id),
          claimed_at = coalesce(claimed_at, now()),
          reservation_expires_at = v_end + interval '6 hours',
          cancelled_at = null
      where id = v_claim.id
      returning * into v_claim;
    end if;
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
    org_id, branch_id, customer_id, customer_name, customer_phone,
    requested_service, preferred_staff, note,
    requested_start_at, requested_end_at,
    source, status, applied_offer_id, applied_offer_claim_id, applied_offer_code
  ) values (
    v_org_id, v_branch_id, v_customer_id, p_customer_name, v_normalized_phone,
    p_requested_service, p_preferred_staff, p_note,
    v_start, v_end,
    v_source, 'NEW', p_applied_offer_id, v_claim.id, v_offer_code
  ) returning * into v_row;

  if v_claim.id is not null then
    update public.customer_offer_claims
    set booking_request_id = v_row.id
    where id = v_claim.id;
  end if;

  if v_customer_id is not null then
    insert into public.customer_notifications (
      user_id, customer_id, org_id, title, body, kind, is_read, sent_at, related_offer_id
    ) values (
      v_auth_user_id,
      v_customer_id,
      v_org_id,
      'Yêu cầu đặt lịch đã được gửi',
      'Tiệm đã nhận yêu cầu ' || coalesce(nullif(trim(p_requested_service), ''), 'đặt lịch') || ' vào ' || to_char(v_start at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI') || case when v_offer_code is not null then '. Ưu đãi ' || v_offer_code || ' đang được giữ chỗ.' else '.' end,
      'BOOKING',
      false,
      now(),
      p_applied_offer_id
    );
  end if;

  perform public.append_customer_activity(
    v_org_id,
    v_customer_id,
    'BOOKING_REQUEST',
    'WEB',
    'Tạo yêu cầu đặt lịch ' || to_char(v_start at time zone 'Asia/Bangkok', 'DD/MM HH24:MI'),
    null
  );

  return jsonb_build_object(
    'booking_request_id', v_row.id,
    'status', v_row.status,
    'applied_offer_id', p_applied_offer_id,
    'applied_offer_claim_id', v_claim.id,
    'applied_offer_code', v_offer_code
  );
end;
$$;

commit;
