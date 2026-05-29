# Nails App Monorepo

Monorepo cho hệ thống đặt lịch và vận hành salon nail. Repo này gom ứng dụng web, ứng dụng mobile, lớp domain dùng chung và toàn bộ phần SQL/Supabase cần để chạy nghiệp vụ.

## Mục lục

- [Tổng quan](#tổng-quan)
- [Kiến trúc nhanh](#kiến-trúc-nhanh)
- [Công nghệ sử dụng](#công-nghệ-sử-dụng)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Yêu cầu môi trường](#yêu-cầu-môi-trường)
- [Bắt đầu nhanh](#bắt-đầu-nhanh)
- [Biến môi trường](#biến-môi-trường)
- [Lệnh thường dùng](#lệnh-thường-dùng)
- [Phát triển web](#phát-triển-web)
- [Phát triển mobile](#phát-triển-mobile)
- [Supabase và SQL](#supabase-và-sql)
- [Quy ước làm việc](#quy-ước-làm-việc)
- [Kiểm tra trước khi merge](#kiểm-tra-trước-khi-merge)
- [Tài liệu bổ sung](#tài-liệu-bổ-sung)
- [Xử lý sự cố](#xử-lý-sự-cố)

## Tổng quan

Repo được tổ chức theo `npm workspaces` và chia thành các phần chính:

- `apps/web`: ứng dụng Next.js cho landing page, luồng khách hàng, luồng quản trị, API routes và tích hợp Telegram.
- `apps/mobile`: ứng dụng Expo / React Native cho khách hàng và quản trị viên, dùng Expo Router.
- `packages/shared`: contract, kiểu dữ liệu, validation, helper nghiệp vụ dùng chung giữa web, mobile và script.
- `supabase`: migrations, patches, seeds, Edge Functions và các file SQL vận hành.
- `docs`: ghi chú kiến trúc, SOP và tài liệu triển khai nội bộ.

README này phục vụ ba mục tiêu:

1. Giúp một lập trình viên mới clone repo và chạy local nhanh.
2. Giúp hiểu ranh giới giữa web, mobile, shared và Supabase.
3. Giảm rủi ro khi sửa env, flow mobile hoặc schema cơ sở dữ liệu.

## Kiến trúc nhanh

Luồng tổng quát của hệ thống:

1. Web và mobile cùng dùng Supabase cho dữ liệu, xác thực và một phần RPC.
2. Các kiểu dữ liệu và hàm domain nằm ở `packages/shared` để tránh lệch logic giữa hai nền tảng.
3. Web có các API routes để xử lý các việc cần server-side như session, Telegram và các route nội bộ.
4. Mobile gọi web API cho một số tác vụ cần side effect phía server; khi cần vẫn có nhánh fallback qua Supabase RPC.
5. Toàn bộ thay đổi schema phải đi qua `supabase/migrations` để có thể theo dõi và tái áp dụng.

## Công nghệ sử dụng

- **Quản lý package**: npm workspaces
- **Web**: Next.js 16, React 19, TypeScript
- **Mobile**: Expo SDK 54, React Native 0.81, Expo Router 6
- **Lớp dùng chung**: TypeScript workspace package
- **Cơ sở dữ liệu / Auth / Storage**: Supabase
- **Validation**: Zod
- **Linting**: ESLint
- **Script điều phối**: các script Node.js trong `scripts/`

## Cấu trúc thư mục

```text
.
|- apps/
|  |- web/
|  |  |- src/app/                # Routes và API routes của Next.js
|  |  |- src/components/         # UI components
|  |  |- src/lib/                # Auth, data layer, helper nghiệp vụ
|  |
|  |- mobile/
|     |- app/                    # Màn hình theo Expo Router
|     |- src/                    # Logic dùng lại trong mobile
|     |- android/                # Native Android project đang được track
|
|- packages/
|  |- shared/
|     |- src/                    # Contract, helper, validation, shared types
|
|- scripts/                      # Script cấp repo
|- supabase/                     # Migrations, patches, seeds, functions
|- docs/                         # Tài liệu kiến trúc và vận hành
|- package.json                  # Root workspace
|- README.md
```

## Yêu cầu môi trường

Tối thiểu:

- Node.js 20 trở lên
- npm 10 trở lên
- Git

Để phát triển mobile Android:

- Android Studio
- Android SDK
- `ANDROID_HOME`
- `ANDROID_SDK_ROOT`
- `platform-tools` đã có trong `PATH`

Để làm việc với Supabase từ xa:

- Một project Supabase đang hoạt động
- `SUPABASE_SERVICE_ROLE_KEY`
- Nếu dùng lệnh đẩy schema kiểu `supabase db push --linked`, thường sẽ cần thêm `SUPABASE_DB_PASSWORD`

## Bắt đầu nhanh

### 1. Clone repo

```bash
git clone <repo-url>
cd nails-app
```

### 2. Cài dependency

```bash
npm install
```

### 3. Tạo file môi trường

Repo này dùng file `.env.local` ở root làm nguồn env chính cho web và các script mobile.

Nếu có file mẫu:

```bash
copy .env.local.example .env.local
```

Nếu chưa có file mẫu, hãy tạo `.env.local` thủ công và điền các biến tối thiểu ở phần [Biến môi trường](#biến-môi-trường).

### 4. Chạy web local

```bash
npm run dev
```

Lệnh này thực chất chạy workspace web:

```bash
npm run dev --workspace @nails/web
```

### 5. Kiểm tra env mobile

```bash
npm run mobile:env
```

Script này đọc `.env.local`, kiểm tra các biến quan trọng và đồng bộ env cần thiết cho workspace mobile.

### 6. Chạy mobile

Qua LAN:

```bash
npm run mobile:go:lan
```

Qua tunnel:

```bash
npm run mobile:go
```

Qua Cloudflare:

```bash
npm run mobile:go:cloudflare
```

## Biến môi trường

### Nhóm web và script dùng chung

| Biến | Bắt buộc | Mô tả |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Có | URL của project Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Có | Anon key cho web client |
| `SUPABASE_SERVICE_ROLE_KEY` | Có cho route server và script | Service role key để chạy tác vụ đặc quyền |
| `NEXT_PUBLIC_APP_URL` | Nên có | URL public của web app |

### Nhóm env public cho mobile

Mobile dùng các biến `EXPO_PUBLIC_*` làm hợp đồng chính:

| Biến | Bắt buộc | Mô tả |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Có | URL Supabase cho mobile |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Có | Anon key cho mobile |
| `EXPO_PUBLIC_API_BASE_URL` | Có | Base URL để mobile gọi web API |
| `EXPO_PUBLIC_PASSWORD_RESET_URL` | Có | URL reset mật khẩu |
| `EXPO_PUBLIC_WEB_API_BASE_URL` | Không bắt buộc | Override riêng cho web API |
| `EXPO_PUBLIC_BOOKING_API_BASE_URL` | Không bắt buộc | Override riêng cho booking API |
| `EXPO_PUBLIC_DEFAULT_ORG_ID` | Không bắt buộc | Gợi ý org mặc định |
| `EXPO_PUBLIC_DEFAULT_BRANCH_ID` | Không bắt buộc | Gợi ý chi nhánh mặc định |

### Nhóm Telegram

Nếu dùng Telegram bot hoặc route nội bộ liên quan thông báo booking:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_BOOKING_CHAT_ID`
- `TELEGRAM_WEBHOOK_SECRET`
- `TELEGRAM_INTERNAL_ROUTE_SECRET`
- `TELEGRAM_BOOKING_ALERT_MEDIA_URL`
- `TELEGRAM_STATE_DIR`

## Lệnh thường dùng

### Lệnh ở root

| Lệnh | Mô tả |
| --- | --- |
| `npm install` | Cài dependency cho toàn bộ monorepo |
| `npm run dev` | Chạy web app local |
| `npm run build` | Build web app |
| `npm run start` | Chạy web build production |
| `npm run lint` | Lint cả web và mobile |
| `npm run typecheck` | Typecheck cả web và mobile |
| `npm run services:seed:priceboard` | Cập nhật seed dịch vụ từ bảng giá mẫu |

### Lệnh cho web

| Lệnh | Mô tả |
| --- | --- |
| `npm run web:dev` | Chạy Next.js web app |
| `npm run web:build` | Build workspace web |
| `npm run web:start` | Chạy web build |
| `npm run web:lint` | Lint workspace web |
| `npm run web:typecheck` | Typecheck workspace web |

### Lệnh cho mobile

| Lệnh | Mô tả |
| --- | --- |
| `npm run mobile:start` | Chạy Expo start |
| `npm run mobile:go:lan` | Expo Go qua LAN |
| `npm run mobile:go` | Expo Go qua tunnel |
| `npm run mobile:go:cloudflare` | Luồng dev mobile qua Cloudflare |
| `npm run mobile:android` | Chạy Android |
| `npm run mobile:prebuild` | Prebuild Android không cài dependency native |
| `npm run mobile:config` | In Expo config dạng JSON |
| `npm run mobile:doctor` | Chạy `expo-doctor` |
| `npm run mobile:env` | Kiểm tra và đồng bộ env cho mobile |
| `npm run mobile:ios` | Chạy iOS nếu môi trường hỗ trợ |
| `npm run mobile:lint` | Lint mobile |
| `npm run mobile:typecheck` | Typecheck mobile |

### Lệnh hỗ trợ i18n

| Lệnh | Mô tả |
| --- | --- |
| `npm run i18n:audit` | Audit chuỗi dịch toàn repo |
| `npm run i18n:audit:customer-mobile` | Audit phần customer mobile |
| `npm run i18n:audit:admin-mobile` | Audit phần admin mobile |

## Phát triển web

Nguồn chính của web nằm ở:

- `apps/web/src/app`
- `apps/web/src/components`
- `apps/web/src/lib`

Những khu vực cần lưu ý:

- `src/app/api/*`: API routes cho booking, session, Telegram, upload
- `src/lib/supabase.ts`: khởi tạo Supabase client
- `src/lib/route-secrets.ts`: kiểm tra secret cho route nội bộ
- `src/lib/public-app-url.ts`: suy ra public base URL

Khi sửa web:

1. Chạy `npm run web:lint`
2. Chạy `npm run web:typecheck`
3. Nếu sửa API route mà mobile đang gọi, kiểm tra lại flow mobile tương ứng

## Phát triển mobile

Mobile app hiện dùng:

- Expo SDK 54
- Expo Router
- Tracked native Android project trong `apps/mobile/android`

### Lưu ý về Expo Go

- Repo đã được kéo về Expo SDK 54 để tương thích với Expo Go hiện tại.
- `expo-doctor` đang tắt check `appConfigFieldsNotSyncedCheck` có chủ đích vì repo vẫn track thư mục `android/`.

Trong `apps/mobile/package.json` hiện có:

```json
{
  "expo": {
    "doctor": {
      "appConfigFieldsNotSyncedCheck": {
        "enabled": false
      }
    }
  }
}
```

### Lưu ý về booking mobile

- Mobile ưu tiên gọi web API cho booking để giữ các side effect phía server như Telegram.
- Khi web API chậm hoặc timeout, mobile có thể fallback sang Supabase RPC.
- Vì vậy mọi thay đổi liên quan tạo booking công khai cần được kiểm tra ở cả hai nhánh: web API và RPC.

### Lưu ý về xác thực

- Google sign-in còn hoạt động.
- Apple sign-in đã bị gỡ khỏi UI, flow provider và dependency liên quan.

## Supabase và SQL

Thư mục `supabase/` được chia thành:

- `supabase/migrations`: thay đổi schema bền vững, cần giữ để deploy và đồng bộ môi trường
- `supabase/patches`: script vá hoặc hỗ trợ chuyển tiếp cho một bối cảnh cụ thể
- `supabase/seeds`: dữ liệu seed
- `supabase/functions`: Edge Functions

Nguyên tắc làm việc:

1. Mọi thay đổi schema lâu dài phải thêm file mới trong `supabase/migrations`.
2. Không sửa trực tiếp lịch sử migration cũ trừ khi bạn chủ động làm sạch toàn bộ môi trường.
3. Patch một lần hoặc script cứu dữ liệu nên để riêng trong `supabase/patches`.
4. Khi thay đổi hàm RPC quan trọng, cần ghi rõ migration nào đã được thêm trong PR hoặc commit.

## Quy ước làm việc

### Quy ước code

- Dùng TypeScript cho web, mobile và shared layer.
- Giữ module nhỏ, một nhiệm vụ rõ ràng.
- Tên file theo `kebab-case`.
- Component React theo `PascalCase`.
- Hook theo dạng `use-*`.

### Quy ước commit

Lịch sử gần đây đang dùng các dạng như:

- `Fix ...`
- `Add ...`
- `Refactor ...`
- `chore: ...`

Khi commit, nên mô tả ngắn gọn, mệnh lệnh, phạm vi rõ ràng.

### Quy ước pull request

PR nên có:

- Tóm tắt thay đổi
- Phạm vi ảnh hưởng: `apps/web`, `apps/mobile`, `packages/shared`, `supabase`, ...
- Lệnh kiểm tra đã chạy
- Ảnh chụp màn hình nếu có thay đổi UI

## Kiểm tra trước khi merge

Hiện chưa có test suite tổng hợp ở root. Tối thiểu trước khi merge:

```bash
npm run lint
npm run typecheck
```

Nếu chỉ sửa một phần nhỏ, có thể chạy theo workspace:

```bash
npm run web:typecheck
npm run mobile:typecheck
```

Nếu sửa dữ liệu hoặc schema:

- ghi rõ file migration hoặc patch đã thêm
- mô tả cách kiểm tra thủ công
- nếu thay đổi liên quan booking, xác nhận lại cả web và mobile

## Tài liệu bổ sung

Hãy đọc thêm:

- `docs/` cho kiến trúc và SOP
- `supabase/migrations/` để hiểu lịch sử thay đổi schema
- `packages/shared/src/` để nắm contract nghiệp vụ chung

## Xử lý sự cố

### `npm install` lỗi hoặc xung đột dependency

- Kiểm tra Node.js đang dùng có đúng phiên bản mới hay không
- Xóa `node_modules` và cài lại nếu cần

### Mobile không chạy được

Kiểm tra lần lượt:

1. `npm run mobile:env`
2. `npm run mobile:doctor`
3. Android SDK và `platform-tools` đã có trong `PATH`
4. URL web API trong env có truy cập được từ điện thoại hoặc emulator

### Mobile booking tạo được lịch nhưng thiếu side effect

Kiểm tra:

1. `EXPO_PUBLIC_API_BASE_URL` hoặc `EXPO_PUBLIC_WEB_API_BASE_URL`
2. Web deployment đã chứa bản vá mới nhất chưa
3. Các biến Telegram trên web runtime có đủ chưa
4. Migration RPC mới nhất đã được áp dụng trên Supabase chưa

### Web route báo lỗi env

Thường là thiếu một trong các biến:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Lệch dữ liệu giữa web và mobile

Đây thường là dấu hiệu của một trong ba vấn đề:

1. Logic bị tách khác nhau giữa web và mobile thay vì đi qua `packages/shared`
2. Mobile đang đi fallback RPC nhưng web đang đi route server
3. Migration mới chưa được áp dụng ở môi trường deploy

Khi debug, hãy xác định rõ request hiện đang đi theo nhánh nào trước khi sửa.
