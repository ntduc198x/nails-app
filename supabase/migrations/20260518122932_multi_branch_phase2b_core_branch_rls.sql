begin;

drop policy if exists "branches auth read" on public.branches;
drop policy if exists "branches auth insert" on public.branches;

create policy "branches branch scoped read"
on public.branches
for select
using (
  org_id = public.my_org_id()
  and (
    public.has_org_role(array['OWNER'])
    or public.can_access_branch(id)
  )
);

create policy "branches owner insert"
on public.branches
for insert
with check (
  org_id = public.my_org_id()
  and public.has_org_role(array['OWNER'])
);

create policy "branches owner update"
on public.branches
for update
using (
  org_id = public.my_org_id()
  and public.has_org_role(array['OWNER'])
)
with check (
  org_id = public.my_org_id()
  and public.has_org_role(array['OWNER'])
);

drop policy if exists "org read resources" on public.resources;
drop policy if exists "owner manager reception write resources" on public.resources;

create policy "resources branch read"
on public.resources
for select
using (
  org_id = public.my_org_id()
  and public.can_access_branch(branch_id)
);

create policy "resources branch write"
on public.resources
for all
using (
  org_id = public.my_org_id()
  and public.can_access_branch(branch_id, array['OWNER','PARTNER','MANAGER','RECEPTION'])
)
with check (
  org_id = public.my_org_id()
  and public.can_access_branch(branch_id, array['OWNER','PARTNER','MANAGER','RECEPTION'])
);

drop policy if exists "Allow authenticated users to insert appointments" on public.appointments;
drop policy if exists "Allow authenticated users to read appointments" on public.appointments;
drop policy if exists "Allow authenticated users to update appointments" on public.appointments;
drop policy if exists "org read appointments" on public.appointments;
drop policy if exists "owner manager reception write appointments" on public.appointments;
drop policy if exists "tech insert own appointments" on public.appointments;
drop policy if exists "tech update own appointments" on public.appointments;

create policy "appointments branch read"
on public.appointments
for select
using (
  org_id = public.my_org_id()
  and (
    public.can_access_branch(branch_id, array['OWNER','PARTNER','MANAGER','RECEPTION','ACCOUNTANT'])
    or staff_user_id = auth.uid()
  )
);

create policy "appointments branch write"
on public.appointments
for all
using (
  org_id = public.my_org_id()
  and public.can_access_branch(branch_id, array['OWNER','PARTNER','MANAGER','RECEPTION'])
)
with check (
  org_id = public.my_org_id()
  and public.can_access_branch(branch_id, array['OWNER','PARTNER','MANAGER','RECEPTION'])
);

create policy "appointments tech update own"
on public.appointments
for update
using (
  org_id = public.my_org_id()
  and staff_user_id = auth.uid()
  and public.can_access_branch(branch_id, array['TECH'])
)
with check (
  org_id = public.my_org_id()
  and staff_user_id = auth.uid()
  and public.can_access_branch(branch_id, array['TECH'])
);

drop policy if exists "Allow authenticated users to insert customers" on public.customers;
drop policy if exists "Allow authenticated users to read customers" on public.customers;
drop policy if exists "Allow authenticated users to update customers" on public.customers;
drop policy if exists "org read customers" on public.customers;
drop policy if exists "owner manager reception write customers" on public.customers;
drop policy if exists "tech write customers" on public.customers;

create policy "customers branch read"
on public.customers
for select
using (
  org_id = public.my_org_id()
  and public.can_access_branch(branch_id, array['OWNER','PARTNER','MANAGER','RECEPTION','ACCOUNTANT'])
);

create policy "customers branch write"
on public.customers
for all
using (
  org_id = public.my_org_id()
  and public.can_access_branch(branch_id, array['OWNER','PARTNER','MANAGER','RECEPTION'])
)
with check (
  org_id = public.my_org_id()
  and public.can_access_branch(branch_id, array['OWNER','PARTNER','MANAGER','RECEPTION'])
);

