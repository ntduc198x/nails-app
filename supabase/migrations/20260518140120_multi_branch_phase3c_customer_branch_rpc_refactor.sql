begin;

create or replace function public.refresh_customer_metrics(
  p_customer_id uuid default null,
  p_org_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer record;
  v_updated integer := 0;
  v_first_visit timestamptz;
  v_last_visit timestamptz;
  v_total_visits integer;
  v_total_spend numeric(12,2);
  v_last_service_summary text;
  v_favorite_staff_user_id uuid;
  v_status text;
  v_next_follow_up_at timestamptz;
  v_last_contacted_at timestamptz;
  v_follow_up_status text;
begin
  for v_customer in
    select c.id, c.org_id
    from public.customers c
    where (p_customer_id is null or c.id = p_customer_id)
      and (p_org_id is null or c.org_id = p_org_id)
      and c.merged_into_customer_id is null
  loop
    insert into public.customer_branches (customer_id, org_id, branch_id)
    select distinct src.customer_id, src.org_id, src.branch_id
    from (
      select t.customer_id, t.org_id, t.branch_id
      from public.tickets t
      where t.customer_id = v_customer.id
        and t.branch_id is not null
      union
      select a.customer_id, a.org_id, a.branch_id
      from public.appointments a
      where a.customer_id = v_customer.id
        and a.branch_id is not null
      union
      select br.customer_id, br.org_id, br.branch_id
      from public.booking_requests br
      where br.customer_id = v_customer.id
        and br.branch_id is not null
      union
      select c.id, c.org_id, c.branch_id
      from public.customers c
      where c.id = v_customer.id
        and c.branch_id is not null
    ) src
    on conflict (customer_id, branch_id) do nothing;

    with branch_metrics as (
      select
        cb.customer_id,
        cb.org_id,
        cb.branch_id,
        (
          select min(val)
          from (
            values
              ((select min(a.start_at)
                from public.appointments a
                where a.customer_id = cb.customer_id
                  and a.branch_id = cb.branch_id
                  and a.status in ('BOOKED','CHECKED_IN','DONE'))),
              ((select min(t.created_at)
                from public.tickets t
                where t.customer_id = cb.customer_id
                  and t.branch_id = cb.branch_id)),
              ((select min(coalesce(br.requested_start_at, br.created_at))
                from public.booking_requests br
                where br.customer_id = cb.customer_id
                  and br.branch_id = cb.branch_id)),
              (cb.first_seen_at),
              (cb.created_at)
          ) as first_points(val)
          where val is not null
        ) as first_seen_at,
        (
          select max(val)
          from (
            values
              ((select max(a.start_at)
                from public.appointments a
                where a.customer_id = cb.customer_id
                  and a.branch_id = cb.branch_id
                  and a.status in ('BOOKED','CHECKED_IN','DONE'))),
              ((select max(t.created_at)
                from public.tickets t
                where t.customer_id = cb.customer_id
                  and t.branch_id = cb.branch_id)),
              ((select max(coalesce(br.requested_end_at, br.requested_start_at, br.created_at))
                from public.booking_requests br
                where br.customer_id = cb.customer_id
                  and br.branch_id = cb.branch_id)),
              (cb.last_seen_at),
              (cb.created_at)
          ) as last_points(val)
          where val is not null
        ) as last_seen_at,
        coalesce((
          select count(*)
          from public.tickets t
          where t.customer_id = cb.customer_id
            and t.branch_id = cb.branch_id
            and t.status = 'CLOSED'
        ), 0)::integer as closed_ticket_visits,
        coalesce((
          select count(*)
          from public.appointments a
          where a.customer_id = cb.customer_id
            and a.branch_id = cb.branch_id
            and a.status in ('DONE','CHECKED_IN')
        ), 0)::integer as done_appointment_visits,
        coalesce((
          select sum((t.totals_json ->> 'grand_total')::numeric)
          from public.tickets t
          where t.customer_id = cb.customer_id
            and t.branch_id = cb.branch_id
            and t.status = 'CLOSED'
        ), 0)::numeric(12,2) as total_spend,
        (
          select string_agg(distinct s.name, ', ' order by s.name)
          from public.tickets t
          join public.ticket_items ti on ti.ticket_id = t.id
          left join public.services s on s.id = ti.service_id
          where t.customer_id = cb.customer_id
            and t.branch_id = cb.branch_id
            and t.status = 'CLOSED'
            and t.created_at = (
              select max(t2.created_at)
              from public.tickets t2
              where t2.customer_id = cb.customer_id
                and t2.branch_id = cb.branch_id
                and t2.status = 'CLOSED'
            )
        ) as last_service_summary,
        (
          select staff_rank.staff_user_id
          from (
            select
              a.staff_user_id,
              count(*) as visit_count,
              max(coalesce(t.created_at, a.start_at)) as last_seen_at
            from public.appointments a
            left join public.tickets t
              on t.appointment_id = a.id
             and t.customer_id = a.customer_id
             and t.branch_id = a.branch_id
             and t.status = 'CLOSED'
            where a.customer_id = cb.customer_id
              and a.branch_id = cb.branch_id
              and a.staff_user_id is not null
            group by a.staff_user_id
            order by visit_count desc, last_seen_at desc
            limit 1
          ) as staff_rank
        ) as favorite_staff_user_id
      from public.customer_branches cb
      where cb.customer_id = v_customer.id
        and cb.org_id = v_customer.org_id
    )
    update public.customer_branches cb
    set
      first_seen_at = bm.first_seen_at,
      last_seen_at = bm.last_seen_at,
      total_visits = case
        when bm.closed_ticket_visits > 0 then bm.closed_ticket_visits
        else bm.done_appointment_visits
      end,
      total_spend = bm.total_spend,
      customer_status = case
        when bm.total_spend >= 3000000 or (case when bm.closed_ticket_visits > 0 then bm.closed_ticket_visits else bm.done_appointment_visits end) >= 8 then 'VIP'
        when bm.last_seen_at is not null and bm.last_seen_at < now() - interval '60 days' then 'LOST'
        when bm.last_seen_at is not null and bm.last_seen_at < now() - interval '30 days' then 'AT_RISK'
        when (case when bm.closed_ticket_visits > 0 then bm.closed_ticket_visits else bm.done_appointment_visits end) >= 3 then 'RETURNING'
        when (case when bm.closed_ticket_visits > 0 then bm.closed_ticket_visits else bm.done_appointment_visits end) >= 1 then 'ACTIVE'
        else 'NEW'
      end,
      favorite_staff_user_id = coalesce(bm.favorite_staff_user_id, cb.favorite_staff_user_id),
      next_follow_up_at = case
        when cb.follow_up_status = 'DONE' then cb.next_follow_up_at
        when cb.next_follow_up_at is not null then cb.next_follow_up_at
        when bm.last_seen_at is not null then bm.last_seen_at + make_interval(days => public.infer_follow_up_days(bm.last_service_summary))
        else null
      end,
      updated_at = now()
    from branch_metrics bm
    where cb.customer_id = bm.customer_id
      and cb.org_id = bm.org_id
      and cb.branch_id = bm.branch_id;

    select
      min(cb.first_seen_at),
      max(cb.last_seen_at),
      coalesce(sum(cb.total_visits), 0)::integer,
      coalesce(sum(cb.total_spend), 0)::numeric(12,2),
      max(cb.last_contacted_at),
      min(cb.next_follow_up_at) filter (where coalesce(cb.follow_up_status, 'PENDING') <> 'DONE'),
      case
        when count(*) filter (where coalesce(cb.follow_up_status, 'PENDING') <> 'DONE' and cb.next_follow_up_at is not null) > 0 then 'PENDING'
        when count(*) filter (where cb.follow_up_status = 'DONE') > 0 then 'DONE'
        else null
      end
    into
      v_first_visit,
      v_last_visit,
      v_total_visits,
      v_total_spend,
      v_last_contacted_at,
      v_next_follow_up_at,
      v_follow_up_status
    from public.customer_branches cb
    where cb.customer_id = v_customer.id
      and cb.org_id = v_customer.org_id;

    select string_agg(distinct s.name, ', ' order by s.name)
    into v_last_service_summary
    from public.tickets t
    join public.ticket_items ti on ti.ticket_id = t.id
    left join public.services s on s.id = ti.service_id
    where t.customer_id = v_customer.id
      and t.status = 'CLOSED'
      and t.created_at = (
        select max(t2.created_at)
        from public.tickets t2
        where t2.customer_id = v_customer.id
          and t2.status = 'CLOSED'
      );

    select staff_rank.staff_user_id
    into v_favorite_staff_user_id
    from (
      select
        a.staff_user_id,
        count(*) as visit_count,
        max(coalesce(t.created_at, a.start_at)) as last_seen_at
      from public.appointments a
      left join public.tickets t
        on t.appointment_id = a.id
       and t.customer_id = a.customer_id
       and t.status = 'CLOSED'
      where a.customer_id = v_customer.id
        and a.staff_user_id is not null
      group by a.staff_user_id
      order by visit_count desc, last_seen_at desc
      limit 1
    ) as staff_rank;

    if v_total_spend >= 3000000 or v_total_visits >= 8 then
      v_status := 'VIP';
    elsif v_last_visit is not null and v_last_visit < now() - interval '60 days' then
      v_status := 'LOST';
    elsif v_last_visit is not null and v_last_visit < now() - interval '30 days' then
      v_status := 'AT_RISK';
    elsif v_total_visits >= 3 then
      v_status := 'RETURNING';
    elsif v_total_visits >= 1 then
      v_status := 'ACTIVE';
    else
      v_status := 'NEW';
    end if;

    update public.customers c
    set
      full_name = coalesce(nullif(trim(c.full_name), ''), c.name),
      normalized_phone = public.normalize_customer_phone(c.phone),
      first_visit_at = v_first_visit,
      last_visit_at = v_last_visit,
      total_visits = coalesce(v_total_visits, 0),
      total_spend = coalesce(v_total_spend, 0),
      last_service_summary = v_last_service_summary,
      favorite_staff_user_id = coalesce(v_favorite_staff_user_id, c.favorite_staff_user_id),
      customer_status = v_status,
      next_follow_up_at = coalesce(v_next_follow_up_at, c.next_follow_up_at),
      last_contacted_at = coalesce(v_last_contacted_at, c.last_contacted_at),
      follow_up_status = coalesce(v_follow_up_status, c.follow_up_status),
      branch_id = coalesce(
        c.branch_id,
        (
          select cb.branch_id
          from public.customer_branches cb
          where cb.customer_id = c.id
            and cb.org_id = c.org_id
          order by cb.created_at asc, cb.branch_id asc
          limit 1
        )
      )
    where c.id = v_customer.id;

    v_updated := v_updated + 1;
  end loop;

  return v_updated;
end;
$$;

create or replace function public.upsert_customer_by_identity_secure(
  p_branch_id uuid,
  p_full_name text,
  p_phone text,
  p_care_note text default null,
  p_source text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_customer_id uuid;
  v_normalized_phone text;
  v_branch_id uuid := p_branch_id;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if p_full_name is null or btrim(p_full_name) = '' then
    raise exception 'CUSTOMER_NAME_REQUIRED';
  end if;

  v_org_id := public.my_org_id();

  if v_org_id is null then
    raise exception 'NO_ORG';
  end if;

  if v_branch_id is null then
    v_branch_id := public.my_default_branch_id();
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
    raise exception 'BRANCH_REQUIRED';
  end if;

  if not public.can_access_branch(
    v_branch_id,
    array['OWNER','PARTNER','MANAGER','RECEPTION']
  ) then
    raise exception 'ACCESS_DENIED';
  end if;

  v_normalized_phone := public.normalize_customer_phone(p_phone);

  if v_normalized_phone is not null then
    select c.id
    into v_customer_id
    from public.customers c
    where c.org_id = v_org_id
      and c.normalized_phone = v_normalized_phone
      and c.merged_into_customer_id is null
    order by c.created_at asc
    limit 1;
  end if;

  if v_customer_id is null then
    insert into public.customers (
      org_id,
      branch_id,
      name,
      full_name,
      phone,
      normalized_phone,
      global_note,
      notes,
      needs_merge_review
    )
    values (
      v_org_id,
      v_branch_id,
      p_full_name,
      p_full_name,
      nullif(trim(coalesce(p_phone, '')), ''),
      v_normalized_phone,
      p_care_note,
      p_care_note,
      v_normalized_phone is null
    )
    returning id into v_customer_id;
  else
    update public.customers c
    set
      full_name = coalesce(nullif(trim(c.full_name), ''), p_full_name),
      name = coalesce(c.name, p_full_name),
      phone = coalesce(c.phone, nullif(trim(coalesce(p_phone, '')), '')),
      normalized_phone = coalesce(c.normalized_phone, v_normalized_phone),
      global_note = case
        when p_care_note is null or btrim(p_care_note) = '' then c.global_note
        when c.global_note is null or btrim(c.global_note) = '' then p_care_note
        when position(p_care_note in c.global_note) > 0 then c.global_note
        else c.global_note || E'\n' || p_care_note
      end,
      branch_id = coalesce(c.branch_id, v_branch_id),
      needs_merge_review = c.needs_merge_review or v_normalized_phone is null
    where c.id = v_customer_id;
  end if;

  insert into public.customer_branches (
    customer_id,
    org_id,
    branch_id,
    first_seen_at,
    last_seen_at,
    care_note,
    source
  )
  values (
    v_customer_id,
    v_org_id,
    v_branch_id,
    now(),
    now(),
    p_care_note,
    p_source
  )
  on conflict (customer_id, branch_id)
  do update set
    last_seen_at = greatest(
      coalesce(public.customer_branches.last_seen_at, excluded.last_seen_at),
      excluded.last_seen_at
    ),
    care_note = case
      when excluded.care_note is null or btrim(excluded.care_note) = '' then public.customer_branches.care_note
      when public.customer_branches.care_note is null or btrim(public.customer_branches.care_note) = '' then excluded.care_note
      when position(excluded.care_note in public.customer_branches.care_note) > 0 then public.customer_branches.care_note
      else public.customer_branches.care_note || E'\n' || excluded.care_note
    end,
    source = coalesce(public.customer_branches.source, excluded.source),
    updated_at = now();

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
begin
  if p_org_id is null then
    raise exception 'ORG_REQUIRED';
  end if;

  if public.my_org_id() is distinct from p_org_id then
    raise exception 'ACCESS_DENIED';
  end if;

  return public.upsert_customer_by_identity_secure(
    coalesce(p_branch_id, public.my_default_branch_id()),
    p_full_name,
    p_phone,
    p_care_note,
    p_source
  );
end;
$$;

create or replace function public.list_customers_crm(
  p_search text default null,
  p_status text default null,
  p_dormant_days integer default null,
  p_vip_only boolean default false,
  p_source text default null
)
returns table(
  id uuid,
  org_id uuid,
  full_name text,
  phone text,
  birthday date,
  gender text,
  first_visit_at timestamptz,
  last_visit_at timestamptz,
  total_visits integer,
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

create or replace function public.list_customers_crm(
  p_search text default null,
  p_status text default null,
  p_dormant_days integer default null,
  p_vip_only boolean default false,
  p_source text default null,
  p_branch_id uuid default null
)
returns table(
  id uuid,
  org_id uuid,
  full_name text,
  phone text,
  birthday date,
  gender text,
  first_visit_at timestamptz,
  last_visit_at timestamptz,
  total_visits integer,
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

  if p_branch_id is not null then
    return query
    select
      c.id,
      c.org_id,
      coalesce(nullif(trim(c.full_name), ''), c.name) as full_name,
      c.phone,
      c.birthday,
      c.gender,
      cb.first_seen_at as first_visit_at,
      cb.last_seen_at,
      cb.total_visits,
      cb.total_spend,
      coalesce(branch_service.last_service_summary, c.last_service_summary) as last_service_summary,
      cb.favorite_staff_user_id,
      cb.customer_status,
      cb.tags,
      cb.care_note,
      cb.source,
      cb.next_follow_up_at,
      cb.last_contacted_at,
      cb.follow_up_status,
      c.needs_merge_review
    from public.customer_branches cb
    join public.customers c
      on c.id = cb.customer_id
    left join lateral (
      select string_agg(distinct s.name, ', ' order by s.name) as last_service_summary
      from public.tickets t
      join public.ticket_items ti on ti.ticket_id = t.id
      left join public.services s on s.id = ti.service_id
      where t.customer_id = c.id
        and t.branch_id = cb.branch_id
        and t.status = 'CLOSED'
        and t.created_at = (
          select max(t2.created_at)
          from public.tickets t2
          where t2.customer_id = c.id
            and t2.branch_id = cb.branch_id
            and t2.status = 'CLOSED'
        )
    ) as branch_service on true
    where cb.org_id = public.my_org_id()
      and cb.branch_id = p_branch_id
      and c.merged_into_customer_id is null
      and (
        p_search is null
        or lower(coalesce(c.full_name, c.name, '')) like '%' || lower(p_search) || '%'
        or coalesce(public.normalize_customer_phone(c.phone), '') like '%' || coalesce(public.normalize_customer_phone(p_search), p_search) || '%'
      )
      and (p_status is null or cb.customer_status = p_status)
      and (p_source is null or cb.source = p_source)
      and (not p_vip_only or cb.customer_status = 'VIP')
      and (
        p_dormant_days is null
        or cb.last_seen_at is null
        or cb.last_seen_at <= now() - make_interval(days => p_dormant_days)
      )
    order by cb.last_seen_at desc nulls last, cb.total_spend desc, c.created_at desc;
  end if;

  return query
  with focus_branch as (
    select distinct on (cb.customer_id)
      cb.customer_id,
      cb.org_id,
      cb.branch_id,
      cb.favorite_staff_user_id,
      cb.tags,
      cb.care_note,
      cb.source,
      cb.next_follow_up_at,
      cb.last_contacted_at,
      cb.follow_up_status
    from public.customer_branches cb
    where cb.org_id = public.my_org_id()
      and public.can_access_crm_branch(cb.branch_id)
    order by
      cb.customer_id,
      case when cb.branch_id = public.my_default_branch_id() then 0 else 1 end,
      cb.last_seen_at desc nulls last,
      cb.updated_at desc,
      cb.created_at desc
  ),
  follow_up_rollup as (
    select
      cb.customer_id,
      min(cb.next_follow_up_at) filter (where coalesce(cb.follow_up_status, 'PENDING') <> 'DONE') as next_follow_up_at,
      max(cb.last_contacted_at) as last_contacted_at
    from public.customer_branches cb
    where cb.org_id = public.my_org_id()
      and public.can_access_crm_branch(cb.branch_id)
    group by cb.customer_id
  )
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
    coalesce(fb.favorite_staff_user_id, c.favorite_staff_user_id) as favorite_staff_user_id,
    c.customer_status,
    fb.tags,
    fb.care_note,
    fb.source,
    coalesce(fr.next_follow_up_at, fb.next_follow_up_at) as next_follow_up_at,
    coalesce(fr.last_contacted_at, fb.last_contacted_at) as last_contacted_at,
    case
      when fr.next_follow_up_at is not null then 'PENDING'
      else coalesce(fb.follow_up_status, c.follow_up_status)
    end as follow_up_status,
    c.needs_merge_review
  from public.customers c
  join focus_branch fb
    on fb.customer_id = c.id
   and fb.org_id = c.org_id
  left join follow_up_rollup fr
    on fr.customer_id = c.id
  where c.org_id = public.my_org_id()
    and c.merged_into_customer_id is null
    and (
      p_search is null
      or lower(coalesce(c.full_name, c.name, '')) like '%' || lower(p_search) || '%'
      or coalesce(public.normalize_customer_phone(c.phone), '') like '%' || coalesce(public.normalize_customer_phone(p_search), p_search) || '%'
    )
    and (p_status is null or c.customer_status = p_status)
    and (p_source is null or fb.source = p_source)
    and (not p_vip_only or c.customer_status = 'VIP')
    and (
      p_dormant_days is null
      or c.last_visit_at is null
      or c.last_visit_at <= now() - make_interval(days => p_dormant_days)
    )
  order by c.last_visit_at desc nulls last, c.total_spend desc, c.created_at desc;
end;
$$;

create or replace function public.list_follow_up_candidates(
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table(
  id uuid,
  org_id uuid,
  full_name text,
  phone text,
  birthday date,
  gender text,
  first_visit_at timestamptz,
  last_visit_at timestamptz,
  total_visits integer,
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

create or replace function public.list_follow_up_candidates(
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_branch_id uuid default null
)
returns table(
  id uuid,
  org_id uuid,
  full_name text,
  phone text,
  birthday date,
  gender text,
  first_visit_at timestamptz,
  last_visit_at timestamptz,
  total_visits integer,
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

  if p_branch_id is not null then
    return query
    select
      c.id,
      c.org_id,
      coalesce(nullif(trim(c.full_name), ''), c.name) as full_name,
      c.phone,
      c.birthday,
      c.gender,
      cb.first_seen_at as first_visit_at,
      cb.last_seen_at,
      cb.total_visits,
      cb.total_spend,
      coalesce(branch_service.last_service_summary, c.last_service_summary) as last_service_summary,
      cb.favorite_staff_user_id,
      cb.customer_status,
      cb.tags,
      cb.care_note,
      cb.source,
      cb.next_follow_up_at,
      cb.last_contacted_at,
      cb.follow_up_status,
      c.needs_merge_review
    from public.customer_branches cb
    join public.customers c
      on c.id = cb.customer_id
    left join lateral (
      select string_agg(distinct s.name, ', ' order by s.name) as last_service_summary
      from public.tickets t
      join public.ticket_items ti on ti.ticket_id = t.id
      left join public.services s on s.id = ti.service_id
      where t.customer_id = c.id
        and t.branch_id = cb.branch_id
        and t.status = 'CLOSED'
        and t.created_at = (
          select max(t2.created_at)
          from public.tickets t2
          where t2.customer_id = c.id
            and t2.branch_id = cb.branch_id
            and t2.status = 'CLOSED'
        )
    ) as branch_service on true
    where cb.org_id = public.my_org_id()
      and cb.branch_id = p_branch_id
      and c.merged_into_customer_id is null
      and cb.next_follow_up_at is not null
      and (p_from is null or cb.next_follow_up_at >= p_from)
      and (p_to is null or cb.next_follow_up_at <= p_to)
      and coalesce(cb.follow_up_status, 'PENDING') <> 'DONE'
    order by cb.next_follow_up_at asc, cb.total_spend desc;
  end if;

  return query
  with focus_follow_up as (
    select distinct on (cb.customer_id)
      cb.customer_id,
      cb.org_id,
      cb.branch_id,
      cb.favorite_staff_user_id,
      cb.tags,
      cb.care_note,
      cb.source,
      cb.next_follow_up_at,
      cb.last_contacted_at,
      cb.follow_up_status
    from public.customer_branches cb
    where cb.org_id = public.my_org_id()
      and public.can_access_crm_branch(cb.branch_id)
      and cb.next_follow_up_at is not null
      and (p_from is null or cb.next_follow_up_at >= p_from)
      and (p_to is null or cb.next_follow_up_at <= p_to)
      and coalesce(cb.follow_up_status, 'PENDING') <> 'DONE'
    order by cb.customer_id, cb.next_follow_up_at asc, cb.last_seen_at desc nulls last
  )
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
    coalesce(ff.favorite_staff_user_id, c.favorite_staff_user_id) as favorite_staff_user_id,
    c.customer_status,
    ff.tags,
    ff.care_note,
    ff.source,
    ff.next_follow_up_at,
    ff.last_contacted_at,
    ff.follow_up_status,
    c.needs_merge_review
  from public.customers c
  join focus_follow_up ff
    on ff.customer_id = c.id
   and ff.org_id = c.org_id
  where c.org_id = public.my_org_id()
    and c.merged_into_customer_id is null
  order by ff.next_follow_up_at asc, c.total_spend desc;
end;
$$;

create or replace function public.get_customer_crm_detail(p_customer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_row public.customers;
  v_focus_branch public.customer_branches;
  v_customer jsonb;
  v_branch_relationships jsonb;
  v_appointments jsonb;
  v_tickets jsonb;
  v_booking_requests jsonb;
  v_activities jsonb;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if not public.can_access_crm() then
    raise exception 'FORBIDDEN';
  end if;

  select *
  into v_customer_row
  from public.customers c
  where c.id = p_customer_id
    and c.org_id = public.my_org_id()
    and c.merged_into_customer_id is null
    and (
      public.has_org_role(array['OWNER','PARTNER'])
      or exists (
        select 1
        from public.customer_branches cb
        where cb.customer_id = c.id
          and cb.org_id = c.org_id
          and public.can_access_branch(cb.branch_id)
      )
    );

  if v_customer_row.id is null then
    raise exception 'CUSTOMER_NOT_FOUND';
  end if;

  select *
  into v_focus_branch
  from public.customer_branches cb
  where cb.customer_id = p_customer_id
    and cb.org_id = public.my_org_id()
    and public.can_access_branch(cb.branch_id)
  order by
    case when cb.branch_id = public.my_default_branch_id() then 0 else 1 end,
    cb.last_seen_at desc nulls last,
    cb.updated_at desc,
    cb.created_at desc
  limit 1;

  select to_jsonb(x)
  into v_customer
  from (
    select
      c.id,
      c.org_id,
      v_focus_branch.branch_id,
      coalesce(nullif(trim(c.full_name), ''), c.name) as full_name,
      c.phone,
      c.birthday,
      c.gender,
      c.first_visit_at,
      c.last_visit_at,
      c.total_visits,
      c.total_spend,
      c.last_service_summary,
      coalesce(v_focus_branch.favorite_staff_user_id, c.favorite_staff_user_id) as favorite_staff_user_id,
      coalesce(v_focus_branch.customer_status, c.customer_status) as customer_status,
      coalesce(v_focus_branch.tags, '{}'::text[]) as tags,
      coalesce(v_focus_branch.care_note, c.care_note, c.notes) as care_note,
      coalesce(v_focus_branch.source, c.source) as source,
      coalesce(v_focus_branch.next_follow_up_at, c.next_follow_up_at) as next_follow_up_at,
      coalesce(v_focus_branch.last_contacted_at, c.last_contacted_at) as last_contacted_at,
      coalesce(v_focus_branch.follow_up_status, c.follow_up_status) as follow_up_status,
      coalesce(c.global_note, c.notes) as global_note,
      c.needs_merge_review
    from public.customers c
    where c.id = p_customer_id
  ) x;

  select coalesce(jsonb_agg(to_jsonb(rel) order by rel.last_seen_at desc nulls last), '[]'::jsonb)
  into v_branch_relationships
  from (
    select
      cb.branch_id,
      cb.first_seen_at,
      cb.last_seen_at,
      cb.total_visits,
      cb.total_spend,
      cb.customer_status,
      cb.favorite_staff_user_id,
      cb.care_note,
      cb.tags,
      cb.source,
      cb.next_follow_up_at,
      cb.last_contacted_at,
      cb.follow_up_status
    from public.customer_branches cb
    where cb.customer_id = p_customer_id
      and cb.org_id = public.my_org_id()
      and public.can_access_branch(cb.branch_id)
  ) rel;

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
    'branch_relationships', v_branch_relationships,
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

  if not public.can_access_crm() then
    raise exception 'FORBIDDEN';
  end if;

  select cb.branch_id
  into v_branch_id
  from public.customer_branches cb
  where cb.customer_id = p_customer_id
    and cb.org_id = public.my_org_id()
    and public.can_access_crm_branch(cb.branch_id)
  order by
    case when cb.branch_id = public.my_default_branch_id() then 0 else 1 end,
    cb.last_seen_at desc nulls last,
    cb.updated_at desc,
    cb.created_at desc
  limit 1;

  if v_branch_id is null then
    if not public.has_org_role(array['OWNER','PARTNER']) then
      raise exception 'ACCESS_DENIED';
    end if;

    v_branch_id := public.my_default_branch_id();

    if v_branch_id is null then
      select b.id
      into v_branch_id
      from public.branches b
      where b.org_id = public.my_org_id()
      order by b.created_at asc
      limit 1;
    end if;

    if v_branch_id is null then
      raise exception 'BRANCH_REQUIRED';
    end if;

    insert into public.customer_branches (customer_id, org_id, branch_id)
    values (p_customer_id, public.my_org_id(), v_branch_id)
    on conflict (customer_id, branch_id) do nothing;
  end if;

  if not public.can_access_crm_branch(v_branch_id) then
    raise exception 'ACCESS_DENIED';
  end if;

  update public.customer_branches
  set
    care_note = p_care_note,
    tags = coalesce(p_tags, '{}'::text[]),
    next_follow_up_at = p_next_follow_up_at,
    follow_up_status = coalesce(p_follow_up_status, 'PENDING'),
    last_contacted_at = now(),
    updated_at = now()
  where customer_id = p_customer_id
    and org_id = public.my_org_id()
    and branch_id = v_branch_id;

  update public.customers c
  set
    last_contacted_at = agg.last_contacted_at,
    next_follow_up_at = coalesce(agg.next_follow_up_at, c.next_follow_up_at),
    follow_up_status = coalesce(agg.follow_up_status, c.follow_up_status)
  from (
    select
      customer_id,
      max(last_contacted_at) as last_contacted_at,
      min(next_follow_up_at) filter (where coalesce(follow_up_status, 'PENDING') <> 'DONE') as next_follow_up_at,
      case
        when count(*) filter (where coalesce(follow_up_status, 'PENDING') <> 'DONE' and next_follow_up_at is not null) > 0 then 'PENDING'
        when count(*) filter (where follow_up_status = 'DONE') > 0 then 'DONE'
        else null
      end as follow_up_status
    from public.customer_branches
    where customer_id = p_customer_id
      and org_id = public.my_org_id()
    group by customer_id
  ) agg
  where c.id = agg.customer_id
    and c.org_id = public.my_org_id();

  perform public.append_customer_activity(
    public.my_org_id(),
    p_customer_id,
    'FOLLOW_UP_NOTE',
    'MANUAL',
    coalesce(nullif(trim(p_care_note), ''), 'Cap nhat ghi chu cham soc'),
    auth.uid()
  );

  return jsonb_build_object(
    'ok', true,
    'customer_id', p_customer_id,
    'branch_id', v_branch_id
  );
end;
$$;

create or replace function public.merge_customer_records(
  p_canonical_customer_id uuid,
  p_duplicate_customer_id uuid,
  p_reason text default 'EMAIL_OR_PHONE_DUPLICATE'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_canonical public.customers%rowtype;
  v_duplicate public.customers%rowtype;
  v_actor uuid := auth.uid();
  v_snapshot jsonb;
  v_canonical_email text;
  v_duplicate_email text;
  v_canonical_phone text;
  v_duplicate_phone text;
begin
  if p_canonical_customer_id is null or p_duplicate_customer_id is null then
    raise exception 'CUSTOMER_IDS_REQUIRED';
  end if;

  if p_canonical_customer_id = p_duplicate_customer_id then
    raise exception 'CUSTOMER_IDS_MUST_DIFFER';
  end if;

  select * into v_canonical
  from public.customers
  where id = p_canonical_customer_id
  for update;

  if not found then
    raise exception 'CANONICAL_CUSTOMER_NOT_FOUND';
  end if;

  select * into v_duplicate
  from public.customers
  where id = p_duplicate_customer_id
  for update;

  if not found then
    raise exception 'DUPLICATE_CUSTOMER_NOT_FOUND';
  end if;

  if v_canonical.org_id <> v_duplicate.org_id then
    raise exception 'CUSTOMER_ORG_MISMATCH';
  end if;

  if v_canonical.merged_into_customer_id is not null then
    raise exception 'CANONICAL_ALREADY_MERGED';
  end if;

  if v_duplicate.merged_into_customer_id is not null then
    raise exception 'DUPLICATE_ALREADY_MERGED';
  end if;

  v_canonical_email := lower(nullif(trim(v_canonical.email), ''));
  v_duplicate_email := lower(nullif(trim(v_duplicate.email), ''));
  v_canonical_phone := public.normalize_customer_phone(v_canonical.phone);
  v_duplicate_phone := public.normalize_customer_phone(v_duplicate.phone);

  if v_canonical_email is not null and v_duplicate_email is not null and v_canonical_email <> v_duplicate_email then
    raise exception 'MERGE_BLOCKED_EMAIL_CONFLICT';
  end if;

  if v_canonical_phone is not null and v_duplicate_phone is not null and v_canonical_phone <> v_duplicate_phone then
    raise exception 'MERGE_BLOCKED_PHONE_CONFLICT';
  end if;

  if v_canonical.birthday is not null and v_duplicate.birthday is not null and v_canonical.birthday <> v_duplicate.birthday then
    raise exception 'MERGE_BLOCKED_BIRTHDAY_CONFLICT';
  end if;

  if nullif(trim(coalesce(v_canonical.notes, '')), '') is not null
     and nullif(trim(coalesce(v_duplicate.notes, '')), '') is not null then
    raise exception 'MERGE_BLOCKED_BOTH_HAVE_NOTES';
  end if;

  if nullif(trim(coalesce(v_canonical.care_note, '')), '') is not null
     and nullif(trim(coalesce(v_duplicate.care_note, '')), '') is not null then
    raise exception 'MERGE_BLOCKED_BOTH_HAVE_CARE_NOTES';
  end if;

  if coalesce(v_canonical.total_visits, 0) > 0 and coalesce(v_duplicate.total_visits, 0) > 0 then
    raise exception 'MERGE_BLOCKED_BOTH_HAVE_VISIT_HISTORY';
  end if;

  if coalesce(v_canonical.total_spend, 0) > 0 and coalesce(v_duplicate.total_spend, 0) > 0 then
    raise exception 'MERGE_BLOCKED_BOTH_HAVE_SPEND_HISTORY';
  end if;

  v_snapshot := jsonb_build_object(
    'canonical_before', to_jsonb(v_canonical),
    'duplicate_before', to_jsonb(v_duplicate)
  );

  update public.customers
  set
    full_name = case
      when nullif(trim(public.customers.full_name), '') is not null then public.customers.full_name
      when nullif(trim(v_duplicate.full_name), '') is not null then v_duplicate.full_name
      when nullif(trim(v_duplicate.name), '') is not null then v_duplicate.name
      else public.customers.full_name
    end,
    name = case
      when nullif(trim(public.customers.name), '') is not null then public.customers.name
      when nullif(trim(v_duplicate.name), '') is not null then v_duplicate.name
      when nullif(trim(v_duplicate.full_name), '') is not null then v_duplicate.full_name
      else public.customers.name
    end,
    email = coalesce(public.customers.email, v_duplicate.email),
    phone = coalesce(public.customers.phone, v_duplicate.phone),
    birthday = coalesce(public.customers.birthday, v_duplicate.birthday),
    gender = coalesce(public.customers.gender, v_duplicate.gender),
    address = coalesce(public.customers.address, v_duplicate.address),
    tags = coalesce((
      select array_agg(distinct tag)
      from unnest(coalesce(public.customers.tags, '{}'::text[]) || coalesce(v_duplicate.tags, '{}'::text[])) tag
    ), '{}'::text[]),
    global_note = concat_ws(E'\n\n', nullif(public.customers.global_note, ''), nullif(v_duplicate.global_note, '')),
    notes = concat_ws(E'\n\n', nullif(public.customers.notes, ''), nullif(v_duplicate.notes, '')),
    care_note = concat_ws(E'\n\n', nullif(public.customers.care_note, ''), nullif(v_duplicate.care_note, '')),
    first_visit_at = least(
      coalesce(public.customers.first_visit_at, v_duplicate.first_visit_at),
      coalesce(v_duplicate.first_visit_at, public.customers.first_visit_at)
    ),
    last_visit_at = greatest(
      coalesce(public.customers.last_visit_at, v_duplicate.last_visit_at),
      coalesce(v_duplicate.last_visit_at, public.customers.last_visit_at)
    ),
    last_contacted_at = greatest(
      coalesce(public.customers.last_contacted_at, v_duplicate.last_contacted_at),
      coalesce(v_duplicate.last_contacted_at, public.customers.last_contacted_at)
    ),
    next_follow_up_at = coalesce(public.customers.next_follow_up_at, v_duplicate.next_follow_up_at),
    follow_up_status = coalesce(public.customers.follow_up_status, v_duplicate.follow_up_status),
    favorite_staff_user_id = coalesce(public.customers.favorite_staff_user_id, v_duplicate.favorite_staff_user_id),
    source = coalesce(public.customers.source, v_duplicate.source),
    branch_id = coalesce(public.customers.branch_id, v_duplicate.branch_id)
  where public.customers.id = v_canonical.id;

  update public.customer_accounts
  set customer_id = v_canonical.id,
      linked_by = coalesce(linked_by, 'MERGED')
  where customer_id = v_duplicate.id;

  update public.appointments set customer_id = v_canonical.id where customer_id = v_duplicate.id;
  update public.tickets set customer_id = v_canonical.id where customer_id = v_duplicate.id;
  update public.booking_requests set customer_id = v_canonical.id where customer_id = v_duplicate.id;

  insert into public.customer_branches (
    customer_id, org_id, branch_id, first_seen_at, last_seen_at, total_visits, total_spend,
    customer_status, favorite_staff_user_id, care_note, tags, source, next_follow_up_at,
    last_contacted_at, follow_up_status, created_at, updated_at
  )
  select
    v_canonical.id, cb.org_id, cb.branch_id, cb.first_seen_at, cb.last_seen_at, cb.total_visits, cb.total_spend,
    cb.customer_status, cb.favorite_staff_user_id, cb.care_note, cb.tags, cb.source, cb.next_follow_up_at,
    cb.last_contacted_at, cb.follow_up_status, cb.created_at, cb.updated_at
  from public.customer_branches cb
  where cb.customer_id = v_duplicate.id
  on conflict (customer_id, branch_id)
  do update set
    first_seen_at = least(coalesce(public.customer_branches.first_seen_at, excluded.first_seen_at), excluded.first_seen_at),
    last_seen_at = greatest(coalesce(public.customer_branches.last_seen_at, excluded.last_seen_at), excluded.last_seen_at),
    total_visits = public.customer_branches.total_visits + excluded.total_visits,
    total_spend = public.customer_branches.total_spend + excluded.total_spend,
    customer_status = case when public.customer_branches.customer_status = 'NEW' then excluded.customer_status else public.customer_branches.customer_status end,
    favorite_staff_user_id = coalesce(public.customer_branches.favorite_staff_user_id, excluded.favorite_staff_user_id),
    care_note = concat_ws(E'\n\n', nullif(public.customer_branches.care_note, ''), nullif(excluded.care_note, '')),
    tags = coalesce((
      select array_agg(distinct tag)
      from unnest(coalesce(public.customer_branches.tags, '{}'::text[]) || coalesce(excluded.tags, '{}'::text[])) tag
    ), '{}'::text[]),
    source = coalesce(public.customer_branches.source, excluded.source),
    next_follow_up_at = coalesce(public.customer_branches.next_follow_up_at, excluded.next_follow_up_at),
    last_contacted_at = greatest(
      coalesce(public.customer_branches.last_contacted_at, excluded.last_contacted_at),
      coalesce(excluded.last_contacted_at, public.customer_branches.last_contacted_at)
    ),
    follow_up_status = coalesce(public.customer_branches.follow_up_status, excluded.follow_up_status),
    updated_at = now();

  delete from public.customer_branches where customer_id = v_duplicate.id;

  update public.customer_favorite_services
  set customer_id = v_canonical.id
  where customer_id = v_duplicate.id
    and not exists (
      select 1
      from public.customer_favorite_services keep
      where keep.customer_id = v_canonical.id
        and keep.service_id = public.customer_favorite_services.service_id
    );
  delete from public.customer_favorite_services where customer_id = v_duplicate.id;

  update public.customer_memberships
  set customer_id = v_canonical.id
  where customer_id = v_duplicate.id
    and not exists (
      select 1 from public.customer_memberships keep where keep.customer_id = v_canonical.id
    );
  delete from public.customer_memberships where customer_id = v_duplicate.id;

  update public.customer_notification_preferences
  set customer_id = v_canonical.id
  where customer_id = v_duplicate.id
    and not exists (
      select 1 from public.customer_notification_preferences keep where keep.customer_id = v_canonical.id
    );
  delete from public.customer_notification_preferences where customer_id = v_duplicate.id;

  update public.customer_offer_claims
  set customer_id = v_canonical.id
  where customer_id = v_duplicate.id
    and not exists (
      select 1
      from public.customer_offer_claims keep
      where keep.customer_id = v_canonical.id
        and keep.offer_id = public.customer_offer_claims.offer_id
    );
  delete from public.customer_offer_claims where customer_id = v_duplicate.id;

  update public.customer_notifications set customer_id = v_canonical.id where customer_id = v_duplicate.id;
  update public.customer_service_reviews set customer_id = v_canonical.id where customer_id = v_duplicate.id;
  update public.customer_activities set customer_id = v_canonical.id where customer_id = v_duplicate.id;

  update public.customers
  set merged_into_customer_id = v_canonical.id,
      needs_merge_review = false
  where id = v_duplicate.id;

  update public.customers
  set needs_merge_review = false
  where id = v_canonical.id;

  insert into public.customer_merge_audit (
    org_id, canonical_customer_id, duplicate_customer_id, merge_reason, merged_by, snapshot
  )
  values (
    v_canonical.org_id, v_canonical.id, v_duplicate.id,
    coalesce(nullif(trim(p_reason), ''), 'EMAIL_OR_PHONE_DUPLICATE'),
    v_actor, v_snapshot
  )
  on conflict (canonical_customer_id, duplicate_customer_id) do update
    set merge_reason = excluded.merge_reason,
        merged_by = excluded.merged_by,
        merged_at = now(),
        snapshot = excluded.snapshot;

  perform public.append_customer_activity(
    v_canonical.org_id,
    v_canonical.id,
    'MERGE',
    'CRM',
    'Merged duplicate customer ' || v_duplicate.id::text || ' into canonical record',
    null
  );

  perform public.refresh_customer_metrics(v_canonical.id, null);

  return jsonb_build_object(
    'success', true,
    'org_id', v_canonical.org_id,
    'canonical_customer_id', v_canonical.id,
    'duplicate_customer_id', v_duplicate.id,
    'reason', coalesce(nullif(trim(p_reason), ''), 'EMAIL_OR_PHONE_DUPLICATE')
  );
end;
$$;

create or replace function public.merge_customer_records_force(
  p_canonical_customer_id uuid,
  p_duplicate_customer_id uuid,
  p_reason text default 'CONFIRMED_NAME_DUPLICATE'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_canonical public.customers%rowtype;
  v_duplicate public.customers%rowtype;
  v_actor uuid := auth.uid();
  v_snapshot jsonb;
begin
  if p_canonical_customer_id is null or p_duplicate_customer_id is null then
    raise exception 'CUSTOMER_IDS_REQUIRED';
  end if;

  if p_canonical_customer_id = p_duplicate_customer_id then
    raise exception 'CUSTOMER_IDS_MUST_DIFFER';
  end if;

  select * into v_canonical from public.customers where id = p_canonical_customer_id for update;
  if not found then raise exception 'CANONICAL_CUSTOMER_NOT_FOUND'; end if;

  select * into v_duplicate from public.customers where id = p_duplicate_customer_id for update;
  if not found then raise exception 'DUPLICATE_CUSTOMER_NOT_FOUND'; end if;

  if v_canonical.org_id <> v_duplicate.org_id then raise exception 'CUSTOMER_ORG_MISMATCH'; end if;
  if v_canonical.merged_into_customer_id is not null then raise exception 'CANONICAL_ALREADY_MERGED'; end if;
  if v_duplicate.merged_into_customer_id is not null then raise exception 'DUPLICATE_ALREADY_MERGED'; end if;

  v_snapshot := jsonb_build_object(
    'canonical_before', to_jsonb(v_canonical),
    'duplicate_before', to_jsonb(v_duplicate),
    'forced', true
  );

  update public.customers
  set
    full_name = case when nullif(trim(public.customers.full_name), '') is not null then public.customers.full_name when nullif(trim(v_duplicate.full_name), '') is not null then v_duplicate.full_name when nullif(trim(v_duplicate.name), '') is not null then v_duplicate.name else public.customers.full_name end,
    name = case when nullif(trim(public.customers.name), '') is not null then public.customers.name when nullif(trim(v_duplicate.name), '') is not null then v_duplicate.name when nullif(trim(v_duplicate.full_name), '') is not null then v_duplicate.full_name else public.customers.name end,
    email = coalesce(public.customers.email, v_duplicate.email),
    phone = coalesce(public.customers.phone, v_duplicate.phone),
    birthday = coalesce(public.customers.birthday, v_duplicate.birthday),
    gender = coalesce(public.customers.gender, v_duplicate.gender),
    address = coalesce(public.customers.address, v_duplicate.address),
    tags = coalesce((select array_agg(distinct tag) from unnest(coalesce(public.customers.tags, '{}'::text[]) || coalesce(v_duplicate.tags, '{}'::text[])) tag), '{}'::text[]),
    global_note = concat_ws(E'\n\n', nullif(public.customers.global_note, ''), nullif(v_duplicate.global_note, '')),
    notes = concat_ws(E'\n\n', nullif(public.customers.notes, ''), nullif(v_duplicate.notes, '')),
    care_note = concat_ws(E'\n\n', nullif(public.customers.care_note, ''), nullif(v_duplicate.care_note, '')),
    first_visit_at = least(coalesce(public.customers.first_visit_at, v_duplicate.first_visit_at), coalesce(v_duplicate.first_visit_at, public.customers.first_visit_at)),
    last_visit_at = greatest(coalesce(public.customers.last_visit_at, v_duplicate.last_visit_at), coalesce(v_duplicate.last_visit_at, public.customers.last_visit_at)),
    last_contacted_at = greatest(coalesce(public.customers.last_contacted_at, v_duplicate.last_contacted_at), coalesce(v_duplicate.last_contacted_at, public.customers.last_contacted_at)),
    next_follow_up_at = coalesce(public.customers.next_follow_up_at, v_duplicate.next_follow_up_at),
    follow_up_status = coalesce(public.customers.follow_up_status, v_duplicate.follow_up_status),
    favorite_staff_user_id = coalesce(public.customers.favorite_staff_user_id, v_duplicate.favorite_staff_user_id),
    source = coalesce(public.customers.source, v_duplicate.source),
    branch_id = coalesce(public.customers.branch_id, v_duplicate.branch_id)
  where public.customers.id = v_canonical.id;

  update public.customer_accounts set customer_id = v_canonical.id, linked_by = 'FORCED_MERGE' where customer_id = v_duplicate.id;
  update public.appointments set customer_id = v_canonical.id where customer_id = v_duplicate.id;
  update public.tickets set customer_id = v_canonical.id where customer_id = v_duplicate.id;
  update public.booking_requests set customer_id = v_canonical.id where customer_id = v_duplicate.id;

  insert into public.customer_branches (
    customer_id, org_id, branch_id, first_seen_at, last_seen_at, total_visits, total_spend,
    customer_status, favorite_staff_user_id, care_note, tags, source, next_follow_up_at,
    last_contacted_at, follow_up_status, created_at, updated_at
  )
  select
    v_canonical.id, cb.org_id, cb.branch_id, cb.first_seen_at, cb.last_seen_at, cb.total_visits, cb.total_spend,
    cb.customer_status, cb.favorite_staff_user_id, cb.care_note, cb.tags, cb.source, cb.next_follow_up_at,
    cb.last_contacted_at, cb.follow_up_status, cb.created_at, cb.updated_at
  from public.customer_branches cb
  where cb.customer_id = v_duplicate.id
  on conflict (customer_id, branch_id)
  do update set
    first_seen_at = least(coalesce(public.customer_branches.first_seen_at, excluded.first_seen_at), excluded.first_seen_at),
    last_seen_at = greatest(coalesce(public.customer_branches.last_seen_at, excluded.last_seen_at), excluded.last_seen_at),
    total_visits = public.customer_branches.total_visits + excluded.total_visits,
    total_spend = public.customer_branches.total_spend + excluded.total_spend,
    customer_status = case when public.customer_branches.customer_status = 'NEW' then excluded.customer_status else public.customer_branches.customer_status end,
    favorite_staff_user_id = coalesce(public.customer_branches.favorite_staff_user_id, excluded.favorite_staff_user_id),
    care_note = concat_ws(E'\n\n', nullif(public.customer_branches.care_note, ''), nullif(excluded.care_note, '')),
    tags = coalesce((select array_agg(distinct tag) from unnest(coalesce(public.customer_branches.tags, '{}'::text[]) || coalesce(excluded.tags, '{}'::text[])) tag), '{}'::text[]),
    source = coalesce(public.customer_branches.source, excluded.source),
    next_follow_up_at = coalesce(public.customer_branches.next_follow_up_at, excluded.next_follow_up_at),
    last_contacted_at = greatest(coalesce(public.customer_branches.last_contacted_at, excluded.last_contacted_at), coalesce(excluded.last_contacted_at, public.customer_branches.last_contacted_at)),
    follow_up_status = coalesce(public.customer_branches.follow_up_status, excluded.follow_up_status),
    updated_at = now();

  delete from public.customer_branches where customer_id = v_duplicate.id;

  update public.customer_favorite_services set customer_id = v_canonical.id where customer_id = v_duplicate.id and not exists (select 1 from public.customer_favorite_services keep where keep.customer_id = v_canonical.id and keep.service_id = public.customer_favorite_services.service_id);
  delete from public.customer_favorite_services where customer_id = v_duplicate.id;
  update public.customer_memberships set customer_id = v_canonical.id where customer_id = v_duplicate.id and not exists (select 1 from public.customer_memberships keep where keep.customer_id = v_canonical.id);
  delete from public.customer_memberships where customer_id = v_duplicate.id;
  update public.customer_notification_preferences set customer_id = v_canonical.id where customer_id = v_duplicate.id and not exists (select 1 from public.customer_notification_preferences keep where keep.customer_id = v_canonical.id);
  delete from public.customer_notification_preferences where customer_id = v_duplicate.id;
  update public.customer_offer_claims set customer_id = v_canonical.id where customer_id = v_duplicate.id and not exists (select 1 from public.customer_offer_claims keep where keep.customer_id = v_canonical.id and keep.offer_id = public.customer_offer_claims.offer_id);
  delete from public.customer_offer_claims where customer_id = v_duplicate.id;
  update public.customer_notifications set customer_id = v_canonical.id where customer_id = v_duplicate.id;
  update public.customer_service_reviews set customer_id = v_canonical.id where customer_id = v_duplicate.id;
  update public.customer_activities set customer_id = v_canonical.id where customer_id = v_duplicate.id;

  update public.customers set merged_into_customer_id = v_canonical.id, needs_merge_review = false where id = v_duplicate.id;
  update public.customers set needs_merge_review = false where id = v_canonical.id;

  insert into public.customer_merge_audit (org_id, canonical_customer_id, duplicate_customer_id, merge_reason, merged_by, snapshot)
  values (v_canonical.org_id, v_canonical.id, v_duplicate.id, coalesce(nullif(trim(p_reason), ''), 'CONFIRMED_NAME_DUPLICATE'), v_actor, v_snapshot)
  on conflict (canonical_customer_id, duplicate_customer_id) do update
    set merge_reason = excluded.merge_reason,
        merged_by = excluded.merged_by,
        merged_at = now(),
        snapshot = excluded.snapshot;

  perform public.append_customer_activity(v_canonical.org_id, v_canonical.id, 'FORCED_MERGE', 'CRM', 'Forced merge duplicate customer ' || v_duplicate.id::text || ' into canonical record', null);
  perform public.refresh_customer_metrics(v_canonical.id, null);

  return jsonb_build_object(
    'success', true,
    'org_id', v_canonical.org_id,
    'canonical_customer_id', v_canonical.id,
    'duplicate_customer_id', v_duplicate.id,
    'reason', coalesce(nullif(trim(p_reason), ''), 'CONFIRMED_NAME_DUPLICATE'),
    'forced', true
  );
end;
$$;

commit;
