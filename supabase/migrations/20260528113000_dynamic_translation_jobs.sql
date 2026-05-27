create extension if not exists pgcrypto;

alter table if exists public.branches
  add column if not exists translation_meta jsonb;

alter table if exists public.resources
  add column if not exists translation_meta jsonb;

alter table if exists public.services
  add column if not exists translation_meta jsonb;

alter table if exists public.storefront_profile
  add column if not exists translation_meta jsonb;

alter table if exists public.storefront_team_members
  add column if not exists translation_meta jsonb;

alter table if exists public.storefront_products
  add column if not exists translation_meta jsonb;

alter table if exists public.storefront_gallery
  add column if not exists translation_meta jsonb;

alter table if exists public.marketing_offers
  add column if not exists translation_meta jsonb;

alter table if exists public.customer_content_posts
  add column if not exists translation_meta jsonb;

create table if not exists public.content_translation_jobs (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid not null,
  org_id uuid null,
  branch_id uuid null,
  target_locale text not null default 'en',
  force_overwrite boolean not null default false,
  requested_fields text[] null,
  source_payload jsonb null,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  error_message text null,
  requested_by uuid null,
  created_at timestamptz not null default now(),
  started_at timestamptz null,
  finished_at timestamptz null,
  constraint content_translation_jobs_status_check
    check (status in ('pending', 'in_progress', 'completed', 'error', 'cancelled')),
  constraint content_translation_jobs_locale_check
    check (target_locale in ('en'))
);

create index if not exists idx_content_translation_jobs_status_created_at
  on public.content_translation_jobs (status, created_at);

create index if not exists idx_content_translation_jobs_record_lookup
  on public.content_translation_jobs (table_name, record_id, target_locale, created_at desc);

create or replace function public.translation_source_payload(
  p_table_name text,
  p_row jsonb
)
returns jsonb
language plpgsql
stable
as $$
declare
  payload jsonb := '{}'::jsonb;
begin
  case p_table_name
    when 'branches' then
      payload := jsonb_build_object(
        'name', p_row ->> 'name'
      );
    when 'resources' then
      payload := jsonb_build_object(
        'name', p_row ->> 'name'
      );
    when 'services' then
      payload := jsonb_build_object(
        'name', p_row ->> 'name',
        'short_description', p_row ->> 'short_description'
      );
    when 'storefront_profile' then
      payload := jsonb_build_object(
        'name', p_row ->> 'name',
        'category', p_row ->> 'category',
        'description', p_row ->> 'description',
        'reviews_label', p_row ->> 'reviews_label',
        'address_line', p_row ->> 'address_line',
        'opening_hours', p_row ->> 'opening_hours',
        'highlights', coalesce(p_row -> 'highlights', '[]'::jsonb)
      );
    when 'storefront_team_members' then
      payload := jsonb_build_object(
        'display_name', p_row ->> 'display_name',
        'role_label', p_row ->> 'role_label',
        'bio', p_row ->> 'bio'
      );
    when 'storefront_products' then
      payload := jsonb_build_object(
        'name', p_row ->> 'name',
        'subtitle', p_row ->> 'subtitle',
        'price_label', p_row ->> 'price_label',
        'product_type', p_row ->> 'product_type'
      );
    when 'storefront_gallery' then
      payload := jsonb_build_object(
        'title', p_row ->> 'title'
      );
    when 'marketing_offers' then
      payload := jsonb_build_object(
        'title', p_row ->> 'title',
        'description', p_row ->> 'description',
        'badge', p_row ->> 'badge'
      );
    when 'customer_content_posts' then
      payload := jsonb_build_object(
        'title', p_row ->> 'title',
        'summary', p_row ->> 'summary',
        'body', p_row ->> 'body',
        'source_platform', p_row ->> 'source_platform'
      );
    else
      payload := '{}'::jsonb;
  end case;

  return jsonb_strip_nulls(payload);
end;
$$;

create or replace function public.enqueue_dynamic_translation_job()
returns trigger
language plpgsql
as $$
declare
  new_payload jsonb;
  old_payload jsonb;
  changed_fields text[] := array[]::text[];
  queued_fields text[] := array[]::text[];
  field_name text;
  field_mode text;
  record_id uuid;
  org_id uuid;
  branch_id uuid;
