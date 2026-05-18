-- Phase 12c pg_cron schedule for expiring unconfirmed booking requests every 15 minutes
-- Requires pg_cron to be enabled in the database.
--
-- This script:
-- 1) unschedules older known job names if they exist
-- 2) schedules the canonical 15-minute job
-- 3) prints matching cron jobs for verification

begin;

-- Unschedule old variants safely if they already exist.
select cron.unschedule(jobid)
from cron.job
where jobname in (
  'expire-unconfirmed-booking-requests-every-5m',
  'expire-unconfirmed-booking-requests-every-15m'
);

-- Create the canonical 15-minute schedule.
select cron.schedule(
  'expire-unconfirmed-booking-requests-every-15m',
  '*/15 * * * *',
  $$select public.run_expire_unconfirmed_booking_requests_job();$$
);

commit;

-- Verify scheduled jobs.
select jobid, jobname, schedule, command, active
from cron.job
where jobname = 'expire-unconfirmed-booking-requests-every-15m';
