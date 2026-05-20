create or replace function public.enforce_appointment_status_transition()
returns trigger
language plpgsql
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if old.status = 'BOOKED' and new.status in ('CHECKED_IN', 'CANCELLED', 'NO_SHOW') then
    return new;
  elsif old.status = 'CHECKED_IN' and new.status in ('DONE', 'CANCELLED', 'NO_SHOW') then
    return new;
  end if;

  raise exception 'INVALID_APPOINTMENT_STATUS_TRANSITION: % -> %', old.status, new.status;
end;
$$;

create or replace function public.list_tax_book_rows_secure(
  p_type text,
  p_from timestamptz,
  p_to timestamptz,
  p_branch_id uuid default null
)
returns table (
  date timestamptz,
  description text,
  amount numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_effective_branch_id uuid := p_branch_id;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if p_type not in ('S1A_HKD', 'S2A_HKD', 'S3A_HKD') then
    raise exception 'INVALID_TAX_BOOK_TYPE';
  end if;

  if p_to <= p_from then
    raise exception 'INVALID_TIME_RANGE';
  end if;

  if v_effective_branch_id is not null then
    if not public.can_access_branch(
      v_effective_branch_id,
      array['OWNER','PARTNER','ACCOUNTANT']
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
      array['OWNER','PARTNER','ACCOUNTANT']
    ) then
      raise exception 'ACCESS_DENIED';
    end if;
  end if;

  if p_type in ('S1A_HKD', 'S2A_HKD') then
    return query
    with ticket_rows as (
      select
        t.created_at,
        coalesce(
          string_agg(distinct s.name, ' + ') filter (where s.name is not null and btrim(s.name) <> ''),
          'Dich vu'
        ) as service_label,
        coalesce(nullif(trim(c.full_name), ''), nullif(trim(c.name), ''), 'khach le') as customer_label,
        coalesce((t.totals_json->>'grand_total')::numeric, 0) as grand_total,
        coalesce((t.totals_json->>'vat_total')::numeric, 0) as vat_total
      from public.tickets t
      left join public.customers c on c.id = t.customer_id
      left join public.ticket_items ti on ti.ticket_id = t.id
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
          array['OWNER','PARTNER','ACCOUNTANT']
        )
      group by
        t.id,
        t.created_at,
        coalesce(nullif(trim(c.full_name), ''), nullif(trim(c.name), ''), 'khach le'),
        coalesce((t.totals_json->>'grand_total')::numeric, 0),
        coalesce((t.totals_json->>'vat_total')::numeric, 0)
    )
    select
      ticket_rows.created_at as date,
      case
        when p_type = 'S2A_HKD' then 'VAT - '
        else ''
      end || ticket_rows.service_label || ' - ' || ticket_rows.customer_label as description,
      case
        when p_type = 'S2A_HKD' then ticket_rows.vat_total
        else ticket_rows.grand_total
      end as amount
    from ticket_rows
    order by ticket_rows.created_at asc;

    return;
  end if;

  return query
  select
    te.effective_clock_in as date,
    'Cong tho ' || left(coalesce(te.staff_user_id::text, 'staff'), 8) || ' (' ||
      greatest(
        0,
        round(
          extract(
            epoch from coalesce(te.effective_clock_out, now()) - te.effective_clock_in
          ) / 60.0
        )
      )::int || ' phut)' as description,
    0::numeric as amount
  from public.time_entries te
  where te.org_id = public.my_org_id()
    and te.approval_status = 'APPROVED'
    and te.clock_in >= p_from
    and te.clock_in < p_to
    and (
      v_effective_branch_id is null
      or te.branch_id = v_effective_branch_id
    )
    and public.can_access_branch(
      te.branch_id,
      array['OWNER','PARTNER','ACCOUNTANT']
    )
  order by te.effective_clock_in asc;
end;
$$;

grant execute on function public.list_tax_book_rows_secure(text, timestamptz, timestamptz, uuid) to authenticated;
