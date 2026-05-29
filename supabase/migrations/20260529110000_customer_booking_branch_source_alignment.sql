begin;

alter table public.orgs
  add column if not exists primary_branch_id uuid;

update public.orgs as o
set primary_branch_id = (
  select b.id
  from public.branches b
  where b.org_id = o.id
  order by b.created_at asc, b.id asc
  limit 1
)
where o.primary_branch_id is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orgs_primary_branch_id_fkey'
      and conrelid = 'public.orgs'::regclass
  ) then
    alter table public.orgs
      add constraint orgs_primary_branch_id_fkey
      foreign key (primary_branch_id) references public.branches(id);
  end if;
end
$$;

comment on column public.orgs.primary_branch_id is
  'Primary branch fallback for customer-facing booking and storefront flows.';

drop function if exists public.create_booking_request_public(
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  text,
  uuid,
  uuid,
  text
);

create or replace function public.create_booking_request_public(
  p_branch_id uuid default null,
  p_customer_name text default null,
  p_customer_phone text default null,
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
  v_points_required integer := 0;
  v_points_balance integer := 0;
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
    v_customer_id := public.upsert_customer_by_identity(v_org_id, p_customer_name, p_customer_phone, v_source, p_note);
  else
    update public.customers
    set full_name = case when full_name is null or btrim(full_name) = '' then p_customer_name else full_name end,
        name = case when name is null or btrim(name) = '' then p_customer_name else name end,
        phone = case when (phone is null or btrim(phone) = '') and v_normalized_phone is not null then v_normalized_phone else phone end,
        source = coalesce(source, v_source)
    where id = v_customer_id
      and org_id = v_org_id;
  end if;

  if v_auth_user_id is not null and v_customer_id is not null and v_customer_account_id is null then
    insert into public.customer_accounts (user_id, customer_id, org_id, linked_by)
    values (v_auth_user_id, v_customer_id, v_org_id, 'BOOKING_PHONE_SYNC')
    returning id into v_customer_account_id;
  end if;

  if p_applied_offer_id is not null then
    select *
    into v_offer
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

    v_points_required := greatest(
      case
        when coalesce(v_offer.offer_metadata ->> 'pointsRequired', '') ~ '^\d+$'
          then (v_offer.offer_metadata ->> 'pointsRequired')::integer
        else 0
      end,
      0
    );

    if v_points_required > 0 then
      select coalesce(cm.points_balance, 0)
      into v_points_balance
      from public.customer_memberships cm
      where cm.customer_id = v_customer_id
        and cm.org_id = v_org_id
      limit 1;

      if coalesce(v_points_balance, 0) < v_points_required then
        raise exception 'INSUFFICIENT_MEMBERSHIP_POINTS';
      end if;
    end if;

    v_offer_code := coalesce(
      nullif(trim(p_applied_offer_code), ''),
      nullif(trim(v_offer.offer_metadata ->> 'code'), '')
    );

    if p_applied_offer_claim_id is not null then
      select *
      into v_claim
      from public.customer_offer_claims coc
      where coc.id = p_applied_offer_claim_id
        and coc.customer_id = v_customer_id
        and coc.offer_id = p_applied_offer_id
        and coc.org_id = v_org_id
      limit 1;
    end if;

    if v_claim.id is null then
      select *
      into v_claim
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

  if p_branch_id is not null then
    select b.id
    into v_branch_id
    from public.branches b
    where b.id = p_branch_id
      and b.org_id = v_org_id
    limit 1;
  end if;

  if v_branch_id is null then
    select o.primary_branch_id
    into v_branch_id
    from public.orgs o
    where o.id = v_org_id
    limit 1;
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
    status,
    applied_offer_id,
    applied_offer_claim_id,
    applied_offer_code
  ) values (
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
    'NEW',
    p_applied_offer_id,
    v_claim.id,
    v_offer_code
  )
  returning * into v_row;

  if v_customer_id is not null then
    insert into public.customer_branches (
      customer_id,
      org_id,
      branch_id,
      first_seen_at,
      last_seen_at,
      source
    ) values (
      v_customer_id,
      v_org_id,
      v_branch_id,
      v_start,
      v_start,
      v_source
    )
    on conflict (customer_id, branch_id) do update
    set
      org_id = excluded.org_id,
      last_seen_at = greatest(
        coalesce(public.customer_branches.last_seen_at, excluded.last_seen_at),
        excluded.last_seen_at
      ),
      source = coalesce(excluded.source, public.customer_branches.source),
      updated_at = now();
  end if;

  if v_claim.id is not null then
    update public.customer_offer_claims
    set booking_request_id = v_row.id
    where id = v_claim.id;
  end if;

  if v_customer_id is not null then
    insert into public.customer_notifications (
      user_id,
      customer_id,
      org_id,
      title,
      body,
      kind,
      is_read,
      sent_at,
      related_offer_id
    ) values (
      v_auth_user_id,
      v_customer_id,
      v_org_id,
      'Yêu cầu đặt lịch đã được gửi',
      'Tiệm đã nhận yêu cầu ' || coalesce(nullif(trim(p_requested_service), ''), 'đặt lịch') || ' vào ' ||
        to_char(v_start at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI') ||
        case when v_offer_code is not null then '. Ưu đãi ' || v_offer_code || ' đang được giữ chỗ.' else '.' end,
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

grant execute on function public.create_booking_request_public(
  uuid,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  text,
  uuid,
  uuid,
  text
) to anon, authenticated, service_role;

commit;
