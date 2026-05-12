-- Fix customer Google signup/login backend flow.
-- Goal:
-- 1) USER/customer accounts must be created in customers + customer_accounts
-- 2) USER/customer signups must NOT auto-create public.profiles
-- 3) Internal/admin roles continue to use profiles + user_roles
--
-- Apply this AFTER the existing auth/customer mobile patches.

begin;

-- customer_accounts should point to auth.users for customer/mobile identities,
-- not to public.profiles. This lets customer USER exist without a profiles row.
alter table public.customer_accounts
  drop constraint if exists customer_accounts_user_id_fkey;

alter table public.customer_accounts
  add constraint customer_accounts_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

create index if not exists idx_customer_accounts_user_id
  on public.customer_accounts (user_id);

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
  v_customer_id uuid;
begin
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

  v_workspace := public.ensure_default_workspace();
  v_org_id := coalesce((v_workspace ->> 'org_id')::uuid, '00000000-0000-0000-0000-000000000001'::uuid);
  v_branch_id := coalesce((v_workspace ->> 'branch_id')::uuid, '00000000-0000-0000-0000-000000000101'::uuid);

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
  v_phone := public.normalize_customer_phone(v_phone);

  if v_registration_mode = 'USER' then
    select c.id
    into v_customer_id
    from public.customers c
    where c.org_id = v_org_id
      and (
        (v_phone is not null and public.normalize_customer_phone(c.phone) = v_phone)
        or lower(trim(coalesce(c.full_name, c.name))) = lower(trim(v_display_name))
      )
      and c.merged_into_customer_id is null
    order by
      case when v_phone is not null and public.normalize_customer_phone(c.phone) = v_phone then 0 else 1 end,
      c.total_visits desc,
      c.total_spend desc,
      c.created_at asc
    limit 1;

    if v_customer_id is null then
      insert into public.customers (
        org_id,
        name,
        full_name,
        phone,
        source
      )
      values (
        v_org_id,
        v_display_name,
        v_display_name,
        v_phone,
        'APP_SIGNUP'
      )
      returning id into v_customer_id;
    else
      update public.customers
      set
        full_name = coalesce(nullif(trim(full_name), ''), v_display_name),
        name = coalesce(name, v_display_name),
        phone = coalesce(phone, v_phone),
        source = coalesce(source, 'APP_SIGNUP')
      where id = v_customer_id;
    end if;

    insert into public.customer_accounts (
      user_id,
      customer_id,
      org_id,
      linked_by
    )
    values (
      new.id,
      v_customer_id,
      v_org_id,
      case when v_phone is not null then 'PHONE_MATCH' else 'EMAIL_MATCH' end
    )
    on conflict (user_id) do update
      set
        customer_id = excluded.customer_id,
        org_id = excluded.org_id,
        linked_by = excluded.linked_by;

    return new;
  end if;

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

create or replace function public.ensure_current_user_profile(p_user_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_current_user_id uuid := auth.uid();
  v_auth_user auth.users%rowtype;
  v_workspace jsonb;
  v_org_id uuid;
  v_branch_id uuid;
  v_display_name text;
  v_phone text;
  v_registration_mode text;
  v_auth_provider text;
  v_role text;
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

  v_auth_provider := lower(coalesce(v_auth_user.raw_app_meta_data ->> 'provider', 'email'));
  v_registration_mode := upper(
    coalesce(
      v_auth_user.raw_user_meta_data ->> 'registration_mode',
      case
        when v_auth_provider in ('google', 'apple') then 'USER'
        else 'ADMIN'
      end
    )
  );

  if v_registration_mode = 'USER' then
    select ca.org_id
    into v_org_id
    from public.customer_accounts ca
    where ca.user_id = v_current_user_id
    limit 1;

    if v_org_id is null then
      v_workspace := public.ensure_default_workspace();
      v_org_id := coalesce((v_workspace ->> 'org_id')::uuid, '00000000-0000-0000-0000-000000000001'::uuid);
    end if;

    select b.id
    into v_branch_id
    from public.branches b
    where b.org_id = v_org_id
    order by b.created_at asc, b.id asc
    limit 1;

    return jsonb_build_object(
      'success', true,
      'user_id', v_current_user_id,
      'org_id', v_org_id,
      'branch_id', v_branch_id
    );
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
    limit 1;
  end if;

  if v_org_id is null then
    v_workspace := public.ensure_default_workspace();
    v_org_id := coalesce((v_workspace ->> 'org_id')::uuid, '00000000-0000-0000-0000-000000000001'::uuid);
    v_branch_id := coalesce(v_branch_id, (v_workspace ->> 'branch_id')::uuid, '00000000-0000-0000-0000-000000000101'::uuid);
  end if;

  if v_branch_id is null then
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

  v_phone := public.normalize_customer_phone(nullif(trim(coalesce(v_auth_user.phone, v_auth_user.raw_user_meta_data ->> 'phone', '')), ''));

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

  if not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = v_current_user_id
      and ur.org_id = v_org_id
  ) then
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

    begin
      insert into public.user_roles (user_id, org_id, role)
      values (v_current_user_id, v_org_id, v_role);
    exception when unique_violation then
      null;
    end;
  end if;

  return jsonb_build_object(
    'success', true,
    'user_id', v_current_user_id,
    'org_id', v_org_id,
    'branch_id', v_branch_id
  );
