begin;

drop policy if exists "booking_requests branch update" on public.booking_requests;
create policy "booking_requests branch update"
on public.booking_requests
for update
to authenticated
using (
  org_id = public.my_org_id()
  and public.can_access_branch(
    branch_id,
    array['OWNER','PARTNER','MANAGER','RECEPTION','TECH']
  )
)
with check (
  org_id = public.my_org_id()
  and public.can_access_branch(
    branch_id,
    array['OWNER','PARTNER','MANAGER','RECEPTION','TECH']
  )
);

drop policy if exists "booking_requests branch delete" on public.booking_requests;
create policy "booking_requests branch delete"
on public.booking_requests
for delete
to authenticated
using (
  org_id = public.my_org_id()
  and public.can_access_branch(
    branch_id,
    array['OWNER','PARTNER','MANAGER','RECEPTION','TECH']
  )
);

create or replace function public.convert_booking_request_to_appointment_secure(
  p_booking_request_id uuid,
  p_staff_user_id uuid default null,
  p_resource_id uuid default null,
  p_start_at timestamptz default null,
  p_end_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.booking_requests;
  v_customer_id uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_appointment_id uuid;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select *
  into v_req
  from public.booking_requests br
  where br.id = p_booking_request_id
    and br.org_id = public.my_org_id()
  limit 1;

  if v_req.id is null then
    raise exception 'BOOKING_REQUEST_NOT_FOUND';
  end if;

  if not public.can_access_branch(
    v_req.branch_id,
    array['OWNER','PARTNER','MANAGER','RECEPTION','TECH']
  ) then
    raise exception 'ACCESS_DENIED';
  end if;

  if v_req.status in ('CANCELLED', 'CONVERTED') then
    raise exception 'BOOKING_REQUEST_ALREADY_FINALIZED';
  end if;

  if p_resource_id is not null and not exists (
    select 1
    from public.resources r
    where r.id = p_resource_id
      and r.org_id = v_req.org_id
      and r.branch_id = v_req.branch_id
  ) then
    raise exception 'RESOURCE_BRANCH_MISMATCH';
  end if;

  v_start := coalesce(p_start_at, v_req.requested_start_at);
  v_end := coalesce(p_end_at, v_req.requested_end_at, v_start + interval '60 minutes');

  if v_end <= v_start then
    raise exception 'INVALID_TIME_RANGE';
  end if;

  v_customer_id := public.upsert_customer_by_identity(
    v_req.org_id,
    v_req.customer_name,
    v_req.customer_phone,
    v_req.source,
    concat_ws(' | ',
      case when v_req.requested_service is not null then 'DV: ' || v_req.requested_service else null end,
      case when v_req.preferred_staff is not null then 'Tho mong muon: ' || v_req.preferred_staff else null end,
      nullif(v_req.note, '')
    ),
    v_req.branch_id
  );

  insert into public.appointments (
    org_id, branch_id, customer_id, staff_user_id, resource_id, start_at, end_at, status
  ) values (
    v_req.org_id, v_req.branch_id, v_customer_id, p_staff_user_id, p_resource_id, v_start, v_end, 'BOOKED'
  )
  returning id into v_appointment_id;

  update public.booking_requests
  set status = 'CONVERTED',
      appointment_id = v_appointment_id
  where id = v_req.id;

  return jsonb_build_object(
    'booking_request_id', v_req.id,
    'appointment_id', v_appointment_id,
    'status', 'CONVERTED'
  );
end;
$$;

grant execute on function public.convert_booking_request_to_appointment_secure(uuid, uuid, uuid, timestamptz, timestamptz) to authenticated;

commit;
