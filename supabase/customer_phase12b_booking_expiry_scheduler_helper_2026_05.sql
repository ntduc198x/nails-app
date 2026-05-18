-- Phase 12b booking expiry scheduler helper
-- Purpose:
-- 1) Provide a stable helper wrapper for scheduled execution
-- 2) Keep cron/job configuration simple and explicit
--
-- Suggested schedule:
--   every 5 minutes
--
-- If pg_cron is available, example:
--   select cron.schedule(
--     'expire-unconfirmed-booking-requests-every-5m',
--     '*/5 * * * *',
--     $$select public.run_expire_unconfirmed_booking_requests_job();$$
--   );
--
-- Manual run:
--   select public.run_expire_unconfirmed_booking_requests_job();

begin;

create or replace function public.run_expire_unconfirmed_booking_requests_job()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expired_count integer := 0;
begin
  v_expired_count := public.expire_unconfirmed_booking_requests();

  return jsonb_build_object(
    'ok', true,
    'job', 'expire_unconfirmed_booking_requests',
    'expired_count', v_expired_count,
    'ran_at', now()
  );
end;
$$;

grant execute on function public.run_expire_unconfirmed_booking_requests_job() to authenticated;

commit;
