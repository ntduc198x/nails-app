-- Migrate customer_favorite_services away from profiles(user_id)
-- and align it with customers + customer_accounts.

begin;

do $$
declare
  v_unlinked_count bigint;
begin
  alter table public.customer_favorite_services
    add column if not exists customer_id uuid;

  update public.customer_favorite_services cfs
  set customer_id = ca.customer_id
  from public.customer_accounts ca
  where cfs.customer_id is null
    and ca.user_id = cfs.user_id
    and ca.org_id = cfs.org_id;

  select count(*)
  into v_unlinked_count
  from public.customer_favorite_services
  where customer_id is null;

  if v_unlinked_count > 0 then
    raise exception 'CUSTOMER_FAVORITES_UNLINKED_ROWS:%', v_unlinked_count;
  end if;

  alter table public.customer_favorite_services
    alter column customer_id set not null;
end $$;

alter table public.customer_favorite_services
  drop constraint if exists customer_favorite_services_user_id_fkey;

alter table public.customer_favorite_services
  add constraint customer_favorite_services_customer_id_fkey
  foreign key (customer_id)
  references public.customers(id)
  on delete cascade;

create index if not exists idx_customer_favorite_services_customer
  on public.customer_favorite_services (customer_id, created_at desc);

with duplicates as (
  select ctid,
         row_number() over (
           partition by customer_id, service_id
           order by created_at asc, user_id asc
         ) as rn
  from public.customer_favorite_services
)
delete from public.customer_favorite_services target
using duplicates d
where target.ctid = d.ctid
  and d.rn > 1;

create unique index if not exists idx_customer_favorite_services_customer_service_unique
  on public.customer_favorite_services (customer_id, service_id);

alter table public.customer_favorite_services
  drop constraint if exists customer_favorite_services_pkey;

alter table public.customer_favorite_services
  add constraint customer_favorite_services_pkey
  primary key (customer_id, service_id);

create index if not exists idx_customer_favorite_services_user_id
  on public.customer_favorite_services (user_id);

alter table public.customer_favorite_services enable row level security;

drop policy if exists "customer favorites own all" on public.customer_favorite_services;
create policy "customer favorites own all" on public.customer_favorite_services
for all
using (
  exists (
    select 1
    from public.customer_accounts ca
    where ca.user_id = auth.uid()
      and ca.org_id = customer_favorite_services.org_id
      and ca.customer_id = customer_favorite_services.customer_id
  )
)
with check (
  exists (
    select 1
    from public.customer_accounts ca
    where ca.user_id = auth.uid()
      and ca.org_id = customer_favorite_services.org_id
      and ca.customer_id = customer_favorite_services.customer_id
  )
);

commit;
