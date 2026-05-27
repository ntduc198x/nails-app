create or replace function public.enqueue_dynamic_translation_job()
returns trigger
language plpgsql
as $$
begin
  return new;
end;
$$;

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
  if auth.uid() is null then
    raise exception 'Authentication required for translation approval.';
  end if;

  if not public.has_org_role(array['OWNER']) then
    raise exception 'Only OWNER can approve automatic translation.';
  end if;

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

  if p_table_name in ('branches', 'resources', 'services') then
    sql := format(
      'select public.translation_source_payload(%L, to_jsonb(t)), t.org_id, t.branch_id from public.%I t where t.id = $1',
      p_table_name,
      p_table_name
    );
  else
    sql := format(
      'select public.translation_source_payload(%L, to_jsonb(t)), t.org_id, null::uuid from public.%I t where t.id = $1',
      p_table_name,
      p_table_name
    );
  end if;

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

  execute format(
    'update public.%I set translation_meta = jsonb_set(coalesce(translation_meta, ''{}''::jsonb), ''{targets,en}'', coalesce(translation_meta->''targets''->''en'', ''{}''::jsonb) || jsonb_build_object(''status'', ''pending'', ''approvalStatus'', ''approved'', ''error'', null, ''updatedAt'', now()::text), true) where id = $1',
    p_table_name
  ) using p_record_id;

  return job_id;
end;
$$;

grant execute on function public.request_dynamic_translation(text, uuid, text, boolean, text[]) to authenticated, service_role;
