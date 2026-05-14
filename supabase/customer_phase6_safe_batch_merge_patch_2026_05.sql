-- Phase 6 safe batch merge helpers
-- Auto-merge only very safe duplicate cases.

begin;

create or replace function public.merge_safe_customer_duplicates_by_email(
  p_org_id uuid default null,
  p_dry_run boolean default true
)
returns table (
  canonical_customer_id uuid,
  duplicate_customer_id uuid,
  match_value text,
  action text,
  reason text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_result jsonb;
begin
  for v_row in
    with ranked as (
      select
        c.id,
        c.org_id,
        lower(nullif(trim(c.email), '')) as normalized_email,
        coalesce(c.total_visits, 0) as total_visits,
        coalesce(c.total_spend, 0) as total_spend,
        c.last_visit_at,
        c.created_at,
        row_number() over (
          partition by c.org_id, lower(nullif(trim(c.email), ''))
          order by coalesce(c.total_visits, 0) desc,
                   coalesce(c.total_spend, 0) desc,
                   c.last_visit_at desc nulls last,
                   c.created_at asc
        ) as rank_in_group,
        count(*) over (
          partition by c.org_id, lower(nullif(trim(c.email), ''))
        ) as group_size
      from public.customers c
      where c.merged_into_customer_id is null
        and lower(nullif(trim(c.email), '')) is not null
        and (p_org_id is null or c.org_id = p_org_id)
    ), paired as (
      select
        winner.org_id,
        winner.normalized_email,
        winner.id as canonical_customer_id,
        loser.id as duplicate_customer_id,
        loser.total_visits as loser_total_visits,
        loser.total_spend as loser_total_spend
      from ranked winner
      join ranked loser
        on loser.org_id = winner.org_id
       and loser.normalized_email = winner.normalized_email
       and loser.rank_in_group > 1
      where winner.rank_in_group = 1
        and winner.group_size > 1
    )
    select *
    from paired
    where coalesce(loser_total_visits, 0) = 0
      and coalesce(loser_total_spend, 0) = 0
  loop
    if p_dry_run then
      canonical_customer_id := v_row.canonical_customer_id;
      duplicate_customer_id := v_row.duplicate_customer_id;
      match_value := v_row.normalized_email;
      action := 'DRY_RUN';
      reason := 'SAFE_EMAIL_DUPLICATE';
      return next;
    else
      v_result := public.merge_customer_records(
        v_row.canonical_customer_id,
        v_row.duplicate_customer_id,
        'SAFE_EMAIL_DUPLICATE'
      );

      canonical_customer_id := (v_result ->> 'canonical_customer_id')::uuid;
      duplicate_customer_id := (v_result ->> 'duplicate_customer_id')::uuid;
      match_value := v_row.normalized_email;
      action := 'MERGED';
      reason := 'SAFE_EMAIL_DUPLICATE';
      return next;
    end if;
  end loop;
end;
$$;

create or replace function public.merge_safe_customer_duplicates_by_phone(
  p_org_id uuid default null,
  p_dry_run boolean default true
)
returns table (
  canonical_customer_id uuid,
  duplicate_customer_id uuid,
  match_value text,
  action text,
  reason text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_result jsonb;
begin
  for v_row in
    with ranked as (
      select
        c.id,
        c.org_id,
        public.normalize_customer_phone(c.phone) as normalized_phone,
        lower(nullif(trim(c.email), '')) as normalized_email,
        coalesce(c.total_visits, 0) as total_visits,
        coalesce(c.total_spend, 0) as total_spend,
        c.last_visit_at,
        c.created_at,
        row_number() over (
          partition by c.org_id, public.normalize_customer_phone(c.phone)
          order by coalesce(c.total_visits, 0) desc,
                   coalesce(c.total_spend, 0) desc,
                   c.last_visit_at desc nulls last,
                   c.created_at asc
        ) as rank_in_group,
        count(*) over (
          partition by c.org_id, public.normalize_customer_phone(c.phone)
        ) as group_size
      from public.customers c
      where c.merged_into_customer_id is null
        and public.normalize_customer_phone(c.phone) is not null
        and (p_org_id is null or c.org_id = p_org_id)
    ), paired as (
      select
        winner.org_id,
        winner.normalized_phone,
        winner.id as canonical_customer_id,
        loser.id as duplicate_customer_id,
        loser.total_visits as loser_total_visits,
        loser.total_spend as loser_total_spend,
        winner.normalized_email as winner_email,
        loser.normalized_email as loser_email
      from ranked winner
      join ranked loser
        on loser.org_id = winner.org_id
       and loser.normalized_phone = winner.normalized_phone
       and loser.rank_in_group > 1
      where winner.rank_in_group = 1
        and winner.group_size > 1
    )
    select *
    from paired
    where coalesce(loser_total_visits, 0) = 0
      and coalesce(loser_total_spend, 0) = 0
      and (
        winner_email is null
        or loser_email is null
        or winner_email = loser_email
      )
  loop
    if p_dry_run then
      canonical_customer_id := v_row.canonical_customer_id;
      duplicate_customer_id := v_row.duplicate_customer_id;
      match_value := v_row.normalized_phone;
      action := 'DRY_RUN';
      reason := 'SAFE_PHONE_DUPLICATE';
      return next;
    else
      v_result := public.merge_customer_records(
        v_row.canonical_customer_id,
        v_row.duplicate_customer_id,
        'SAFE_PHONE_DUPLICATE'
      );

      canonical_customer_id := (v_result ->> 'canonical_customer_id')::uuid;
      duplicate_customer_id := (v_result ->> 'duplicate_customer_id')::uuid;
      match_value := v_row.normalized_phone;
      action := 'MERGED';
      reason := 'SAFE_PHONE_DUPLICATE';
      return next;
    end if;
  end loop;
end;
$$;

grant execute on function public.merge_safe_customer_duplicates_by_email(uuid, boolean) to authenticated, service_role;
grant execute on function public.merge_safe_customer_duplicates_by_phone(uuid, boolean) to authenticated, service_role;

commit;
