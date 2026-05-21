create table if not exists public.shift_change_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict,
  requester_user_id uuid not null references public.profiles(user_id) on delete cascade,
  request_kind text not null check (request_kind in ('SWAP', 'PICKUP')),
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  source_slot_json jsonb,
  target_slot_json jsonb not null,
  note text,
  owner_note text,
  reviewed_by uuid references public.profiles(user_id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_shift_change_requests_branch_status
  on public.shift_change_requests (org_id, branch_id, status, created_at desc);

create index if not exists idx_shift_change_requests_requester
  on public.shift_change_requests (requester_user_id, created_at desc);

alter table public.shift_change_requests enable row level security;

drop policy if exists "shift_change_requests branch read" on public.shift_change_requests;
create policy "shift_change_requests branch read"
on public.shift_change_requests
for select
using (
  org_id = public.my_org_id()
  and (
    requester_user_id = auth.uid()
    or public.can_access_branch(branch_id, array['OWNER'::text, 'PARTNER'::text])
  )
);

drop policy if exists "shift_change_requests staff insert self" on public.shift_change_requests;
create policy "shift_change_requests staff insert self"
on public.shift_change_requests
for insert
with check (
  org_id = public.my_org_id()
  and requester_user_id = auth.uid()
  and public.can_access_branch(branch_id)
  and not public.can_access_branch(branch_id, array['OWNER'::text, 'PARTNER'::text])
);

drop policy if exists "shift_change_requests owner partner update" on public.shift_change_requests;
create policy "shift_change_requests owner partner update"
on public.shift_change_requests
for update
using (
  org_id = public.my_org_id()
  and public.can_access_branch(branch_id, array['OWNER'::text, 'PARTNER'::text])
)
with check (
  org_id = public.my_org_id()
  and public.can_access_branch(branch_id, array['OWNER'::text, 'PARTNER'::text])
);

drop trigger if exists trg_shift_change_requests_branch_org on public.shift_change_requests;
create trigger trg_shift_change_requests_branch_org
before insert or update on public.shift_change_requests
for each row execute function public.assert_branch_belongs_to_org();

drop trigger if exists trg_shift_change_requests_touch_updated_at on public.shift_change_requests;
create trigger trg_shift_change_requests_touch_updated_at
before update on public.shift_change_requests
for each row execute function public.touch_updated_at();

create table if not exists public.shift_assignment_overrides (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict,
  staff_user_id uuid not null references public.profiles(user_id) on delete cascade,
  date_key date not null,
  shift_type text not null check (shift_type in ('MORNING', 'AFTERNOON', 'FULL_DAY')),
  shift_label text not null,
  start_time text not null,
  end_time text not null,
  action text not null check (action in ('ADD', 'REMOVE')),
  source_kind text not null check (source_kind in ('REQUEST_APPROVAL', 'MANUAL_SETUP')),
  request_id uuid references public.shift_change_requests(id) on delete set null,
  created_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);

create index if not exists idx_shift_assignment_overrides_branch_date
  on public.shift_assignment_overrides (org_id, branch_id, date_key, staff_user_id);

create index if not exists idx_shift_assignment_overrides_request
  on public.shift_assignment_overrides (request_id);

alter table public.shift_assignment_overrides enable row level security;

drop policy if exists "shift_assignment_overrides branch read" on public.shift_assignment_overrides;
create policy "shift_assignment_overrides branch read"
on public.shift_assignment_overrides
for select
using (
  org_id = public.my_org_id()
  and public.can_access_branch(branch_id)
);

drop policy if exists "shift_assignment_overrides owner partner write" on public.shift_assignment_overrides;
create policy "shift_assignment_overrides owner partner write"
on public.shift_assignment_overrides
for all
using (
  org_id = public.my_org_id()
  and public.can_access_branch(branch_id, array['OWNER'::text, 'PARTNER'::text])
)
with check (
  org_id = public.my_org_id()
  and public.can_access_branch(branch_id, array['OWNER'::text, 'PARTNER'::text])
);

drop trigger if exists trg_shift_assignment_overrides_branch_org on public.shift_assignment_overrides;
create trigger trg_shift_assignment_overrides_branch_org
before insert or update on public.shift_assignment_overrides
for each row execute function public.assert_branch_belongs_to_org();
