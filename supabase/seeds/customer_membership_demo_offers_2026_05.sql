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
        'Quà chào mừng thành viên mới',
        'Tặng quà mini hoặc voucher nhẹ cho khách bắt đầu hành trình thành viên tại cửa hàng.',
        'Gói thành viên thường',
        now() - interval '1 day',
        now() + interval '120 day',
        true,
        jsonb_build_object(
          'code', 'REGWELCOME',
          'usageHint', 'Báo mã REGWELCOME khi đặt lịch đầu tiên hoặc trước khi thanh toán để cửa hàng áp dụng.',
          'redeemLabel', 'Ưu đãi khởi đầu dành riêng cho thành viên thường, tạo cảm giác được chào đón ngay từ lần đầu.',
          'bookingCtaLabel', 'Đặt lịch với mã này',
          'packageTier', 'REGULAR',
          'packageOrder', 1
        )
      ),
      (
        'Voucher 30.000đ cho thành viên thường',
        'Giảm 30.000đ cho dịch vụ phù hợp theo chính sách đang áp dụng tại cửa hàng.',
        'Gói thành viên thường',
        now() - interval '1 day',
        now() + interval '120 day',
        true,
        jsonb_build_object(
          'code', 'REG30K',
          'usageHint', 'Báo mã REG30K khi đặt lịch hoặc đến cửa hàng để được kiểm tra điều kiện áp dụng.',
          'redeemLabel', 'Ưu đãi cơ bản, dễ dùng, giúp khách mới có lý do quay lại sớm hơn.',
          'bookingCtaLabel', 'Dùng mã này khi đặt lịch',
          'packageTier', 'REGULAR',
          'packageOrder', 2
        )
      ),
      (
        'Add-on mini dành cho Bronze',
        'Tặng 1 add-on mini khi sử dụng dịch vụ đủ điều kiện trong thời gian ưu đãi.',
        'Gói Bronze',
        now() - interval '1 day',
        now() + interval '120 day',
        true,
        jsonb_build_object(
          'code', 'BRONZEMINI',
          'usageHint', 'Báo mã BRONZEMINI khi đặt lịch hoặc trước lúc thanh toán để cửa hàng áp dụng add-on phù hợp.',
          'redeemLabel', 'Ưu đãi đầu tiên khi lên Bronze, đủ khác để khách cảm thấy đã bắt đầu có đặc quyền.',
          'bookingCtaLabel', 'Đặt lịch với mã Bronze',
          'packageTier', 'BRONZE',
          'packageOrder', 1
        )
      ),
      (
        'Voucher 50.000đ cho Bronze',
        'Giảm 50.000đ cho dịch vụ theo điều kiện áp dụng hiện hành.',
        'Gói Bronze',
        now() - interval '1 day',
        now() + interval '120 day',
        true,
        jsonb_build_object(
          'code', 'BRONZE50K',
          'usageHint', 'Báo mã BRONZE50K khi đặt lịch hoặc trước lúc checkout để cửa hàng xác nhận ưu đãi.',
          'redeemLabel', 'Bronze nên có ưu đãi đủ rõ để khách muốn giữ nhịp quay lại và tích lũy tiếp.',
          'bookingCtaLabel', 'Dùng ưu đãi Bronze',
          'packageTier', 'BRONZE',
          'packageOrder', 2
        )
      ),
      (
        'Đổi 500 điểm lấy add-on',
        'Dùng 500 điểm để đổi 1 add-on tiêu chuẩn theo danh mục cửa hàng.',
        'Gói Silver',
        now() - interval '1 day',
        now() + interval '120 day',
        true,
        jsonb_build_object(
          'code', 'SILVER500',
          'usageHint', 'Báo mã SILVER500 khi muốn đổi 500 điểm sang add-on tại quầy hoặc lúc đặt lịch.',
          'redeemLabel', 'Silver bắt đầu chạm vào cơ chế đổi điểm thật, tạo cảm giác tích lũy có ý nghĩa hơn.',
          'bookingCtaLabel', 'Đặt lịch để dùng điểm',
          'packageTier', 'SILVER',
          'packageOrder', 1
        )
      ),
      (
        'Voucher 80.000đ cho Silver',
        'Giảm 80.000đ cho dịch vụ hoặc combo phù hợp theo chiến dịch đang bật.',
        'Gói Silver',
        now() - interval '1 day',
        now() + interval '120 day',
        true,
        jsonb_build_object(
          'code', 'SILVER80K',
          'usageHint', 'Báo mã SILVER80K khi đặt lịch để cửa hàng xác nhận khung áp dụng.',
          'redeemLabel', 'Silver cần đủ hấp dẫn để khách thấy lên hạng đã bắt đầu có lợi rõ rệt.',
          'bookingCtaLabel', 'Dùng ưu đãi Silver',
          'packageTier', 'SILVER',
          'packageOrder', 2
        )
      ),
      (
        'Ưu đãi signature cho Gold',
        'Mở khóa giá tốt hơn cho dịch vụ signature hoặc set hot theo danh sách áp dụng.',
        'Gói Gold',
        now() - interval '1 day',
        now() + interval '120 day',
        true,
        jsonb_build_object(
          'code', 'GOLDSIGN',
          'usageHint', 'Báo mã GOLDSIGN khi chọn dịch vụ signature để cửa hàng áp dụng đúng quyền lợi.',
          'redeemLabel', 'Gold nên mang cảm giác khách thân thiết thật sự với quyền lợi mà các hạng dưới chưa có.',
          'bookingCtaLabel', 'Đặt lịch với ưu đãi Gold',
          'packageTier', 'GOLD',
          'packageOrder', 1
        )
      ),
      (
        'Quà sinh nhật nâng cấp cho Gold',
        'Khách Gold được nhận quà sinh nhật hoặc quà kèm booking với mức tốt hơn gói dưới.',
        'Gói Gold',
        now() - interval '1 day',
        now() + interval '120 day',
        true,
        jsonb_build_object(
          'code', 'GOLDBDAY',
          'usageHint', 'Dùng mã GOLDBDAY trong tháng sinh nhật hoặc theo rule cửa hàng để nhận quà phù hợp.',
          'redeemLabel', 'Gold nên có một ưu đãi đủ tình cảm và đáng nhớ để tăng độ trung thành.',
          'bookingCtaLabel', 'Dùng quà Gold',
          'packageTier', 'GOLD',
          'packageOrder', 2
        )
      ),
      (
        'Add-on VIP định kỳ cho Platinum',
        'Tặng 1 add-on VIP định kỳ cho khách Platinum theo chu kỳ mà cửa hàng cấu hình.',
        'Gói Platinum',
        now() - interval '1 day',
        now() + interval '120 day',
        true,
        jsonb_build_object(
          'code', 'PLATVIP',
          'usageHint', 'Báo mã PLATVIP khi đặt lịch để cửa hàng kiểm tra chu kỳ và add-on phù hợp.',
          'redeemLabel', 'Platinum cần cảm giác được ưu tiên cao hơn, không chỉ là giảm giá đơn thuần.',
          'bookingCtaLabel', 'Đặt lịch với gói Platinum',
          'packageTier', 'PLATINUM',
          'packageOrder', 1
        )
      ),
      (
        'Ưu tiên giữ lịch đẹp cho Platinum',
        'Khách Platinum được ưu tiên giữ slot đẹp khi còn khả dụng trong các khung giờ hot.',
        'Gói Platinum',
        now() - interval '1 day',
        now() + interval '120 day',
        true,
        jsonb_build_object(
          'code', 'PLATSLOT',
          'usageHint', 'Báo mã PLATSLOT khi đặt lịch để cửa hàng ưu tiên kiểm tra khung giờ phù hợp.',
          'redeemLabel', 'Đây là kiểu quyền lợi rất kích cầu vì khách sẽ thấy tiện hơn rõ rệt khi lên Platinum.',
          'bookingCtaLabel', 'Giữ lịch với Platinum',
          'packageTier', 'PLATINUM',
          'packageOrder', 2
        )
      ),
      (
        'Đặc quyền Diamond Signature',
        'Ưu đãi riêng cho dịch vụ premium hoặc launch mới chỉ dành cho Diamond.',
        'Gói Diamond',
        now() - interval '1 day',
        now() + interval '120 day',
        true,
        jsonb_build_object(
          'code', 'DIAMSIGN',
          'usageHint', 'Báo mã DIAMSIGN khi đặt lịch để cửa hàng mở đúng đặc quyền Diamond Signature.',
          'redeemLabel', 'Diamond phải có cảm giác VIP thật, ít nhưng chất và đủ khác biệt hoàn toàn với các hạng dưới.',
          'bookingCtaLabel', 'Đặt lịch với Diamond',
          'packageTier', 'DIAMOND',
          'packageOrder', 1
        )
      ),
      (
        'Quà tri ân cao cấp cho Diamond',
        'Quà tri ân cao cấp theo quý hoặc năm dành riêng cho khách Diamond đủ điều kiện.',
        'Gói Diamond',
        now() - interval '1 day',
        now() + interval '120 day',
        true,
        jsonb_build_object(
          'code', 'DIAMGIFT',
          'usageHint', 'Báo mã DIAMGIFT khi đặt lịch hoặc liên hệ cửa hàng để xác nhận quà tri ân đang áp dụng.',
          'redeemLabel', 'Diamond nên có một ưu đãi mang tính biểu tượng để khách cảm thấy mình thật sự được trân trọng.',
          'bookingCtaLabel', 'Dùng quà Diamond',
          'packageTier', 'DIAMOND',
          'packageOrder', 2
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
