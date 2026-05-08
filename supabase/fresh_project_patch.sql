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
  v_registration_mode text;
  v_auth_provider text;
begin
  v_workspace := public.ensure_default_workspace();
  v_org_id := (v_workspace ->> 'org_id')::uuid;
  v_branch_id := (v_workspace ->> 'branch_id')::uuid;
  v_auth_provider := lower(coalesce(new.raw_app_meta_data ->> 'provider', 'email'));
  v_registration_mode := upper(
    coalesce(
      new.raw_user_meta_data ->> 'registration_mode',
      case
        when v_auth_provider in ('google', 'apple') then 'USER'
        else 'ADMIN'
      end
    )
  );

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
    when v_registration_mode = 'USER' then 'USER'
    when exists (
      select 1
      from public.user_roles
      where org_id = v_org_id
        and role = 'OWNER'
    ) then 'RECEPTION'
    else 'OWNER'
  end
  into v_role;

  begin
    insert into public.user_roles (user_id, org_id, role)
    values (new.id, v_org_id, v_role);
  exception when unique_violation then
    null;
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();
