-- Admin/customer notification retention daily schedule

begin;

select cron.unschedule(jobid)
from cron.job
where jobname in (
  'notification-retention-daily-0310',
  'expired-unconfirmed-booking-retention-daily-0320'
);

select cron.schedule(
  'notification-retention-daily-0310',
  '10 3 * * *',
  $$select public.run_notification_retention_job();$$
);

select cron.schedule(
  'expired-unconfirmed-booking-retention-daily-0320',
  '20 3 * * *',
  $$select public.run_expired_unconfirmed_booking_retention_job();$$
);

commit;

select jobid, jobname, schedule, command, active
from cron.job
where jobname in (
  'notification-retention-daily-0310',
  'expired-unconfirmed-booking-retention-daily-0320'
)
order by jobname;
