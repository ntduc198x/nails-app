# Nails App

Ung dung van hanh tiem nails theo huong mobile-first, xay dung bang Next.js va Supabase.

README nay tap trung vao 4 viec:
- hieu nhanh app dang lam gi
- chay local de dev
- deploy production an toan
- van hanh Telegram webhook va cac route noi bo dung cach

## 1. Tong quan

App nay phuc vu 2 nhom nguoi dung chinh:
- Khach hang dat lich online
- Nhan vien / quan ly van hanh trong khu vuc `/manage`

Luong chinh:
- Khach xem dich vu, chon lich, gui booking request
- He thong luu booking vao Supabase
- Dashboard noi bo theo doi lich hen, khach hang, doanh thu, CRM
- Telegram nhan thong bao booking moi, nhac viec va tong hop van hanh

## 2. Tech stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase
- Telegram Bot API
- Vercel hoac moi truong Node phu hop de deploy

## 3. Cau truc route chinh

### Public

- `/`
- `/booking`
- `/services`
- `/about`
- `/contact`

### Manage

- `/manage`
- `/manage/appointments`
- `/manage/customers`
- `/manage/services`
- `/manage/staff`
- `/manage/analytics`
- `/manage/crm`

### API lien quan Telegram

- `/api/telegram/callback`
- `/api/telegram/setup`
- `/api/telegram/notify`
- `/api/telegram/daily-summary`
- `/api/telegram/appointments-overdue`

## 4. Tinh nang chinh

### Booking online

- Chon dich vu, thoi gian, ky thuat vien
- Tao booking request va luu vao database
- Dieu huong trang thai booking cho van hanh noi bo

### Van hanh noi bo

- Quan ly lich hen
- Quan ly khach hang
- Theo doi CRM
- Dashboard doanh thu va hoat dong

### Telegram

- Gui thong bao booking moi
- Nhan webhook tu bot Telegram
- Trigger route noi bo cho tong hop ngay va canh bao lich tre

## 5. Cai dat local

### Yeu cau

- Node.js 20+
- npm hoac pnpm
- Tai khoan Supabase
- Telegram bot neu can test luong thong bao

### Cai dependency

```bash
npm install
```

### Chay local

```bash
npm run dev
```

Mac dinh app chay tai:

```bash
http://localhost:3000
```

### Build production

```bash
npm run build
npm start
```

## 6. Bien moi truong

Tao file `.env.local` va dien cac bien can thiet.

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

NEXT_PUBLIC_APP_URL=https://www.chambeauty.io.vn
NEXT_PUBLIC_RECEIPT_LINK_EXPIRE_DAYS=30

TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_BOOKING_CHAT_ID=your_telegram_chat_id
TELEGRAM_WEBHOOK_SECRET=your_random_webhook_secret
TELEGRAM_INTERNAL_ROUTE_SECRET=your_random_internal_route_secret

APPOINTMENT_OVERDUE_MINUTES=15
```

Ghi chu:
- `NEXT_PUBLIC_APP_URL` phai la domain production dung de Telegram set webhook chinh xac
- `TELEGRAM_WEBHOOK_SECRET` duoc dung de xac thuc request webhook tu Telegram
- `TELEGRAM_INTERNAL_ROUTE_SECRET` duoc dung de bao ve cac route noi bo nhu setup, notify, daily summary, overdue alerts

### Mobile env contract

Mobile app trong `apps/mobile` doc bien moi truong qua Expo va chi dung cac key `EXPO_PUBLIC_*`.

Can co day du cac bien sau trong root `.env.local`:

```env
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
EXPO_PUBLIC_API_BASE_URL=...
EXPO_PUBLIC_PASSWORD_RESET_URL=...
```

Luu y:
- Khong duoc chi co `NEXT_PUBLIC_*` neu muon chay mobile Android lane
- `EXPO_PUBLIC_API_BASE_URL` phai tro ve domain/backend dang phuc vu route `/api/booking-request`
- `EXPO_PUBLIC_PASSWORD_RESET_URL` tam thoi nen tro ve trang login web cho flow reset password
- Co the chay `npm run mobile:env` de kiem tra contract truoc khi prebuild Android

## 6.1 Android local build

Moc build-ready dau tien la `local Android debug APK` bang Expo prebuild lane, khong dung EAS.

### Yeu cau bo sung

- Android Studio: `D:\Program Files\Android\Android Studio`
- Android SDK: `C:\Users\Admin\AppData\Local\Android\Sdk`
- Shell dang chay Expo/Gradle phai co:

```powershell
$env:ANDROID_HOME='C:\Users\Admin\AppData\Local\Android\Sdk'
$env:ANDROID_SDK_ROOT='C:\Users\Admin\AppData\Local\Android\Sdk'
$env:Path += ';C:\Users\Admin\AppData\Local\Android\Sdk\platform-tools'
```

### Lenh build local Android

```bash
npm install
npm run mobile:env
npm run mobile:typecheck
npm run mobile:lint
npm run mobile:config
npm run mobile:prebuild
npm run mobile:android
```

### Muc tieu verify sau khi boot emulator

- App mo duoc tren Android emulator
- Guest booking screen vao duoc ma khong can auth
- Guest booking submit qua `/api/booking-request`
- Staff sign-in van vao `/(admin)`
- Admin overview van tai duoc du lieu that

### Trang thai da verify tren may local nay

- `npm run mobile:env`: pass
- `npm run mobile:typecheck`: pass
- `npm run mobile:lint`: pass
- `npm run mobile:config`: pass
- `npm run mobile:prebuild`: pass
- Gradle `assembleDebug`: pass
- Debug APK da duoc sinh ra tai:

```text
apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

