-- Phase 3 customer identity cleanup
-- 1) customer_memberships -> customer_id first
-- 2) customer_notification_preferences -> customer_id first
-- 3) customer_offer_claims -> customer_id first
-- 4) customer_notifications -> customer_id first

begin;

alter table public.customer_memberships
  add column if not exists customer_id uuid references public.customers(id) on delete cascade;

update public.customer_memberships cm
set customer_id = ca.customer_id
from public.customer_accounts ca
where cm.customer_id is null
  and ca.user_id = cm.user_id
  and ca.org_id = cm.org_id;

create unique index if not exists idx_customer_memberships_customer_unique
  on public.customer_memberships (customer_id)
  where customer_id is not null;

alter table public.customer_notification_preferences
  add column if not exists customer_id uuid references public.customers(id) on delete cascade;

update public.customer_notification_preferences cnp
set customer_id = ca.customer_id
from public.customer_accounts ca
where cnp.customer_id is null
  and ca.user_id = cnp.user_id
  and ca.org_id = cnp.org_id;

create unique index if not exists idx_customer_notification_preferences_customer_unique
  on public.customer_notification_preferences (customer_id)
  where customer_id is not null;

alter table public.customer_offer_claims
  add column if not exists customer_id uuid references public.customers(id) on delete cascade;

update public.customer_offer_claims coc
set customer_id = ca.customer_id
from public.customer_accounts ca
where coc.customer_id is null
  and ca.user_id = coc.user_id
  and ca.org_id = coc.org_id;

with offer_claim_dupes as (
  select ctid,
         row_number() over (
           partition by customer_id, offer_id
           order by created_at asc, id asc
         ) as rn
  from public.customer_offer_claims
  where customer_id is not null
)
delete from public.customer_offer_claims target
using offer_claim_dupes d
where target.ctid = d.ctid
  and d.rn > 1;

create unique index if not exists idx_customer_offer_claims_customer_offer_unique
  on public.customer_offer_claims (customer_id, offer_id)
  where customer_id is not null;

alter table public.customer_notifications
  add column if not exists customer_id uuid references public.customers(id) on delete cascade;

update public.customer_notifications cn
set customer_id = ca.customer_id
from public.customer_accounts ca
where cn.customer_id is null
  and ca.user_id = cn.user_id
  and ca.org_id = cn.org_id;

create index if not exists idx_customer_notifications_customer_sent
  on public.customer_notifications (customer_id, is_read, sent_at desc);

alter table public.customer_memberships enable row level security;
alter table public.customer_notification_preferences enable row level security;
alter table public.customer_offer_claims enable row level security;
alter table public.customer_notifications enable row level security;

drop policy if exists "customer memberships own read" on public.customer_memberships;
create policy "customer memberships own read" on public.customer_memberships
for select
using (
  exists (
    select 1
    from public.customer_accounts ca
    where ca.user_id = auth.uid()
      and ca.org_id = customer_memberships.org_id
      and ca.customer_id = customer_memberships.customer_id
  )
);

drop policy if exists "customer notification preferences own all" on public.customer_notification_preferences;
create policy "customer notification preferences own all" on public.customer_notification_preferences
for all
using (
  exists (
    select 1
    from public.customer_accounts ca
    where ca.user_id = auth.uid()
      and ca.org_id = customer_notification_preferences.org_id
      and ca.customer_id = customer_notification_preferences.customer_id
  )
)
with check (
  exists (
    select 1
    from public.customer_accounts ca
    where ca.user_id = auth.uid()
      and ca.org_id = customer_notification_preferences.org_id
      and ca.customer_id = customer_notification_preferences.customer_id
  )
);

drop policy if exists "customer offers own all" on public.customer_offer_claims;
create policy "customer offers own all" on public.customer_offer_claims
for all
using (
  exists (
    select 1
    from public.customer_accounts ca
    where ca.user_id = auth.uid()
      and ca.org_id = customer_offer_claims.org_id
      and ca.customer_id = customer_offer_claims.customer_id
  )
)
with check (
  exists (
    select 1
    from public.customer_accounts ca
    where ca.user_id = auth.uid()
      and ca.org_id = customer_offer_claims.org_id
      and ca.customer_id = customer_offer_claims.customer_id
  )
);

drop policy if exists "customer notifications own read update" on public.customer_notifications;
drop policy if exists "customer notifications own update" on public.customer_notifications;
create policy "customer notifications own read update" on public.customer_notifications
for select
using (
  exists (
    select 1
    from public.customer_accounts ca
    where ca.user_id = auth.uid()
      and ca.org_id = customer_notifications.org_id
      and ca.customer_id = customer_notifications.customer_id
  )
);

create policy "customer notifications own update" on public.customer_notifications
for update
using (
  exists (
    select 1
    from public.customer_accounts ca
    where ca.user_id = auth.uid()
      and ca.org_id = customer_notifications.org_id
      and ca.customer_id = customer_notifications.customer_id
  )
)
with check (
  exists (
    select 1
    from public.customer_accounts ca
    where ca.user_id = auth.uid()
      and ca.org_id = customer_notifications.org_id
      and ca.customer_id = customer_notifications.customer_id
  )
);

commit;
