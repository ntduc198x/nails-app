create or replace function public.ensure_default_workspace()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_default_org_id constant uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_default_branch_id constant uuid := '00000000-0000-0000-0000-000000000101'::uuid;
  v_org_id uuid;
  v_branch_id uuid;
begin
  select id
  into v_org_id
  from public.orgs
  where id <> v_default_org_id
  order by created_at asc, id asc
  limit 1;

  if v_org_id is null then
    select id
    into v_org_id
    from public.orgs
    order by created_at asc, id asc
    limit 1;
  end if;

  if v_org_id is null then
    v_org_id := v_default_org_id;

    insert into public.orgs (id, name)
    values (v_org_id, 'Nails App Default Org')
    on conflict (id) do update
      set name = excluded.name;
  end if;

  select id
  into v_branch_id
  from public.branches
  where org_id = v_org_id
  order by created_at asc, id asc
  limit 1;

  if v_branch_id is null then
    v_branch_id := case
      when v_org_id = v_default_org_id then v_default_branch_id
      else gen_random_uuid()
    end;

    insert into public.branches (id, org_id, name, timezone, currency)
    values (
      v_branch_id,
      v_org_id,
      case when v_org_id = v_default_org_id then 'Main Branch' else 'Primary Branch' end,
      'Asia/Bangkok',
      'VND'
    )
    on conflict (id) do update
      set
        org_id = excluded.org_id,
        name = excluded.name,
        timezone = excluded.timezone,
        currency = excluded.currency;
  end if;

  return jsonb_build_object(
    'org_id', v_org_id,
    'branch_id', v_branch_id
  );
end;
$$;

select public.ensure_default_workspace();
