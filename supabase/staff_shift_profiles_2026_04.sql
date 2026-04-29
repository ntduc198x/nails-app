create table if not exists public.staff_shift_profiles (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  staff_role text not null check (staff_role in ('MANAGER', 'RECEPTION', 'TECH', 'ACCOUNTANT')),
  skills_json jsonb not null default '[]'::jsonb,
  availability_json jsonb not null default '[]'::jsonb,
  leave_dates_json jsonb not null default '[]'::jsonb,
  max_weekly_hours integer not null default 40 check (max_weekly_hours between 0 and 84),
  fairness_offset_hours integer not null default 0 check (fairness_offset_hours between 0 and 24),
  performance_score integer not null default 7 check (performance_score between 1 and 10),
  notes_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_staff_shift_profiles_org_branch
  on public.staff_shift_profiles (org_id, branch_id, staff_role);

alter table public.staff_shift_profiles enable row level security;

drop policy if exists "staff_shift_profiles owner manager read" on public.staff_shift_profiles;
create policy "staff_shift_profiles owner manager read" on public.staff_shift_profiles
for select
using (
  org_id = public.my_org_id()
  and (public.has_role('OWNER') or public.has_role('MANAGER'))
);

drop policy if exists "staff_shift_profiles owner manager write" on public.staff_shift_profiles;
create policy "staff_shift_profiles owner manager write" on public.staff_shift_profiles
for all
using (
  org_id = public.my_org_id()
  and (public.has_role('OWNER') or public.has_role('MANAGER'))
)
with check (
  org_id = public.my_org_id()
  and (public.has_role('OWNER') or public.has_role('MANAGER'))
);

drop policy if exists "staff_shift_profiles staff read self" on public.staff_shift_profiles;
create policy "staff_shift_profiles staff read self" on public.staff_shift_profiles
for select
using (
  user_id = auth.uid()
  and org_id = public.my_org_id()
);

drop trigger if exists trg_staff_shift_profiles_touch_updated_at on public.staff_shift_profiles;
create trigger trg_staff_shift_profiles_touch_updated_at
before update on public.staff_shift_profiles
for each row
execute function public.touch_updated_at();
