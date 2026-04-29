alter table public.time_entries
  add column if not exists effective_clock_in timestamptz,
  add column if not exists effective_clock_out timestamptz,
  add column if not exists scheduled_date date,
  add column if not exists scheduled_week_start date,
  add column if not exists scheduled_shift_type text check (scheduled_shift_type in ('MORNING', 'AFTERNOON', 'FULL_DAY', 'OFF')),
  add column if not exists scheduled_shift_label text,
  add column if not exists scheduled_start timestamptz,
  add column if not exists scheduled_end timestamptz,
  add column if not exists approval_status text not null default 'PENDING' check (approval_status in ('PENDING', 'APPROVED', 'REJECTED')),
  add column if not exists approval_note text,
  add column if not exists approved_by uuid references public.profiles(user_id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists auto_closed boolean not null default false;

create index if not exists idx_time_entries_staff_status_day
  on public.time_entries (staff_user_id, approval_status, scheduled_date desc, clock_in desc);

create index if not exists idx_time_entries_open_shift_end
  on public.time_entries (org_id, scheduled_end)
  where clock_out is null;

drop policy if exists "time_entries role write" on public.time_entries;
drop policy if exists "time_entries owner manager write" on public.time_entries;
create policy "time_entries owner manager write" on public.time_entries
for all
using (
  org_id = public.my_org_id()
  and (public.has_role('OWNER') or public.has_role('MANAGER'))
)
with check (
  org_id = public.my_org_id()
  and (public.has_role('OWNER') or public.has_role('MANAGER'))
);

drop policy if exists "time_entries staff self write" on public.time_entries;
create policy "time_entries staff self write" on public.time_entries
for all
using (
  org_id = public.my_org_id()
  and staff_user_id = auth.uid()
  and (
    public.has_role('RECEPTION')
    or public.has_role('TECH')
    or public.has_role('ACCOUNTANT')
    or public.has_role('MANAGER')
  )
)
with check (
  org_id = public.my_org_id()
  and staff_user_id = auth.uid()
  and (
    public.has_role('RECEPTION')
    or public.has_role('TECH')
    or public.has_role('ACCOUNTANT')
    or public.has_role('MANAGER')
  )
);

create table if not exists public.shift_leave_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  staff_user_id uuid not null references public.profiles(user_id) on delete cascade,
  request_type text not null check (request_type in ('DAY_OFF', 'EARLY_LEAVE')),
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  scheduled_date date,
  requested_at timestamptz not null default now(),
  requested_end_at timestamptz,
  note text,
  owner_note text,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(user_id) on delete set null,
  time_entry_id uuid references public.time_entries(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_shift_leave_requests_org_status
  on public.shift_leave_requests (org_id, status, requested_at desc);

create index if not exists idx_shift_leave_requests_staff_date
  on public.shift_leave_requests (staff_user_id, scheduled_date desc, requested_at desc);

alter table public.shift_leave_requests enable row level security;

drop policy if exists "shift_leave_requests owner manager read" on public.shift_leave_requests;
create policy "shift_leave_requests owner manager read" on public.shift_leave_requests
for select
using (
  org_id = public.my_org_id()
  and (public.has_role('OWNER') or public.has_role('MANAGER'))
);

drop policy if exists "shift_leave_requests owner manager write" on public.shift_leave_requests;
create policy "shift_leave_requests owner manager write" on public.shift_leave_requests
for all
using (
  org_id = public.my_org_id()
  and (public.has_role('OWNER') or public.has_role('MANAGER'))
)
with check (
  org_id = public.my_org_id()
  and (public.has_role('OWNER') or public.has_role('MANAGER'))
);

drop policy if exists "shift_leave_requests staff read self" on public.shift_leave_requests;
create policy "shift_leave_requests staff read self" on public.shift_leave_requests
for select
using (
  org_id = public.my_org_id()
  and staff_user_id = auth.uid()
);

drop policy if exists "shift_leave_requests staff write self" on public.shift_leave_requests;
create policy "shift_leave_requests staff write self" on public.shift_leave_requests
for insert
with check (
  org_id = public.my_org_id()
  and staff_user_id = auth.uid()
);

drop trigger if exists trg_shift_leave_requests_touch_updated_at on public.shift_leave_requests;
create trigger trg_shift_leave_requests_touch_updated_at
before update on public.shift_leave_requests
for each row
execute function public.touch_updated_at();
