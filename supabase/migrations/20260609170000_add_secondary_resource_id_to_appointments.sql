alter table public.appointments
  add column if not exists secondary_resource_id uuid references public.resources(id) on delete set null;

create index if not exists appointments_secondary_resource_id_idx
  on public.appointments (secondary_resource_id);
