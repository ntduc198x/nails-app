begin;

alter table public.membership_tiers
  add column if not exists sort_order int not null default 0,
  add column if not exists gradient_from text,
  add column if not exists gradient_to text,
  add column if not exists badge_icon text,
  add column if not exists theme_key text,
  add column if not exists visit_min_spend numeric not null default 300000;

with seed_tiers as (
  select
    org.id as org_id,
    tier.code,
    tier.name,
    tier.description,
    tier.sort_order,
    tier.spending_threshold,
    tier.visit_threshold,
    tier.visit_min_spend,
    tier.accent_color,
    tier.gradient_from,
    tier.gradient_to,
    tier.badge_icon,
    tier.theme_key,
    tier.perks
  from public.orgs org
  cross join (
    values
      (
        'BRONZE',
        'Bronze',
        'Khởi động với quyền lợi cơ bản và tích lũy ban đầu.',
        1,
        1000000::numeric,
        2,
        300000::numeric,
        '#B77B4A',
        '#C18A57',
        '#5D3B22',
        'award',
        'bronze',
        jsonb_build_array('Tích điểm cho mọi hóa đơn hợp lệ', 'Nhận ưu đãi mới sớm hơn', 'Quà chào mừng khi bắt đầu hành trình thành viên', 'Được tham gia các đợt quà mini hoặc voucher chỉ dành cho thành viên')
      ),
      (
        'SILVER',
        'Silver',
        'Khách quay lại đều, bắt đầu có ưu tiên nhẹ.',
        2,
        3000000::numeric,
        6,
        300000::numeric,
        '#A2A8B5',
        '#E7EBF0',
        '#98A2B3',
        'shield',
        'silver',
        jsonb_build_array('Nhân x1.1 điểm thưởng', 'Được ưu tiên giữ lịch sớm hơn khách thường', 'Nhận voucher nhẹ theo tháng hoặc theo chu kỳ', 'Có ưu đãi riêng cho một số combo chăm sóc được chọn', 'Có cơ hội nhận add-on mini trong các đợt campaign')
      ),
      (
        'GOLD',
        'Gold',
        'Khách thân thiết với ưu đãi rõ rệt hơn.',
        3,
        8000000::numeric,
        12,
        350000::numeric,
        '#D2A85A',
        '#F6D48B',
        '#B9852F',
        'star',
        'gold',
        jsonb_build_array('Nhân x1.25 điểm thưởng', 'Mở khóa ưu đãi riêng cho dịch vụ signature và set hot', 'Quà sinh nhật được nâng cấp giá trị hơn', 'Ưu tiên giữ slot đẹp cuối tuần khi còn chỗ', 'Thỉnh thoảng được tặng add-on theo campaign riêng cho Gold', 'Có một số ưu đãi chỉ mở từ Gold trở lên')
      ),
      (
        'PLATINUM',
        'Platinum',
        'Nhóm khách cao cấp, ưu tiên slot và add-on tốt hơn.',
        4,
        15000000::numeric,
        20,
        400000::numeric,
        '#90A4B8',
        '#DDE4EA',
        '#6E7C8C',
        'zap',
        'platinum',
        jsonb_build_array('Nhân x1.5 điểm thưởng', 'Ưu tiên khung giờ đẹp và lịch cao điểm', 'Có 1 add-on miễn phí định kỳ', 'Quà sinh nhật VIP hoặc combo quà được nâng cấp', 'Nhận ưu đãi private dành riêng cho nhóm khách thân thiết cao cấp', 'Được ưu tiên giữ lịch trong các dịp cao điểm khi còn khả dụng')
      ),
      (
        'DIAMOND',
        'Diamond',
        'Hạng cao nhất với đặc quyền VIP và ưu đãi độc quyền.',
        5,
        30000000::numeric,
        30,
        500000::numeric,
        '#344A7A',
        '#344A7A',
        '#111827',
        'gem',
        'diamond',
        jsonb_build_array('Nhân x2 điểm thưởng', 'Nhận ưu đãi VIP độc quyền hơn các hạng dưới', 'Ưu tiên lịch đẹp nhất khi còn khả dụng', 'Quà tri ân cao cấp theo quý hoặc theo năm', 'Có ưu đãi riêng cho dịch vụ premium hoặc launch mới', 'Được chăm sóc giữ lịch và hỗ trợ tốt hơn', 'Có thể nhận đặc quyền signature chỉ dành riêng cho Diamond')
      )
  ) as tier(
    code,
    name,
    description,
    sort_order,
    spending_threshold,
    visit_threshold,
    visit_min_spend,
    accent_color,
    gradient_from,
    gradient_to,
    badge_icon,
    theme_key,
    perks
  )
)
insert into public.membership_tiers (
  org_id,
  code,
  name,
  description,
  sort_order,
  spending_threshold,
  visit_threshold,
  visit_min_spend,
  accent_color,
  gradient_from,
  gradient_to,
  badge_icon,
  theme_key,
  perks,
  is_active
)
select
  seed_tiers.org_id,
  seed_tiers.code,
  seed_tiers.name,
  seed_tiers.description,
  seed_tiers.sort_order,
  seed_tiers.spending_threshold,
  seed_tiers.visit_threshold,
  seed_tiers.visit_min_spend,
  seed_tiers.accent_color,
  seed_tiers.gradient_from,
  seed_tiers.gradient_to,
  seed_tiers.badge_icon,
  seed_tiers.theme_key,
  seed_tiers.perks,
  true
from seed_tiers
on conflict (org_id, code) do update
set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  spending_threshold = excluded.spending_threshold,
  visit_threshold = excluded.visit_threshold,
  visit_min_spend = excluded.visit_min_spend,
  accent_color = excluded.accent_color,
  gradient_from = excluded.gradient_from,
  gradient_to = excluded.gradient_to,
  badge_icon = excluded.badge_icon,
  theme_key = excluded.theme_key,
  perks = excluded.perks,
  is_active = true;

commit;
