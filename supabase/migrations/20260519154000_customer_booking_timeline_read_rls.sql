begin;

drop policy if exists "booking_requests customer own read" on public.booking_requests;
drop policy if exists "appointments customer own read" on public.appointments;
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
      and (
        ca.customer_id = public.customers.id
        or (
          lower(coalesce(public.customers.email, '')) = lower(
            coalesce(
              nullif(trim((auth.jwt() ->> 'email')), ''),
              nullif(trim((auth.jwt() -> 'user_metadata' ->> 'email')), '')
            )
          )
        )
      )
  )
);

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
      and (
        ca.customer_id = public.booking_requests.customer_id
        or exists (
          select 1
          from public.customers c
          where c.id = public.booking_requests.customer_id
            and c.org_id = public.booking_requests.org_id
            and lower(coalesce(c.email, '')) = lower(
              coalesce(
                nullif(trim((auth.jwt() ->> 'email')), ''),
                nullif(trim((auth.jwt() -> 'user_metadata' ->> 'email')), '')
              )
            )
        )
      )
  )
);

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
      and (
        ca.customer_id = public.appointments.customer_id
        or exists (
          select 1
          from public.customers c
          where c.id = public.appointments.customer_id
            and c.org_id = public.appointments.org_id
            and lower(coalesce(c.email, '')) = lower(
              coalesce(
                nullif(trim((auth.jwt() ->> 'email')), ''),
                nullif(trim((auth.jwt() -> 'user_metadata' ->> 'email')), '')
              )
            )
        )
        or exists (
          select 1
          from public.booking_requests br
          join public.customers c
            on c.id = br.customer_id
           and c.org_id = br.org_id
          where br.org_id = public.appointments.org_id
            and br.appointment_id = public.appointments.id
            and lower(coalesce(c.email, '')) = lower(
              coalesce(
                nullif(trim((auth.jwt() ->> 'email')), ''),
                nullif(trim((auth.jwt() -> 'user_metadata' ->> 'email')), '')
              )
            )
        )
      )
  )
);

commit;
