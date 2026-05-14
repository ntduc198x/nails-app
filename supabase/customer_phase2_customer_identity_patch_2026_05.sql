-- Phase 2 customer identity cleanup
-- 1) booking_requests -> add customer_id and backfill
-- 2) customers -> add address and backfill
-- 3) profile save surface can treat customers as source of truth for birthday/address

begin;

alter table public.customers
  add column if not exists address text;

update public.customers c
set address = src.address
from (
  select distinct on (ca.customer_id)
    ca.customer_id,
    nullif(trim(coalesce(addr.address_line_1, p.address)), '') as address
  from public.customer_accounts ca
  left join public.profiles p
    on p.user_id = ca.user_id
  left join public.customer_addresses addr
    on addr.user_id = ca.user_id
   and addr.is_default = true
  where ca.customer_id is not null
  order by ca.customer_id, addr.updated_at desc nulls last, addr.created_at desc nulls last
) src
where c.id = src.customer_id
  and src.address is not null
  and (c.address is null or btrim(c.address) = '');

update public.customers c
set birthday = src.birth_date::date
from (
  select distinct on (ca.customer_id)
    ca.customer_id,
    p.birth_date
  from public.customer_accounts ca
  join public.profiles p
    on p.user_id = ca.user_id
  where ca.customer_id is not null
    and p.birth_date is not null
  order by ca.customer_id, p.updated_at desc nulls last
) src
where c.id = src.customer_id
  and src.birth_date is not null
  and c.birthday is null;

alter table public.booking_requests
  add column if not exists customer_id uuid references public.customers(id) on delete set null;

update public.booking_requests br
set customer_id = a.customer_id
from public.appointments a
where br.customer_id is null
  and br.appointment_id = a.id
  and a.customer_id is not null;

update public.booking_requests br
set customer_id = c.id
from public.customers c
where br.customer_id is null
  and br.org_id = c.org_id
  and c.merged_into_customer_id is null
  and public.normalize_customer_phone(br.customer_phone) = public.normalize_customer_phone(c.phone);

create index if not exists idx_booking_requests_org_customer_created
  on public.booking_requests (org_id, customer_id, created_at desc);

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

  v_customer_id := public.upsert_customer_by_identity(
    v_org_id,
    p_customer_name,
    p_customer_phone,
    coalesce(nullif(trim(p_source), ''), 'landing_page'),
    p_note
  );

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

  v_customer_id := coalesce(
    v_req.customer_id,
    public.upsert_customer_by_identity(
      v_org_id,
      v_req.customer_name,
      v_req.customer_phone,
      v_req.source,
      v_req.note
    )
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
    customer_id = v_customer_id,
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

comment on table public.customer_addresses is 'Deprecated for customer app runtime. Use public.customers.address as source of truth.';

commit;
