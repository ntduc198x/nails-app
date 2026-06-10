begin;

revoke insert, update, delete on table public.tickets from authenticated;
revoke insert, update, delete on table public.ticket_items from authenticated;
revoke insert, update, delete on table public.payments from authenticated;
revoke insert, update, delete on table public.receipts from authenticated;

grant select on table public.tickets to authenticated;
grant select on table public.ticket_items to authenticated;
grant select on table public.payments to authenticated;
grant select on table public.receipts to authenticated;

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
      ti.service_id,
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

create or replace function public.update_closed_ticket_secure(
  p_ticket_id uuid,
  p_payment_method text,
  p_lines jsonb
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

  v_grand_total := v_subtotal + v_vat_total;

  update public.tickets
  set totals_json = jsonb_build_object(
    'subtotal', v_subtotal,
    'discount_total', 0,
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

revoke all on function public.update_closed_ticket_secure(uuid, text, jsonb) from public;
revoke all on function public.update_closed_ticket_secure(uuid, text, jsonb) from anon;
grant execute on function public.update_closed_ticket_secure(uuid, text, jsonb) to authenticated;

commit;
