-- Review duplicate candidates

-- 1) Overview
select *
from public.list_customer_duplicate_candidates();

-- 2) Safe email merges preview
select *
from public.merge_safe_customer_duplicates_by_email(null, true);

-- 3) Safe phone merges preview
select *
from public.merge_safe_customer_duplicates_by_phone(null, true);

-- 4) Execute safe email merges
-- select * from public.merge_safe_customer_duplicates_by_email(null, false);

-- 5) Execute safe phone merges
-- select * from public.merge_safe_customer_duplicates_by_phone(null, false);

-- 6) Inspect one customer group manually
-- replace VALUE with normalized email/phone
-- EMAIL
-- select id, org_id, full_name, email, phone, total_visits, total_spend, created_at, merged_into_customer_id
-- from public.customers
-- where lower(email) = 'value'
-- order by total_visits desc, total_spend desc, created_at asc;

-- PHONE
-- select id, org_id, full_name, email, phone, total_visits, total_spend, created_at, merged_into_customer_id
-- from public.customers
-- where public.normalize_customer_phone(phone) = 'value'
-- order by total_visits desc, total_spend desc, created_at asc;
