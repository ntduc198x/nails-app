begin;

drop policy if exists "booking_requests customer own read" on public.booking_requests;
drop policy if exists "appointments customer own read" on public.appointments;

create policy "booking_requests customer own read"
on public.booking_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.customer_accounts ca
    join public.customers linked_customer
      on linked_customer.id = ca.customer_id
     and linked_customer.org_id = ca.org_id
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
        or (
          public.normalize_customer_phone(public.booking_requests.customer_phone) is not null
          and public.normalize_customer_phone(public.booking_requests.customer_phone)
            = public.normalize_customer_phone(linked_customer.phone)
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
    join public.customers linked_customer
      on linked_customer.id = ca.customer_id
     and linked_customer.org_id = ca.org_id
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
          where br.org_id = public.appointments.org_id
            and br.appointment_id = public.appointments.id
            and (
              br.customer_id = ca.customer_id
              or (
                public.normalize_customer_phone(br.customer_phone) is not null
                and public.normalize_customer_phone(br.customer_phone)
                  = public.normalize_customer_phone(linked_customer.phone)
              )
            )
        )
      )
  )
);

commit;
