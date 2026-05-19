begin;

create or replace function public.generate_invite_code_secure(
  p_branch_id uuid,
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
  v_role text;
  v_code text;
  v_row public.invite_codes;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  v_org_id := public.my_org_id();
  if v_org_id is null then
    raise exception 'ORG_CONTEXT_REQUIRED';
  end if;

  if p_branch_id is null then
    raise exception 'BRANCH_CONTEXT_REQUIRED';
  end if;

  if not public.can_access_branch(
    p_branch_id,
    array['OWNER','PARTNER','MANAGER']
  ) then
    raise exception 'ACCESS_DENIED';
  end if;

  v_role := upper(coalesce(nullif(trim(p_allowed_role), ''), 'TECH'));
  if v_role not in ('PARTNER','MANAGER','RECEPTION','ACCOUNTANT','TECH') then
    raise exception 'INVALID_ROLE';
  end if;

  if public.has_org_role(array['OWNER']) then
    null;
  elsif public.can_access_branch(p_branch_id, array['PARTNER']) then
    if v_role not in ('MANAGER','RECEPTION','ACCOUNTANT','TECH') then
      raise exception 'FORBIDDEN_ROLE';
    end if;
  elsif public.can_access_branch(p_branch_id, array['MANAGER']) then
    if v_role <> 'TECH' then
      raise exception 'FORBIDDEN_ROLE';
    end if;
  else
    raise exception 'FORBIDDEN_ROLE';
  end if;

  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    begin
      insert into public.invite_codes (org_id, branch_id, code, created_by, allowed_role, expires_at, note)
      values (v_org_id, p_branch_id, v_code, auth.uid(), v_role, now() + interval '15 minutes', nullif(trim(p_note), ''))
      returning * into v_row;
      exit;
    exception when unique_violation then
    end;
  end loop;

  return v_row;
end;
$$;

create or replace function public.generate_invite_code_secure(
  p_allowed_role text default 'TECH',
  p_note text default null
)
returns public.invite_codes
language sql
security definer
set search_path = public
as $$
  select public.generate_invite_code_secure(
    public.my_default_branch_id(),
    p_allowed_role,
    p_note
  )
$$;

grant execute on function public.generate_invite_code_secure(uuid, text, text) to authenticated;
grant execute on function public.generate_invite_code_secure(text, text) to authenticated;

commit;
