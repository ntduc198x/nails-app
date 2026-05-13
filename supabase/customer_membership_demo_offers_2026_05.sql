begin;

with org_source as (
  select id as org_id
  from public.orgs
), seeded_offers as (
  select
    org_source.org_id,
    offer.title,
    offer.description,
    offer.badge,
    offer.starts_at,
    offer.ends_at,
    offer.is_active,
    offer.offer_metadata
  from org_source
  cross join (
    values
      (
        'Add-on mini cho thành viên',
        'Tặng 1 add-on mini khi sử dụng dịch vụ đủ điều kiện tại cửa hàng.',
        'Member demo',
        now() - interval '1 day',
        now() + interval '90 day',
        true,
        jsonb_build_object(
          'code', 'MEMMINI',
          'usageHint', 'Báo mã MEMMINI khi đặt lịch hoặc trước lúc thanh toán để cửa hàng áp dụng.',
          'redeemLabel', 'Gợi ý dùng: phù hợp cho khách mới hoặc thành viên thường muốn thử quyền lợi đầu tiên.',
          'bookingCtaLabel', 'Đặt lịch với mã này'
        )
      ),
      (
        'Voucher dịch vụ 50.000đ',
        'Giảm 50.000đ cho một dịch vụ được áp dụng trong khung ưu đãi hiện hành.',
        'Voucher demo',
        now() - interval '1 day',
        now() + interval '90 day',
        true,
        jsonb_build_object(
          'code', 'MEM50K',
          'usageHint', 'Báo mã MEM50K cho cửa hàng khi đặt lịch hoặc đến sử dụng dịch vụ.',
          'redeemLabel', 'Gợi ý dùng: ưu đãi kích cầu quay lại, dễ hiểu và dễ áp dụng tại quầy.',
          'bookingCtaLabel', 'Dùng mã này khi đặt lịch'
        )
      ),
      (
        'Đổi 500 điểm lấy add-on',
        'Demo rule hướng B: 500 điểm có thể đổi 1 add-on tiêu chuẩn theo danh mục cửa hàng.',
        'Điểm đổi quà',
        now() - interval '1 day',
        now() + interval '90 day',
        true,
        jsonb_build_object(
          'code', 'POINT500',
          'usageHint', 'Khách báo muốn đổi 500 điểm với mã POINT500, cửa hàng xác nhận rồi áp dụng add-on phù hợp.',
          'redeemLabel', 'Demo hướng B: điểm đổi quà / voucher / add-on, không quy trực tiếp ra tiền mặt.',
          'bookingCtaLabel', 'Đặt lịch để dùng đổi điểm'
        )
      )
  ) as offer(title, description, badge, starts_at, ends_at, is_active, offer_metadata)
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
  seeded_offers.org_id,
  seeded_offers.title,
  seeded_offers.description,
  null,
  seeded_offers.badge,
  seeded_offers.starts_at,
  seeded_offers.ends_at,
  seeded_offers.is_active,
  seeded_offers.offer_metadata
from seeded_offers
where not exists (
  select 1
  from public.marketing_offers existing
  where existing.org_id = seeded_offers.org_id
    and existing.title = seeded_offers.title
);

commit;
