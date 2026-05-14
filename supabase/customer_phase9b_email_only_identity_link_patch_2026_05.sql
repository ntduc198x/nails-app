-- Phase 9b customer identity linking: auth.user.id -> normalized email only
-- Remove phone fallback for customer social/app login linking.

begin;

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
  v_email text;
  v_registration_mode text;
  v_auth_provider text;
  v_customer_id uuid;
  v_existing_customer_id uuid;
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

  v_display_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', '')), '');
  if v_display_name is null then
    v_display_name := coalesce(nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'User');
  end if;

  v_phone := public.normalize_customer_phone(nullif(trim(coalesce(new.phone, new.raw_user_meta_data ->> 'phone', '')), ''));
  v_email := lower(nullif(trim(coalesce(new.email, '')), ''));

  if v_registration_mode = 'USER' then
    -- 1) existing customer_accounts by auth.user.id
    select ca.customer_id
    into v_existing_customer_id
    from public.customer_accounts ca
    where ca.user_id = new.id
    order by ca.created_at asc
    limit 1;

    if v_existing_customer_id is not null then
      v_customer_id := v_existing_customer_id;
    end if;

    -- 2) customers by normalized email only
    if v_customer_id is null and v_email is not null then
      select c.id
      into v_customer_id
      from public.customers c
      where c.org_id = v_org_id
        and lower(coalesce(c.email, '')) = v_email
        and c.merged_into_customer_id is null
      order by c.total_visits desc, c.total_spend desc, c.created_at asc
      limit 1;
    end if;

    if v_customer_id is null then
      insert into public.customers (org_id, name, full_name, email, phone, source)
      values (v_org_id, v_display_name, v_display_name, v_email, v_phone, 'APP_SIGNUP')
      returning id into v_customer_id;
    else
      update public.customers
      set
        full_name = coalesce(nullif(trim(full_name), ''), v_display_name),
        name = coalesce(nullif(trim(name), ''), v_display_name),
        email = coalesce(email, v_email),
        phone = coalesce(phone, v_phone),
        source = coalesce(source, 'APP_SIGNUP')
      where id = v_customer_id;
    end if;

    insert into public.customer_accounts (user_id, customer_id, org_id, linked_by)
    values (
      new.id,
      v_customer_id,
      v_org_id,
      case
        when v_existing_customer_id is not null then 'ACCOUNT_LINK'
        when v_email is not null then 'EMAIL_MATCH'
        else 'APP_SIGNUP'
      end
    )
    on conflict (user_id) do update
      set customer_id = excluded.customer_id,
          org_id = excluded.org_id,
          linked_by = excluded.linked_by;

    return new;
  end if;

  insert into public.profiles (user_id, org_id, default_branch_id, display_name, email, phone)
  values (new.id, v_org_id, v_branch_id, v_display_name, new.email, v_phone)
  on conflict (user_id) do update
    set org_id = coalesce(public.profiles.org_id, excluded.org_id),
        default_branch_id = coalesce(public.profiles.default_branch_id, excluded.default_branch_id),
        display_name = coalesce(nullif(public.profiles.display_name, ''), excluded.display_name),
        email = coalesce(excluded.email, public.profiles.email),
        phone = coalesce(excluded.phone, public.profiles.phone);

  select case
    when exists (select 1 from public.user_roles where org_id = v_org_id and role = 'OWNER') then 'RECEPTION'
    else 'OWNER'
  end into v_role;

  begin
    insert into public.user_roles (user_id, org_id, role)
    values (new.id, v_org_id, v_role);
  exception when unique_violation then
    null;
  end;

  return new;
end;
$$;

create or replace function public.link_customer_account_for_current_user()
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
  v_email text;
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

  select ca.org_id, ca.customer_id, ca.id
  into v_org_id, v_customer_id, v_existing_account_id
  from public.customer_accounts ca
  where ca.user_id = auth.uid()
  order by ca.created_at asc
  limit 1;

  if v_org_id is null then
    v_workspace := public.ensure_default_workspace();
    v_org_id := coalesce((v_workspace ->> 'org_id')::uuid, '00000000-0000-0000-0000-000000000001'::uuid);
  end if;

  v_display_name := nullif(trim(coalesce(
    v_auth_user.raw_user_meta_data ->> 'display_name',
    v_auth_user.raw_user_meta_data ->> 'full_name',
    split_part(coalesce(v_auth_user.email, ''), '@', 1),
    'Customer'
  )), '');
  v_phone := public.normalize_customer_phone(nullif(trim(coalesce(v_auth_user.phone, v_auth_user.raw_user_meta_data ->> 'phone', '')), ''));
  v_email := lower(nullif(trim(coalesce(v_auth_user.email, '')), ''));

  -- 1) existing customer_accounts by auth.user.id
  if v_customer_id is not null then
    update public.customers
    set
      email = coalesce(email, v_email),
      phone = coalesce(phone, v_phone),
      full_name = coalesce(nullif(trim(full_name), ''), v_display_name),
      name = coalesce(nullif(trim(name), ''), v_display_name)
    where id = v_customer_id;

    return v_customer_id;
  end if;

  -- 2) customers by normalized email only
  if v_email is not null then
    select id
    into v_customer_id
    from public.customers
    where org_id = v_org_id
      and lower(coalesce(email, '')) = v_email
      and merged_into_customer_id is null
    order by total_visits desc, total_spend desc, created_at asc
    limit 1;
  end if;

  if v_customer_id is null then
    insert into public.customers (org_id, name, full_name, email, phone, source)
    values (
      v_org_id,
      coalesce(v_display_name, coalesce(v_auth_user.email, 'Customer')),
      coalesce(v_display_name, coalesce(v_auth_user.email, 'Customer')),
      v_email,
      v_phone,
      'APP_SIGNUP'
    )
    returning id into v_customer_id;
  else
    update public.customers
    set
      email = coalesce(email, v_email),
      phone = coalesce(phone, v_phone),
      full_name = coalesce(nullif(trim(full_name), ''), v_display_name),
      name = coalesce(nullif(trim(name), ''), v_display_name)
    where id = v_customer_id;
  end if;

  select id
  into v_existing_account_id
  from public.customer_accounts
  where user_id = auth.uid() or customer_id = v_customer_id
  order by case when user_id = auth.uid() then 0 else 1 end, created_at asc
  limit 1;

  if v_existing_account_id is not null then
    update public.customer_accounts
    set user_id = auth.uid(),
        customer_id = v_customer_id,
        org_id = v_org_id,
        linked_by = case
          when v_email is not null then 'EMAIL_MATCH'
          else 'APP_SIGNUP'
        end
    where id = v_existing_account_id;
  else
    insert into public.customer_accounts (user_id, customer_id, org_id, linked_by)
    values (
      auth.uid(),
      v_customer_id,
      v_org_id,
      case
        when v_email is not null then 'EMAIL_MATCH'
        else 'APP_SIGNUP'
      end
    );
  end if;

  return v_customer_id;
end;
$$;

create or replace function public.link_customer_account_by_phone()
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  return public.link_customer_account_for_current_user();
end;
$$;

grant execute on function public.link_customer_account_for_current_user() to authenticated;
grant execute on function public.link_customer_account_by_phone() to authenticated;

commit;
