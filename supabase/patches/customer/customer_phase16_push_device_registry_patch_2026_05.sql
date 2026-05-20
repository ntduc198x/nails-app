-- Phase 16 push device registry patch
-- Store customer mobile push tokens by customer/account identity.

begin;

create table if not exists public.customer_push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  customer_id uuid not null references public.customers(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  platform text not null,
  expo_push_token text not null,
  device_label text,
  app_build text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists idx_customer_push_devices_unique_token
  on public.customer_push_devices (expo_push_token);

create index if not exists idx_customer_push_devices_customer
  on public.customer_push_devices (customer_id, last_seen_at desc);

alter table public.customer_push_devices enable row level security;

drop policy if exists "customer push devices own all" on public.customer_push_devices;
create policy "customer push devices own all" on public.customer_push_devices
for all
using (
  exists (
    select 1
    from public.customer_accounts ca
    where ca.user_id = auth.uid()
      and ca.org_id = customer_push_devices.org_id
      and ca.customer_id = customer_push_devices.customer_id
  )
)
with check (
  exists (
    select 1
    from public.customer_accounts ca
    where ca.user_id = auth.uid()
      and ca.org_id = customer_push_devices.org_id
      and ca.customer_id = customer_push_devices.customer_id
  )
);

create or replace function public.register_customer_push_device(
  p_platform text,
  p_expo_push_token text,
  p_device_label text default null,
  p_app_build text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_customer_id uuid;
  v_device_id uuid;
begin
  if v_user_id is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select ca.org_id, ca.customer_id
  into v_org_id, v_customer_id
  from public.customer_accounts ca
  where ca.user_id = v_user_id
  order by ca.created_at asc
  limit 1;

  if v_customer_id is null or v_org_id is null then
    raise exception 'CUSTOMER_ACCOUNT_NOT_FOUND';
  end if;

  insert into public.customer_push_devices (
    user_id,
    customer_id,
    org_id,
    platform,
    expo_push_token,
    device_label,
    app_build,
    last_seen_at
  )
  values (
    v_user_id,
    v_customer_id,
    v_org_id,
    p_platform,
    p_expo_push_token,
    p_device_label,
    p_app_build,
    now()
  )
  on conflict (expo_push_token) do update
    set
      user_id = excluded.user_id,
      customer_id = excluded.customer_id,
      org_id = excluded.org_id,
      platform = excluded.platform,
      device_label = excluded.device_label,
      app_build = excluded.app_build,
      last_seen_at = now()
  returning id into v_device_id;

  return v_device_id;
end;
$$;

grant execute on function public.register_customer_push_device(text, text, text, text) to authenticated;

commit;
