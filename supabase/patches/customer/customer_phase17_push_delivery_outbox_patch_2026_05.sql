-- Phase 17 push delivery outbox patch
-- Track delivery attempts for customer push notifications and expose helper RPCs.

begin;

alter table public.customer_notifications
  add column if not exists push_last_sent_at timestamptz,
  add column if not exists push_last_error text,
  add column if not exists push_delivery_state text not null default 'PENDING'
    check (push_delivery_state in ('PENDING','SENT','FAILED','SKIPPED'));

create index if not exists idx_customer_notifications_push_delivery_state
  on public.customer_notifications (push_delivery_state, sent_at desc);

create table if not exists public.customer_push_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.customer_notifications(id) on delete cascade,
  push_device_id uuid references public.customer_push_devices(id) on delete set null,
  expo_push_token text,
  status text not null check (status in ('PENDING','SENT','FAILED','SKIPPED')),
  response_payload jsonb,
  error_message text,
  attempted_at timestamptz not null default now(),
  delivered_at timestamptz
);

create index if not exists idx_customer_push_delivery_logs_notification
  on public.customer_push_delivery_logs (notification_id, attempted_at desc);

create or replace function public.list_pending_customer_push_notifications(p_limit int default 100)
returns table (
  notification_id uuid,
  customer_id uuid,
  org_id uuid,
  title text,
  body text,
  kind text,
  expo_push_token text,
  push_device_id uuid
)
language sql
security definer
set search_path = public, auth
as $$
  select
    cn.id as notification_id,
    cn.customer_id,
    cn.org_id,
    cn.title,
    cn.body,
    cn.kind,
    cpd.expo_push_token,
    cpd.id as push_device_id
  from public.customer_notifications cn
  join public.customer_push_devices cpd
    on cpd.customer_id = cn.customer_id
   and cpd.org_id = cn.org_id
  where cn.push_delivery_state in ('PENDING', 'FAILED')
  order by cn.sent_at asc, cpd.last_seen_at desc
  limit greatest(coalesce(p_limit, 100), 1);
$$;

grant execute on function public.list_pending_customer_push_notifications(int) to authenticated;

create or replace function public.mark_customer_push_delivery_result(
  p_notification_id uuid,
  p_push_device_id uuid,
  p_status text,
  p_response_payload jsonb default null,
  p_error_message text default null
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.customer_push_delivery_logs (
    notification_id,
    push_device_id,
    expo_push_token,
    status,
    response_payload,
    error_message,
    attempted_at,
    delivered_at
  )
  select
    p_notification_id,
    p_push_device_id,
    cpd.expo_push_token,
    p_status,
    p_response_payload,
    p_error_message,
    now(),
    case when p_status = 'SENT' then now() else null end
  from public.customer_push_devices cpd
  where cpd.id = p_push_device_id;

  update public.customer_notifications
  set
    push_last_sent_at = case when p_status = 'SENT' then now() else push_last_sent_at end,
    push_last_error = case when p_status = 'FAILED' then p_error_message else null end,
    push_delivery_state = case
      when p_status = 'SENT' then 'SENT'
      when p_status = 'FAILED' then 'FAILED'
      else 'SKIPPED'
    end
  where id = p_notification_id;
end;
$$;

grant execute on function public.mark_customer_push_delivery_result(uuid, uuid, text, jsonb, text) to authenticated;

commit;
