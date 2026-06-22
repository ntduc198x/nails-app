begin;

drop function if exists public.checkout_close_ticket_secure(text, text, jsonb, uuid, int, text);
drop function if exists public.create_checkout_secure(text, text, jsonb, uuid, int, text);
drop function if exists public.update_closed_ticket_secure(uuid, text, jsonb);

create or replace function public.checkout_close_ticket_secure(
  p_customer_name text,
  p_payment_method text,
  p_lines jsonb,
  p_appointment_id uuid default null,
  p_dedupe_window_ms int default 15000,
  p_idempotency_key text default null,
  p_discount_type text default null,
  p_discount_value numeric default null
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
  v_appointment_customer_id uuid;
  v_customer_name text;
  v_subtotal numeric := 0;
  v_vat_total numeric := 0;
  v_pre_discount_total numeric := 0;
  v_discount_type text := 'amount';
  v_discount_value numeric := 0;
  v_discount_total numeric := 0;
  v_grand_total numeric := 0;
  v_ticket_id uuid;
  v_token text;
  v_expires_at timestamptz;
  v_days int := 30;
  v_duplicate_ticket_id uuid;
  v_duplicate_token text;
  v_existing_ticket_id uuid;
  v_existing_token text;
  v_is_tech boolean := false;
  v_has_open_shift boolean := false;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  v_customer_name := nullif(btrim(p_customer_name), '');
  if v_customer_name is null then
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
    select a.branch_id, a.customer_id
    into v_branch_id, v_appointment_customer_id
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

  v_is_tech := public.can_access_branch(v_branch_id, array['TECH']);

  if v_is_tech then
    select exists (
      select 1
      from public.time_entries te
      where te.org_id = v_org_id
        and te.branch_id = v_branch_id
        and te.staff_user_id = v_uid
        and te.clock_out is null
    )
    into v_has_open_shift;
  end if;

  if not (
    public.can_access_branch(
      v_branch_id,
      array['OWNER','PARTNER','MANAGER','RECEPTION']
    )
    or (v_is_tech and v_has_open_shift)
  ) then
    if v_is_tech then
      raise exception 'TECH chỉ được checkout khi đang mở ca.';
    end if;

    raise exception 'ACCESS_DENIED';
  end if;

  if v_appointment_customer_id is not null then
    v_customer_id := v_appointment_customer_id;

    update public.customers c
    set name = case
          when btrim(coalesce(c.name, '')) = '' then v_customer_name
          else c.name
        end,
        full_name = case
          when btrim(coalesce(c.full_name, '')) = '' then v_customer_name
          else c.full_name
        end
    where c.id = v_customer_id
      and c.org_id = v_org_id;
  else
    v_customer_id := public.upsert_customer_by_identity(
      v_org_id,
      v_customer_name,
      null,
      'APP',
      null,
      v_branch_id
    );
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
  join public.services s on s.id = x.service_id and s.org_id = v_org_id;

  if v_subtotal <= 0 then
    raise exception 'INVALID_SERVICES';
  end if;

  v_pre_discount_total := v_subtotal + v_vat_total;
  v_discount_type := lower(coalesce(nullif(btrim(p_discount_type), ''), 'amount'));
  v_discount_value := coalesce(p_discount_value, 0);

  if v_discount_type not in ('amount', 'percent') then
    raise exception 'INVALID_DISCOUNT_TYPE';
  end if;

  if v_discount_value < 0 then
    raise exception 'INVALID_DISCOUNT_VALUE';
  end if;

  if v_discount_type = 'percent' then
    if v_discount_value > 100 then
      raise exception 'INVALID_DISCOUNT_VALUE';
    end if;
    v_discount_total := round((v_pre_discount_total * v_discount_value / 100.0)::numeric, 2);
  else
    v_discount_total := round(v_discount_value, 2);
  end if;

  if v_discount_total > v_pre_discount_total then
    raise exception 'DISCOUNT_EXCEEDS_TOTAL';
  end if;

  v_grand_total := greatest(v_pre_discount_total - v_discount_total, 0);

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
      'discount_total', v_discount_total,
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
    insert into public.checkout_requests (org_id, idempotency_key, ticket_id, created_by, created_at)
    values (v_org_id, p_idempotency_key, v_ticket_id, v_uid, now())
    on conflict (org_id, idempotency_key) do nothing;
  end if;

  return jsonb_build_object(
    'ticketId', v_ticket_id,
    'receiptToken', v_token,
    'grandTotal', v_grand_total,
    'deduped', false
  );
end;
$$;

create or replace function public.create_checkout_secure(
  p_customer_name text,
  p_payment_method text,
  p_lines jsonb,
  p_appointment_id uuid default null,
  p_dedupe_window_ms int default 15000,
  p_idempotency_key text default null,
  p_discount_type text default null,
  p_discount_value numeric default null
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.checkout_close_ticket_secure(
    p_customer_name,
    p_payment_method,
    p_lines,
    p_appointment_id,
    p_dedupe_window_ms,
    p_idempotency_key,
    p_discount_type,
    p_discount_value
  )
$$;

create or replace function public.update_closed_ticket_secure(
  p_ticket_id uuid,
  p_payment_method text,
  p_lines jsonb,
  p_discount_type text default null,
  p_discount_value numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.tickets;
  v_org_id uuid;
  v_line_count int := 0;
  v_service_count int := 0;
  v_subtotal numeric := 0;
  v_vat_total numeric := 0;
  v_pre_discount_total numeric := 0;
  v_discount_type text := 'amount';
  v_discount_value numeric := 0;
  v_discount_total numeric := 0;
  v_grand_total numeric := 0;
  v_receipt_token text;
  v_receipt_expires_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if p_payment_method not in ('CASH', 'TRANSFER') then
    raise exception 'INVALID_PAYMENT_METHOD';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'CHECKOUT_LINES_REQUIRED';
  end if;

  v_org_id := public.my_org_id();
  if v_org_id is null then
    raise exception 'ORG_NOT_FOUND';
  end if;

  select *
  into v_ticket
  from public.tickets t
  where t.id = p_ticket_id
    and t.org_id = v_org_id;

  if v_ticket.id is null then
    raise exception 'TICKET_NOT_FOUND';
  end if;

  if v_ticket.status <> 'CLOSED' then
    raise exception 'TICKET_NOT_EDITABLE';
  end if;

  if not public.can_access_branch(v_ticket.branch_id, array['OWNER','PARTNER']) then
    raise exception 'ACCESS_DENIED';
  end if;

  select
    count(*)::int,
    count(s.id)::int,
    coalesce(sum(s.base_price * x.qty), 0),
    coalesce(sum(s.base_price * x.qty * s.vat_rate), 0)
  into
    v_line_count,
    v_service_count,
    v_subtotal,
    v_vat_total
  from (
    select
      (elem->>'serviceId')::uuid as service_id,
      greatest((elem->>'qty')::int, 1) as qty
    from jsonb_array_elements(p_lines) elem
  ) x
  left join public.services s
    on s.id = x.service_id
   and s.org_id = v_org_id;

  if v_line_count = 0 or v_service_count <> v_line_count or v_subtotal <= 0 then
    raise exception 'INVALID_SERVICES';
  end if;

  v_pre_discount_total := v_subtotal + v_vat_total;
  v_discount_type := lower(coalesce(nullif(btrim(p_discount_type), ''), 'amount'));
  v_discount_value := coalesce(p_discount_value, 0);

  if v_discount_type not in ('amount', 'percent') then
    raise exception 'INVALID_DISCOUNT_TYPE';
  end if;

  if v_discount_value < 0 then
    raise exception 'INVALID_DISCOUNT_VALUE';
  end if;

  if v_discount_type = 'percent' then
    if v_discount_value > 100 then
      raise exception 'INVALID_DISCOUNT_VALUE';
    end if;
    v_discount_total := round((v_pre_discount_total * v_discount_value / 100.0)::numeric, 2);
  else
    v_discount_total := round(v_discount_value, 2);
  end if;

  if v_discount_total > v_pre_discount_total then
    raise exception 'DISCOUNT_EXCEEDS_TOTAL';
  end if;

  v_grand_total := greatest(v_pre_discount_total - v_discount_total, 0);

  update public.tickets
  set totals_json = jsonb_build_object(
    'subtotal', v_subtotal,
    'discount_total', v_discount_total,
    'vat_total', v_vat_total,
    'grand_total', v_grand_total
  )
  where id = v_ticket.id
    and org_id = v_org_id;

  delete from public.ticket_items
  where ticket_id = v_ticket.id
    and org_id = v_org_id;

  insert into public.ticket_items (org_id, ticket_id, service_id, qty, unit_price, vat_rate)
  select
    v_org_id,
    v_ticket.id,
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
  join public.services s
    on s.id = x.service_id
   and s.org_id = v_org_id;

  update public.payments
  set method = p_payment_method,
      amount = v_grand_total,
      status = 'PAID'
  where ticket_id = v_ticket.id
    and org_id = v_org_id;

  if not found then
    insert into public.payments (org_id, ticket_id, method, amount, status)
    values (v_org_id, v_ticket.id, p_payment_method, v_grand_total, 'PAID');
  end if;

  select r.public_token, r.expires_at
  into v_receipt_token, v_receipt_expires_at
  from public.receipts r
  where r.ticket_id = v_ticket.id
    and r.org_id = v_org_id
  order by r.created_at desc
  limit 1;

  if v_receipt_token is null then
    v_receipt_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    v_receipt_expires_at := now() + interval '30 days';

    insert into public.receipts (org_id, ticket_id, public_token, expires_at)
    values (v_org_id, v_ticket.id, v_receipt_token, v_receipt_expires_at);
  end if;

  return jsonb_build_object(
    'ticketId', v_ticket.id,
    'receiptToken', v_receipt_token,
    'grandTotal', v_grand_total
  );
end;
$$;

commit;
