# REPOSITORY SUMMARY - NAILS APP

Tài liệu này là bản tóm tắt kỹ thuật dành cho dev mới vào repo. Mục tiêu là giúp đọc nhanh để hiểu:

- repo này gồm những phần nào;
- mỗi app chạy theo runtime gì;
- auth, session, org/branch binding hoạt động ra sao;
- dữ liệu customer/admin đi qua những lớp nào;
- các subsystem lớn cần chú ý khi sửa code.

## 1. Tổng quan

### 1.1 Bản chất project

- **Tên project**: Nails App
- **Loại repo**: monorepo
- **Domain sản phẩm**: quản lý salon nail / beauty studio
- **Hai mặt ứng dụng chính**:
  - **customer-facing**: landing, lookbook, explore, offers, booking
  - **internal operations**: lịch hẹn, checkout, CRM, shifts, reports, team, tax books
- **Backend chính**: Supabase
  - PostgreSQL
  - Auth
  - Realtime
  - Storage
  - RPC + RLS
- **Kênh vận hành bổ sung**: Telegram bot cho thông báo và thao tác quản trị nhanh

### 1.2 Cấu trúc thư mục chính

```text
nails-app/
  apps/
    web/                  # Next.js web app
    mobile/               # Expo / React Native mobile app
  packages/
    shared/               # shared contracts + helpers dùng chung
  supabase/               # bootstrap SQL, patches, schema/runtime fixes
  scripts/                # root runner scripts cho web/mobile
  artifacts/              # debug artifacts, screenshots, emulator output
  tmp/                    # local temp output, logs, bundle exports
  package.json            # workspace orchestrator
```

### 1.3 Điểm cần nhớ ngay

- Root `package.json` **không chứa app logic**. Nó chỉ điều phối workspaces và scripts.
- `apps/web` là web app production-facing cho landing + admin web.
- `apps/mobile` là mobile app có cả customer shell và admin shell.
- `packages/shared` là **contract layer** giữa web, mobile, và business logic Supabase-facing, không chỉ là “shared types”.
- `supabase/bootstrap.sql` là entry SQL chuẩn cho project mới.

## 2. Stack thực tế

### 2.1 Root workspace

- Workspaces: `apps/*`, `packages/*`
- Root scripts:
  - `npm run dev`
  - `npm run build`
  - `npm run start`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run mobile:*`

### 2.2 Web app

Theo [apps/web/package.json](/D:/Code/nails-app/apps/web/package.json):

- **Next.js**: `16.2.3`
- **React**: `19.1.0`
- **TypeScript**: `5.9.3`
- **Supabase JS**: `@supabase/supabase-js`
- **Styling/tooling**:
  - global CSS
  - class-based UI styles
  - Tailwind CSS v4 hiện diện trong toolchain
  - PostCSS
- **Một số thư viện nghiệp vụ/UI**:
  - `html2canvas`
  - `jspdf`
  - `jspdf-autotable`
  - `xlsx`
  - `zod`

### 2.3 Mobile app

Theo [apps/mobile/package.json](/D:/Code/nails-app/apps/mobile/package.json):

- **Expo SDK**: `54`
- **React Native**: `0.81.5`
- **Expo Router**: `6.0.23`
- **React**: `19.1.0`
- **Storage/auth support**:
  - `@react-native-async-storage/async-storage`
  - `expo-secure-store`
  - `expo-web-browser`
  - `expo-apple-authentication`
- **Media/UI**:
  - `expo-image`
  - `expo-image-picker`
  - `expo-linear-gradient`
  - `expo-status-bar`

### 2.4 Shared package

Theo [packages/shared/package.json](/D:/Code/nails-app/packages/shared/package.json):

- package internal: `@nails/shared`
- dependency chính: `zod`
- export trực tiếp từ `src/index.ts`

## 3. Kiến trúc runtime

## 3.1 Web runtime

### Entry và layout

- Root layout thật là [apps/web/src/app/layout.tsx](/D:/Code/nails-app/apps/web/src/app/layout.tsx)
  - cấu hình metadata
  - fonts
  - Open Graph / Twitter card
  - canonical site
  - brand/domain `https://chambeauty.io.vn`