### Blocker local con lai

- Chua co Android emulator (AVD) duoc cau hinh tren may nay
- `npm run mobile:android` se dung o buoc tim device/emulator cho toi khi co AVD hoac thiet bi that
- `npm run mobile:doctor` con 1 warning expected cua prebuild workflow:
  - khi thu muc native `android/` ton tai, phai tiep tuc chay `prebuild` trong build pipeline de sync `app.json`

### Chinh sach native generation

- `android/` co the duoc Expo sinh ra trong local prebuild lane de compile native
- Khong sua tay file native duoc sinh ra, tru khi co blocker cu the
- Neu sau nay can commit native directories, do la mot quyet dinh rieng, khong thuoc moc build-ready hien tai

## 7. Database

SQL chinh:

- `supabase/deploy.sql`

Mot so patch bo sung dang co trong repo:

- `supabase/telegram_links.sql`
- `supabase/telegram_conversations.sql`
- `supabase/runtime_patch_2026_04_telegram_booking.sql`
- `supabase/appointments_overdue_alerts.sql`
- `supabase/booking_requests_tech_access.sql`
- `supabase/add_profile_email.sql`
- `supabase/remove_service_display_order.sql`
- `supabase/crm_patch_2026_04.sql`

Neu can xem huong dan chi tiet hon cho database, doc them:

- `supabase/README.md`

## 8. Telegram production

### 8.1 Webhook callback

Route:

```text
/api/telegram/callback
```

Route nay chi nhan request hop le khi header sau trung voi secret da set:

```text
X-Telegram-Bot-Api-Secret-Token
```

Secret nay duoc truyen khi app goi `setWebhook`.

### 8.2 Route noi bo

Nhung route sau khong duoc goi public khong bao ve:

- `/api/telegram/setup`
- `/api/telegram/notify`
- `/api/telegram/daily-summary`
- `/api/telegram/appointments-overdue`

Can gui mot trong hai header:

```text
x-telegram-internal-secret: <TELEGRAM_INTERNAL_ROUTE_SECRET>
```

hoac

```text
Authorization: Bearer <TELEGRAM_INTERNAL_ROUTE_SECRET>
```

### 8.3 Set webhook production

Sau khi set env production, goi:

```bash
curl -X POST "https://www.chambeauty.io.vn/api/telegram/setup" ^
  -H "Authorization: Bearer <TELEGRAM_INTERNAL_ROUTE_SECRET>"
```

Muc dich:
- dang ky webhook ve dung domain production
- gui `secret_token` len Telegram
- dam bao callback chi nhan request hop le

### 8.4 Vi du cron / external trigger

Tong hop ngay:

```bash
curl -X POST "https://www.chambeauty.io.vn/api/telegram/daily-summary" ^
  -H "Authorization: Bearer <TELEGRAM_INTERNAL_ROUTE_SECRET>"
```

Canh bao lich tre:

```bash
curl -X POST "https://www.chambeauty.io.vn/api/telegram/appointments-overdue" ^
  -H "x-telegram-internal-secret: <TELEGRAM_INTERNAL_ROUTE_SECRET>"
```

Gui notify thu cong:

```bash
curl -X POST "https://www.chambeauty.io.vn/api/telegram/notify" ^
  -H "Authorization: Bearer <TELEGRAM_INTERNAL_ROUTE_SECRET>" ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"Test production notification\"}"
```

## 9. Van hanh theo vai tro

### Chu shop / manager

- Theo doi booking moi
- Xem dashboard va CRM
- Kiem tra canh bao tren Telegram

### Ky thuat vien / le tan

- Xu ly lich hen
- Cap nhat thong tin khach
- Theo doi appointment status trong khu vuc quan ly

### Developer

- Quan ly env
- Deploy app
- Duy tri webhook Telegram
- Chay SQL patch khi can

## 10. Lenh thuong dung

```bash
npm install
npm run dev
npm run build
npm run lint
npx tsc --noEmit
npm run mobile:env
npm run mobile:config
npm run mobile:prebuild
npm run mobile:android
```

Neu can setup webhook sau deploy:

```bash
curl -X POST "https://www.chambeauty.io.vn/api/telegram/setup" ^
  -H "Authorization: Bearer <TELEGRAM_INTERNAL_ROUTE_SECRET>"
```

## 11. File tai lieu lien quan

- `GUIDE.vi.md`
- `TELEGRAM_SETUP.md`
- `supabase/README.md`

## 12. Luu y bao mat

- Khong commit secret that
- Neu token Telegram hoac Supabase service role key da tung nam trong script test, nen rotate truoc khi production
- Khong mo public cac route noi bo cua Telegram ma khong co secret header
- Sau moi lan doi domain hoac webhook secret, goi lai `/api/telegram/setup`

## 13. Trang thai hien tai

- App dang theo huong mobile-first cho khu vuc `/manage`
- Telegram da co guard cho webhook va internal routes
- README nay duoc viet lai de de onboarding, van hanh va deploy production hon
