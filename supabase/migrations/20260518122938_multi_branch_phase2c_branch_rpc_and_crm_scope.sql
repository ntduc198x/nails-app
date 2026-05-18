begin;

create or replace function public.upsert_customer_by_identity(
  p_org_id uuid,
  p_full_name text,
  p_phone text default null,
  p_source text default null,
  p_care_note text default null,
  p_branch_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_phone text := public.normalize_customer_phone(p_phone);
  v_branch_id uuid := p_branch_id;
begin
  if p_org_id is null then
    raise exception 'ORG_REQUIRED';
  end if;

  if p_full_name is null or btrim(p_full_name) = '' then
    raise exception 'CUSTOMER_NAME_REQUIRED';
  end if;

  if v_branch_id is null then
    v_branch_id := public.my_default_branch_id();
  end if;

  if v_branch_id is null then
    select b.id
    into v_branch_id
    from public.branches b
    where b.org_id = p_org_id
    order by b.created_at asc
    limit 1;
  end if;

  if v_branch_id is null then
    raise exception 'BRANCH_REQUIRED';
  end if;

  if v_phone is not null then
    select id
    into v_customer_id
    from public.customers
    where org_id = p_org_id
      and branch_id = v_branch_id
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
      and branch_id = v_branch_id
      and lower(trim(coalesce(full_name, name))) = lower(trim(p_full_name))
      and merged_into_customer_id is null
    order by created_at asc
    limit 1;
  end if;

  if v_customer_id is null then
    insert into public.customers (
      org_id,
      branch_id,
      name,
      full_name,
      phone,
      notes,
      care_note,
      source
    )
    values (
      p_org_id,
      v_branch_id,
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

create or replace function public.upsert_customer_by_identity(
  p_org_id uuid,
  p_full_name text,
  p_phone text default null,
  p_source text default null,
  p_care_note text default null
)
returns uuid
language sql
security definer
set search_path = public
as $$
  select public.upsert_customer_by_identity(
    p_org_id,
    p_full_name,
    p_phone,
    p_source,
    p_care_note,
    public.my_default_branch_id()
  )
$$;

create or replace function public.list_team_members_secure()
returns table (
  id uuid,
  user_id uuid,
  role text,
  display_name text
)
language sql
security definer
set search_path = public
as $$
  select
    ur.id,
    ur.user_id,
    ur.role::text,
    coalesce(nullif(trim(p.display_name), ''), left(ur.user_id::text, 8)) as display_name
  from public.user_roles ur
  left join public.profiles p on p.user_id = ur.user_id
  where ur.org_id = public.my_org_id()
    and (
      public.has_org_role(array['OWNER'])
      or (
        public.can_access_branch(ur.branch_id, array['MANAGER','PARTNER'])
        and ur.branch_id is not null
      )
      or ur.user_id = auth.uid()
    )
  order by ur.role asc, ur.user_id asc
$$;

create or replace function public.list_team_members_secure_v2()
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
  where ur.org_id = public.my_org_id()
    and (
      public.has_org_role(array['OWNER'])
      or (
        public.can_access_branch(ur.branch_id, array['MANAGER','PARTNER'])
        and ur.branch_id is not null
      )
      or ur.user_id = auth.uid()
    )
  order by ur.role asc, ur.user_id asc
$$;

create or replace function public.get_ticket_detail_secure(p_ticket_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.tickets;
  v_customer jsonb;
  v_payment jsonb;
  v_receipt jsonb;
  v_items jsonb;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select *
  into v_ticket
  from public.tickets t
  where t.id = p_ticket_id
    and t.org_id = public.my_org_id();

  if v_ticket.id is null then
    raise exception 'TICKET_NOT_FOUND';
  end if;

  if not public.can_access_branch(
    v_ticket.branch_id,
    array['OWNER','PARTNER','MANAGER','RECEPTION','ACCOUNTANT']
  ) then
    raise exception 'ACCESS_DENIED';
  end if;

  select to_jsonb(c)
  into v_customer
  from (
    select name, full_name, phone, branch_id
    from public.customers
    where id = v_ticket.customer_id
      and org_id = v_ticket.org_id
    limit 1
  ) c;

  select to_jsonb(p)
  into v_payment
  from (
    select method, amount, status, created_at
    from public.payments
    where ticket_id = v_ticket.id
      and org_id = v_ticket.org_id
    order by created_at desc
    limit 1
  ) p;

  select to_jsonb(r)
  into v_receipt
  from (
    select public_token, expires_at
    from public.receipts
    where ticket_id = v_ticket.id
      and org_id = v_ticket.org_id
    order by created_at desc
    limit 1
  ) r;

  select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb)
  into v_items
  from (
    select
      ti.qty,
      ti.unit_price,
      ti.vat_rate,
      coalesce(s.name, '(service deleted)') as service_name
    from public.ticket_items ti
    left join public.services s on s.id = ti.service_id
    where ti.ticket_id = v_ticket.id
      and ti.org_id = v_ticket.org_id
    order by ti.created_at asc
  ) i;

  return jsonb_build_object(
    'ticket', jsonb_build_object(
      'id', v_ticket.id,
      'branch_id', v_ticket.branch_id,
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

create or replace function public.get_report_breakdown_secure(
  p_from timestamptz,
  p_to timestamptz,
  p_branch_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_summary jsonb;
  v_by_service jsonb;
  v_by_payment jsonb;
  v_effective_branch_id uuid := p_branch_id;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if p_to <= p_from then
    raise exception 'INVALID_TIME_RANGE';
  end if;

  if v_effective_branch_id is not null then
    if not public.can_access_branch(
      v_effective_branch_id,
      array['OWNER','PARTNER','MANAGER','ACCOUNTANT']
    ) then
      raise exception 'ACCESS_DENIED';
    end if;
  elsif not public.has_org_role(array['OWNER']) then
    v_effective_branch_id := public.my_default_branch_id();
    if v_effective_branch_id is null then
      raise exception 'BRANCH_CONTEXT_REQUIRED';
    end if;
    if not public.can_access_branch(
      v_effective_branch_id,
      array['OWNER','PARTNER','MANAGER','ACCOUNTANT']
    ) then
      raise exception 'ACCESS_DENIED';
    end if;
  end if;

  select jsonb_build_object(
    'count', count(*)::int,
    'subtotal', coalesce(sum((t.totals_json->>'subtotal')::numeric), 0),
    'vat', coalesce(sum((t.totals_json->>'vat_total')::numeric), 0),
    'revenue', coalesce(sum((t.totals_json->>'grand_total')::numeric), 0)
  )
  into v_summary
  from public.tickets t
  where t.org_id = public.my_org_id()
    and t.status = 'CLOSED'
    and t.created_at >= p_from
    and t.created_at < p_to
    and (
      v_effective_branch_id is null
      or t.branch_id = v_effective_branch_id
    )
    and public.can_access_branch(
      t.branch_id,
      array['OWNER','PARTNER','MANAGER','ACCOUNTANT']
    );

  select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
  into v_by_service
  from (
    select
      coalesce(s.name, '(service deleted)') as service_name,
      sum(ti.qty)::int as qty,
      coalesce(sum(ti.qty * ti.unit_price), 0)::numeric as subtotal
    from public.ticket_items ti
    join public.tickets t on t.id = ti.ticket_id
    left join public.services s on s.id = ti.service_id
    where t.org_id = public.my_org_id()
      and t.status = 'CLOSED'
      and t.created_at >= p_from
      and t.created_at < p_to
      and (
        v_effective_branch_id is null
        or t.branch_id = v_effective_branch_id
      )
      and public.can_access_branch(
        t.branch_id,
        array['OWNER','PARTNER','MANAGER','ACCOUNTANT']
      )
    group by coalesce(s.name, '(service deleted)')
    order by subtotal desc
  ) x;

  select coalesce(jsonb_agg(to_jsonb(y)), '[]'::jsonb)
  into v_by_payment
  from (
    select
      p.method,
      count(*)::int as count,
      coalesce(sum(p.amount), 0)::numeric as amount
    from public.payments p
    join public.tickets t on t.id = p.ticket_id
    where t.org_id = public.my_org_id()
      and t.status = 'CLOSED'
      and t.created_at >= p_from
      and t.created_at < p_to
      and (
        v_effective_branch_id is null
        or t.branch_id = v_effective_branch_id
      )
      and public.can_access_branch(
        t.branch_id,
        array['OWNER','PARTNER','MANAGER','ACCOUNTANT']
      )
    group by p.method
    order by amount desc
  ) y;

  return jsonb_build_object(
    'summary', coalesce(v_summary, '{}'::jsonb),
    'branch_id', v_effective_branch_id,
    'by_service', v_by_service,
    'by_payment', v_by_payment
  );
end;
$$;

create or replace function public.get_report_breakdown_secure(
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.get_report_breakdown_secure(p_from, p_to, null::uuid)
$$;

create or replace function public.generate_invite_code_secure(
  p_branch_id uuid,
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

  v_org_id := public.my_org_id();
  if v_org_id is null then
    raise exception 'ORG_CONTEXT_REQUIRED';
  end if;

  if p_branch_id is null then
    raise exception 'BRANCH_CONTEXT_REQUIRED';
  end if;

  if not public.can_access_branch(
    p_branch_id,
    array['OWNER','PARTNER','MANAGER']
  ) then
    raise exception 'ACCESS_DENIED';
  end if;

  v_role := coalesce(nullif(trim(p_allowed_role), ''), 'TECH');
  if v_role not in ('OWNER','PARTNER','MANAGER','RECEPTION','ACCOUNTANT','TECH') then
    raise exception 'INVALID_ROLE';
  end if;

  if v_role in ('OWNER','PARTNER') and not public.has_org_role(array['OWNER']) then
    raise exception 'FORBIDDEN_ROLE';
  end if;

  if v_role = 'MANAGER'
     and not (
       public.has_org_role(array['OWNER'])
       or public.can_access_branch(p_branch_id, array['PARTNER'])
     ) then
    raise exception 'FORBIDDEN_ROLE';
  end if;

  if v_role in ('RECEPTION','ACCOUNTANT','TECH')
     and not public.can_access_branch(p_branch_id, array['OWNER','PARTNER','MANAGER']) then
    raise exception 'FORBIDDEN_ROLE';
  end if;

  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    begin
      insert into public.invite_codes (org_id, branch_id, code, created_by, allowed_role, expires_at, note)
      values (v_org_id, p_branch_id, v_code, auth.uid(), v_role, now() + interval '15 minutes', nullif(trim(p_note), ''))
      returning * into v_row;
      exit;
    exception when unique_violation then
    end;
  end loop;

  return v_row;
end;
$$;

create or replace function public.generate_invite_code_secure(
  p_allowed_role text default 'TECH',
  p_note text default null
)
returns public.invite_codes
language sql
security definer
set search_path = public
as $$
  select public.generate_invite_code_secure(
    public.my_default_branch_id(),
    p_allowed_role,
    p_note
  )
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
  v_req public.booking_requests;
  v_customer_id uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_appointment_id uuid;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select *
  into v_req
  from public.booking_requests br
  where br.id = p_booking_request_id
    and br.org_id = public.my_org_id()
  limit 1;

  if v_req.id is null then
    raise exception 'BOOKING_REQUEST_NOT_FOUND';
  end if;

  if not public.can_access_branch(
    v_req.branch_id,
    array['OWNER','PARTNER','MANAGER','RECEPTION']
  ) then
    raise exception 'ACCESS_DENIED';
  end if;

  if v_req.status in ('CANCELLED', 'CONVERTED') then
    raise exception 'BOOKING_REQUEST_ALREADY_FINALIZED';
  end if;

  if p_resource_id is not null and not exists (
    select 1
    from public.resources r
    where r.id = p_resource_id
      and r.org_id = v_req.org_id
      and r.branch_id = v_req.branch_id
  ) then
    raise exception 'RESOURCE_BRANCH_MISMATCH';
  end if;

  v_start := coalesce(p_start_at, v_req.requested_start_at);
  v_end := coalesce(p_end_at, v_req.requested_end_at, v_start + interval '60 minutes');

  if v_end <= v_start then
    raise exception 'INVALID_TIME_RANGE';
  end if;

  v_customer_id := public.upsert_customer_by_identity(
    v_req.org_id,
    v_req.customer_name,
    v_req.customer_phone,
    v_req.source,
    concat_ws(' | ',
      case when v_req.requested_service is not null then 'DV: ' || v_req.requested_service else null end,
      case when v_req.preferred_staff is not null then 'Tho mong muon: ' || v_req.preferred_staff else null end,
      nullif(v_req.note, '')
    ),
    v_req.branch_id
  );

  insert into public.appointments (
    org_id, branch_id, customer_id, staff_user_id, resource_id, start_at, end_at, status
  ) values (
    v_req.org_id, v_req.branch_id, v_customer_id, p_staff_user_id, p_resource_id, v_start, v_end, 'BOOKED'
  )
  returning id into v_appointment_id;

  update public.booking_requests
  set status = 'CONVERTED',
      appointment_id = v_appointment_id
  where id = v_req.id;

  return jsonb_build_object(
    'booking_request_id', v_req.id,
    'appointment_id', v_appointment_id,
    'status', 'CONVERTED',
    'branch_id', v_req.branch_id
  );
end;
$$;

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

  v_org_id := public.my_org_id();
  v_branch_id := public.my_default_branch_id();

  if v_org_id is null then
    raise exception 'ORG_NOT_FOUND';
  end if;

  if p_appointment_id is not null then
    select a.branch_id
    into v_branch_id
    from public.appointments a
    where a.id = p_appointment_id
      and a.org_id = v_org_id;

    if v_branch_id is null then
      raise exception 'APPOINTMENT_NOT_FOUND';
    end if;
  end if;

  if v_branch_id is null then
    select b.id
    into v_branch_id
    from public.branches b
    where b.org_id = v_org_id
    order by b.created_at asc
    limit 1;
  end if;

  if v_branch_id is null then
    raise exception 'BRANCH_NOT_FOUND';
  end if;

  if not public.can_access_branch(
    v_branch_id,
    array['OWNER','PARTNER','MANAGER','RECEPTION']
  ) then
    raise exception 'ACCESS_DENIED';
  end if;

  v_customer_id := public.upsert_customer_by_identity(
    v_org_id,
    p_customer_name,
    null,
    'APP',
    null,
    v_branch_id
  );

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
  join public.services s on s.id = x.service_id and s.org_id = v_org_id;

  if v_subtotal <= 0 then
    raise exception 'INVALID_SERVICES';
  end if;

  v_grand_total := v_subtotal + v_vat_total;

  if p_idempotency_key is not null and btrim(p_idempotency_key) <> '' then
    select cr.ticket_id
    into v_existing_ticket_id
    from public.checkout_requests cr
    where cr.org_id = v_org_id
      and cr.idempotency_key = p_idempotency_key
    limit 1;

    if v_existing_ticket_id is not null then
      select r.public_token
      into v_existing_token
      from public.receipts r
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

  select t.id
  into v_duplicate_ticket_id
  from public.tickets t
  where t.org_id = v_org_id
    and t.branch_id = v_branch_id
    and t.customer_id = v_customer_id
    and t.status = 'CLOSED'
    and t.created_at >= (now() - make_interval(secs => greatest(p_dedupe_window_ms, 1000) / 1000.0))
    and abs(coalesce((t.totals_json->>'grand_total')::numeric, 0) - v_grand_total) < 0.01
  order by t.created_at desc
  limit 1;

  if v_duplicate_ticket_id is not null then
    select r.public_token
    into v_duplicate_token
    from public.receipts r
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

  insert into public.tickets (org_id, branch_id, customer_id, appointment_id, status, totals_json)
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

  insert into public.ticket_items (org_id, ticket_id, service_id, qty, unit_price, vat_rate)
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
  join public.services s on s.id = x.service_id and s.org_id = v_org_id;

  insert into public.payments (org_id, ticket_id, method, amount, status)
  values (v_org_id, v_ticket_id, p_payment_method, v_grand_total, 'PAID');

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_expires_at := now() + make_interval(days => v_days);

  insert into public.receipts (org_id, ticket_id, public_token, expires_at)
  values (v_org_id, v_ticket_id, v_token, v_expires_at);

  if p_appointment_id is not null then
    update public.appointments
    set status = 'DONE'
    where id = p_appointment_id
      and org_id = v_org_id
      and branch_id = v_branch_id;
  end if;

  if p_idempotency_key is not null and btrim(p_idempotency_key) <> '' then
    insert into public.checkout_requests (org_id, idempotency_key, ticket_id, created_by)
    values (v_org_id, p_idempotency_key, v_ticket_id, v_uid)
    on conflict (org_id, idempotency_key)
    do update set ticket_id = excluded.ticket_id;
  end if;

  return jsonb_build_object(
    'ticketId', v_ticket_id,
    'branchId', v_branch_id,
    'receiptToken', v_token,
    'grandTotal', v_grand_total,
    'deduped', false
  );
end;
$$;

create or replace function public.list_customers_crm(
  p_search text default null,
  p_status text default null,
  p_dormant_days int default null,
  p_vip_only boolean default false,
  p_source text default null,
  p_branch_id uuid default null
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
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if not public.can_access_crm() then
    raise exception 'FORBIDDEN';
  end if;

  if p_branch_id is not null and not public.can_access_crm_branch(p_branch_id) then
    raise exception 'ACCESS_DENIED';
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
  where c.org_id = public.my_org_id()
    and public.can_access_crm_branch(c.branch_id)
    and (
      p_branch_id is null
      or c.branch_id = p_branch_id
    )
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
language sql
security definer
set search_path = public
as $$
  select *
  from public.list_customers_crm(
    p_search,
    p_status,
    p_dormant_days,
    p_vip_only,
    p_source,
    null::uuid
  )
$$;

create or replace function public.get_customer_crm_detail(p_customer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_row public.customers;
  v_customer jsonb;
  v_appointments jsonb;
  v_tickets jsonb;
  v_booking_requests jsonb;
  v_activities jsonb;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select *
  into v_customer_row
  from public.customers c
  where c.id = p_customer_id
    and c.org_id = public.my_org_id()
    and c.merged_into_customer_id is null;

  if v_customer_row.id is null then
    raise exception 'CUSTOMER_NOT_FOUND';
  end if;

  if not public.can_access_crm_branch(v_customer_row.branch_id) then
    raise exception 'ACCESS_DENIED';
  end if;

  select to_jsonb(x)
  into v_customer
  from (
    select
      c.id,
      c.org_id,
      c.branch_id,
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
  ) x;

  select coalesce(jsonb_agg(to_jsonb(a) order by a.start_at desc), '[]'::jsonb)
  into v_appointments
  from (
    select id, branch_id, start_at, end_at, status, staff_user_id, resource_id
    from public.appointments
    where customer_id = p_customer_id
      and org_id = public.my_org_id()
      and public.can_access_branch(branch_id)
    order by start_at desc
    limit 50
  ) a;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc), '[]'::jsonb)
  into v_tickets
  from (
    select
      t.id,
      t.branch_id,
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
      and t.org_id = public.my_org_id()
      and public.can_access_branch(
        t.branch_id,
        array['OWNER','PARTNER','MANAGER','RECEPTION','ACCOUNTANT']
      )
    order by t.created_at desc
    limit 50
  ) t;

  select coalesce(jsonb_agg(to_jsonb(b) order by b.created_at desc), '[]'::jsonb)
  into v_booking_requests
  from (
    select
      br.id,
      br.branch_id,
      br.customer_name,
      br.customer_phone,
      br.requested_service,
      br.requested_start_at,
      br.requested_end_at,
      br.source,
      br.status,
      br.created_at
    from public.booking_requests br
    where br.org_id = public.my_org_id()
      and public.can_access_crm_branch(br.branch_id)
      and (
        public.normalize_customer_phone(br.customer_phone) = public.normalize_customer_phone(v_customer_row.phone)
        or lower(trim(br.customer_name)) = lower(trim(coalesce(v_customer_row.full_name, v_customer_row.name)))
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
  v_branch_id uuid;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select c.branch_id
  into v_branch_id
  from public.customers c
  where c.id = p_customer_id
    and c.org_id = public.my_org_id();

  if v_branch_id is null then
    raise exception 'CUSTOMER_NOT_FOUND';
  end if;

  if not public.can_access_crm_branch(v_branch_id) then
    raise exception 'ACCESS_DENIED';
  end if;

  update public.customers
  set
    care_note = p_care_note,
    tags = coalesce(p_tags, '{}'::text[]),
    next_follow_up_at = p_next_follow_up_at,
    follow_up_status = coalesce(p_follow_up_status, 'PENDING'),
    last_contacted_at = now()
  where id = p_customer_id
    and org_id = public.my_org_id()
    and branch_id = v_branch_id;

  perform public.append_customer_activity(
    public.my_org_id(),
    p_customer_id,
    'FOLLOW_UP_NOTE',
    'MANUAL',
    coalesce(nullif(trim(p_care_note), ''), 'Cap nhat ghi chu cham soc'),
    auth.uid()
  );

  return jsonb_build_object('ok', true, 'customer_id', p_customer_id);
end;
$$;

create or replace function public.list_follow_up_candidates(
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_branch_id uuid default null
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
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if not public.can_access_crm() then
    raise exception 'FORBIDDEN';
  end if;

  if p_branch_id is not null and not public.can_access_crm_branch(p_branch_id) then
    raise exception 'ACCESS_DENIED';
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
  where c.org_id = public.my_org_id()
    and public.can_access_crm_branch(c.branch_id)
    and (
      p_branch_id is null
      or c.branch_id = p_branch_id
    )
    and c.next_follow_up_at is not null
    and (p_from is null or c.next_follow_up_at >= p_from)
    and (p_to is null or c.next_follow_up_at <= p_to)
    and coalesce(c.follow_up_status, 'PENDING') <> 'DONE'
  order by c.next_follow_up_at asc, c.total_spend desc;
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
language sql
security definer
set search_path = public
as $$
  select *
  from public.list_follow_up_candidates(p_from, p_to, null::uuid)
$$;

grant execute on function public.upsert_customer_by_identity(uuid, text, text, text, text, uuid) to authenticated, service_role;
grant execute on function public.upsert_customer_by_identity(uuid, text, text, text, text) to authenticated, service_role;
grant execute on function public.list_team_members_secure() to authenticated;
grant execute on function public.list_team_members_secure_v2() to authenticated;
grant execute on function public.get_ticket_detail_secure(uuid) to authenticated;
grant execute on function public.get_report_breakdown_secure(timestamptz, timestamptz, uuid) to authenticated;
grant execute on function public.get_report_breakdown_secure(timestamptz, timestamptz) to authenticated;
grant execute on function public.generate_invite_code_secure(uuid, text, text) to authenticated;
grant execute on function public.generate_invite_code_secure(text, text) to authenticated;
grant execute on function public.convert_booking_request_to_appointment_secure(uuid, uuid, uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.checkout_close_ticket_secure(text, text, jsonb, uuid, int, text) to authenticated;
grant execute on function public.list_customers_crm(text, text, int, boolean, text, uuid) to authenticated;
grant execute on function public.list_customers_crm(text, text, int, boolean, text) to authenticated;
grant execute on function public.get_customer_crm_detail(uuid) to authenticated;
grant execute on function public.update_customer_care_note(uuid, text, text[], timestamptz, text) to authenticated;
grant execute on function public.list_follow_up_candidates(timestamptz, timestamptz, uuid) to authenticated;
grant execute on function public.list_follow_up_candidates(timestamptz, timestamptz) to authenticated;

commit;
