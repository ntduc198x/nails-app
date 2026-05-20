begin;

drop policy if exists "booking_requests branch read" on public.booking_requests;

create policy "booking_requests branch read"
on public.booking_requests
for select
to authenticated
using (
  org_id = public.my_org_id()
  and public.can_access_branch(
    branch_id,
    array['OWNER','PARTNER','MANAGER','RECEPTION','TECH']
  )
);

commit;
