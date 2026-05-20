-- Admin Phase A7: DB-backed acknowledgement / resolution for admin notifications

begin;

create table if not exists public.admin_notification_states (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  notification_key text not null,
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, notification_key)
);

create index if not exists idx_admin_notification_states_org_key
  on public.admin_notification_states (org_id, notification_key);

alter table public.admin_notification_states enable row level security;

drop policy if exists "admin_notification_states_manage" on public.admin_notification_states;
create policy "admin_notification_states_manage" on public.admin_notification_states
for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create or replace function public.touch_admin_notification_state(
  p_org_id uuid,
  p_notification_key text,
  p_action text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'UNAUTHENTICATED';
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
    case when p_action in ('ack','resolve') then now() else null end,
    case when p_action in ('ack','resolve') then v_user_id else null end,
    case when p_action = 'resolve' then now() else null end,
    case when p_action = 'resolve' then v_user_id else null end,
    now()
  )
  on conflict (org_id, notification_key)
  do update set
    acknowledged_at = case
      when p_action in ('ack','resolve') then coalesce(public.admin_notification_states.acknowledged_at, now())
      else public.admin_notification_states.acknowledged_at
    end,
    acknowledged_by = case
      when p_action in ('ack','resolve') then coalesce(public.admin_notification_states.acknowledged_by, v_user_id)
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

commit;
