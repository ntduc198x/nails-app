alter table public.booking_requests
  add column if not exists updated_at timestamptz;

update public.booking_requests
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

alter table public.booking_requests
  alter column updated_at set default now();

alter table public.booking_requests
  alter column updated_at set not null;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_booking_requests_updated_at on public.booking_requests;

create trigger trg_booking_requests_updated_at
before update on public.booking_requests
for each row
execute function public.touch_updated_at();