drop policy if exists "Allow authenticated users to insert tickets" on public.tickets;
drop policy if exists "Allow authenticated users to read tickets" on public.tickets;
drop policy if exists "Allow authenticated users to update tickets" on public.tickets;
drop policy if exists "owner manager reception accountant read tickets" on public.tickets;
drop policy if exists "owner manager reception write tickets" on public.tickets;
drop policy if exists "tech read tickets" on public.tickets;
drop policy if exists "tech write tickets" on public.tickets;

create policy "tickets branch read"
on public.tickets
for select
using (
  org_id = public.my_org_id()
  and public.can_access_branch(branch_id, array['OWNER','PARTNER','MANAGER','RECEPTION','ACCOUNTANT'])
);

create policy "tickets branch write"
on public.tickets
for all
using (
  org_id = public.my_org_id()
  and public.can_access_branch(branch_id, array['OWNER','PARTNER','MANAGER','RECEPTION'])
)
with check (
  org_id = public.my_org_id()
  and public.can_access_branch(branch_id, array['OWNER','PARTNER','MANAGER','RECEPTION'])
);

drop policy if exists "ticket_items role read" on public.ticket_items;
drop policy if exists "ticket_items reception write" on public.ticket_items;

create policy "ticket_items branch read"
on public.ticket_items
for select
using (
  org_id = public.my_org_id()
  and exists (
    select 1
    from public.tickets t
    where t.id = ticket_items.ticket_id
      and t.org_id = ticket_items.org_id
      and public.can_access_branch(
        t.branch_id,
        array['OWNER','PARTNER','MANAGER','RECEPTION','ACCOUNTANT']
      )
  )
);

create policy "ticket_items branch write"
on public.ticket_items
for all
using (
  org_id = public.my_org_id()
  and exists (
    select 1
    from public.tickets t
    where t.id = ticket_items.ticket_id
      and t.org_id = ticket_items.org_id
      and public.can_access_branch(
        t.branch_id,
        array['OWNER','PARTNER','MANAGER','RECEPTION']
      )
  )
)
with check (
  org_id = public.my_org_id()
  and exists (
    select 1
    from public.tickets t
    where t.id = ticket_items.ticket_id
      and t.org_id = ticket_items.org_id
      and public.can_access_branch(
        t.branch_id,
        array['OWNER','PARTNER','MANAGER','RECEPTION']
      )
  )
);

drop policy if exists "owner manager reception accountant read payments" on public.payments;
drop policy if exists "owner manager reception write payments" on public.payments;
drop policy if exists "tech read payments" on public.payments;
drop policy if exists "tech write payments" on public.payments;

create policy "payments branch read"
on public.payments
for select
using (
  org_id = public.my_org_id()
  and exists (
    select 1
    from public.tickets t
    where t.id = payments.ticket_id
      and t.org_id = payments.org_id
      and public.can_access_branch(
        t.branch_id,
        array['OWNER','PARTNER','MANAGER','RECEPTION','ACCOUNTANT']
      )
  )
);

create policy "payments branch write"
on public.payments
for all
using (
  org_id = public.my_org_id()
  and exists (
    select 1
    from public.tickets t
    where t.id = payments.ticket_id
      and t.org_id = payments.org_id
      and public.can_access_branch(
        t.branch_id,
        array['OWNER','PARTNER','MANAGER','RECEPTION']
      )
  )
)
with check (
  org_id = public.my_org_id()
  and exists (
    select 1
    from public.tickets t
    where t.id = payments.ticket_id
      and t.org_id = payments.org_id
      and public.can_access_branch(
        t.branch_id,
        array['OWNER','PARTNER','MANAGER','RECEPTION']
      )
  )
);

drop policy if exists "receipts role read" on public.receipts;
drop policy if exists "receipts reception write" on public.receipts;

create policy "receipts branch read"
on public.receipts
for select
using (
  org_id = public.my_org_id()
  and exists (
    select 1
    from public.tickets t
    where t.id = receipts.ticket_id
      and t.org_id = receipts.org_id
      and public.can_access_branch(
        t.branch_id,
        array['OWNER','PARTNER','MANAGER','RECEPTION','ACCOUNTANT']
      )
  )
);

