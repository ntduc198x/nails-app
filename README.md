# Nails App (MVP starter)

Starter app để chạy localhost cho bài toán quản lý + tính tiền quán nails.

## 1) Chạy local

```bash
cd nails-app
cp .env.example .env.local
npm install
npm run dev
```

Mở: http://localhost:3000

## 2) Kết nối Supabase

Điền vào `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
RESEND_API_KEY=...
RECEIPT_LINK_EXPIRE_DAYS=30
TELEGRAM_BOT_TOKEN=...
TELEGRAM_BOOKING_CHAT_ID=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_APP_URL=...
APPOINTMENT_OVERDUE_MINUTES=15
```

## 3) Khởi tạo DB schema

- Mở Supabase SQL Editor
- Chạy **một file duy nhất**: `supabase/deploy.sql`
- (Khuyến nghị) chạy thêm: `supabase/smoke_checkout_integrity.sql` để kiểm tra nhanh toàn vẹn checkout

## 4) Những gì đã có trong starter

- UI MVP nhiều màn:
  - `/login` (Supabase Auth)
  - `/` Dashboard
  - `/appointments`
  - `/services`
  - `/checkout`
  - `/reports`
  - `/team`
- Điều hướng mượt hơn nhờ auth-cache + data-cache (stale nhanh, refresh khi cần)
- Reports nâng cao:
  - Lọc theo khoảng ngày
  - Export CSV
  - Click vào ticket để xem detail
- Supabase client stub: `src/lib/supabase.ts`
- SQL schema hợp nhất (`supabase/deploy.sql`)
- Mock data domain: `src/lib/mock-data.ts`
- Roadmap triển khai: `ROADMAP.vi.md`

## 5) Cảnh báo appointment overdue + scheduler

### Apply DB patch

Chạy thêm file này trong Supabase SQL Editor:

- `supabase/appointments_overdue_alerts.sql`

File này thêm cột `appointments.overdue_alert_sent_at` để chống gửi trùng cảnh báo Telegram cho cùng một appointment quá giờ chưa check-in.

### Route cảnh báo

App đã có route:

- `POST /api/telegram/appointments-overdue`

Route sẽ:
- quét appointment đang `BOOKED`
- đã quá `APPOINTMENT_OVERDUE_MINUTES` phút
- chưa từng gửi cảnh báo overdue
- gửi cảnh báo vào Telegram group
- rồi đánh dấu `overdue_alert_sent_at`

### Scheduler gợi ý với OpenClaw cron

Ví dụ chạy mỗi 5 phút bằng Gateway scheduler:

```bash
openclaw cron add \
  --name "nails-app overdue appointment alerts" \
  --cron "*/5 * * * *" \
  --session isolated \
  --message "POST https://chambeauty.io.vn/api/telegram/appointments-overdue và báo ngắn gọn kết quả" \
  --no-deliver
```

Nếu anh muốn làm chuẩn hơn, em khuyên dùng một webhook/job ngoài app hoặc ping nội bộ có auth riêng, nhưng để chạy nhanh thì cron gọi route này là đủ ổn.

## 6) Ưu tiên build tiếp theo

1. Auth + roles + RLS (OWNER/RECEPTION/TECH)
2. Appointment -> Ticket -> Checkout flow
3. Receipt link expire + PDF
4. Email receipt qua Resend
5. Offline mode A (pending sync)

---

Nếu muốn, bước tiếp theo có thể generate luôn:
- migration SQL đầy đủ hơn
- RLS policies skeleton
- API routes/Edge Functions mẫu cho `pricing_preview` + `checkout_close_ticket`
