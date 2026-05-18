begin;

-- Phase 1A:
-- 1. Add branch_id to operational tables that are still org-scoped.
-- 2. Backfill from the strongest available source.
-- 3. Fail fast if any row still cannot be scoped to a branch.
-- 4. Enforce NOT NULL and add branch-aware indexes.

alter table public.customers
add column if not exists branch_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customers_branch_id_fkey'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_branch_id_fkey
      foreign key (branch_id) references public.branches(id) on delete restrict;
  end if;
end
$$;

with latest_ticket_branch as (
  select distinct on (t.customer_id)
    t.customer_id,
    t.branch_id
  from public.tickets t
  where t.customer_id is not null
    and t.branch_id is not null
  order by t.customer_id, t.created_at desc, t.id desc
)
update public.customers c
set branch_id = x.branch_id
from latest_ticket_branch x
where c.id = x.customer_id
  and c.branch_id is null;

with first_branch_per_org as (
  select distinct on (b.org_id)
    b.org_id,
    b.id as branch_id
  from public.branches b
  order by b.org_id, b.created_at asc, b.id asc
)
update public.customers c
set branch_id = fb.branch_id
from first_branch_per_org fb
where fb.org_id = c.org_id
  and c.branch_id is null;

do $$
begin
  if exists (
    select 1
    from public.customers
    where branch_id is null
  ) then
    raise exception 'CUSTOMERS_BRANCH_BACKFILL_INCOMPLETE';
  end if;
end
$$;

alter table public.customers
alter column branch_id set not null;

create index if not exists idx_customers_org_branch_created
on public.customers (org_id, branch_id, created_at desc);

create index if not exists idx_customers_org_branch_phone
on public.customers (org_id, branch_id, phone);


alter table public.time_entries
add column if not exists branch_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'time_entries_branch_id_fkey'
      and conrelid = 'public.time_entries'::regclass
  ) then
    alter table public.time_entries
      add constraint time_entries_branch_id_fkey
      foreign key (branch_id) references public.branches(id) on delete restrict;
  end if;
end
$$;

update public.time_entries te
set branch_id = ssp.branch_id
from public.staff_shift_profiles ssp
where ssp.user_id = te.staff_user_id
  and ssp.org_id = te.org_id
  and te.branch_id is null;

update public.time_entries te
set branch_id = p.default_branch_id
from public.profiles p
where p.user_id = te.staff_user_id
  and p.org_id = te.org_id
  and p.default_branch_id is not null
  and te.branch_id is null;

with first_branch_per_org as (
  select distinct on (b.org_id)
    b.org_id,
    b.id as branch_id
  from public.branches b
  order by b.org_id, b.created_at asc, b.id asc
)
update public.time_entries te
set branch_id = fb.branch_id
from first_branch_per_org fb
where fb.org_id = te.org_id
  and te.branch_id is null;

do $$
begin
  if exists (
    select 1
    from public.time_entries
    where branch_id is null
  ) then
    raise exception 'TIME_ENTRIES_BRANCH_BACKFILL_INCOMPLETE';
  end if;
end
$$;

alter table public.time_entries
alter column branch_id set not null;

create index if not exists idx_time_entries_org_branch_staff
on public.time_entries (org_id, branch_id, staff_user_id, clock_in desc);

create index if not exists idx_time_entries_org_branch_status
on public.time_entries (org_id, branch_id, approval_status, scheduled_date desc);


alter table public.shift_leave_requests
add column if not exists branch_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'shift_leave_requests_branch_id_fkey'
      and conrelid = 'public.shift_leave_requests'::regclass
  ) then
    alter table public.shift_leave_requests
      add constraint shift_leave_requests_branch_id_fkey
      foreign key (branch_id) references public.branches(id) on delete restrict;
  end if;
end
$$;

update public.shift_leave_requests slr
set branch_id = ssp.branch_id
from public.staff_shift_profiles ssp
where ssp.user_id = slr.staff_user_id
  and ssp.org_id = slr.org_id
  and slr.branch_id is null;

update public.shift_leave_requests slr
set branch_id = p.default_branch_id
from public.profiles p
where p.user_id = slr.staff_user_id
  and p.org_id = slr.org_id
  and p.default_branch_id is not null
  and slr.branch_id is null;

with first_branch_per_org as (
  select distinct on (b.org_id)
    b.org_id,
    b.id as branch_id
  from public.branches b
  order by b.org_id, b.created_at asc, b.id asc
)
update public.shift_leave_requests slr
set branch_id = fb.branch_id
from first_branch_per_org fb
where fb.org_id = slr.org_id
  and slr.branch_id is null;

do $$
begin
  if exists (
    select 1
    from public.shift_leave_requests
    where branch_id is null
  ) then
    raise exception 'SHIFT_LEAVE_REQUESTS_BRANCH_BACKFILL_INCOMPLETE';
  end if;
end
$$;

alter table public.shift_leave_requests
alter column branch_id set not null;

create index if not exists idx_shift_leave_requests_org_branch_status
on public.shift_leave_requests (org_id, branch_id, status, requested_at desc);

create index if not exists idx_shift_leave_requests_org_branch_staff
on public.shift_leave_requests (org_id, branch_id, staff_user_id, scheduled_date desc);

commit;