begin
  if tg_op = 'DELETE' then
    return old;
  end if;

  new_payload := public.translation_source_payload(tg_table_name, to_jsonb(new));
  old_payload := case when tg_op = 'UPDATE' then public.translation_source_payload(tg_table_name, to_jsonb(old)) else '{}'::jsonb end;

  if tg_op = 'UPDATE' and new_payload = old_payload then
    return new;
  end if;

  for field_name in
    select key from jsonb_object_keys(new_payload) as key
  loop
    if (old_payload -> field_name) is distinct from (new_payload -> field_name) then
      changed_fields := array_append(changed_fields, field_name);
      field_mode := coalesce(new.translation_meta -> 'fields' -> field_name ->> 'mode', 'auto');
      if field_mode <> 'manual' then
        queued_fields := array_append(queued_fields, field_name);
      end if;
    end if;
  end loop;

  if coalesce(array_length(queued_fields, 1), 0) = 0 then
    return new;
  end if;

  record_id := (to_jsonb(new) ->> 'id')::uuid;
  org_id := nullif(to_jsonb(new) ->> 'org_id', '')::uuid;
  branch_id := nullif(to_jsonb(new) ->> 'branch_id', '')::uuid;

  insert into public.content_translation_jobs (
    table_name,
    record_id,
    org_id,
    branch_id,
    target_locale,
    force_overwrite,
    requested_fields,
    source_payload,
    status
  ) values (
    tg_table_name,
    record_id,
    org_id,
    branch_id,
    'en',
    false,
    queued_fields,
    new_payload,
    'pending'
  );

  return new;
end;
$$;

drop trigger if exists trg_enqueue_branch_translation_job on public.branches;
create trigger trg_enqueue_branch_translation_job
after insert or update on public.branches
for each row execute function public.enqueue_dynamic_translation_job();

drop trigger if exists trg_enqueue_resource_translation_job on public.resources;
create trigger trg_enqueue_resource_translation_job
after insert or update on public.resources
for each row execute function public.enqueue_dynamic_translation_job();

drop trigger if exists trg_enqueue_service_translation_job on public.services;
create trigger trg_enqueue_service_translation_job
after insert or update on public.services
for each row execute function public.enqueue_dynamic_translation_job();

drop trigger if exists trg_enqueue_storefront_translation_job on public.storefront_profile;
create trigger trg_enqueue_storefront_translation_job
after insert or update on public.storefront_profile
for each row execute function public.enqueue_dynamic_translation_job();

drop trigger if exists trg_enqueue_storefront_team_translation_job on public.storefront_team_members;
create trigger trg_enqueue_storefront_team_translation_job
after insert or update on public.storefront_team_members
for each row execute function public.enqueue_dynamic_translation_job();

drop trigger if exists trg_enqueue_storefront_product_translation_job on public.storefront_products;
create trigger trg_enqueue_storefront_product_translation_job
after insert or update on public.storefront_products
for each row execute function public.enqueue_dynamic_translation_job();

drop trigger if exists trg_enqueue_storefront_gallery_translation_job on public.storefront_gallery;
create trigger trg_enqueue_storefront_gallery_translation_job
after insert or update on public.storefront_gallery
for each row execute function public.enqueue_dynamic_translation_job();

drop trigger if exists trg_enqueue_offer_translation_job on public.marketing_offers;
create trigger trg_enqueue_offer_translation_job
after insert or update on public.marketing_offers
for each row execute function public.enqueue_dynamic_translation_job();

drop trigger if exists trg_enqueue_content_post_translation_job on public.customer_content_posts;
create trigger trg_enqueue_content_post_translation_job
after insert or update on public.customer_content_posts
for each row execute function public.enqueue_dynamic_translation_job();

create or replace function public.request_dynamic_translation(
  p_table_name text,
  p_record_id uuid,
  p_target_locale text default 'en',
  p_force_overwrite boolean default false,
  p_fields text[] default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  source_payload jsonb;
  org_id uuid;
  branch_id uuid;
  job_id uuid;
  sql text;
begin
  if p_target_locale <> 'en' then
    raise exception 'Unsupported translation target locale: %', p_target_locale;
  end if;

  if p_table_name not in (
    'branches',
    'resources',
    'services',
    'storefront_profile',
    'storefront_team_members',
    'storefront_products',
    'storefront_gallery',
    'marketing_offers',
    'customer_content_posts'
  ) then
    raise exception 'Unsupported translation table: %', p_table_name;
  end if;

  sql := format(
    'select public.translation_source_payload(%L, to_jsonb(t)), t.org_id, t.branch_id from public.%I t where t.id = $1',
    p_table_name,
    p_table_name
  );

  execute sql using p_record_id into source_payload, org_id, branch_id;

  if source_payload is null then
    raise exception 'Record not found for translation request: %.%', p_table_name, p_record_id;
  end if;

  insert into public.content_translation_jobs (
    table_name,
    record_id,
    org_id,
    branch_id,
    target_locale,
    force_overwrite,
    requested_fields,
    source_payload,
    status
  ) values (
    p_table_name,
    p_record_id,
    org_id,
    branch_id,
    p_target_locale,
    p_force_overwrite,
    p_fields,
    source_payload,
    'pending'
  )
  returning id into job_id;

  return job_id;
end;
$$;

grant execute on function public.request_dynamic_translation(text, uuid, text, boolean, text[]) to authenticated, service_role;
