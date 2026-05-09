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


## SUMMARY BỔ SUNG - NAILS APP

Đây là tài liệu bổ sung chi tiết cho REPOSITORY_SUMMARY.md hiện tại.

---

### 1. Cập nhật gần đây (2026-05-09)

#### 1.1 Avatar Upload System
- **Location**: `apps/mobile/src/features/admin/content-images.ts`
- **Format**: WebP (ưu tiên), JPEG fallback
- **Sizes**: 64px, 128px, 256px, 512px, 1024px
- **Quality**: 85-100% tùy size
- **Storage**: Supabase bucket `service-images`, folder `avatars`
- **Path**: `avatars/{timestamp}-{name}.webp`

#### 1.2 Role-based Access Control Updates
- **Mobile routing fix**: Non-OWNER/PARTNER roles không còn bị màn trắng
- **Redirect logic**:
  - OWNER/PARTNER → `/manage` (Landing Feed admin)
  - Others → `/shifts` (Lịch làm việc cá nhân)
- **Files changed**:
  - `apps/mobile/app/(admin)/index.tsx`
  - `apps/mobile/src/features/admin/manage-ui.tsx`
  - `apps/mobile/src/features/admin/navigation.ts`

#### 1.3 UI Fixes
- **Landing Feed**: Fixed layout shift (removed useFocusEffect)
- **Checkout**: Fixed screen jumping (removed useFocusEffect)
- **Scheduling**: Fixed safe-area overflow
- **Booking Request**: Fixed gap from top
- **Avatar Circle**: Fixed square frame issue with transparent background

---

### 2. Mobile App Structure Detail

#### 2.1 Route Groups
```
apps/mobile/app/
├── (admin)/              # Admin shell
│   ├── booking.tsx       # Landing Feed (manage-content.tsx)
│   ├── checkout.tsx      # Thu tiền
│   ├── scheduling.tsx    # Điều phối
│   ├── shifts.tsx        # Lịch làm việc (renamed from shifts.tsx)
│   ├── manage.tsx        # Quản lý (OWNER/PARTNER only)
│   ├── manage-*.tsx      # Các màn quản lý khác
│   └── _layout.tsx       # Admin layout (Tabs hidden)
├── (auth)/               # Authentication
│   ├── sign-in.tsx
│   └── callback.tsx
├── (customer)/           # Customer shell
│   ├── index.tsx         # Home feed
│   ├── explore.tsx       # Explore storefront
│   ├── booking.tsx       # Booking
│   ├── profile.tsx       # Profile + avatar upload
│   └── _layout.tsx       # Customer layout
├── booking-request/      # Public booking
│   └── [bookingRequestId].tsx
└── index.tsx             # App gate (role-based redirect)
```

#### 2.2 Mobile Features
```
apps/mobile/src/features/
├── admin/
│   ├── content-images.ts    # Avatar upload, image manipulation
│   ├── manage-ui.tsx        # Admin UI components
│   ├── manage.ts            # Manage screen items
│   ├── navigation.ts        # Admin navigation logic
│   ├── notifications.ts     # Notification system
│   ├── services-data.ts     # Services data
│   └── ui.tsx               # Shared admin UI
└── customer/
    ├── cached-image.tsx     # Image caching with intent
    ├── data.ts              # Customer data
    ├── image-preview-modal.tsx
    ├── strings.ts           # Localization
    └── ui.tsx               # Customer UI components
```

#### 2.3 Mobile Hooks
```
apps/mobile/src/hooks/
├── use-admin-operations.ts  # Admin operations (scheduling, checkout, etc.)
├── use-customer-favorites.ts
└── use-customer-home-feed.ts
```

#### 2.4 Mobile Libraries
```
apps/mobile/src/lib/
├── admin-services-cache.ts  # Admin services caching
├── customer-image-cache.ts  # Customer image caching
├── customer-image-url.ts    # Image URL with intent (avatar64, avatar128, etc.)
├── app-session.ts           # App session management
├── supabase.ts              # Supabase client
└── env.ts                   # Environment variables
```

---

### 3. Web App Structure Detail

#### 3.1 Web Routes
```
apps/web/src/app/
├── page.tsx                 # Landing page
├── login/page.tsx           # Login
├── auth/callback/page.tsx   # Auth callback
├── account/page.tsx         # Account settings
├── manage/                  # Admin routes
│   ├── page.tsx             # Manage landing (role-based redirect)
│   ├── landing/             # Landing Feed admin
│   ├── appointments/        # Appointments
│   ├── booking-requests/    # Booking requests
│   ├── checkout/            # Checkout
│   ├── customers/           # Customer management
│   └── reports/             # Reports
└── api/                     # API routes
    ├── booking-request/     # Public booking
    ├── customer/            # Customer APIs
    │   ├── home-feed/
    │   └── explore/
    ├── telegram/            # Telegram webhook
    └── lookbook/            # Lookbook data
```

