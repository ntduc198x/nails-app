# Supabase SQL layout

## Canonical deploy

- `deploy.sql`
  - file deploy chuẩn duy nhất
  - chứa schema, RLS, RPC, indexes, invite codes, landing booking, storage setup

## Legacy

Các file trong `legacy/` chỉ để tham chiếu lịch sử, backfill, smoke test, hoặc patch tạm.
Không dùng như bộ deploy chuẩn mới.

## Ghi chú

- `remove_dev_role.sql` đã được chạy xong và đã bỏ khỏi bộ chuẩn.
- Nếu cần setup môi trường mới, ưu tiên chạy `deploy.sql`.

Thứ tự chạy:
1	deploy.sql	Schema + RLS + RPC chính	Lần đầu setup
2	app_sessions.sql	Single-device login	Sau deploy.sql
3	telegram_links.sql	Telegram bot	Sau deploy.sql
4	lookbook_trend_seed.sql	Seed mẫu lookbook	Khi cần
5	update_services_from_priceboard.sql	Seed bảng giá	Khi cần