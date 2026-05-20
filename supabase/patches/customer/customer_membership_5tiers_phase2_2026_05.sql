-- Membership Phase 2+: expand to 5 tiers with theme metadata
begin;

alter table public.membership_tiers
  add column if not exists sort_order int not null default 0,
  add column if not exists gradient_from text,
  add column if not exists gradient_to text,
  add column if not exists badge_icon text,
  add column if not exists theme_key text;

with seed_tiers as (
  select org.id as org_id, *
  from public.orgs org
  cross join (
    values
      ('BRONZE', 'Bronze', 'Khởi động với quyền lợi cơ bản và tích lũy ban đầu.', 1, 0::numeric, 0, '#B77B4A', '#C18A57', '#5D3B22', 'award', 'bronze', '["Tích điểm cơ bản","Nhận thông báo ưu đãi sớm"]'::jsonb),
      ('SILVER', 'Silver', 'Khách quay lại đều, bắt đầu có ưu tiên nhẹ.', 2, 2000000::numeric, 3, '#A2A8B5', '#E7EBF0', '#98A2B3', 'shield', 'silver', '["x1.1 điểm thưởng","Ưu tiên đặt lịch sớm","Voucher nhẹ theo tháng"]'::jsonb),
      ('GOLD', 'Gold', 'Khách thân thiết với ưu đãi rõ rệt hơn.', 3, 5000000::numeric, 8, '#D2A85A', '#F6D48B', '#B9852F', 'star', 'gold', '["x1.25 điểm thưởng","Ưu đãi dịch vụ signature","Quà sinh nhật nâng cấp"]'::jsonb),
      ('PLATINUM', 'Platinum', 'Nhóm khách cao cấp, ưu tiên slot và add-on tốt hơn.', 4, 10000000::numeric, 15, '#90A4B8', '#DDE4EA', '#6E7C8C', 'zap', 'platinum', '["x1.5 điểm thưởng","Ưu tiên khung giờ đẹp","Add-on miễn phí định kỳ"]'::jsonb),
      ('DIAMOND', 'Diamond', 'Hạng cao nhất với đặc quyền VIP và ưu đãi độc quyền.', 5, 20000000::numeric, 28, '#344A7A', '#344A7A', '#111827', 'gem', 'diamond', '["x2 điểm thưởng","Ưu đãi VIP độc quyền","Quà khách hàng thân thiết cao cấp"]'::jsonb)
  ) as tier(code, name, description, sort_order, spending_threshold, visit_threshold, accent_color, gradient_from, gradient_to, badge_icon, theme_key, perks)
)
insert into public.membership_tiers (
  org_id, code, name, description, sort_order, spending_threshold, visit_threshold, accent_color, gradient_from, gradient_to, badge_icon, theme_key, perks, is_active
)
select org_id, code, name, description, sort_order, spending_threshold, visit_threshold, accent_color, gradient_from, gradient_to, badge_icon, theme_key, perks, true
from seed_tiers
on conflict (org_id, code) do update
set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  spending_threshold = excluded.spending_threshold,
  visit_threshold = excluded.visit_threshold,
  accent_color = excluded.accent_color,
  gradient_from = excluded.gradient_from,
  gradient_to = excluded.gradient_to,
  badge_icon = excluded.badge_icon,
  theme_key = excluded.theme_key,
  perks = excluded.perks,
  is_active = true;

commit;
