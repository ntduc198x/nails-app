-- Admin Phase A8: retention cleanup for admin/customer notifications
-- Policy:
-- - keep notifications for at least 7 days
-- - then purge old inbox rows

begin;

create or replace function public.purge_old_customer_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  delete from public.customer_notifications
  where sent_at < now() - interval '7 days';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.purge_old_customer_notifications() to authenticated;

create or replace function public.purge_old_admin_notification_states()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  delete from public.admin_notification_states
  where coalesce(resolved_at, acknowledged_at, created_at) < now() - interval '7 days';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.purge_old_admin_notification_states() to authenticated;

create or replace function public.run_notification_retention_job()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_deleted integer := 0;
  v_admin_deleted integer := 0;
begin
  v_customer_deleted := public.purge_old_customer_notifications();
  v_admin_deleted := public.purge_old_admin_notification_states();

  return jsonb_build_object(
    'ok', true,
    'job', 'notification_retention',
    'customer_deleted', v_customer_deleted,
    'admin_deleted', v_admin_deleted,
    'ran_at', now()
  );
end;
$$;

grant execute on function public.run_notification_retention_job() to authenticated;

commit;
