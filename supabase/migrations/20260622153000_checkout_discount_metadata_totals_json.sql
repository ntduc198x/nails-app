begin;

create or replace function public.create_checkout_secure(
  p_customer_name text,
  p_payment_method text,
  p_lines jsonb,
  p_appointment_id uuid default null,
  p_dedupe_window_ms int default 90000,
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
  v_org_id uuid;
  v_branch_id uuid;
  v_customer_id uuid;
  v_ticket_id uuid;
  v_token text;
  v_days int := 30;
  v_expires_at timestamptz;
  v_existing_ticket_id uuid;
  v_existing_token text;
  v_duplicate_ticket_id uuid;
  v_duplicate_token text;
  v_subtotal numeric := 0;
  v_vat_total numeric := 0;
  v_pre_discount_total numeric := 0;
  v_discount_type text := 'amount';
  v_discount_value numeric := 0;
  v_discount_total numeric := 0;
  v_grand_total numeric := 0;
begin
  select org_id, branch_id
    into v_org_id, v_branch_id
  from public.get_my_context();

  if v_org_id is null then
    raise exception 'FORBIDDEN';
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

  if p_appointment_id is not null then
    perform 1
    from public.appointments a
    where a.id = p_appointment_id
      and a.org_id = v_org_id
      and a.branch_id = v_branch_id
      and a.status = 'CHECKED_IN';

    if not found then
      raise exception 'INVALID_APPOINTMENT_STATUS_TRANSITION';
    end if;
  end if;

  insert into public.customers (org_id, name)
  values (v_org_id, btrim(p_customer_name))
  returning id into v_customer_id;

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
      'discount_type', v_discount_type,
      'discount_value', v_discount_value,
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
      and org_id = v_org_id;
  end if;

  if p_idempotency_key is not null and btrim(p_idempotency_key) <> '' then
    insert into public.checkout_requests (org_id, idempotency_key, ticket_id)
    values (v_org_id, p_idempotency_key, v_ticket_id)
    on conflict (org_id, idempotency_key) do update
      set ticket_id = excluded.ticket_id,
          created_at = now();
  end if;

  return jsonb_build_object(
    'ticketId', v_ticket_id,
    'receiptToken', v_token,
    'grandTotal', v_grand_total,
    'deduped', false
  );
end;
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
  v_org_id uuid;
  v_branch_id uuid;
  v_ticket record;
  v_receipt_token text;
  v_receipt_expires_at timestamptz;
  v_subtotal numeric := 0;
  v_vat_total numeric := 0;
  v_pre_discount_total numeric := 0;
  v_discount_type text := 'amount';
  v_discount_value numeric := 0;
  v_discount_total numeric := 0;
  v_grand_total numeric := 0;
begin
  select org_id, branch_id
    into v_org_id, v_branch_id
  from public.get_my_context();

  if v_org_id is null then
    raise exception 'FORBIDDEN';
  end if;

  if p_payment_method not in ('CASH', 'TRANSFER') then
    raise exception 'INVALID_PAYMENT_METHOD';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'CHECKOUT_LINES_REQUIRED';
  end if;

  select t.id, t.customer_id
  into v_ticket
  from public.tickets t
  where t.id = p_ticket_id
    and t.org_id = v_org_id
    and t.branch_id = v_branch_id
    and t.status = 'CLOSED';

  if not found then
    raise exception 'TICKET_NOT_FOUND';
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
  join public.services s
    on s.id = x.service_id
   and s.org_id = v_org_id;

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

  update public.tickets
  set totals_json = jsonb_build_object(
    'subtotal', v_subtotal,
    'discount_total', v_discount_total,
    'discount_type', v_discount_type,
    'discount_value', v_discount_value,
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
