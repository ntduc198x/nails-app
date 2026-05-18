-- Phase 15b pg_cron schedule for membership progress nudges
-- Suggested cadence: once daily at 09:00 Asia/Ho_Chi_Minh equivalent DB time assumption.
-- Adjust schedule if your DB timezone differs.

begin;

select cron.unschedule(jobid)
from cron.job
where jobname in (
  'customer-membership-progress-nudges-daily-0900'
);

select cron.schedule(
  'customer-membership-progress-nudges-daily-0900',
  '0 9 * * *',
  $$select public.run_customer_membership_progress_nudges_job();$$
);

commit;

select jobid, jobname, schedule, command, active
from cron.job
where jobname = 'customer-membership-progress-nudges-daily-0900';
