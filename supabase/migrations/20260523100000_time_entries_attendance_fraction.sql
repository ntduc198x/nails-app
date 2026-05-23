alter table public.time_entries
  add column if not exists attendance_fraction numeric(3, 2) not null default 0 check (attendance_fraction in (0, 0.5, 0.75, 1));
