-- Seed + query dữ liệu section "Sản phẩm" theo mockup Cham Beauty.
-- Chạy trên Supabase/Postgres sau khi đã có ít nhất 1 storefront_profile đang active.

with active_storefront as (
  select sp.id as storefront_id, sp.org_id
  from public.storefront_profile sp
  where sp.is_active = true
  order by sp.updated_at desc nulls last, sp.created_at desc nulls last
  limit 1
),
payload(name, subtitle, price_label, image_url, product_type, display_order, is_featured) as (
  values
    (
      'Dầu Dưỡng Móng Cham',
      'Dưỡng ẩm - Bóng khỏe - Hương nhẹ',
      '200.000đ',
      'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=1200&q=80',
      'care',
      1,
      true
    ),
    (
      'Sơn Gel Premium',
      'Bền màu - Lên form chuẩn - An toàn',
      '280.000đ',
      'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1200&q=80',
      'gel',
      2,
      true
    ),
    (
      'Base Gel Cham',
      'Bảo vệ nền móng - Tăng độ bám',
      '250.000đ',
      'https://images.unsplash.com/photo-1607779097040-26e80aa78e66?auto=format&fit=crop&w=1200&q=80',
      'gel',
      3,
      true
    ),
    (
      'Top Gel No-Wipe Cham',
      'Bóng đẹp - Không lưu gel - Siêu bền',
      '270.000đ',
      'https://images.unsplash.com/photo-1519014816548-bf5fe059798b?auto=format&fit=crop&w=1200&q=80',
      'gel',
      4,
      true
    ),
    (
      'Bộ Cọ Nail Art',
      'Bộ cọ chuẩn salon cho vẽ nét và đắp gel',
      '180.000đ',
      'https://images.unsplash.com/photo-1631730486782-d8b6a16f5c44?auto=format&fit=crop&w=1200&q=80',
      'tool',
      5,
      true
    ),
    (
      'Dũa Móng Cao Cấp',
      'Êm tay - Chuẩn form - Dịu với móng',
      '120.000đ',
      'https://images.unsplash.com/photo-1612817288484-6f916006741a?auto=format&fit=crop&w=1200&q=80',
      'tool',
      6,
      true
    ),
    (
      'Kem Dưỡng Tay',
      'Mềm da - Giữ ẩm - Hương thanh',
      '150.000đ',
      'https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=1200&q=80',
      'care',
      7,
      true
    ),
    (
      'Cây Đẩy Da',
      'Chuẩn salon - Bền chắc - Dễ thao tác',
      '120.000đ',
      'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=1200&q=80',
      'tool',
      8,
      true
    )
),
updated as (
  update public.storefront_products sp
  set
    subtitle = p.subtitle,
    price_label = p.price_label,
    image_url = p.image_url,
    product_type = p.product_type,
    display_order = p.display_order,
    is_featured = p.is_featured,
    is_active = true,
    updated_at = now()
  from active_storefront s
  join payload p on true
  where sp.storefront_id = s.storefront_id
    and sp.name = p.name
  returning sp.name
)
insert into public.storefront_products (
  org_id,
  storefront_id,
  name,
  subtitle,
  price_label,
  image_url,
  product_type,
  display_order,
  is_active,
  is_featured
)
select
  s.org_id,
  s.storefront_id,
  p.name,
  p.subtitle,
  p.price_label,
  p.image_url,
  p.product_type,
  p.display_order,
  true,
  p.is_featured
from active_storefront s
join payload p on true
where not exists (
  select 1
  from public.storefront_products sp
  where sp.storefront_id = s.storefront_id
    and sp.name = p.name
);

select
  id, name, subtitle, price_label, image_url,
  product_type, is_featured, display_order
from public.storefront_products
where storefront_id = (
  select sp.id
  from public.storefront_profile sp
  where sp.is_active = true
  order by sp.updated_at desc nulls last, sp.created_at desc nulls last
  limit 1
)
and is_active = true
order by display_order asc, created_at asc;
