# DESIGN

## Landing Direction
- Tone: premium, calm, editorial, already-polished rather than flashy.
- Promise: “ít cuộn, nhiều tín hiệu”, mọi section mới phải giúp người dùng quyết định nhanh hơn.
- Emotional axis: tinh tế, đáng tin, mềm nhưng không mơ hồ.

## Typography
- Display serif: `Cormorant Garamond`
- UI sans: `Montserrat`
- Rule: serif dùng cho tiêu đề, category moments, luxury emphasis; sans dùng cho navigation, metadata, form, CTA.
- Avoid: đổi sang font system khác, trộn thêm family mới cho landing.

## Color Language
- Base background: warm ivory / champagne.
- Text: deep espresso, không dùng đen tuyệt đối.
- Accent: soft gold, chỉ dùng cho emphasis, divider, badge, hover.
- Support: blush neutrals, smoke beige.

## Section Behavior
- `Hero`: giữ mạnh, thoáng, không thêm nhiễu.
- `Storefront`: như editorial snapshot, có highlight chips + social proof + offer card.
- `Home-feed`: card phải giống “bài đáng đọc”, không giống dashboard.
- `Products & Services`: 1 khối offer + 1 khối product grid để tránh kéo dài.
- `Testimonials`: mềm, giàu khoảng trắng, đọc nhanh.
- `Map`: thực dụng nhưng vẫn cùng mood vật liệu và bo góc.

## Interaction
- Hover chỉ nâng nhẹ, không rung lắc hoặc glow mạnh.
- Motion nhanh, sạch, dưới ~220ms.
- CTA luôn rõ ràng, số lượng hạn chế.

## Auth UX
- Mặc định là khách hàng.
- Không để khách hàng phải hiểu role.
- “Mã mời nhân sự” chỉ xuất hiện như một nhánh nội bộ, kích hoạt bằng link phụ kín đáo.

## SEO + Performance
- `home-feed` phải render sẵn từ server.
- Story detail là trang độc lập, indexable.
- Dùng semantic HTML + JSON-LD gọn.
- Ưu tiên `loading="lazy"` cho ảnh dưới fold.
