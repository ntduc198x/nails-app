-- Preserve invited role using invite context when inserting user_roles.
-- Rule:
-- - if org has no OWNER yet => OWNER
-- - otherwise, if invite context exists => invite allowed_role
-- - otherwise fallback bootstrap self-signup => RECEPTION

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
  v_invite_insert text;
  v_invite_role text;
begin
  v_current_user_id := auth.uid();
  v_invite_insert := current_setting('app.invite_role_insert', true);
  v_invite_role := current_setting('app.invite_allowed_role', true);

  if v_current_user_id is null then
    return NEW;
  end if;

  select count(*)::int into v_owner_count
  from public.user_roles
  where org_id = NEW.org_id
    and role = 'OWNER';

  if v_owner_count = 0 then
    NEW.role := 'OWNER';
    return NEW;
  end if;

  if v_invite_insert = 'on' and v_invite_role in ('PARTNER','MANAGER','RECEPTION','ACCOUNTANT','TECH') then
    NEW.role := v_invite_role;
    return NEW;
  end if;

  if NEW.user_id = v_current_user_id then
    NEW.role := 'RECEPTION';
    return NEW;
  end if;

  if exists (
    select 1
    from public.user_roles ur
    where ur.org_id = NEW.org_id
      and ur.user_id = v_current_user_id
      and ur.role in ('OWNER', 'PARTNER')
  ) then
    return NEW;
  end if;

  raise exception 'FORBIDDEN_ROLE_INSERT';
end;
$$;

create or replace function public.consume_invite_code_secure(
  p_code text,
  p_user_id uuid,
  p_display_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.invite_codes;
  v_display_name text;
begin
  if p_user_id is null then
    raise exception 'USER_REQUIRED';
  end if;

  select * into v_invite
  from public.invite_codes
  where code = upper(trim(p_code))
    and revoked_at is null
    and used_count < max_uses
    and expires_at > now()
  order by created_at desc
  limit 1
  for update;

  if v_invite.id is null then
    raise exception 'INVITE_INVALID';
  end if;

  update public.invite_codes
  set used_count = used_count + 1,
      used_by = p_user_id,
      used_at = now()
  where id = v_invite.id
    and used_count < max_uses;

  if not found then
    raise exception 'INVITE_ALREADY_USED';
  end if;

  v_display_name := nullif(trim(coalesce(p_display_name, '')), '');

  insert into public.profiles (user_id, org_id, default_branch_id, display_name)
  values (p_user_id, v_invite.org_id, v_invite.branch_id, coalesce(v_display_name, 'User'))
  on conflict (user_id) do update
    set org_id = excluded.org_id,
        default_branch_id = excluded.default_branch_id,
        display_name = coalesce(nullif(excluded.display_name, ''), public.profiles.display_name, 'User');

  perform set_config('app.invite_role_insert', 'on', true);
  perform set_config('app.invite_allowed_role', v_invite.allowed_role, true);

  insert into public.user_roles (user_id, org_id, branch_id, role)
  values (p_user_id, v_invite.org_id, v_invite.branch_id, v_invite.allowed_role)
  on conflict do nothing;

  return jsonb_build_object(
    'inviteId', v_invite.id,
    'orgId', v_invite.org_id,
    'role', v_invite.allowed_role,
    'expiresAt', v_invite.expires_at
  );
end;
$$;

commit;