### Landing flow

- Landing page là [apps/web/src/app/page.tsx](/D:/Code/nails-app/apps/web/src/app/page.tsx)
- Trang này:
  - gọi `getLandingPagePayload()` từ [apps/web/src/lib/landing-content.ts](/D:/Code/nails-app/apps/web/src/lib/landing-content.ts)
  - build `homeFeed` + `explore`
  - inject JSON-LD cho salon + blog-like content
  - render `LandingPageClient`

### Manage flow

- `/manage` không phải dashboard cuối cùng.
- [apps/web/src/app/manage/page.tsx](/D:/Code/nails-app/apps/web/src/app/manage/page.tsx) chỉ:
  - resolve role hiện tại
  - redirect theo role qua `getDefaultManageHref()` trong [apps/web/src/lib/manage-landing-auth.ts](/D:/Code/nails-app/apps/web/src/lib/manage-landing-auth.ts)

Mapping hiện tại:

- `OWNER`, `PARTNER`, `MANAGER` -> `/manage/landing`
- `ACCOUNTANT` -> `/manage/checkout`
- `RECEPTION` -> `/manage/services`
- `TECH` -> `/manage/appointments`

### Supabase clients trên web

[apps/web/src/lib/supabase.ts](/D:/Code/nails-app/apps/web/src/lib/supabase.ts) định nghĩa:

- `supabase`: client thường cho browser/user flow
- `createServiceRoleClient()`: client service-role cho server-side/API access

Điều này quan trọng vì web đang dùng cả:

- **user-scoped access**
- **service-role scoped access**

## 3.2 Mobile runtime

### Root layout

- Root layout là [apps/mobile/app/_layout.tsx](/D:/Code/nails-app/apps/mobile/app/_layout.tsx)
- Toàn bộ app được bọc trong `SessionProvider`
- Sau đó mount Expo Router `Stack`

### App gate

- [apps/mobile/app/index.tsx](/D:/Code/nails-app/apps/mobile/app/index.tsx) là runtime gate chính
- Logic:
  - nếu session chưa hydrate -> loading
  - nếu session lỗi -> redirect `/\(auth\)/sign-in`
  - nếu role là customer -> vào `/(customer)`
  - còn lại -> vào `/(admin)`

### Customer shell

- Layout chính: [apps/mobile/app/(customer)/_layout.tsx](/D:/Code/nails-app/apps/mobile/app/(customer)/_layout.tsx)
- Có:
  - `CustomerPreferencesProvider`
  - theme động
  - `StatusBar` theo color scheme
  - `CustomerRenderBoundary` để giữ fallback UI nếu customer tree lỗi

### Admin shell

- Layout chính: [apps/mobile/app/(admin)/_layout.tsx](/D:/Code/nails-app/apps/mobile/app/(admin)/_layout.tsx)
- Dùng Expo Router `Tabs` nhưng:
  - ẩn tab bar
  - dùng tabs như internal route container

### Route groups quan trọng

- `/(auth)`:
  - sign-in
  - signup/reset flow
  - auth callback
- `/(customer)`:
  - home feed
  - explore
  - booking
  - membership
  - history
  - settings/profile
- `/(admin)`:
  - overview
  - queue
  - booking
  - scheduling
  - checkout
  - shifts
  - manage-content
  - manage-customers
  - manage-services
  - manage-resources
  - manage-team
  - manage-tax-books
  - reports

## 4. Auth, session, và org binding

## 4.1 Không chỉ dùng Supabase Auth mặc định

Repo này có **2 lớp session**:

1. **Supabase Auth session**
2. **App session nội bộ của project**

App session được dùng để:

- ràng buộc theo device
- validate user switching/session replacement
- heartbeat online user
- revoke session có chủ đích

## 4.2 Web auth/session model

