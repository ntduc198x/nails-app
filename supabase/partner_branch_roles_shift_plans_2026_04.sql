alter table public.user_roles
  add column if not exists branch_id uuid references public.branches(id) on delete cascade;

do $$
declare
  v_constraint text;
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.user_roles'::regclass
      and conname = 'user_roles_user_id_org_id_role_key'
  ) then
    alter table public.user_roles drop constraint user_roles_user_id_org_id_role_key;
  end if;

  for v_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.user_roles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role in (%'
  loop
    execute format('alter table public.user_roles drop constraint %I', v_constraint);
  end loop;
end $$;

alter table public.user_roles
  drop constraint if exists user_roles_role_check;

alter table public.user_roles
  add constraint user_roles_role_check
  check (role in ('USER','OWNER','PARTNER','MANAGER','RECEPTION','ACCOUNTANT','TECH'));

alter table public.user_roles
  drop constraint if exists user_roles_partner_requires_branch;

alter table public.user_roles
  add constraint user_roles_partner_requires_branch
  check (role <> 'PARTNER' or branch_id is not null);

create unique index if not exists idx_user_roles_user_org_role_global
  on public.user_roles (user_id, org_id, role)
  where branch_id is null;

create unique index if not exists idx_user_roles_user_org_branch_role
  on public.user_roles (user_id, org_id, branch_id, role)
  where branch_id is not null;

create index if not exists idx_user_roles_org_branch_role
  on public.user_roles (org_id, branch_id, role);

create index if not exists idx_user_roles_user_org_branch
  on public.user_roles (user_id, org_id, branch_id);

alter table public.invite_codes
  add column if not exists branch_id uuid references public.branches(id) on delete cascade;

update public.invite_codes ic
set branch_id = (
  select b.id
  from public.branches b
  where b.org_id = ic.org_id
  order by b.created_at asc
  limit 1
)
where ic.branch_id is null;

do $$
declare
  v_constraint text;
begin
  for v_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.invite_codes'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%allowed_role in (%'
  loop
    execute format('alter table public.invite_codes drop constraint %I', v_constraint);
  end loop;
end $$;

alter table public.invite_codes
  drop constraint if exists invite_codes_allowed_role_check;

alter table public.invite_codes
  add constraint invite_codes_allowed_role_check
  check (allowed_role in ('PARTNER','MANAGER','RECEPTION','ACCOUNTANT','TECH'));

do $$
begin
  if exists (
    select 1
    from public.invite_codes
    where branch_id is null
  ) then
    raise exception 'INVITE_CODES_BRANCH_BACKFILL_FAILED';
  end if;
end $$;

alter table public.invite_codes
  alter column branch_id set not null;

create index if not exists idx_invite_codes_org_branch_created_at
  on public.invite_codes (org_id, branch_id, created_at desc);

create or replace function public.my_branch_id()
returns uuid
language sql
stable
as $$
  select default_branch_id
  from public.profiles
  where user_id = auth.uid()
  limit 1
$$;

create or replace function public.has_role(_role text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.org_id = public.my_org_id()
      and (
        (
          ur.role = _role
          and (
            ur.branch_id is null
            or ur.branch_id = public.my_branch_id()
          )
        )
        or (
          _role = 'OWNER'
          and ur.role = 'PARTNER'
          and ur.branch_id = public.my_branch_id()
        )
      )
  )
$$;

drop policy if exists "owner read invite codes" on public.invite_codes;
create policy "owner read invite codes" on public.invite_codes
for select using (
  org_id = public.my_org_id()
  and branch_id = public.my_branch_id()
  and (
    public.has_role('OWNER')
    or auth.jwt() ->> 'role' = 'service_role'
  )
);

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
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select p.org_id, p.default_branch_id
  into v_org_id, v_branch_id
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

  if not public.has_role('OWNER') then
    raise exception 'FORBIDDEN';
  end if;

  v_role := coalesce(nullif(trim(p_allowed_role), ''), 'TECH');
  if v_role not in ('PARTNER','MANAGER','RECEPTION','ACCOUNTANT','TECH') then
    raise exception 'INVALID_ROLE';
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

create or replace function public.revoke_invite_code_secure(
  p_invite_id uuid
)
returns public.invite_codes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_branch_id uuid;
  v_row public.invite_codes;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select p.org_id, p.default_branch_id
  into v_org_id, v_branch_id
  from public.profiles p
  where p.user_id = auth.uid()
  limit 1;

  if v_org_id is null or v_branch_id is null then
    raise exception 'ORG_CONTEXT_REQUIRED';
  end if;

  if not public.has_role('OWNER') then
    raise exception 'FORBIDDEN';
  end if;

  update public.invite_codes
  set revoked_at = now()
  where id = p_invite_id
    and org_id = v_org_id
    and branch_id = v_branch_id
    and revoked_at is null
    and used_count < max_uses
  returning * into v_row;

  if v_row.id is null then
    raise exception 'INVITE_NOT_FOUND_OR_FINALIZED';
  end if;

  return v_row;
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

create or replace function public.update_staff_display_name_secure(
  p_user_id uuid,
  p_display_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_branch_id uuid;
begin
  select org_id, default_branch_id
  into v_org_id, v_branch_id
  from public.profiles
  where user_id = auth.uid()
  limit 1;

  if v_org_id is null then
    raise exception 'ORG_NOT_FOUND';
  end if;

  if not public.has_role('OWNER') then
    raise exception 'FORBIDDEN';
  end if;

  update public.profiles
  set display_name = coalesce(nullif(trim(p_display_name), ''), 'User')
  where user_id = p_user_id
    and org_id = v_org_id
    and exists (
      select 1
      from public.user_roles ur
      where ur.user_id = p_user_id
        and ur.org_id = v_org_id
        and (
          ur.branch_id is null
          or ur.branch_id = v_branch_id
        )
    );
end;
$$;

drop function if exists public.list_team_members_secure_v2();

create function public.list_team_members_secure_v2()
returns table (
  id uuid,
  user_id uuid,
  role text,
  display_name text,
  email text
)
language sql
security definer
set search_path = public
as $$
  select
    ur.id,
    ur.user_id,
    ur.role::text,
    coalesce(nullif(trim(p.display_name), ''), left(ur.user_id::text, 8)) as display_name,
    nullif(trim(p.email), '') as email
  from public.user_roles ur
  left join public.profiles p on p.user_id = ur.user_id
  where ur.org_id = public.my_org_id()
    and (
      ur.branch_id is null
      or ur.branch_id = public.my_branch_id()
    )
  order by ur.role asc, ur.user_id asc
$$;

drop index if exists public.idx_shift_plans_org_branch_week;
create unique index if not exists idx_shift_plans_org_branch_week_status
  on public.shift_plans (org_id, branch_id, week_start, status);
