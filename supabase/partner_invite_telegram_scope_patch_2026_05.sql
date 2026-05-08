-- Runtime patch:
-- 1. Partner can generate invite codes for branch staff roles only.
-- 2. Only owner can generate partner invite codes.
-- 3. Telegram role RPC returns branch_id for branch-scoped partner access.

create or replace function public.generate_invite_code_secure(
  p_allowed_role text default 'TECH',
  p_note text default null
)
returns public.invite_codes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_branch_id uuid;
  v_role text;
  v_code text;
  v_row public.invite_codes;
  v_can_manage_all_roles boolean := false;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select p.org_id, p.default_branch_id into v_org_id, v_branch_id
  from public.profiles p
  where p.user_id = auth.uid()
  limit 1;

  if v_org_id is null then
    raise exception 'ORG_CONTEXT_REQUIRED';
  end if;

  if v_branch_id is null then
    select id into v_branch_id
    from public.branches
    where org_id = v_org_id
    order by created_at asc
    limit 1;
  end if;

  if v_branch_id is null then
    raise exception 'BRANCH_CONTEXT_REQUIRED';
  end if;

  if not (public.has_role('OWNER') or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.org_id = v_org_id
      and ur.role = 'PARTNER'
      and ur.branch_id = v_branch_id
  )) then
    raise exception 'FORBIDDEN';
  end if;

  v_can_manage_all_roles := exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.org_id = v_org_id
      and ur.role = 'OWNER'
      and ur.branch_id is null
  );

  v_role := coalesce(nullif(trim(p_allowed_role), ''), 'TECH');
  if v_role not in ('PARTNER','MANAGER','RECEPTION','ACCOUNTANT','TECH') then
    raise exception 'INVALID_ROLE';
  end if;

  if not v_can_manage_all_roles and v_role = 'PARTNER' then
    raise exception 'FORBIDDEN_ROLE';
  end if;

  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    begin
      insert into public.invite_codes (org_id, branch_id, code, created_by, allowed_role, expires_at, note)
      values (v_org_id, v_branch_id, v_code, auth.uid(), v_role, now() + interval '15 minutes', nullif(trim(p_note), ''))
      returning * into v_row;
      exit;
    exception when unique_violation then
    end;
  end loop;

  return v_row;
end;
$$;

drop function if exists public.get_telegram_user_role(bigint);

create or replace function public.get_telegram_user_role(p_telegram_user_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app_user_id uuid;
  v_role text;
  v_display_name text;
  v_org_id uuid;
  v_branch_id uuid;
begin
  select tl.app_user_id
  into v_app_user_id
  from public.telegram_links tl
  where tl.telegram_user_id = p_telegram_user_id
  limit 1;

  if v_app_user_id is null then
    return jsonb_build_object('linked', false);
  end if;

  select r.role, r.org_id, r.branch_id
  into v_role, v_org_id, v_branch_id
  from public.user_roles r
  where r.user_id = v_app_user_id
  order by
    case r.role
      when 'OWNER' then 0
      when 'PARTNER' then 1
      when 'MANAGER' then 2
      when 'RECEPTION' then 3
      when 'ACCOUNTANT' then 4
      when 'TECH' then 5
      else 99
    end asc
  limit 1;

  select p.display_name
  into v_display_name
  from public.profiles p
  where p.user_id = v_app_user_id;

  return jsonb_build_object(
    'linked', true,
    'user_id', v_app_user_id,
    'role', v_role,
    'display_name', v_display_name,
    'org_id', v_org_id,
    'branch_id', v_branch_id
  );
end;
$$;
