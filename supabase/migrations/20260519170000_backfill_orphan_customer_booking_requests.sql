begin;

with orphan_name_matches as (
  select
    br.id as booking_request_id,
    min(c.id) as customer_id,
    count(*) as match_count
  from public.booking_requests br
  join public.customers c
    on c.org_id = br.org_id
   and c.merged_into_customer_id is null
   and lower(btrim(coalesce(c.full_name, c.name, ''))) = lower(btrim(coalesce(br.customer_name, '')))
  where br.customer_id is null
    and nullif(btrim(coalesce(br.customer_name, '')), '') is not null
  group by br.id
),
backfill_targets as (
  select booking_request_id, customer_id
  from orphan_name_matches
  where match_count = 1
)
update public.booking_requests br
set customer_id = bt.customer_id
from backfill_targets bt
where br.id = bt.booking_request_id
  and br.customer_id is null;

commit;
