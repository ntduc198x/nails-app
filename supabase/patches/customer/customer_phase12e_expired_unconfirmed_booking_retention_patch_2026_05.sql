-- Phase 12e: purge expired unconfirmed bookings after 3 days

begin;

create or replace function public.purge_expired_unconfirmed_booking_requests()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  delete from public.booking_requests
  where status = 'EXPIRED_UNCONFIRMED'
    and requested_start_at < now() - interval '3 days';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.purge_expired_unconfirmed_booking_requests() to authenticated;

create or replace function public.run_expired_unconfirmed_booking_retention_job()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer := 0;
begin
  v_deleted := public.purge_expired_unconfirmed_booking_requests();

  return jsonb_build_object(
    'ok', true,
    'job', 'expired_unconfirmed_booking_retention',
    'deleted_count', v_deleted,
    'ran_at', now()
  );
end;
$$;

grant execute on function public.run_expired_unconfirmed_booking_retention_job() to authenticated;

commit;