create policy "receipts branch write"
on public.receipts
for all
using (
  org_id = public.my_org_id()
  and exists (
    select 1
    from public.tickets t
    where t.id = receipts.ticket_id
      and t.org_id = receipts.org_id
      and public.can_access_branch(
        t.branch_id,
        array['OWNER','PARTNER','MANAGER','RECEPTION']
      )
  )
)
with check (
  org_id = public.my_org_id()
  and exists (
    select 1
    from public.tickets t
    where t.id = receipts.ticket_id
      and t.org_id = receipts.org_id
      and public.can_access_branch(
        t.branch_id,
        array['OWNER','PARTNER','MANAGER','RECEPTION']
      )
  )
);

drop policy if exists "Allow authenticated users to read booking_requests" on public.booking_requests;
drop policy if exists "Allow authenticated users to update booking_requests" on public.booking_requests;
drop policy if exists "org read booking_requests" on public.booking_requests;
drop policy if exists "org read booking_requests tech ops" on public.booking_requests;
drop policy if exists "org update booking_requests" on public.booking_requests;
drop policy if exists "org delete booking_requests" on public.booking_requests;

create policy "booking_requests branch read"
on public.booking_requests
for select
using (
  org_id = public.my_org_id()
  and public.can_access_branch(branch_id, array['OWNER','PARTNER','MANAGER','RECEPTION'])
);

create policy "booking_requests branch update"
on public.booking_requests
for update
using (
  org_id = public.my_org_id()
  and public.can_access_branch(branch_id, array['OWNER','PARTNER','MANAGER','RECEPTION'])
)
with check (
  org_id = public.my_org_id()
  and public.can_access_branch(branch_id, array['OWNER','PARTNER','MANAGER','RECEPTION'])
);

create policy "booking_requests branch delete"
on public.booking_requests
for delete
using (
  org_id = public.my_org_id()
  and public.can_access_branch(branch_id, array['OWNER','PARTNER','MANAGER'])
);

drop policy if exists "owner read invite codes" on public.invite_codes;
drop policy if exists "owner dev read invite codes" on public.invite_codes;

create policy "invite_codes branch read"
on public.invite_codes
for select
using (
  org_id = public.my_org_id()
  and public.can_access_branch(branch_id, array['OWNER','PARTNER','MANAGER'])
);

create policy "invite_codes branch write"
on public.invite_codes
for all
using (
  org_id = public.my_org_id()
  and public.can_access_branch(branch_id, array['OWNER','PARTNER','MANAGER'])
)
with check (
  org_id = public.my_org_id()
  and public.can_access_branch(branch_id, array['OWNER','PARTNER','MANAGER'])
);

drop policy if exists "staff_shift_profiles owner manager read" on public.staff_shift_profiles;
drop policy if exists "staff_shift_profiles owner manager write" on public.staff_shift_profiles;
drop policy if exists "staff_shift_profiles staff read self" on public.staff_shift_profiles;

create policy "staff_shift_profiles branch read"
on public.staff_shift_profiles
for select
using (
  org_id = public.my_org_id()
  and (
    public.can_access_branch(branch_id, array['OWNER','PARTNER','MANAGER'])
    or user_id = auth.uid()
  )
);

create policy "staff_shift_profiles branch write"
on public.staff_shift_profiles
for all
using (
  org_id = public.my_org_id()
  and public.can_access_branch(branch_id, array['OWNER','PARTNER','MANAGER'])
)
with check (
  org_id = public.my_org_id()
  and public.can_access_branch(branch_id, array['OWNER','PARTNER','MANAGER'])
);

drop policy if exists "shift_plans owner manager read all" on public.shift_plans;
drop policy if exists "shift_plans owner manager write" on public.shift_plans;
drop policy if exists "shift_plans staff read published" on public.shift_plans;

create policy "shift_plans manager branch read"
on public.shift_plans
for select
using (
  org_id = public.my_org_id()
  and public.can_access_branch(branch_id, array['OWNER','PARTNER','MANAGER'])
);

create policy "shift_plans manager branch write"
on public.shift_plans
for all
using (
  org_id = public.my_org_id()
  and public.can_access_branch(branch_id, array['OWNER','PARTNER','MANAGER'])
)
with check (
  org_id = public.my_org_id()
  and public.can_access_branch(branch_id, array['OWNER','PARTNER','MANAGER'])
);

