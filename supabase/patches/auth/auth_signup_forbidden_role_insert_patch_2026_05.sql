-- Fix signup failures caused by FORBIDDEN_ROLE_INSERT during auth.users insert.
-- Root cause confirmed from schema backup supabase_schema_8-5-26.sql:
-- 1. public.normalize_user_role_on_insert() rejects system-trigger inserts because auth.uid() is null
-- 2. public.handle_new_auth_user() still inserts USER into public.user_roles for customer signups
--
-- Safe to run multiple times.

begin;

create or replace function public.normalize_user_role_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_count int;
  v_current_user_id uuid;
begin
  v_current_user_id := auth.uid();

  if v_current_user_id is null then
    return NEW;
  end if;

  if NEW.user_id = v_current_user_id then
    select count(*)::int into v_owner_count
    from public.user_roles
    where org_id = NEW.org_id
      and role = 'OWNER';

    if v_owner_count = 0 then
      NEW.role := 'OWNER';
    else
      NEW.role := 'RECEPTION';
    end if;

    return NEW;
  end if;

  if exists (
    select 1
    from public.user_roles ur
    where ur.org_id = NEW.org_id
      and ur.user_id = v_current_user_id
      and ur.role = 'OWNER'
  ) then
    return NEW;
  end if;

  raise exception 'FORBIDDEN_ROLE_INSERT';
end;
$$;

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

  if v_registration_mode <> 'USER' then
    v_workspace := public.ensure_default_workspace();
    v_org_id := coalesce((v_workspace ->> 'org_id')::uuid, '00000000-0000-0000-0000-000000000001'::uuid);
    v_branch_id := coalesce((v_workspace ->> 'branch_id')::uuid, '00000000-0000-0000-0000-000000000101'::uuid);
  else
    v_org_id := null;
    v_branch_id := null;
  end if;

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

  if v_registration_mode <> 'USER' then
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
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

commit;
