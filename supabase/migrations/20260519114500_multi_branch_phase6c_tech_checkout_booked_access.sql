begin;

drop policy if exists "appointments branch read" on public.appointments;

create policy "appointments branch read"
on public.appointments
for select
to authenticated
using (
  org_id = public.my_org_id()
  and (
    public.can_access_branch(
      branch_id,
      array['OWNER','PARTNER','MANAGER','RECEPTION','ACCOUNTANT']
    )
    or staff_user_id = auth.uid()
    or (
      status in ('BOOKED','CHECKED_IN')
      and public.can_access_branch(branch_id, array['TECH'])
    )
  )
);

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
  v_is_tech boolean := false;
  v_has_open_shift boolean := false;
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

create or replace function public.create_checkout_secure(
  p_customer_name text,
  p_payment_method text,
  p_lines jsonb,
  p_appointment_id uuid default null,
  p_dedupe_window_ms int default 15000,
  p_idempotency_key text default null
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
    p_idempotency_key
  )
$$;

commit;
