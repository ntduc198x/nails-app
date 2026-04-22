create or replace function public.ensure_default_workspace()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_branch_id uuid;
begin
  select id
  into v_org_id
  from public.orgs
  order by created_at asc, id asc
  limit 1;

  if v_org_id is null then
    v_org_id := '00000000-0000-0000-0000-000000000001'::uuid;

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
    v_branch_id := '00000000-0000-0000-0000-000000000101'::uuid;

    insert into public.branches (id, org_id, name, timezone, currency)
    values (v_branch_id, v_org_id, 'Main Branch', 'Asia/Bangkok', 'VND')
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

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace jsonb;
  v_org_id uuid;
  v_branch_id uuid;
  v_role text;
  v_display_name text;
  v_phone text;
begin
  v_workspace := public.ensure_default_workspace();
  v_org_id := (v_workspace ->> 'org_id')::uuid;
  v_branch_id := (v_workspace ->> 'branch_id')::uuid;

  v_display_name := nullif(
    trim(
      coalesce(
        new.raw_user_meta_data ->> 'display_name',
        new.raw_user_meta_data ->> 'full_name',
        ''
      )
    ),
    ''
  );

  if v_display_name is null then
    v_display_name := coalesce(nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'User');
  end if;

  v_phone := nullif(trim(coalesce(new.phone, new.raw_user_meta_data ->> 'phone', '')), '');

  insert into public.profiles (
    user_id,
    org_id,
    default_branch_id,
    display_name,
    email,
    phone
  )
  values (
    new.id,
    v_org_id,
    v_branch_id,
    v_display_name,
    new.email,
    v_phone
  )
  on conflict (user_id) do update
    set
      org_id = coalesce(public.profiles.org_id, excluded.org_id),
      default_branch_id = coalesce(public.profiles.default_branch_id, excluded.default_branch_id),
      display_name = coalesce(nullif(public.profiles.display_name, ''), excluded.display_name),
      email = coalesce(excluded.email, public.profiles.email),
      phone = coalesce(excluded.phone, public.profiles.phone);

  select case
    when exists (
      select 1
      from public.user_roles
      where org_id = v_org_id
        and role = 'OWNER'
    ) then 'RECEPTION'
    else 'OWNER'
  end
  into v_role;

  insert into public.user_roles (user_id, org_id, role)
  values (new.id, v_org_id, v_role)
  on conflict (user_id, org_id, role) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();
