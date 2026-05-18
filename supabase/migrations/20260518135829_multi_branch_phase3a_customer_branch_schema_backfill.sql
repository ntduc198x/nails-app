begin;

create or replace function public.set_customer_normalized_phone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.normalized_phone := public.normalize_customer_phone(new.phone);
  return new;
end;
$$;

alter table public.customers
  add column if not exists normalized_phone text;

alter table public.customers
  add column if not exists global_note text;

alter table public.customers
  add column if not exists needs_merge_review boolean not null default false;

alter table public.customers
  add column if not exists merged_into_customer_id uuid references public.customers(id);

update public.customers
set normalized_phone = public.normalize_customer_phone(phone)
where normalized_phone is distinct from public.normalize_customer_phone(phone);

update public.customers
set global_note = notes
where global_note is null
  and nullif(trim(coalesce(notes, '')), '') is not null;

drop trigger if exists trg_customers_normalized_phone on public.customers;

create trigger trg_customers_normalized_phone
before insert or update of phone
on public.customers
for each row
execute function public.set_customer_normalized_phone();

create table if not exists public.customer_branches (
  customer_id uuid not null references public.customers(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  total_visits integer not null default 0,
  total_spend numeric(12,2) not null default 0,
  customer_status text not null default 'NEW',
  favorite_staff_user_id uuid references public.profiles(user_id),
  care_note text,
  tags text[] not null default '{}'::text[],
  source text,
  next_follow_up_at timestamptz,
  last_contacted_at timestamptz,
  follow_up_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (customer_id, branch_id)
);

create index if not exists idx_customer_branches_org_branch_last_seen
on public.customer_branches (org_id, branch_id, last_seen_at desc);

create index if not exists idx_customer_branches_customer
on public.customer_branches (customer_id);

create index if not exists idx_customers_org_normalized_phone
on public.customers (org_id, normalized_phone);

insert into public.customer_branches (
  customer_id,
  org_id,
  branch_id,
  first_seen_at,
  last_seen_at,
  total_visits,
  total_spend
)
select
  t.customer_id,
  t.org_id,
  t.branch_id,
  min(t.created_at) as first_seen_at,
  max(t.created_at) as last_seen_at,
  count(*) filter (where t.status = 'CLOSED')::integer as total_visits,
  coalesce(sum(((t.totals_json ->> 'grand_total'))::numeric) filter (where t.status = 'CLOSED'), 0)::numeric(12,2) as total_spend
from public.tickets t
where t.customer_id is not null
  and t.branch_id is not null
group by t.customer_id, t.org_id, t.branch_id
on conflict (customer_id, branch_id)
do update set
  first_seen_at = least(
    coalesce(public.customer_branches.first_seen_at, excluded.first_seen_at),
    excluded.first_seen_at
  ),
  last_seen_at = greatest(
    coalesce(public.customer_branches.last_seen_at, excluded.last_seen_at),
    excluded.last_seen_at
  ),
  total_visits = greatest(public.customer_branches.total_visits, excluded.total_visits),
  total_spend = greatest(public.customer_branches.total_spend, excluded.total_spend),
  updated_at = now();

insert into public.customer_branches (
  customer_id,
  org_id,
  branch_id,
  first_seen_at,
  last_seen_at
)
select
  a.customer_id,
  a.org_id,
  a.branch_id,
  min(a.start_at) as first_seen_at,
  max(a.start_at) as last_seen_at
from public.appointments a
where a.customer_id is not null
  and a.branch_id is not null
group by a.customer_id, a.org_id, a.branch_id
on conflict (customer_id, branch_id)
do update set
  first_seen_at = least(
    coalesce(public.customer_branches.first_seen_at, excluded.first_seen_at),
    excluded.first_seen_at
  ),
  last_seen_at = greatest(
    coalesce(public.customer_branches.last_seen_at, excluded.last_seen_at),
    excluded.last_seen_at
  ),
  updated_at = now();

insert into public.customer_branches (
  customer_id,
  org_id,
  branch_id,
  first_seen_at,
  last_seen_at,
  source
)
select
  br.customer_id,
  br.org_id,
  br.branch_id,
  min(br.requested_start_at) as first_seen_at,
  max(coalesce(br.requested_end_at, br.requested_start_at, br.created_at)) as last_seen_at,
  max(br.source) as source
from public.booking_requests br
where br.customer_id is not null
  and br.branch_id is not null
group by br.customer_id, br.org_id, br.branch_id
on conflict (customer_id, branch_id)
do update set
  first_seen_at = least(
    coalesce(public.customer_branches.first_seen_at, excluded.first_seen_at),
    excluded.first_seen_at
  ),
  last_seen_at = greatest(
    coalesce(public.customer_branches.last_seen_at, excluded.last_seen_at),
    excluded.last_seen_at
  ),
  source = coalesce(public.customer_branches.source, excluded.source),
  updated_at = now();

insert into public.customer_branches (
  customer_id,
  org_id,
  branch_id,
  first_seen_at,
  last_seen_at,
  care_note,
  tags,
  customer_status,
  favorite_staff_user_id,
  source,
  next_follow_up_at,
  last_contacted_at,
  follow_up_status
)
select
  c.id,
  c.org_id,
  c.branch_id,
  c.created_at,
  coalesce(c.last_visit_at, c.created_at),
  coalesce(c.care_note, c.notes),
  coalesce(c.tags, '{}'::text[]),
  coalesce(c.customer_status, 'NEW'),
  c.favorite_staff_user_id,
  c.source,
  c.next_follow_up_at,
  c.last_contacted_at,
  c.follow_up_status
from public.customers c
where c.branch_id is not null
on conflict (customer_id, branch_id)
do update set
  care_note = coalesce(public.customer_branches.care_note, excluded.care_note),
  tags = case
    when coalesce(array_length(public.customer_branches.tags, 1), 0) = 0 then excluded.tags
    else public.customer_branches.tags
  end,
  customer_status = case
    when public.customer_branches.customer_status = 'NEW' and excluded.customer_status <> 'NEW'
      then excluded.customer_status
    else public.customer_branches.customer_status
  end,
  favorite_staff_user_id = coalesce(public.customer_branches.favorite_staff_user_id, excluded.favorite_staff_user_id),
  source = coalesce(public.customer_branches.source, excluded.source),
  next_follow_up_at = coalesce(public.customer_branches.next_follow_up_at, excluded.next_follow_up_at),
  last_contacted_at = greatest(
    coalesce(public.customer_branches.last_contacted_at, excluded.last_contacted_at),
    coalesce(excluded.last_contacted_at, public.customer_branches.last_contacted_at)
  ),
  follow_up_status = coalesce(public.customer_branches.follow_up_status, excluded.follow_up_status),
  updated_at = now();

create or replace function public.ensure_customer_branch_from_ticket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.customer_id is not null and new.branch_id is not null then
    insert into public.customer_branches (
      customer_id,
      org_id,
      branch_id,
      first_seen_at,
      last_seen_at
    )
    values (
      new.customer_id,
      new.org_id,
      new.branch_id,
      new.created_at,
      new.created_at
    )
    on conflict (customer_id, branch_id)
    do update set
      last_seen_at = greatest(
        coalesce(public.customer_branches.last_seen_at, excluded.last_seen_at),
        excluded.last_seen_at
      ),
      updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_tickets_ensure_customer_branch on public.tickets;

create trigger trg_tickets_ensure_customer_branch
after insert or update of customer_id, branch_id
on public.tickets
for each row
execute function public.ensure_customer_branch_from_ticket();

create or replace function public.ensure_customer_branch_from_appointment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.customer_id is not null and new.branch_id is not null then
    insert into public.customer_branches (
      customer_id,
      org_id,
      branch_id,
      first_seen_at,
      last_seen_at,
      favorite_staff_user_id
    )
    values (
      new.customer_id,
      new.org_id,
      new.branch_id,
      new.start_at,
      new.start_at,
      new.staff_user_id
    )
    on conflict (customer_id, branch_id)
    do update set
      last_seen_at = greatest(
        coalesce(public.customer_branches.last_seen_at, excluded.last_seen_at),
        excluded.last_seen_at
      ),
      favorite_staff_user_id = coalesce(excluded.favorite_staff_user_id, public.customer_branches.favorite_staff_user_id),
      updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_appointments_ensure_customer_branch on public.appointments;

create trigger trg_appointments_ensure_customer_branch
after insert or update of customer_id, branch_id
on public.appointments
for each row
execute function public.ensure_customer_branch_from_appointment();

commit;
