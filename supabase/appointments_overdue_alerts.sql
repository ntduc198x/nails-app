alter table public.appointments
  add column if not exists overdue_alert_sent_at timestamptz;

create index if not exists idx_appointments_org_status_overdue_alert
  on public.appointments (org_id, status, overdue_alert_sent_at, start_at);
