-- Admin Phase A9b: schedule auto-resolve job for admin notifications every 5 minutes

begin;

select cron.unschedule(jobid)
from cron.job
where jobname in (
  'admin-notification-auto-resolve-every-5m'
);

select cron.schedule(
  'admin-notification-auto-resolve-every-5m',
  '*/5 * * * *',
  $$select public.run_admin_notification_auto_resolve_job();$$
);

commit;

select jobid, jobname, schedule, command, active
from cron.job
where jobname = 'admin-notification-auto-resolve-every-5m';
