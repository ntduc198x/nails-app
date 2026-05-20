-- Phase 7 stricter merge guards
-- Refuse merges when both sides have conflicting high-signal customer identity/history.

begin;

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
      linked_by = coalesce(linked_by, 'MERGED')
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
    coalesce(nullif(trim(p_reason), ''), 'EMAIL_OR_PHONE_DUPLICATE'),
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

commit;
