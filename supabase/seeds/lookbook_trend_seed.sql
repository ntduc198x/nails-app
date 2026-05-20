-- Seed / refresh curated lookbook trend items for landing page
-- Usage: run in Supabase SQL editor after deploy.sql

begin;

with target_org as (
  select id from public.orgs order by created_at asc limit 1
), lookbook_samples(name, short_description, duration_min, base_price, vat_rate, image_url) as (
  values
    ('Mẫu Clean Nude Hàn', 'Tone nude sữa trong trẻo, hợp công sở và đi chơi hằng ngày.', 75, 219000, 0.10, 'https://images.unsplash.com/photo-1604654894610-df63bc536371?q=80&w=1200'),
    ('Mẫu Cat Eye Khói', 'Hiệu ứng mắt mèo ánh khói sang tay, nổi bật dưới ánh đèn.', 90, 259000, 0.10, 'https://images.unsplash.com/photo-1607779097040-26e80aa78e66?q=80&w=1200'),
    ('Mẫu French Chrome', 'French đầu móng kết hợp ánh chrome tối giản, thanh lịch và hiện đại.', 85, 249000, 0.10, 'https://images.unsplash.com/photo-1519014816548-bf5fe059798b?q=80&w=1200'),
    ('Mẫu Cherry Red Gloss', 'Đỏ cherry bóng gương, tôn da và cực hợp mùa lễ hội.', 75, 229000, 0.10, 'https://images.unsplash.com/photo-1522337660859-02fbefca4702?q=80&w=1200'),
    ('Mẫu Mocha Glazed', 'Sắc nâu sữa phủ glaze nhẹ, sang nhưng không phô.', 80, 239000, 0.10, 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?q=80&w=1200'),
    ('Mẫu Charm Hàn Sang', 'Thiết kế đính charm nhỏ gọn, hợp chụp ảnh và đi tiệc.', 95, 289000, 0.10, 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=1200')
), upsert_existing as (
  update public.services s
  set
    short_description = l.short_description,
    duration_min = l.duration_min,
    base_price = l.base_price,
    vat_rate = l.vat_rate,
    image_url = l.image_url,
    featured_in_lookbook = true,
    active = true
  from lookbook_samples l, target_org o
  where s.org_id = o.id
    and s.name = l.name
  returning s.name
)
insert into public.services (
  org_id,
  name,
  short_description,
  duration_min,
  base_price,
  vat_rate,
  image_url,
  featured_in_lookbook,
  active
)
select
  o.id,
  l.name,
  l.short_description,
  l.duration_min,
  l.base_price,
  l.vat_rate,
  l.image_url,
  true,
  true
from lookbook_samples l
cross join target_org o
left join upsert_existing u on u.name = l.name
where u.name is null;

commit;
