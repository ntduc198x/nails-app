begin;

create or replace function public.my_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.org_id
  from public.profiles p
  where p.user_id = auth.uid()
  limit 1
$$;

create or replace function public.my_default_branch_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.default_branch_id
  from public.profiles p
  where p.user_id = auth.uid()
  limit 1
$$;

create or replace function public.my_branch_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select public.my_default_branch_id()
$$;

create or replace function public.has_org_role(
  p_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.org_id = public.my_org_id()
      and ur.branch_id is null
      and ur.role = any(p_roles)
  )
$$;

create or replace function public.has_branch_role(
  p_branch_id uuid,
  p_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.org_id = public.my_org_id()
      and ur.branch_id = p_branch_id
      and ur.role = any(p_roles)
  )
$$;

create or replace function public.can_access_branch(
  p_branch_id uuid,
  p_roles text[] default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.org_id = public.my_org_id()
      and (
        ur.branch_id is null
        or ur.branch_id = p_branch_id
      )
      and (
        p_roles is null
        or ur.role = any(p_roles)
      )
  )
$$;

create or replace function public.can_access_crm()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.org_id = public.my_org_id()
      and ur.role in ('OWNER', 'PARTNER', 'MANAGER', 'RECEPTION', 'ACCOUNTANT')
  )
$$;

create or replace function public.can_access_crm_branch(
  p_branch_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_access_branch(
    p_branch_id,
    array['OWNER','PARTNER','MANAGER','RECEPTION','ACCOUNTANT']
  )
$$;

revoke all on function public.my_org_id() from public;
revoke all on function public.my_org_id() from anon;
revoke all on function public.my_default_branch_id() from public;
revoke all on function public.my_default_branch_id() from anon;
revoke all on function public.my_branch_id() from public;
revoke all on function public.my_branch_id() from anon;
revoke all on function public.has_org_role(text[]) from public;
revoke all on function public.has_org_role(text[]) from anon;
revoke all on function public.has_branch_role(uuid, text[]) from public;
revoke all on function public.has_branch_role(uuid, text[]) from anon;
revoke all on function public.can_access_branch(uuid, text[]) from public;
revoke all on function public.can_access_branch(uuid, text[]) from anon;
revoke all on function public.can_access_crm() from public;
revoke all on function public.can_access_crm() from anon;
revoke all on function public.can_access_crm_branch(uuid) from public;
revoke all on function public.can_access_crm_branch(uuid) from anon;

grant execute on function public.my_org_id() to authenticated, service_role;
grant execute on function public.my_default_branch_id() to authenticated, service_role;
grant execute on function public.my_branch_id() to authenticated, service_role;
grant execute on function public.has_org_role(text[]) to authenticated, service_role;
grant execute on function public.has_branch_role(uuid, text[]) to authenticated, service_role;
grant execute on function public.can_access_branch(uuid, text[]) to authenticated, service_role;
grant execute on function public.can_access_crm() to authenticated, service_role;
grant execute on function public.can_access_crm_branch(uuid) to authenticated, service_role;

comment on function public.my_default_branch_id() is
  'Default branch selector for UI defaults. Do not use as the primary authorization source.';

comment on function public.can_access_branch(uuid, text[]) is
  'Branch-aware authorization helper. Users with org-level roles (branch_id null) can access all branches in their org.';

commit;