#### 3.2 Web Libraries
```
apps/web/src/lib/
├── app-session.ts           # App session management
├── auth.ts                  # Auth helpers
├── booking-requests.ts      # Booking request logic
├── domain.ts                # Domain context (ensureOrgContext)
├── landing-content.ts       # Landing page data
├── manage-landing-auth.ts   # Manage auth redirect
├── supabase.ts              # Supabase clients
└── telegram-bot.ts          # Telegram bot logic
```

---

### 4. Shared Package Detail

#### 4.1 Shared Modules
```
packages/shared/src/
├── auth.ts                  # Auth types and helpers
├── session.ts               # Session management
├── org.ts                   # Organization context
├── roles.ts                 # Role labels and helpers
├── validation.ts            # Validation schemas
├── booking.ts               # Booking types
├── appointments.ts          # Appointment types
├── checkout.ts              # Checkout types
├── dashboard.ts             # Dashboard types
├── crm.ts                   # CRM types
├── reporting.ts             # Reporting types
├── services.ts              # Services types
├── resources.ts             # Resources types
├── team.ts                  # Team types
├── tax-books.ts             # Tax books types
├── customer-feed.ts         # Customer feed types
├── customer-explore.ts      # Customer explore types
├── customer-personalization.ts
├── admin-content.ts         # Admin content types
├── auto-schedule.ts         # Auto-schedule types
└── format.ts                # Formatting helpers
```

#### 4.2 Role System
```typescript
type AppRole = "USER" | "OWNER" | "PARTNER" | "MANAGER" | "RECEPTION" | "ACCOUNTANT" | "TECH";

const ROLE_LABELS = {
  USER: "Khách hàng",
  OWNER: "BOSS",
  PARTNER: "Chủ tiệm",
  MANAGER: "Quản lý",
  RECEPTION: "Lễ tân",
  ACCOUNTANT: "Kế toán",
  TECH: "Kỹ thuật viên",
};
```

---

### 5. Database Schema Summary

#### 5.1 Core Tables
- `orgs` - Organizations
- `branches` - Branches
- `profiles` - User profiles
- `user_roles` - User roles per org/branch
- `services` - Services
- `resources` - Resources (staff, equipment)
- `appointments` - Appointments
- `tickets` - Checkout tickets
- `time_entries` - Time entries (shifts)

#### 5.2 Customer Tables
- `customer_accounts` - Customer accounts
- `customer_content_posts` - Content posts
- `marketing_offers` - Marketing offers
- `storefront_profile` - Storefront profile
- `storefront_products` - Storefront products
- `storefront_team_members` - Storefront team
- `storefront_gallery` - Storefront gallery

#### 5.3 Session Tables
- `device_sessions` - Device sessions
- `app_sessions` - App sessions
- `online_users` - Online users

#### 5.4 Telegram Tables
- `telegram_links` - Telegram account links
- `telegram_conversations` - Telegram conversations

---

### 6. API Endpoints Summary

#### 6.1 Public APIs
- `POST /api/booking-request` - Public booking request

#### 6.2 Customer APIs
- `GET /api/customer/home-feed` - Customer home feed
- `GET /api/customer/explore` - Customer explore

#### 6.3 Admin APIs
- `GET /api/manage/landing/content-posts` - Landing content posts
- `GET /api/lookbook` - Lookbook data

#### 6.4 Telegram APIs
- `POST /api/telegram` - Telegram webhook
- `POST /api/telegram/callback` - Telegram callback
- `POST /api/telegram/content` - Telegram content
- `POST /api/telegram/setup` - Telegram setup
- `POST /api/telegram/notify` - Telegram notify
- `POST /api/telegram/daily-summary` - Daily summary
- `POST /api/telegram/appointments-overdue` - Overdue appointments

---

### 7. Image System Detail

#### 7.1 Image Intents
```typescript
type CustomerImageIntent = 
  | "hero"           // 900px, quality 78
  | "card"           // 480px, quality 72
  | "avatar"         // 128px, quality 75
  | "avatar64"       // 64px, quality 70
  | "avatar128"      // 128px, quality 75
  | "avatar512"      // 512px, quality 80
  | "preview"        // 1400px, quality 86
  | "thumbnail"      // 64px, quality 60
```

#### 7.2 Image Storage
- **Bucket**: `service-images`
- **Folders**: `avatars`, `offers`, `posts`, `storefront`, `gallery`, `products`
- **Format**: WebP (ưu tiên), JPEG fallback
- **Cache**: Mobile app caches images locally

#### 7.3 Image Upload Flow
1. User picks image from gallery
2. Resize to target size (64/128/256/512/1024px)
3. Compress with quality (85-100%)
4. Upload to Supabase storage
5. Get public URL
6. Cache locally

---

### 8. Troubleshooting Guide

#### 8.1 Mobile App Issues

**Issue: Màn trắng khi login với non-OWNER/PARTNER**
- **Cause**: `ManageScreenShell` có role guard return View trống
- **Fix**: Đã fix trong `manage-ui.tsx` - xóa guard, chỉ dùng `useSession`

