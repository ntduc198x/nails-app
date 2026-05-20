-- Phase 10b runtime patch:
-- Ensure authenticated booking flow links customer_accounts when the user had no link yet,
-- and backfill profiles.phone from the booking phone only when the profile is blank.

begin;

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
    select ca.org_id, ca.customer_id
    into v_org_id, v_customer_id
    from public.customer_accounts ca
    where ca.user_id = v_auth_user_id
    order by ca.created_at asc
    limit 1;

    if v_customer_id is null then
      begin
        perform public.link_customer_account_for_current_user();
      exception
        when others then
          null;
      end;

      select ca.org_id, ca.customer_id
      into v_org_id, v_customer_id
      from public.customer_accounts ca
      where ca.user_id = v_auth_user_id
      order by ca.created_at asc
      limit 1;
    end if;
  end if;

  if v_org_id is null then
    select id
    into v_org_id
    from public.orgs
    order by created_at asc
    limit 1;
  end if;

  if v_org_id is null then
    raise exception 'ORG_NOT_FOUND';
  end if;

  if v_customer_id is not null then
    perform 1
    from public.customers c
    where c.id = v_customer_id
      and c.org_id = v_org_id
      and c.merged_into_customer_id is null;

    if not found then
      v_customer_id := null;
    end if;
  end if;

  if v_customer_id is null then
    v_customer_id := public.upsert_customer_by_identity(
      v_org_id,
      p_customer_name,
      p_customer_phone,
      v_source,
      p_note
    );
  else
    update public.customers
    set
      full_name = case
        when full_name is null or btrim(full_name) = '' then p_customer_name
        else full_name
      end,
      name = case
        when name is null or btrim(name) = '' then p_customer_name
        else name
      end,
      phone = case
        when (phone is null or btrim(phone) = '') and v_normalized_phone is not null then v_normalized_phone
        else phone
      end,
      source = coalesce(source, v_source)
    where id = v_customer_id
      and org_id = v_org_id;
  end if;

  if v_auth_user_id is not null and v_customer_id is not null then
    select ca.id
    into v_customer_account_id
    from public.customer_accounts ca
    where ca.user_id = v_auth_user_id
    order by ca.created_at asc
    limit 1;

    if v_customer_account_id is null then
      insert into public.customer_accounts (user_id, customer_id, org_id, linked_by)
      values (v_auth_user_id, v_customer_id, v_org_id, 'BOOKING_PHONE_SYNC');
    end if;

    if v_normalized_phone is not null then
      update public.profiles
      set phone = v_normalized_phone
      where user_id = v_auth_user_id
        and (phone is null or btrim(phone) = '');
    end if;
  end if;

  select id
  into v_branch_id
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
    customer_id,
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
    v_customer_id,
    p_customer_name,
    v_normalized_phone,
    p_requested_service,
    p_preferred_staff,
    p_note,
    v_start,
    v_end,
    v_source,
    'NEW'
  )
  returning * into v_row;

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
    'status', v_row.status
  );
end;
$$;

commit;
