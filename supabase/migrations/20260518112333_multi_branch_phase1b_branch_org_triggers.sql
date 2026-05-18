begin;

create or replace function public.assert_branch_belongs_to_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.branch_id is not null and not exists (
    select 1
    from public.branches b
    where b.id = new.branch_id
      and b.org_id = new.org_id
  ) then
    raise exception 'BRANCH_NOT_IN_ORG';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_customers_branch_org on public.customers;
create trigger trg_customers_branch_org
before insert or update on public.customers
for each row execute function public.assert_branch_belongs_to_org();

drop trigger if exists trg_resources_branch_org on public.resources;
create trigger trg_resources_branch_org
before insert or update on public.resources
for each row execute function public.assert_branch_belongs_to_org();

drop trigger if exists trg_appointments_branch_org on public.appointments;
create trigger trg_appointments_branch_org
before insert or update on public.appointments
for each row execute function public.assert_branch_belongs_to_org();

drop trigger if exists trg_tickets_branch_org on public.tickets;
create trigger trg_tickets_branch_org
before insert or update on public.tickets
for each row execute function public.assert_branch_belongs_to_org();

drop trigger if exists trg_invite_codes_branch_org on public.invite_codes;
create trigger trg_invite_codes_branch_org
before insert or update on public.invite_codes
for each row execute function public.assert_branch_belongs_to_org();

drop trigger if exists trg_booking_requests_branch_org on public.booking_requests;
create trigger trg_booking_requests_branch_org
before insert or update on public.booking_requests
for each row execute function public.assert_branch_belongs_to_org();

drop trigger if exists trg_time_entries_branch_org on public.time_entries;
create trigger trg_time_entries_branch_org
before insert or update on public.time_entries
for each row execute function public.assert_branch_belongs_to_org();

drop trigger if exists trg_staff_shift_profiles_branch_org on public.staff_shift_profiles;
create trigger trg_staff_shift_profiles_branch_org
before insert or update on public.staff_shift_profiles
for each row execute function public.assert_branch_belongs_to_org();

drop trigger if exists trg_shift_plans_branch_org on public.shift_plans;
create trigger trg_shift_plans_branch_org
before insert or update on public.shift_plans
for each row execute function public.assert_branch_belongs_to_org();

drop trigger if exists trg_shift_leave_requests_branch_org on public.shift_leave_requests;
create trigger trg_shift_leave_requests_branch_org
before insert or update on public.shift_leave_requests
for each row execute function public.assert_branch_belongs_to_org();

commit;
