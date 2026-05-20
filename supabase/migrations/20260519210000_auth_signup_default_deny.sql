begin;

create or replace function public.ensure_current_user_profile(p_user_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_current_user_id uuid := auth.uid();
  v_auth_user auth.users%rowtype;
  v_org_id uuid;
  v_branch_id uuid;
  v_display_name text;
  v_phone text;
begin
  if v_current_user_id is null then
    raise exception 'UNAUTHORIZED';
  end if;

  if p_user_id is not null and p_user_id <> v_current_user_id then
    raise exception 'UNAUTHORIZED';
  end if;

  select *
  into v_auth_user
  from auth.users
  where id = v_current_user_id
  limit 1;

  if v_auth_user.id is null then
    raise exception 'AUTH_USER_NOT_FOUND';
  end if;

  select p.org_id, p.default_branch_id
  into v_org_id, v_branch_id
  from public.profiles p
  where p.user_id = v_current_user_id
  limit 1;

  if v_org_id is null then
    select ur.org_id
    into v_org_id
    from public.user_roles ur
    where ur.user_id = v_current_user_id
    order by ur.created_at asc, ur.org_id asc
    limit 1;
  end if;

  if v_org_id is null then
    select ca.org_id
    into v_org_id
    from public.customer_accounts ca
    where ca.user_id = v_current_user_id
    limit 1;
  end if;

  if v_branch_id is null and v_org_id is not null then
    select cb.branch_id
    into v_branch_id
    from public.customer_accounts ca
    join public.customer_branches cb
      on cb.org_id = ca.org_id
     and cb.customer_id = ca.customer_id
    where ca.user_id = v_current_user_id
      and cb.branch_id is not null
    order by cb.last_seen_at desc nulls last, cb.created_at desc, cb.branch_id asc
    limit 1;
  end if;

  if v_branch_id is null and v_org_id is not null then
    select b.id
    into v_branch_id
    from public.branches b
    where b.org_id = v_org_id
    order by b.created_at asc, b.id asc
    limit 1;
  end if;

  v_display_name := nullif(
    trim(
      coalesce(
        v_auth_user.raw_user_meta_data ->> 'display_name',
        v_auth_user.raw_user_meta_data ->> 'full_name',
        ''
      )
    ),
    ''
  );

  if v_display_name is null then
    v_display_name := coalesce(nullif(split_part(coalesce(v_auth_user.email, ''), '@', 1), ''), 'User');
  end if;

  v_phone := nullif(trim(coalesce(v_auth_user.phone, v_auth_user.raw_user_meta_data ->> 'phone', '')), '');

  insert into public.profiles (
    user_id,
    org_id,
    default_branch_id,
    display_name,
    email,
    phone
  )
  values (
    v_current_user_id,
    v_org_id,
    v_branch_id,
    v_display_name,
    v_auth_user.email,
    v_phone
  )
  on conflict (user_id) do update
    set
      org_id = coalesce(public.profiles.org_id, excluded.org_id),
      default_branch_id = coalesce(public.profiles.default_branch_id, excluded.default_branch_id),
      display_name = coalesce(nullif(public.profiles.display_name, ''), excluded.display_name),
      email = coalesce(excluded.email, public.profiles.email),
      phone = coalesce(excluded.phone, public.profiles.phone);

  return jsonb_build_object(
    'success', true,
    'user_id', v_current_user_id,
    'org_id', v_org_id,
    'branch_id', v_branch_id
  );
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name text;
  v_phone text;
begin
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
    null,
    null,
    v_display_name,
    new.email,
    v_phone
  )
  on conflict (user_id) do update
    set
      display_name = coalesce(nullif(public.profiles.display_name, ''), excluded.display_name),
      email = coalesce(excluded.email, public.profiles.email),
      phone = coalesce(excluded.phone, public.profiles.phone);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

grant execute on function public.ensure_current_user_profile(uuid) to authenticated;

commit;