**Issue: Avatar mờ**
- **Cause**: Upload size nhỏ + Supabase render nén thêm
- **Fix**: Upload 1024px WebP @ 100%, render quality 92%

**Issue: Avatar tròn có khung vuông lộ**
- **Cause**: View container có background không khớp
- **Fix**: Thêm `transparent` prop + `avatarContainer` với borderRadius

#### 8.2 Web App Issues

**Issue: Landing Feed layout shift**
- **Cause**: `useFocusEffect` trigger reload on focus
- **Fix**: Xóa `useFocusEffect` trong `manage-content.tsx`

**Issue: Checkout screen jumping**
- **Cause**: `useFocusEffect` trigger reload on focus
- **Fix**: Xóa `useFocusEffect` trong `checkout.tsx`

#### 8.3 Database Issues

**Issue: Auth login error 42P10**
- **Cause**: `ON CONFLICT (user_id, org_id, role)` invalid
- **Fix**: Chạy `auth_runtime_patch_2026_05_user_roles_conflict.sql`

**Issue: Customer account linking error**
- **Cause**: `ON CONFLICT (user_id)` dependency
- **Fix**: Chạy `customer_mobile_runtime_patch_2026_05.sql`

---

### 9. Development Workflow

#### 9.1 Running the Apps

**Web:**
```bash
npm run dev              # Development
npm run build            # Production build
npm run start            # Start production
npm run web:lint         # Lint
npm run web:typecheck    # Typecheck
```

**Mobile:**
```bash
npm run mobile:start         # Start Expo
npm run mobile:go:lan       # LAN tunnel
npm run mobile:go:cloudflare # Cloudflare tunnel
npm run mobile:android      # Run on Android
npm run mobile:ios          # Run on iOS
npm run mobile:lint         # Lint
npm run mobile:typecheck    # Typecheck
```

#### 9.2 Typecheck & Lint
```bash
npm run lint         # Lint web + mobile
npm run typecheck    # Typecheck web + mobile
```

#### 9.3 Environment Variables

**Mobile:**
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_PASSWORD_RESET_URL`
- `EXPO_PUBLIC_DEFAULT_ORG_ID`
- `EXPO_PUBLIC_DEFAULT_BRANCH_ID`

---

### 10. Key Files Reference

#### 10.1 Mobile App
- `apps/mobile/app/index.tsx` - App gate (role-based redirect)
- `apps/mobile/app/(admin)/index.tsx` - Admin index redirect
- `apps/mobile/src/providers/session-provider.tsx` - Session management
- `apps/mobile/src/features/admin/content-images.ts` - Image upload
- `apps/mobile/src/features/admin/navigation.ts` - Admin navigation
- `apps/mobile/src/lib/customer-image-url.ts` - Image URL with intent

#### 10.2 Web App
- `apps/web/src/app/manage/page.tsx` - Manage landing
- `apps/web/src/lib/domain.ts` - Domain context
- `apps/web/src/lib/auth.ts` - Auth helpers
- `apps/web/src/lib/booking-requests.ts` - Booking requests
- `apps/web/src/lib/telegram-bot.ts` - Telegram bot

#### 10.3 Shared Package
- `packages/shared/src/session.ts` - Session management
- `packages/shared/src/auth.ts` - Auth types
- `packages/shared/src/roles.ts` - Role labels
- `packages/shared/src/booking.ts` - Booking types
- `packages/shared/src/appointments.ts` - Appointment types

#### 10.4 Database
- `supabase/bootstrap.sql` - Canonical bootstrap
- `supabase/deploy.sql` - Core deploy
- `supabase/app_sessions.sql` - App sessions
- `supabase/customer_mobile_schema_2026_04.sql` - Customer mobile schema

---

### 11. Recent Changes Log

#### 2026-05-09
- ✅ Fixed non-OWNER/PARTNER white screen issue
- ✅ Updated avatar upload to 1024px WebP @ 100%
- ✅ Fixed avatar circle frame issue
- ✅ Fixed Landing Feed layout shift
- ✅ Fixed Checkout screen jumping
- ✅ Fixed Scheduling safe-area overflow
- ✅ Fixed Booking Request gap from top
- ✅ Added back icon to ManageScreenShell
- ✅ Added pull-to-refresh to scheduling screen

---

### 12. Next Steps & TODO

#### 12.1 Immediate
- [ ] Fix Landing Feed access for non-OWNER/PARTNER (redirect to `/shifts`)
- [ ] Test avatar upload on real device
- [ ] Verify all role-based routing works correctly

#### 12.2 Short-term
- [ ] Add chat list with avatar64 intent
- [ ] Implement customer chat feature
- [ ] Add more image optimization

#### 12.3 Long-term
- [ ] Complete mobile feature parity with web
- [ ] Add iOS support
- [ ] Improve offline mode
- [ ] Add push notifications

---

*Last updated: 2026-05-09*