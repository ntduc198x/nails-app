# Nails App Monorepo

Monorepo nay da duoc tach ro thanh 3 khu vuc chinh de khi len GitHub co the nhin ngay:

- `apps/web`: web app Next.js
- `apps/mobile`: mobile app Expo / React Native
- `packages/shared`: logic va type dung chung

## Cau truc thu muc

```text
nails-app/
  apps/
    mobile/   # Expo app
    web/      # Next.js app
  packages/
    shared/   # domain logic, types, helpers dung chung
  scripts/    # script chay web/mobile, build helper
  supabase/   # SQL, patch, schema va tai lieu DB
```

## Chay local

### Web

```bash
cd D:\Code\nails-app
npm install
npm run dev
```

Web app se chay bang source trong `apps/web`.

### Mobile

```bash
cd D:\Code\nails-app
npm install
npm run mobile:go:cloudflare
```

## Script chinh

### Root scripts

- `npm run dev`: chay web app
- `npm run build`: build web app
- `npm run start`: start web app
- `npm run lint`: lint web + mobile
- `npm run typecheck`: typecheck web + mobile

### Web scripts

- `npm run web:dev`
- `npm run web:build`
- `npm run web:start`
- `npm run web:lint`
- `npm run web:typecheck`

### Mobile scripts

- `npm run mobile:start`
- `npm run mobile:go:lan`
- `npm run mobile:go:cloudflare`
- `npm run mobile:android`
- `npm run mobile:ios`
- `npm run mobile:lint`
- `npm run mobile:typecheck`

## Bien moi truong

Hien tai root `.env.local` van duoc dung de de van hanh dong bo.

- Web scripts doc env tu root `.env` / `.env.local`
- Mobile van doc env theo lane Expo nhu hien tai

## Ghi chu

- Web da duoc dua vao `apps/web`, khong con nam lon xon o root nua
- Root package chi dong vai tro workspace orchestrator
- Neu can review source web, vao thang `apps/web/src`
- Neu can review source mobile, vao thang `apps/mobile/app` va `apps/mobile/src`