File chính: [apps/web/src/lib/app-session.ts](/D:/Code/nails-app/apps/web/src/lib/app-session.ts)

Web:

- lưu app session token ở `localStorage`
- gọi RPC:
  - `create_app_session`
  - `validate_app_session`
  - `heartbeat_online_user`
  - `revoke_app_session`
- có recovery path nếu refresh token Supabase bị invalid:
  - clear local app token
  - clear cached auth state
  - sign out local Supabase browser session

Google auth callback web:

- route: [apps/web/src/app/auth/callback/page.tsx](/D:/Code/nails-app/apps/web/src/app/auth/callback/page.tsx)
- dùng `completeGoogleAuthFromCode()`

## 4.3 Mobile auth/session model

Files chính:

- [apps/mobile/src/providers/session-provider.tsx](/D:/Code/nails-app/apps/mobile/src/providers/session-provider.tsx)
- [apps/mobile/src/lib/supabase.ts](/D:/Code/nails-app/apps/mobile/src/lib/supabase.ts)
- [apps/mobile/src/lib/app-session.ts](/D:/Code/nails-app/apps/mobile/src/lib/app-session.ts)

Mobile:

- dùng `safeStorage` để persist Supabase auth session
- tạo app session theo:
  - `deviceFingerprint`
  - `deviceInfo`
- lưu app session token riêng
- validate token khi boot app
- có fallback “basic app session” khi RPC/schema chưa sẵn sàng

Mobile auth methods:

- email/password
- Google OAuth
- Apple Sign-In

Mobile callback path:

- `auth/callback`
- screen loading ở [apps/mobile/app/auth/callback.tsx](/D:/Code/nails-app/apps/mobile/app/auth/callback.tsx)

## 4.4 Org/branch binding

Điểm trung tâm ở web là [apps/web/src/lib/domain.ts](/D:/Code/nails-app/apps/web/src/lib/domain.ts)

`ensureOrgContext()` làm các việc:

- lấy `org_id` và `default_branch_id` từ `profiles`
- fallback qua `user_roles` nếu cần
- tự vá `profiles` nếu user có auth session nhưng profile chưa đủ dữ liệu
- cache context theo session

Ý nghĩa:

- đa số business logic nội bộ đều phải đi qua `ensureOrgContext()`
- gần như mọi query internal đều scoped theo `org_id`

Trong shared layer, [packages/shared/src/session.ts](/D:/Code/nails-app/packages/shared/src/session.ts) còn có:

- `ensureCurrentUserProfile()`
- `getAuthenticatedUserSummary()`
- `createAppSessionWithDevice()`
- `validateAppSessionToken()`
- `consumeInviteCodeWithClient()`

=> auth/session/org binding là concern dùng chung cho cả web và mobile, không phải logic riêng của từng app.

## 4.5 Role model

Web role resolution nằm ở [apps/web/src/lib/auth.ts](/D:/Code/nails-app/apps/web/src/lib/auth.ts)

Priority hiện tại:

`OWNER > PARTNER > MANAGER > RECEPTION > ACCOUNTANT > TECH > USER`

Lưu ý:

- user nội bộ salon dùng `user_roles`
- customer flow có thể bị ép role về `USER`
- nếu role chưa tồn tại, hệ thống có thể bootstrap role phù hợp theo org hiện tại

## 5. Shared package: contract layer

`packages/shared` là lớp contract chung giữa:

- web API
- mobile hooks
- business logic
- Supabase-facing operations

### 5.1 Những module quan trọng

- `auth.ts`
- `session.ts`
- `org.ts`
- `roles.ts`
- `validation.ts`
- `booking.ts`
- `appointments.ts`
- `checkout.ts`
- `dashboard.ts`
- `crm.ts`
- `reporting.ts`
- `services.ts`
- `resources.ts`
- `team.ts`
- `tax-books.ts`
- `customer-feed.ts`
- `customer-explore.ts`
- `customer-personalization.ts`
- `admin-content.ts`
- `auto-schedule.ts`

