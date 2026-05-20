-- Phase 8 name-based duplicate review + explicit force merge
-- Use for confirmed human-reviewed cases like reordered Vietnamese names.

begin;

create or replace function public.normalize_customer_name_tokens(p_value text)
returns text
language plpgsql
immutable
as $$
declare
  v_value text;
  v_tokens text[];
begin
  v_value := lower(coalesce(p_value, ''));
  v_value := translate(
    v_value,
    'áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ',
    'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd'
  );
  v_value := regexp_replace(v_value, '[^a-z0-9\s]+', ' ', 'g');
  v_value := regexp_replace(v_value, '\s+', ' ', 'g');
  v_value := btrim(v_value);

  if v_value = '' then
    return null;
  end if;

  select array_agg(token order by token)
  into v_tokens
  from unnest(string_to_array(v_value, ' ')) token
  where btrim(token) <> '';

  if coalesce(array_length(v_tokens, 1), 0) = 0 then
    return null;
  end if;

  return array_to_string(v_tokens, ' ');
end;
$$;

create or replace view public.customer_name_duplicate_candidates as
with base as (
  select
    c.id,
    c.org_id,
    coalesce(nullif(trim(c.full_name), ''), nullif(trim(c.name), ''), 'Khách hàng') as display_name,
    public.normalize_customer_name_tokens(coalesce(nullif(trim(c.full_name), ''), nullif(trim(c.name), ''))) as normalized_name,
    lower(nullif(trim(c.email), '')) as normalized_email,
    public.normalize_customer_phone(c.phone) as normalized_phone,
    c.birthday,
    c.created_at,
    coalesce(c.total_visits, 0) as total_visits,
    coalesce(c.total_spend, 0) as total_spend,
    c.last_visit_at
  from public.customers c
  where c.merged_into_customer_id is null
), grouped as (
  select
    org_id,
    normalized_name,
    array_agg(id order by total_visits desc, total_spend desc, last_visit_at desc nulls last, created_at asc) as customer_ids,
    count(*) as duplicate_count
  from base
  where normalized_name is not null
  group by org_id, normalized_name
  having count(*) > 1
)
select
  g.org_id,
  g.normalized_name as match_value,
  g.duplicate_count,
  g.customer_ids[1] as canonical_customer_id,
  case
    when coalesce(array_length(g.customer_ids, 1), 0) <= 1 then '{}'::uuid[]
    else g.customer_ids[2:array_length(g.customer_ids, 1)]
  end as duplicate_customer_ids
from grouped g;

create or replace function public.list_customer_name_duplicate_candidates()
returns table (
  org_id uuid,
  match_value text,
  duplicate_count int,
  canonical_customer_id uuid,
  duplicate_customer_ids uuid[]
)
language sql
security definer
set search_path = public
as $$
  select
    org_id,
    match_value,
    duplicate_count::int,
    canonical_customer_id,
    duplicate_customer_ids
  from public.customer_name_duplicate_candidates
  order by org_id, match_value;
$$;

grant select on public.customer_name_duplicate_candidates to authenticated, service_role;
grant execute on function public.list_customer_name_duplicate_candidates() to authenticated, service_role;

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

  v_snapshot := jsonb_build_object(
    'canonical_before', to_jsonb(v_canonical),
    'duplicate_before', to_jsonb(v_duplicate),
    'forced', true
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
    source = coalesce(public.customers.source, v_duplicate.source)
  where public.customers.id = v_canonical.id;

  update public.customer_accounts
  set customer_id = v_canonical.id,
      linked_by = 'FORCED_MERGE'
  where customer_id = v_duplicate.id;

  update public.appointments set customer_id = v_canonical.id where customer_id = v_duplicate.id;
  update public.tickets set customer_id = v_canonical.id where customer_id = v_duplicate.id;
  update public.booking_requests set customer_id = v_canonical.id where customer_id = v_duplicate.id;

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
    org_id,
    canonical_customer_id,
    duplicate_customer_id,
    merge_reason,
    merged_by,
    snapshot
  )
  values (
    v_canonical.org_id,
    v_canonical.id,
    v_duplicate.id,
    coalesce(nullif(trim(p_reason), ''), 'CONFIRMED_NAME_DUPLICATE'),
    v_actor,
    v_snapshot
  )
  on conflict (canonical_customer_id, duplicate_customer_id) do update
    set merge_reason = excluded.merge_reason,
        merged_by = excluded.merged_by,
        merged_at = now(),
        snapshot = excluded.snapshot;

  perform public.append_customer_activity(
    v_canonical.org_id,
    v_canonical.id,
    'FORCED_MERGE',
    'CRM',
    'Forced merge duplicate customer ' || v_duplicate.id::text || ' into canonical record',
    null
  );

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

grant execute on function public.merge_customer_records_force(uuid, uuid, text) to authenticated, service_role;

commit;