end;
$$;

grant execute on function public.ensure_current_user_profile(uuid) to authenticated;

create or replace function public.link_customer_account_by_phone()
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_auth_user auth.users%rowtype;
  v_workspace jsonb;
  v_org_id uuid;
  v_display_name text;
  v_phone text;
  v_customer_id uuid;
  v_existing_account_id uuid;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select *
  into v_auth_user
  from auth.users
  where id = auth.uid()
  limit 1;

  if v_auth_user.id is null then
    raise exception 'AUTH_USER_NOT_FOUND';
  end if;

  select ca.org_id
  into v_org_id
  from public.customer_accounts ca
  where ca.user_id = auth.uid()
  limit 1;

  if v_org_id is null then
    v_workspace := public.ensure_default_workspace();
    v_org_id := coalesce((v_workspace ->> 'org_id')::uuid, '00000000-0000-0000-0000-000000000001'::uuid);
  end if;

  v_display_name := nullif(
    trim(
      coalesce(
        v_auth_user.raw_user_meta_data ->> 'display_name',
        v_auth_user.raw_user_meta_data ->> 'full_name',
        split_part(coalesce(v_auth_user.email, ''), '@', 1),
        'Customer'
      )
    ),
    ''
  );

  v_phone := public.normalize_customer_phone(nullif(trim(coalesce(v_auth_user.phone, v_auth_user.raw_user_meta_data ->> 'phone', '')), ''));

  select id
  into v_customer_id
  from public.customers
  where org_id = v_org_id
    and (
      (v_phone is not null and public.normalize_customer_phone(phone) = v_phone)
      or lower(trim(coalesce(full_name, name))) = lower(trim(v_display_name))
    )
    and merged_into_customer_id is null
  order by
    case when v_phone is not null and public.normalize_customer_phone(phone) = v_phone then 0 else 1 end,
    total_visits desc,
    total_spend desc,
    created_at asc
  limit 1;

  if v_customer_id is null then
    insert into public.customers (
      org_id,
      name,
      full_name,
      phone,
      source
    )
    values (
      v_org_id,
      coalesce(v_display_name, coalesce(v_auth_user.email, 'Customer')),
      coalesce(v_display_name, coalesce(v_auth_user.email, 'Customer')),
      v_phone,
      'APP_SIGNUP'
    )
    returning id into v_customer_id;
  end if;

  select id
  into v_existing_account_id
  from public.customer_accounts
  where user_id = auth.uid()
     or customer_id = v_customer_id
  order by case when user_id = auth.uid() then 0 else 1 end, created_at asc
  limit 1;

  if v_existing_account_id is not null then
    update public.customer_accounts
    set
      user_id = auth.uid(),
      customer_id = v_customer_id,
      org_id = v_org_id,
      linked_by = case when v_phone is not null then 'PHONE_MATCH' else 'EMAIL_MATCH' end
    where id = v_existing_account_id;
  else
    insert into public.customer_accounts (
      user_id,
      customer_id,
      org_id,
      linked_by
    )
    values (
      auth.uid(),
      v_customer_id,
      v_org_id,
      case when v_phone is not null then 'PHONE_MATCH' else 'EMAIL_MATCH' end
    );
  end if;

  return v_customer_id;
end;
$$;

grant execute on function public.link_customer_account_by_phone() to authenticated;

commit;
