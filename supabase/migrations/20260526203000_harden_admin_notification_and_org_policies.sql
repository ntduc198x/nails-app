set check_function_bodies = off;

drop policy if exists admin_notification_states_manage on public.admin_notification_states;
drop policy if exists "admin notification states scoped read" on public.admin_notification_states;

create policy "admin notification states scoped read"
on public.admin_notification_states
for select
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.org_id = admin_notification_states.org_id
      and ur.role = any (array[
        'OWNER'::text,
        'PARTNER'::text,
        'MANAGER'::text,
        'RECEPTION'::text,
        'TECH'::text,
        'ACCOUNTANT'::text
      ])
  )
);

create or replace function public.touch_admin_notification_state(
  p_org_id uuid,
  p_notification_key text,
  p_action text
) returns void
language plpgsql
security definer
set search_path to 'public', 'auth'
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if p_action not in ('ack', 'resolve') then
    raise exception 'INVALID_ACTION';
  end if;

  if not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = v_user_id
      and ur.org_id = p_org_id
      and ur.role = any (array[
        'OWNER'::text,
        'PARTNER'::text,
        'MANAGER'::text,
        'RECEPTION'::text,
        'TECH'::text,
        'ACCOUNTANT'::text
      ])
  ) then
    raise exception 'FORBIDDEN';
  end if;

  insert into public.admin_notification_states (
    org_id,
    notification_key,
    acknowledged_at,
    acknowledged_by,
    resolved_at,
    resolved_by,
    updated_at
  )
  values (
    p_org_id,
    p_notification_key,
    case when p_action in ('ack', 'resolve') then now() else null end,
    case when p_action in ('ack', 'resolve') then v_user_id else null end,
    case when p_action = 'resolve' then now() else null end,
    case when p_action = 'resolve' then v_user_id else null end,
    now()
  )
  on conflict (org_id, notification_key)
  do update set
    acknowledged_at = case
      when p_action in ('ack', 'resolve') then coalesce(public.admin_notification_states.acknowledged_at, now())
      else public.admin_notification_states.acknowledged_at
    end,
    acknowledged_by = case
      when p_action in ('ack', 'resolve') then coalesce(public.admin_notification_states.acknowledged_by, v_user_id)
      else public.admin_notification_states.acknowledged_by
    end,
    resolved_at = case
      when p_action = 'resolve' then now()
      else public.admin_notification_states.resolved_at
    end,
    resolved_by = case
      when p_action = 'resolve' then v_user_id
      else public.admin_notification_states.resolved_by
    end,
    updated_at = now();
end;
$$;

grant execute on function public.touch_admin_notification_state(uuid, text, text) to authenticated;

drop policy if exists "orgs auth read" on public.orgs;
drop policy if exists "orgs scoped read" on public.orgs;

create policy "orgs scoped read"
on public.orgs
for select
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.org_id = orgs.id
      and ur.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.customer_accounts ca
    where ca.org_id = orgs.id
      and ca.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles p
    where p.org_id = orgs.id
      and p.user_id = auth.uid()
  )
);