create policy "shift_plans staff read published branch"
on public.shift_plans
for select
using (
  org_id = public.my_org_id()
  and status = 'published'
  and public.can_access_branch(branch_id)
);

drop policy if exists "time_entries role read" on public.time_entries;
drop policy if exists "time_entries owner manager write" on public.time_entries;
drop policy if exists "time_entries staff self write" on public.time_entries;

create policy "time_entries branch read"
on public.time_entries
for select
using (
  org_id = public.my_org_id()
  and (
    public.can_access_branch(branch_id, array['OWNER','PARTNER','MANAGER','RECEPTION','ACCOUNTANT'])
    or staff_user_id = auth.uid()
  )
);

create policy "time_entries manager branch write"
on public.time_entries
for all
using (
  org_id = public.my_org_id()
  and public.can_access_branch(branch_id, array['OWNER','PARTNER','MANAGER'])
)
with check (
  org_id = public.my_org_id()
  and public.can_access_branch(branch_id, array['OWNER','PARTNER','MANAGER'])
);

create policy "time_entries staff self write"
on public.time_entries
for all
using (
  org_id = public.my_org_id()
  and staff_user_id = auth.uid()
  and public.can_access_branch(branch_id, array['RECEPTION','TECH','ACCOUNTANT','MANAGER'])
)
with check (
  org_id = public.my_org_id()
  and staff_user_id = auth.uid()
  and public.can_access_branch(branch_id, array['RECEPTION','TECH','ACCOUNTANT','MANAGER'])
);

drop policy if exists "shift_leave_requests owner manager read" on public.shift_leave_requests;
drop policy if exists "shift_leave_requests owner manager write" on public.shift_leave_requests;
drop policy if exists "shift_leave_requests staff read self" on public.shift_leave_requests;
drop policy if exists "shift_leave_requests staff write self" on public.shift_leave_requests;

create policy "shift_leave_requests branch read"
on public.shift_leave_requests
for select
using (
  org_id = public.my_org_id()
  and (
    public.can_access_branch(branch_id, array['OWNER','PARTNER','MANAGER'])
    or staff_user_id = auth.uid()
  )
);

create policy "shift_leave_requests manager branch write"
on public.shift_leave_requests
for all
using (
  org_id = public.my_org_id()
  and public.can_access_branch(branch_id, array['OWNER','PARTNER','MANAGER'])
)
with check (
  org_id = public.my_org_id()
  and public.can_access_branch(branch_id, array['OWNER','PARTNER','MANAGER'])
);

create policy "shift_leave_requests staff insert self"
on public.shift_leave_requests
for insert
with check (
  org_id = public.my_org_id()
  and staff_user_id = auth.uid()
  and public.can_access_branch(branch_id, array['RECEPTION','TECH','ACCOUNTANT','MANAGER'])
);

drop policy if exists "read own org roles" on public.user_roles;
drop policy if exists "owner write roles" on public.user_roles;
drop policy if exists "user_roles self bootstrap insert" on public.user_roles;

create policy "user_roles read scoped"
on public.user_roles
for select
using (
  org_id = public.my_org_id()
  and (
    user_id = auth.uid()
    or public.has_org_role(array['OWNER'])
    or (
      branch_id is not null
      and public.can_access_branch(branch_id, array['MANAGER','PARTNER'])
    )
  )
);

create policy "user_roles owner write"
on public.user_roles
for all
using (
  org_id = public.my_org_id()
  and public.has_org_role(array['OWNER'])
)
with check (
  org_id = public.my_org_id()
  and public.has_org_role(array['OWNER'])
);

create policy "user_roles manager branch write"
on public.user_roles
for all
using (
  org_id = public.my_org_id()
  and branch_id is not null
  and public.can_access_branch(branch_id, array['MANAGER'])
  and role in ('RECEPTION','ACCOUNTANT','TECH')
)
with check (
  org_id = public.my_org_id()
  and branch_id is not null
  and public.can_access_branch(branch_id, array['MANAGER'])
  and role in ('RECEPTION','ACCOUNTANT','TECH')
);

commit;