### 5.2 Contracts customer-facing đáng chú ý

Trong [packages/shared/src/customer-feed.ts](/D:/Code/nails-app/packages/shared/src/customer-feed.ts):

- `LookbookItem`
- `CustomerContentPost`
- `MarketingOfferCard`
- `normalizeLookbookRows()`

Trong [packages/shared/src/customer-explore.ts](/D:/Code/nails-app/packages/shared/src/customer-explore.ts):

- `ExploreStorefront`
- `ExploreProduct`
- `ExploreTeamMember`
- `ExploreGalleryItem`
- `ExploreMapCard`
- `CustomerExplorePayload`
- `buildExploreStats()`

Trong [packages/shared/src/session.ts](/D:/Code/nails-app/packages/shared/src/session.ts):

- `AuthenticatedUserSummary`
- `AppSessionResult`
- `AppSessionValidation`
- `InviteCodeConsumptionResult`

## 6. Customer-facing data flow

## 6.1 Landing/home/explore data model

Landing web và customer mobile đang dùng cùng domain model:

- lookbook services
- content posts
- marketing offers
- storefront profile
- products
- team members
- gallery
- map card

Nguồn tổng hợp nằm ở [apps/web/src/lib/landing-content.ts](/D:/Code/nails-app/apps/web/src/lib/landing-content.ts)

File này đọc từ các bảng:

- `services`
- `customer_content_posts`
- `marketing_offers`
- `storefront_profile`
- `storefront_products`
- `storefront_team_members`
- `storefront_gallery`

## 6.2 Customer API surface

Hai API chính:

- [apps/web/src/app/api/customer/home-feed/route.ts](/D:/Code/nails-app/apps/web/src/app/api/customer/home-feed/route.ts)
- [apps/web/src/app/api/customer/explore/route.ts](/D:/Code/nails-app/apps/web/src/app/api/customer/explore/route.ts)

Pattern chung:

1. đọc bearer token
2. xác thực user qua Supabase
3. resolve customer scope
4. trả payload typed từ `@nails/shared`

Nghĩa là web API đang đóng vai trò **scoped façade** cho customer/mobile clients.

## 6.3 Mobile customer fetch model

File đại diện: [apps/mobile/src/hooks/use-customer-home-feed.ts](/D:/Code/nails-app/apps/mobile/src/hooks/use-customer-home-feed.ts)

Thứ tự ưu tiên:

1. gọi web API `GET /api/customer/home-feed` bằng bearer token
2. nếu fail thì fallback query trực tiếp qua shared helpers + Supabase
3. hydrate cache cục bộ
4. prefetch ảnh cho card rendering

Đây là mô hình **hybrid fetch**:

- tuyến chuẩn: web API
- fallback: direct Supabase

Lợi ích:

- mobile vẫn chạy được khi web API unavailable nhưng auth/supabase còn ổn
- giảm cảm giác trắng dữ liệu khi network/path có lỗi cục bộ

## 7. Admin / operations data flow

## 7.1 Booking request flow

Public booking request đi qua:

- [apps/web/src/app/api/booking-request/route.ts](/D:/Code/nails-app/apps/web/src/app/api/booking-request/route.ts)

Flow:

1. nhận payload booking từ landing/public
2. gọi RPC `create_booking_request_public`
3. nếu tạo thành công:
  - notify nội bộ sang `/api/telegram`
  - rebalance booking capacity theo `org_id`

## 7.2 Booking request domain logic

File chính: [apps/web/src/lib/booking-requests.ts](/D:/Code/nails-app/apps/web/src/lib/booking-requests.ts)

Lifecycle đang dùng:

- `NEW`
- `CONFIRMED`
- `NEEDS_RESCHEDULE`
- `CANCELLED`
- `CONVERTED`

File này xử lý:

- list/count booking requests
- patch request quá hạn sang `NEEDS_RESCHEDULE`
- update/delete
- check capacity
- convert booking request sang appointment qua RPC secure

