-- Phase 6b align safe batch merge selectors with phase 7 strict guards
-- Exclude candidates that would be blocked by merge_customer_records strict checks.

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
        public.normalize_customer_phone(c.phone) as normalized_phone,
        c.birthday,
        nullif(trim(coalesce(c.notes, '')), '') as notes_value,
        nullif(trim(coalesce(c.care_note, '')), '') as care_note_value,
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
        winner.normalized_phone as winner_phone,
        loser.normalized_phone as loser_phone,
        winner.birthday as winner_birthday,
        loser.birthday as loser_birthday,
        winner.notes_value as winner_notes,
        loser.notes_value as loser_notes,
        winner.care_note_value as winner_care_note,
        loser.care_note_value as loser_care_note,
        winner.total_visits as winner_total_visits,
        loser.total_visits as loser_total_visits,
        winner.total_spend as winner_total_spend,
        loser.total_spend as loser_total_spend,
        winner.id as canonical_customer_id,
        loser.id as duplicate_customer_id
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
      and not (winner_notes is not null and loser_notes is not null)
      and not (winner_care_note is not null and loser_care_note is not null)
      and not (winner_birthday is not null and loser_birthday is not null and winner_birthday <> loser_birthday)
      and (winner_phone is null or loser_phone is null or winner_phone = loser_phone)
      and not (coalesce(winner_total_visits, 0) > 0 and coalesce(loser_total_visits, 0) > 0)
      and not (coalesce(winner_total_spend, 0) > 0 and coalesce(loser_total_spend, 0) > 0)
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
        c.birthday,
        nullif(trim(coalesce(c.notes, '')), '') as notes_value,
        nullif(trim(coalesce(c.care_note, '')), '') as care_note_value,
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
        winner.normalized_email as winner_email,
        loser.normalized_email as loser_email,
        winner.birthday as winner_birthday,
        loser.birthday as loser_birthday,
        winner.notes_value as winner_notes,
        loser.notes_value as loser_notes,
        winner.care_note_value as winner_care_note,
        loser.care_note_value as loser_care_note,
        winner.total_visits as winner_total_visits,
        loser.total_visits as loser_total_visits,
        winner.total_spend as winner_total_spend,
        loser.total_spend as loser_total_spend,
        winner.id as canonical_customer_id,
        loser.id as duplicate_customer_id
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
      and (winner_email is null or loser_email is null or winner_email = loser_email)
      and not (winner_notes is not null and loser_notes is not null)
      and not (winner_care_note is not null and loser_care_note is not null)
      and not (winner_birthday is not null and loser_birthday is not null and winner_birthday <> loser_birthday)
      and not (coalesce(winner_total_visits, 0) > 0 and coalesce(loser_total_visits, 0) > 0)
      and not (coalesce(winner_total_spend, 0) > 0 and coalesce(loser_total_spend, 0) > 0)
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

commit;
