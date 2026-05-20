create or replace function public.enforce_appointment_status_transition()
returns trigger
language plpgsql
as $$
declare
  v_start_at timestamptz := coalesce(new.start_at, old.start_at);
begin
  if new.status = old.status then
    return new;
  end if;

  if old.status = 'BOOKED' and new.status = 'CHECKED_IN' then
    if v_start_at is null then
      raise exception 'INVALID_APPOINTMENT_START_AT';
    end if;

    if now() < v_start_at - interval '15 minutes'
      or now() > v_start_at + interval '15 minutes' then
      raise exception 'CHECK_IN_WINDOW_VIOLATION';
    end if;

    return new;
  elsif old.status = 'BOOKED' and new.status in ('CANCELLED', 'NO_SHOW') then
    return new;
  elsif old.status = 'CHECKED_IN' and new.status in ('DONE', 'CANCELLED', 'NO_SHOW') then
    return new;
  end if;

  raise exception 'INVALID_APPOINTMENT_STATUS_TRANSITION: % -> %', old.status, new.status;
end;
$$;