## 7.3 Scheduling / appointments / checkout

Một phần lớn business logic nội bộ đang nằm trong [apps/web/src/lib/domain.ts](/D:/Code/nails-app/apps/web/src/lib/domain.ts)

Các nhóm nhiệm vụ chính:

- service CRUD
- resource CRUD
- appointment list/create/update
- overlap staff/resource
- checked-in / done / cancelled / no-show
- shift open-state check
- checkout / close ticket / receipt token
- recent tickets
- realtime subscriptions cho appointments

Mẫu chung:

1. `ensureOrgContext()`
2. query/RPC scoped theo `org_id`
3. invalidate cache nếu có mutation
4. realtime update nếu cần

## 8. Telegram subsystem

## 8.1 Đây là subsystem lớn, không chỉ là integration

File chính: [apps/web/src/lib/telegram-bot.ts](/D:/Code/nails-app/apps/web/src/lib/telegram-bot.ts)

Những thứ file này đang làm:

- wrappers cho Telegram Bot API
  - send message
  - edit message
  - delete message
  - answer callback query
- resolve Telegram user -> user nội bộ + role
- link code flow giữa Telegram account và app account
- booking detail / confirm / cancel / reschedule
- quick check-in
- quick-create appointment
- report doanh thu
- menu quản trị
- conversation state management
- reply panel state management
- file fallback nếu bảng conversation chưa sẵn sàng

=> Telegram hiện là **ops channel song song** với web/mobile admin.

## 8.2 Telegram webhook route

Booking notification route chính:

- [apps/web/src/app/api/telegram/route.ts](/D:/Code/nails-app/apps/web/src/app/api/telegram/route.ts)

Route này:

- đọc booking request đã tạo
- claim record để tránh double-processing
- tính overlap/capacity warning
- gửi message Telegram với action buttons
- ghi lại `telegram_message_id`, `telegram_chat_id`, `notified_at`

Ngoài route này còn có:

- `/api/telegram/callback`
- `/api/telegram/content`
- `/api/telegram/setup`
- `/api/telegram/notify`
- `/api/telegram/dev`
- `/api/telegram/daily-summary`
- `/api/telegram/appointments-overdue`

## 9. Supabase schema và patch strategy

## 9.1 File nền tảng

- [supabase/bootstrap.sql](/D:/Code/nails-app/supabase/bootstrap.sql)
  - canonical one-shot SQL cho project mới
- [supabase/deploy.sql](/D:/Code/nails-app/supabase/deploy.sql)
  - legacy core deploy script
- [supabase/README.md](/D:/Code/nails-app/supabase/README.md)
  - giải thích patch order và mục đích từng file

## 9.2 Các nhóm patch chính

Nhìn theo capability thay vì theo ngày:

- **auth / org bootstrap**
  - `fresh_project_patch.sql`
  - `auth_*`
  - `ensure_default_workspace_runtime_patch_*`
- **app / device sessions**
  - `app_sessions.sql`
- **CRM**
  - `crm_patch_2026_04.sql`
- **customer mobile schema/runtime**
  - `customer_mobile_schema_2026_04.sql`
  - `customer_mobile_runtime_patch_2026_05.sql`
  - `customer_scope_repair_2026_05.sql`
- **content feed / storefront / lookbook**
  - `customer_content_feed_2026_04.sql`
  - `customer_explore_storefront_2026_04.sql`
  - `customer_lookbook_public_read_2026_04.sql`
  - `customer_lookbook_backfill_2026_05.sql`
  - `storefront_products_cham_mock_2026_05.sql`
- **shift planning / staff profiles / attendance**
  - `shift_plans_2026_04.sql`
  - `shift_attendance_requests_2026_04.sql`
  - `staff_shift_profiles_2026_04.sql`
  - `partner_branch_roles_shift_plans_2026_04.sql`
- **Telegram support / booking runtime**
  - `runtime_patch_2026_04_telegram_booking.sql`
  - `telegram_conversations.sql`
  - `telegram_links.sql`
  - `partner_invite_telegram_scope_patch_2026_05.sql`

