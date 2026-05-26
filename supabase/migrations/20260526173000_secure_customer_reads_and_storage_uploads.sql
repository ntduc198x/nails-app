begin;

drop policy if exists "customers customer own read" on public.customers;
create policy "customers customer own read"
on public.customers
for select
to authenticated
using (
  exists (
    select 1
    from public.customer_accounts ca
    where ca.user_id = auth.uid()
      and ca.org_id = public.customers.org_id
      and ca.customer_id = public.customers.id
  )
);

drop policy if exists "booking_requests customer own read" on public.booking_requests;
create policy "booking_requests customer own read"
on public.booking_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.customer_accounts ca
    where ca.user_id = auth.uid()
      and ca.org_id = public.booking_requests.org_id
      and ca.customer_id = public.booking_requests.customer_id
  )
);

drop policy if exists "appointments customer own read" on public.appointments;
create policy "appointments customer own read"
on public.appointments
for select
to authenticated
using (
  exists (
    select 1
    from public.customer_accounts ca
    where ca.user_id = auth.uid()
      and ca.org_id = public.appointments.org_id
      and ca.customer_id = public.appointments.customer_id
  )
);

update storage.buckets
set public = true,
    file_size_limit = 2097152,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'service-images';

drop policy if exists "service-images authenticated insert" on storage.objects;
drop policy if exists "service-images authenticated update" on storage.objects;
drop policy if exists "service-images authenticated delete" on storage.objects;

commit;
