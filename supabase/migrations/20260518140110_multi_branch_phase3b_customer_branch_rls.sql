begin;

revoke all on table public.customer_branches from anon;
grant select, insert, update, delete on table public.customer_branches to authenticated;
grant select, insert, update, delete on table public.customer_branches to service_role;

alter table public.customer_branches enable row level security;

drop policy if exists "customer_branches branch read" on public.customer_branches;
drop policy if exists "customer_branches branch write" on public.customer_branches;

create policy "customer_branches branch read"
on public.customer_branches
for select
to authenticated
using (
  org_id = public.my_org_id()
  and public.can_access_branch(branch_id)
);

create policy "customer_branches branch write"
on public.customer_branches
for all
to authenticated
using (
  org_id = public.my_org_id()
  and public.can_access_branch(
    branch_id,
    array['OWNER','PARTNER','MANAGER','RECEPTION']
  )
)
with check (
  org_id = public.my_org_id()
  and public.can_access_branch(
    branch_id,
    array['OWNER','PARTNER','MANAGER','RECEPTION']
  )
);

drop policy if exists "org read customers" on public.customers;
drop policy if exists "owner manager reception write customers" on public.customers;
drop policy if exists "customers branch read" on public.customers;
drop policy if exists "customers branch write" on public.customers;
drop policy if exists "customers branch relationship read" on public.customers;
drop policy if exists "customers branch relationship write" on public.customers;

create policy "customers branch relationship read"
on public.customers
for select
to authenticated
using (
  org_id = public.my_org_id()
  and (
    public.has_org_role(array['OWNER','PARTNER'])
    or exists (
      select 1
      from public.customer_branches cb
      where cb.customer_id = public.customers.id
        and cb.org_id = public.customers.org_id
        and public.can_access_branch(cb.branch_id)
    )
  )
);

create policy "customers branch relationship write"
on public.customers
for all
to authenticated
using (
  org_id = public.my_org_id()
  and (
    public.has_org_role(array['OWNER','PARTNER'])
    or exists (
      select 1
      from public.customer_branches cb
      where cb.customer_id = public.customers.id
        and cb.org_id = public.customers.org_id
        and public.can_access_branch(
          cb.branch_id,
          array['OWNER','PARTNER','MANAGER','RECEPTION']
        )
    )
  )
)
with check (
  org_id = public.my_org_id()
);

commit;
