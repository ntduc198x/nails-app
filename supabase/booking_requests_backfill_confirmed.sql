-- Backfill old confirmed booking_requests into appointments when possible.
-- Review results before/after running on production.

create or replace function public.backfill_confirmed_booking_requests()
returns table (
  booking_request_id uuid,
  action text,
  detail text,
  appointment_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req record;
  v_customer_id uuid;
  v_branch_id uuid;
  v_appointment_id uuid;
  v_conflict_count integer;
begin
  for v_req in
    select br.*
    from public.booking_requests br
    where br.status = 'CONFIRMED'
      and br.appointment_id is null
    order by br.requested_start_at asc, br.created_at asc
  loop
    select count(*) into v_conflict_count
    from public.appointments a
    where a.org_id = v_req.org_id
      and a.status in ('BOOKED','CHECKED_IN','IN_SERVICE')
      and a.start_at < v_req.requested_end_at
      and a.end_at > v_req.requested_start_at;

    if v_conflict_count >= coalesce(nullif(current_setting('app.booking_max_simultaneous', true), ''), '2')::int then
      update public.booking_requests
      set status = 'NEEDS_RESCHEDULE'
      where id = v_req.id;

      booking_request_id := v_req.id;
      action := 'needs_reschedule';
      detail := 'Conflict with existing appointments at same time';
      appointment_id := null;
      return next;
      continue;
    end if;

    select c.id into v_customer_id
    from public.customers c
    where c.org_id = v_req.org_id
      and c.name = v_req.customer_name
      and coalesce(c.phone, '') = coalesce(v_req.customer_phone, '')
    order by c.created_at asc
    limit 1;

    if v_customer_id is null then
      insert into public.customers (org_id, name, phone, notes)
      values (
        v_req.org_id,
        v_req.customer_name,
        v_req.customer_phone,
        concat_ws(' | ',
          case when v_req.requested_service is not null then 'DV: ' || v_req.requested_service else null end,
          case when v_req.preferred_staff is not null then 'Thợ mong muốn: ' || v_req.preferred_staff else null end,
          nullif(v_req.note, '')
        )
      )
      returning id into v_customer_id;
    end if;

    select p.default_branch_id into v_branch_id
    from public.profiles p
    where p.org_id = v_req.org_id
      and p.default_branch_id is not null
    order by p.created_at asc nulls last
    limit 1;

    insert into public.appointments (
      org_id,
      branch_id,
      customer_id,
      start_at,
      end_at,
      status
    ) values (
      v_req.org_id,
      coalesce(v_req.branch_id, v_branch_id),
      v_customer_id,
      v_req.requested_start_at,
      v_req.requested_end_at,
      'BOOKED'
    )
    returning id into v_appointment_id;

    update public.booking_requests
    set status = 'CONVERTED',
        appointment_id = v_appointment_id
    where id = v_req.id;

    booking_request_id := v_req.id;
    action := 'converted';
    detail := 'Converted confirmed booking request to appointment';
    appointment_id := v_appointment_id;
    return next;
  end loop;
end;
$$;

-- Run:
-- select set_config('app.booking_max_simultaneous', '2', false);
-- select * from public.backfill_confirmed_booking_requests();
