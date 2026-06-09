# Supabase Cleanup Audit 2026-06-09

## Mục tiêu
- Tách rõ table core, table feature phụ, table audit/log, và table retire candidate.
- Ngừng dựa riêng vào `supabase/remote-schema/remote_schema_snapshot_20260518.sql` vì snapshot này đã cũ hơn migration hiện tại.
- Dùng live DB context snapshot mới tại `supabase/remote-schema/remote_database_context_20260609.json` làm source of truth gần nhất trong repo.

## Snapshot cần refresh từ DB live
Các table sau đã được code dùng thật nhưng chưa có trong snapshot cũ:
- `content_translation_jobs`
- `customer_branches`
- `password_reset_requests`
- `shift_assignment_overrides`
- `shift_change_requests`

## Trạng thái live DB đã xác nhận
- Migration `20260609143000_archive_and_retire_unused_customer_runtime_tables` đã được apply trên project `bjwlwvecinqldvwioajw`.
- Các table đã retire khỏi `public` và đang tồn tại ở `archive`: `customer_addresses`, `customer_payment_methods`, `customer_service_reviews`.
- Drift cũ của `password_reset_requests` đã được self-heal trên live DB để khớp lại với code runtime và migration history.

## Nhóm giữ nguyên
- Core vận hành: `appointments`, `booking_requests`, `tickets`, `ticket_items`, `payments`, `receipts`, `customers`, `services`, `resources`, `branches`, `orgs`, `profiles`, `user_roles`
- Session/auth/presence: `app_sessions`, `device_sessions`, `online_users`
- Shift/workforce: `time_entries`, `shift_plans`, `shift_leave_requests`, `staff_shift_profiles`, `shift_change_requests`, `shift_assignment_overrides`
- Multi-branch/customer auth adjunct: `customer_branches`, `customer_accounts`, `password_reset_requests`
- Offers/membership/notification: `marketing_offers`, `membership_tiers`, `customer_memberships`, `customer_notifications`, `customer_notification_preferences`, `customer_offer_claims`, `customer_push_devices`, `customer_push_delivery_logs`

## Đã triển khai trong repo
- Archive rồi retire khỏi `public`:
  - `customer_addresses`
  - `customer_payment_methods`
  - `customer_service_reviews`
- Retention/archive function:
  - `archive_old_admin_notifications()`
  - `archive_old_customer_push_delivery_logs()`
  - `archive_old_checkout_requests()`
  - `archive_old_customer_merge_audit()`
  - `run_archive_retention_job()`
- `run_notification_retention_job()` được mở rộng để archive:
  - `admin_notifications`
  - `customer_push_delivery_logs`
- `merge_customer_records()` và `merge_customer_records_force()` đã được redefine để không còn phụ thuộc vào `customer_service_reviews`.

## TTL mặc định đang áp dụng
- `admin_notifications`: archive sau 30 ngày
- `customer_push_delivery_logs`: archive sau 30 ngày
- `checkout_requests`: archive sau 14 ngày
- `customer_merge_audit`: archive sau 180 ngày

## Việc còn lại ngoài repo
- Refresh schema snapshot từ Supabase live DB.
- Chạy migration trên môi trường dev/staging trước.
- Nếu muốn tự động hóa tiếp, có thể tạo pg_cron schedule riêng cho `run_archive_retention_job()`.
