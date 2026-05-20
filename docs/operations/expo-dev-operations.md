# Expo Dev Operations

## Mục tiêu
Chạy app mobile bằng **Expo Go** qua domain ổn định:

- `exps://cham.thongdong.io.vn`

Domain này đang trỏ vào **Metro bundler** chạy trên port `8083` thông qua **Cloudflare named tunnel**.

---

## Kiến trúc đang chạy

### 1) Metro bundler
- Service: `nails-mobile-metro-8083.service`
- Port local: `8083`
- Script start: `/root/.local/bin/nails-mobile-metro-8083.sh`

### 2) Cloudflare named tunnel
- Service: `cloudflared-nails-mobile.service`
- Config: `/root/.cloudflared/config.yml`
- Hostname public: `cham.thongdong.io.vn`

### 3) Warm-up bundle
- Script: `/root/.local/bin/nails-mobile-warmup.sh`
- Tự chạy sau khi Metro start qua `ExecStartPost`
- Mục đích: preload iOS bundle để Expo Go vào nhanh hơn

---

## Link dùng trên điện thoại

Mở **Expo Go** và nhập:

```text
exps://cham.thongdong.io.vn
```

---

## Lệnh quan trọng

### Xem trạng thái Metro
```bash
systemctl --user status nails-mobile-metro-8083.service
```

### Xem trạng thái tunnel
```bash
systemctl --user status cloudflared-nails-mobile.service
```

### Restart Metro
```bash
systemctl --user restart nails-mobile-metro-8083.service
```

### Restart tunnel
```bash
systemctl --user restart cloudflared-nails-mobile.service
```

### Restart cả hai
```bash
systemctl --user restart nails-mobile-metro-8083.service
systemctl --user restart cloudflared-nails-mobile.service
```

### Xem log Metro realtime
```bash
journalctl --user -u nails-mobile-metro-8083.service -f
```

### Xem log tunnel realtime
```bash
journalctl --user -u cloudflared-nails-mobile.service -f
```

---

## Kiểm tra endpoint

### Kiểm tra manifest Expo
```bash
curl -i \
  -H 'Expo-Platform: ios' \
  -H 'Expo-Protocol-Version: 0' \
  -H 'Accept: application/expo+json,application/json' \
  https://cham.thongdong.io.vn
```

### Kiểm tra bundle iOS
```bash
curl -I 'https://cham.thongdong.io.vn/apps/mobile/index.bundle?platform=ios&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.bytecode=1&transform.routerRoot=app&unstable_transformProfile=hermes-stable'
```

---

## Khi Expo Go báo lỗi

### 1) Thử lại sạch
- đóng hẳn Expo Go
- mở lại
- nhập lại:
  - `exps://cham.thongdong.io.vn`

### 2) Nếu vẫn lỗi
- xóa project recent trong Expo Go
- vào lại bằng link trên

### 3) Nếu vẫn lì
- restart Metro
- đợi warm-up chạy xong
- mở lại Expo Go

---

## File quan trọng

### Mobile config
- `apps/mobile/app.json`

### Root env local
- `.env.local`

### Metro start script
- `/root/.local/bin/nails-mobile-metro-8083.sh`

### Warm-up script
- `/root/.local/bin/nails-mobile-warmup.sh`

### Metro service
- `/root/.config/systemd/user/nails-mobile-metro-8083.service`

### Tunnel service
- `/root/.config/systemd/user/cloudflared-nails-mobile.service`

### Cloudflare config
- `/root/.cloudflared/config.yml`

---

## Ghi chú

- Không dùng quick tunnel nữa cho mobile.
- Endpoint ổn định hiện tại là `cham.thongdong.io.vn`.
- Web app không phải mục tiêu chính ở flow này; domain đang được dùng ưu tiên cho Expo dev endpoint.
