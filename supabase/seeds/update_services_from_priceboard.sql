begin;

with target_org as (
  select id
  from public.orgs
  order by created_at asc nulls last, id asc
  limit 1
), desired_services(name, display_order, base_price) as (
  values
    ('Sửa da 40k', 1, 40000),
    ('Sơn gel cơ bản 100k', 2, 100000),
    ('Gel thạch 100k', 3, 100000),
    ('Combo sửa sơn gel + cứng móng tay 150k', 4, 150000),
    ('Combo sửa sơn gel chân 120k', 5, 120000),
    ('Nhũ 30k', 6, 30000),
    ('Nhũ 40k', 7, 40000),
    ('Mắt mèo 30k', 8, 30000),
    ('Mắt mèo 40k', 9, 40000),
    ('Nhũ flash 30k', 10, 30000),
    ('Nhũ flash 40k', 11, 40000),
    ('Tráng gương 30k', 12, 30000),
    ('Tráng gương 40k', 13, 40000),
    ('Mix màu 10k', 14, 10000),
    ('Mix màu 20k', 15, 20000),
    ('Cứng móng tạo cầu 30k', 16, 30000),
    ('Cứng móng tạo cầu 40k', 17, 40000),
    ('Cứng móng tạo cầu 50k', 18, 50000),
    ('Tháo gel mềm 20k', 19, 20000),
    ('Tháo gel cứng, bột 30k', 20, 30000),
    ('Tháo gel cứng, bột 40k', 21, 40000),
    ('Tháo gel cứng, bột 50k', 22, 50000),
    ('Tháo móng úp 30k', 23, 30000),
    ('Tháo móng úp 40k', 24, 40000),
    ('Tháo móng úp 50k', 25, 50000),
    ('BIAB 200k', 26, 200000),
    ('BIAB 210k', 27, 210000),
    ('BIAB 220k', 28, 220000),
    ('BIAB 230k', 29, 230000),
    ('BIAB 240k', 30, 240000),
    ('BIAB 250k', 31, 250000),
    ('Móng úp gel 100k', 32, 100000),
    ('Dual form 250k', 33, 250000),
    ('Đắp gel móng thật 150k', 34, 150000),
    ('Refill móng thật/giả 100k', 35, 100000),
    ('Vá móng 20k', 36, 20000),
    ('Mắt mèo lẻ 10k', 37, 10000),
    ('Tráng gương / ngón 10k', 38, 10000),
    ('Tráng gương vẽ nổi / ngón 10k', 39, 10000),
    ('Tráng gương vẽ nổi / ngón 15k', 40, 15000),
    ('Vẽ nổi / ngón 10k', 41, 10000),
    ('Vẽ nổi / ngón 20k', 42, 20000),
    ('Vẽ nổi / ngón 30k', 43, 30000),
    ('Vẽ nổi / ngón 40k', 44, 40000),
    ('Vẽ móng / ngón 10k', 45, 10000),
    ('Vẽ móng / ngón 20k', 46, 20000),
    ('Vẽ móng / ngón 30k', 47, 30000),
    ('Vẽ móng / ngón 40k', 48, 40000),
    ('Vẽ móng / ngón 50k', 49, 50000),
    ('Vẽ móng / ngón 60k', 50, 60000),
    ('Vẽ móng / ngón 70k', 51, 70000),
    ('Vẽ móng / ngón 80k', 52, 80000),
    ('Vẽ móng / ngón 90k', 53, 90000),
    ('Vẽ móng / ngón 100k', 54, 100000),
    ('Vẽ móng / ngón 110k', 55, 110000),
    ('Vẽ móng / ngón 120k', 56, 120000),
    ('Vẽ móng / ngón 130k', 57, 130000),
    ('Vẽ móng / ngón 140k', 58, 140000),
    ('Vẽ móng / ngón 150k', 59, 150000),
    ('Loang/Nuance / ngón 10k', 60, 10000),
    ('Loang/Nuance / ngón 20k', 61, 20000),
    ('Loang/Nuance / ngón 30k', 62, 30000),
    ('Loang/Nuance / ngón 40k', 63, 40000),
    ('Xà cừ / ngón 5k', 64, 5000),
    ('Xà cừ / ngón 10k', 65, 10000),
    ('Xà cừ / ngón 15k', 66, 15000),
    ('Xà cừ / ngón 20k', 67, 20000),
    ('Xà cừ / ngón 25k', 68, 25000),
    ('Xà cừ / ngón 30k', 69, 30000),
    ('Hoa khô / ngón 5k', 70, 5000),
    ('Hoa khô / ngón 10k', 71, 10000),
    ('Hoa khô / ngón 15k', 72, 15000),
    ('Hoa khô / ngón 20k', 73, 20000),
    ('Hoa khô / ngón 25k', 74, 25000),
    ('Hoa khô / ngón 30k', 75, 30000),
    ('Nhũ foil / ngón 5k', 76, 5000),
    ('Nhũ foil / ngón 10k', 77, 10000),
    ('Nhũ foil / ngón 15k', 78, 15000),
    ('Nhũ foil / ngón 20k', 79, 20000),
    ('Nhũ foil / ngón 25k', 80, 25000),
    ('Nhũ foil / ngón 30k', 81, 30000),
    ('Ombre / ngón 10k', 82, 10000),
    ('Ombre / ngón 15k', 83, 15000),
    ('Ombre / ngón 20k', 84, 20000),
    ('Ombre / ngón 25k', 85, 25000),
    ('Ombre che khuyết điểm / ngón 3k', 86, 3000),
    ('Đính đá 2.5k', 87, 2500),
    ('Đính đá 5k', 88, 5000),
    ('Đính đá 7.5k', 89, 7500),
    ('Đính đá 10k', 90, 10000),
    ('Đính đá khối 5k', 91, 5000),
    ('Đính đá khối 10k', 92, 10000),
    ('Đính đá khối 15k', 93, 15000),
    ('Đính đá khối 20k', 94, 20000),
    ('Đính đá khối 25k', 95, 25000),
    ('Đính charm 10k', 96, 10000),
    ('Đính charm 20k', 97, 20000),
    ('Đính charm 30k', 98, 30000),
    ('Đính charm 40k', 99, 40000),
    ('Đính charm 50k', 100, 50000),
    ('Charm khuôn 20k', 101, 20000),
    ('Charm khuôn 30k', 102, 30000),
    ('Charm khuôn 40k', 103, 40000),
    ('Phụ kiện kim loại 2.5k', 104, 2500),
    ('Phụ kiện kim loại 5k', 105, 5000),
    ('Phụ kiện kim loại 7.5k', 106, 7500),
    ('Phụ kiện kim loại 10k', 107, 10000),
    ('Sticker ẩn 5k', 108, 5000),
    ('Sticker ẩn 10k', 109, 10000)
), updated_existing as (
  update public.services s
  set
    short_description = 'Cập nhật từ menu CHAM BEAUTY',
    image_url = null,
    display_order = d.display_order,
    featured_in_lookbook = false,
    duration_min = 45,
    base_price = d.base_price,
    vat_rate = 0,
    active = true
  from desired_services d, target_org o
  where s.org_id = o.id
    and s.name = d.name
  returning s.name
), inserted_missing as (
  insert into public.services (
    org_id,
    name,
    short_description,
    image_url,
    display_order,
    featured_in_lookbook,
    duration_min,
    base_price,
    vat_rate,
    active
  )
  select
    o.id,
    d.name,
    'Cập nhật từ menu CHAM BEAUTY',
    null,
    d.display_order,
    false,
    45,
    d.base_price,
    0,
    true
  from desired_services d
  cross join target_org o
  left join public.services s
    on s.org_id = o.id
   and s.name = d.name
  where s.id is null
  returning name
)
update public.services s
set
  active = false,
  display_order = coalesce(s.display_order, 9999)
from target_org o
where s.org_id = o.id
  and s.name not in (select name from desired_services);

commit;
