-- Phase 12 customer identity and booking expiry patch
-- 1) Remove customer runtime dependency on public.profiles
-- 2) Add EXPIRED_UNCONFIRMED booking status and automatic transition for stale NEW bookings

begin;

create or replace function public.link_customer_account_by_phone()
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_customer_id uuid;
  v_existing_account_id uuid;
  v_phone text;
  v_email text;
  v_display_name text;
begin
  if v_user_id is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select ca.org_id, ca.customer_id
  into v_org_id, v_customer_id
  from public.customer_accounts ca
  where ca.user_id = v_user_id
  order by ca.created_at asc
  limit 1;

  if v_customer_id is not null then
    return v_customer_id;
  end if;

  select
    coalesce(
      nullif(trim((auth.jwt() -> 'user_metadata' ->> 'phone')), ''),
      nullif(trim((auth.jwt() ->> 'phone')), '')
    ),
    coalesce(
      nullif(trim((auth.jwt() ->> 'email')), ''),
      nullif(trim((auth.jwt() -> 'user_metadata' ->> 'email')), '')
    ),
    coalesce(
      nullif(trim((auth.jwt() -> 'user_metadata' ->> 'full_name')), ''),
      nullif(trim((auth.jwt() -> 'user_metadata' ->> 'name')), ''),
      nullif(trim((auth.jwt() ->> 'email')), ''),
      'Customer'
    )
  into v_phone, v_email, v_display_name;

  if v_phone is not null then
    v_phone := public.normalize_customer_phone(v_phone);
  end if;

  if v_phone is null or btrim(v_phone) = '' then
    raise exception 'CUSTOMER_PHONE_REQUIRED';
  end if;

  if v_org_id is null then
    select id into v_org_id
    from public.orgs
    order by created_at asc
    limit 1;
  end if;

  if v_org_id is null then
    raise exception 'ORG_NOT_FOUND';
  end if;

  select id
  into v_customer_id
  from public.customers
  where org_id = v_org_id
    and public.normalize_customer_phone(phone) = v_phone
    and merged_into_customer_id is null
  order by total_visits desc, total_spend desc, created_at asc
  limit 1;

  if v_customer_id is null then
    insert into public.customers (
      org_id,
      name,
      full_name,
      email,
      phone,
      source
    )
    values (
      v_org_id,
      v_display_name,
      v_display_name,
      v_email,
      v_phone,
      'APP_SIGNUP'
    )
    returning id into v_customer_id;
  end if;

  select id
  into v_existing_account_id
  from public.customer_accounts
  where user_id = v_user_id
     or customer_id = v_customer_id
  order by case when user_id = v_user_id then 0 else 1 end, created_at asc
  limit 1;

  if v_existing_account_id is not null then
    update public.customer_accounts
    set
      user_id = v_user_id,
      customer_id = v_customer_id,
      org_id = v_org_id,
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
      v_user_id,
      v_customer_id,
      v_org_id,
      'PHONE_MATCH'
    );
  end if;

  return v_customer_id;
end;
$$;

grant execute on function public.link_customer_account_by_phone() to authenticated;

create or replace function public.expire_unconfirmed_booking_requests()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  update public.booking_requests
  set status = 'EXPIRED_UNCONFIRMED'
  where status = 'NEW'
    and requested_start_at < now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.expire_unconfirmed_booking_requests() to authenticated;

create or replace function public.expire_unconfirmed_booking_request_before_read()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'NEW' and new.requested_start_at < now() then
    new.status := 'EXPIRED_UNCONFIRMED';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_booking_requests_expire_before_write on public.booking_requests;
create trigger trg_booking_requests_expire_before_write
before insert or update of requested_start_at, status on public.booking_requests
for each row
execute function public.expire_unconfirmed_booking_request_before_read();

commit;
