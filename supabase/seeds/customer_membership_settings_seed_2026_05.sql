-- Customer membership + settings support seed
-- Apply after bootstrap.sql + customer_mobile_schema_2026_04.sql

alter table public.profiles
  add column if not exists language text not null default 'vi'
  check (language in ('vi', 'en'));

with seed_tiers as (
  select org.id as org_id, tier.code, tier.name, tier.description, tier.spending_threshold, tier.visit_threshold, tier.accent_color, tier.perks
  from public.orgs org
  cross join (
    values
      ('BRONZE', 'Bronze', 'Khởi động với ưu đãi cơ bản và lịch sử điểm tích lũy.', 0::numeric, 0, '#B77B4A', '["Tích điểm mỗi hóa đơn","Nhận thông báo ưu đãi sớm"]'::jsonb),
      ('SILVER', 'Silver', 'Dành cho khách quay lại đều, ưu tiên slot đẹp và ưu đãi bổ sung.', 3000000::numeric, 5, '#A2A8B5', '["Tăng 5% ưu đãi dịch vụ","Ưu tiên giữ slot cuối tuần"]'::jsonb),
      ('GOLD', 'Gold', 'Nhiều quyền lợi dành riêng cho khách thân thiết có tần suất cao.', 8000000::numeric, 12, '#D2A85A', '["Tăng 10% ưu đãi dịch vụ","Quà tặng sinh nhật","Ưu tiên booking trước"]'::jsonb)
  ) as tier(code, name, description, spending_threshold, visit_threshold, accent_color, perks)
), upsert_tiers as (
  insert into public.membership_tiers (
    org_id,
    code,
    name,
    description,
    spending_threshold,
    visit_threshold,
    accent_color,
    perks,
    is_active
  )
  select
    org_id,
    code,
    name,
    description,
    spending_threshold,
    visit_threshold,
    accent_color,
    perks,
    true
  from seed_tiers
  on conflict (org_id, code) do update
    set
      name = excluded.name,
      description = excluded.description,
      spending_threshold = excluded.spending_threshold,
      visit_threshold = excluded.visit_threshold,
      accent_color = excluded.accent_color,
      perks = excluded.perks,
      is_active = true
  returning id, org_id, code
), seed_offers as (
  select org.id as org_id, offer.title, offer.description, offer.image_url, offer.badge, offer.starts_at, offer.ends_at, offer.metadata
  from public.orgs org
  cross join (
    values
      (
        'Ưu đãi refill trong tháng',
        'Giảm giá nhẹ cho lần refill tiếp theo khi đặt lịch sớm.',
        'https://images.unsplash.com/photo-1522337660859-02fbefca4702?auto=format&fit=crop&w=1200&q=80',
        'Thành viên',
        now(),
        now() + interval '45 days',
        '{"placement":"membership","code":"REFILL_MONTH"}'::jsonb
      ),
      (
        'Combo chăm móng + nail art',
        'Tăng thêm quyền lợi cho khách có membership và đặt lịch online.',
        'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=1200&q=80',
        'Nổi bật',
        now(),
        now() + interval '60 days',
        '{"placement":"membership","code":"COMBO_ART"}'::jsonb
      ),
      (
        'Quà tặng sinh nhật',
        'Voucher áp dụng trong tháng sinh nhật của khách hàng.',
        'https://images.unsplash.com/photo-1519014816548-bf5fe059798b?auto=format&fit=crop&w=1200&q=80',
        'Sinh nhật',
        now(),
        now() + interval '90 days',
        '{"placement":"membership","code":"BIRTHDAY_GIFT"}'::jsonb
      )
  ) as offer(title, description, image_url, badge, starts_at, ends_at, metadata)
)
insert into public.marketing_offers (
  org_id,
  title,
  description,
  image_url,
  badge,
  starts_at,
  ends_at,
  is_active,
  offer_metadata
)
select
  org_id,
  title,
  description,
  image_url,
  badge,
  starts_at,
  ends_at,
  true,
  metadata
from seed_offers
where not exists (
  select 1
  from public.marketing_offers existing
  where existing.org_id = seed_offers.org_id
    and existing.title = seed_offers.title
);

with primary_customer as (
  select
    ca.user_id,
    ca.customer_id,
    ca.org_id
  from public.customer_accounts ca
  join public.customers c on c.id = ca.customer_id
  where coalesce(ca.customer_id, c.id) is not null
  order by ca.created_at asc
  limit 1
), bronze_tier as (
  select mt.id, mt.org_id
  from public.membership_tiers mt
  join primary_customer pc on pc.org_id = mt.org_id
  where mt.code = 'BRONZE'
  limit 1
)
insert into public.customer_memberships (
  user_id,
  customer_id,
  org_id,
  tier_id,
  points_balance,
  lifetime_points,
  total_spent,
  total_visits,
  joined_at,
  expires_at,
  created_at,
  updated_at
)
select
  pc.user_id,
  pc.customer_id,
  pc.org_id,
  bt.id,
  180,
  420,
  2450000,
  4,
  now() - interval '40 days',
  now() + interval '325 days',
  now(),
  now()
from primary_customer pc
join bronze_tier bt on bt.org_id = pc.org_id
on conflict (user_id) do update
  set
    customer_id = excluded.customer_id,
    org_id = excluded.org_id,
    tier_id = excluded.tier_id,
    points_balance = excluded.points_balance,
    lifetime_points = excluded.lifetime_points,
    total_spent = excluded.total_spent,
    total_visits = excluded.total_visits,
    expires_at = excluded.expires_at,
    updated_at = now();