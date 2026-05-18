-- Admin Phase A9: auto-resolve admin notification states by business rules

begin;

create or replace function public.auto_resolve_admin_notification_states()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  -- Booking notifications: resolve when booking is no longer actionable.
  update public.admin_notification_states ans
  set
    resolved_at = coalesce(ans.resolved_at, now()),
    updated_at = now()
  where ans.resolved_at is null
    and (
      (ans.notification_key like 'booking-%' and exists (
        select 1
        from public.booking_requests br
        where ('booking-' || br.id::text) = ans.notification_key
          and br.status not in ('NEW', 'NEEDS_RESCHEDULE', 'EXPIRED_UNCONFIRMED')
      ))
      or (ans.notification_key like 'arrival-overdue-%' and exists (
        select 1
        from public.appointments ap
        where ('arrival-overdue-' || ap.id::text) = ans.notification_key
          and ap.status <> 'BOOKED'
      ))
      or (ans.notification_key like 'checked-in-stale-%' and exists (
        select 1
        from public.appointments ap
        where ('checked-in-stale-' || ap.id::text) = ans.notification_key
          and ap.status <> 'CHECKED_IN'
      ))
      or (ans.notification_key like 'leave-%' and exists (
        select 1
        from public.shift_leave_requests lr
        where ('leave-' || lr.id::text) = ans.notification_key
          and lr.status <> 'PENDING'
      ))
      or (ans.notification_key like 'attendance-%' and exists (
        select 1
        from public.time_entries te
        where ('attendance-' || te.id::text) = ans.notification_key
          and te.status <> 'PENDING_APPROVAL'
      ))
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.auto_resolve_admin_notification_states() to authenticated;

create or replace function public.run_admin_notification_auto_resolve_job()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_resolved integer := 0;
begin
  v_resolved := public.auto_resolve_admin_notification_states();

  return jsonb_build_object(
    'ok', true,
    'job', 'admin_notification_auto_resolve',
    'resolved_count', v_resolved,
    'ran_at', now()
  );
end;
$$;

grant execute on function public.run_admin_notification_auto_resolve_job() to authenticated;

commit;
