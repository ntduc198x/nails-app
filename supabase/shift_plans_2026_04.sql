create table if not exists public.shift_plans (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  week_start date not null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  assignments_json jsonb not null default '[]'::jsonb,
  demands_json jsonb not null default '[]'::jsonb,
  forecast_json jsonb not null default '{}'::jsonb,
  employee_summaries_json jsonb not null default '[]'::jsonb,
  day_summaries_json jsonb not null default '[]'::jsonb,
  conflicts_json jsonb not null default '[]'::jsonb,
  suggestions_json jsonb not null default '[]'::jsonb,
  notes_json jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_by uuid references public.profiles(user_id) on delete set null,
  updated_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop index if exists public.idx_shift_plans_org_branch_week;

create unique index if not exists idx_shift_plans_org_branch_week_status
  on public.shift_plans (org_id, branch_id, week_start, status);

create index if not exists idx_shift_plans_org_status_week
  on public.shift_plans (org_id, status, week_start desc);

alter table public.shift_plans enable row level security;

drop policy if exists "shift_plans owner manager read all" on public.shift_plans;
create policy "shift_plans owner manager read all" on public.shift_plans
for select
using (
  org_id = public.my_org_id()
  and (public.has_role('OWNER') or public.has_role('MANAGER'))
);

drop policy if exists "shift_plans owner manager write" on public.shift_plans;
create policy "shift_plans owner manager write" on public.shift_plans
for all
using (
  org_id = public.my_org_id()
  and (public.has_role('OWNER') or public.has_role('MANAGER'))
)
with check (
  org_id = public.my_org_id()
  and (public.has_role('OWNER') or public.has_role('MANAGER'))
);

drop policy if exists "shift_plans staff read published" on public.shift_plans;
create policy "shift_plans staff read published" on public.shift_plans
for select
using (
  org_id = public.my_org_id()
  and status = 'published'
  and (
    public.has_role('OWNER')
    or public.has_role('MANAGER')
    or public.has_role('RECEPTION')
    or public.has_role('TECH')
    or public.has_role('ACCOUNTANT')
  )
);

drop trigger if exists trg_shift_plans_touch_updated_at on public.shift_plans;
create trigger trg_shift_plans_touch_updated_at
before update on public.shift_plans
for each row
execute function public.touch_updated_at();