## 9.3 Kiểu logic đang dùng nhiều

Repo này phụ thuộc nhiều vào:

- Supabase RPC
- RLS-aware queries
- profile/org binding
- runtime repair patches cho môi trường đã drift

Không nên nhìn `supabase/` như thư mục “migrations thông thường” của ORM. Nó gần với:

- bootstrap scripts
- capability patches
- runtime compatibility fixes

## 10. Scripts và môi trường chạy

## 10.1 Root scripts quan trọng

- `npm run dev` -> chạy web
- `npm run build` -> build web
- `npm run start` -> start web
- `npm run lint` -> lint web + mobile
- `npm run typecheck` -> typecheck web + mobile

## 10.2 Web scripts

- `npm run web:dev`
- `npm run web:build`
- `npm run web:start`
- `npm run web:lint`
- `npm run web:typecheck`

## 10.3 Mobile scripts

- `npm run mobile:start`
- `npm run mobile:go:lan`
- `npm run mobile:go`
- `npm run mobile:go:cloudflare`
- `npm run mobile:android`
- `npm run mobile:ios`
- `npm run mobile:config`
- `npm run mobile:doctor`
- `npm run mobile:typecheck`

## 10.4 Môi trường mobile

Theo [apps/mobile/src/lib/env.ts](/D:/Code/nails-app/apps/mobile/src/lib/env.ts), mobile env hiện đọc:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_PASSWORD_RESET_URL`
- `EXPO_PUBLIC_DEFAULT_ORG_ID`
- `EXPO_PUBLIC_DEFAULT_BRANCH_ID`

Điều này xác nhận mobile có thể:

- gọi trực tiếp Supabase
- gọi web API qua `apiBaseUrl`
- fallback guest/customer scope theo default org/branch nếu được cấu hình

## 11. Repo hygiene và lưu ý cho dev

## 11.1 Những thư mục không phải source chính

- `artifacts/`
  - emulator screenshots
  - XML UI dumps
  - metro/debug output
- `tmp/`
  - temp logs
  - exported bundles
  - screenshots

Hai thư mục này là **debug/dev artifacts**, không phải source kiến trúc chính.

## 11.2 Những lưu ý nên nhớ khi sửa code

- Đừng sửa summary cũ theo kiểu chỉ thêm tên file; ưu tiên mô tả behavior và data flow.
- Khi sửa internal business logic web, gần như luôn phải kiểm tra:
  - `ensureOrgContext()`
  - role hiện tại
  - query có còn đúng `org_id` / `branch_id` không
- Khi sửa mobile auth/session, phải kiểm tra cả:
  - Supabase auth session
  - app session token riêng
  - callback flow
  - fallback khi RPC/schema chưa sẵn sàng
- Khi sửa customer feed/explore, cần nhớ:
  - web landing và mobile customer đang dùng cùng domain contracts
  - mobile có web API path và direct Supabase fallback path
- Khi sửa Telegram, cần coi đây là subsystem nghiệp vụ thật sự, không phải chỉ notification utility.

## 12. TL;DR cho dev mới

- Đây là monorepo salon-management gồm **web admin + mobile customer/admin + shared contracts + Supabase SQL**.
- Web dùng Next.js 16; mobile dùng Expo 54; cả hai đều dựa trên Supabase nhưng có thêm **app session layer riêng**.
- `packages/shared` là lớp contract và helper chung, rất quan trọng cho auth/session/customer payloads.
- `ensureOrgContext()` là chìa khóa cho hầu hết logic nội bộ.
- Customer data flow đang theo mô hình **hybrid fetch**: web API trước, direct Supabase fallback sau.
- Telegram là một channel vận hành thật, có logic booking/report/check-in riêng.
- `supabase/` chứa cả bootstrap, patch, runtime fixes, không chỉ migration tuần tự.

---

*Last updated: 2026-05-09*
