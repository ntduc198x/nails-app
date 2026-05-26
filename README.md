# Nails App Monorepo

Monorepo cho he thong dat lich va van hanh salon, gom web app, mobile app, shared domain layer, va bo SQL cho Supabase.

## Muc luc

- [Tong quan](#tong-quan)
- [Tech stack](#tech-stack)
- [Cau truc repo](#cau-truc-repo)
- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
- [Bien moi truong](#bien-moi-truong)
- [Lenh chinh](#lenh-chinh)
- [Phat trien web](#phat-trien-web)
- [Phat trien mobile](#phat-trien-mobile)
- [Supabase va SQL](#supabase-va-sql)
- [Kiem tra truoc khi merge](#kiem-tra-truoc-khi-merge)
- [Tai lieu bo sung](#tai-lieu-bo-sung)
- [Troubleshooting](#troubleshooting)

## Tong quan

Repo nay duoc to chuc theo npm workspaces:

- `apps/web`: Next.js web app, chua landing, customer flow, admin flow, API routes, Telegram hooks.
- `apps/mobile`: Expo / React Native app, dung Expo Router, test duoc bang Expo Go SDK 54.
- `packages/shared`: contracts, types, validation, helper dung chung giua web, mobile, va scripts.
- `supabase`: migrations, patches, bootstrap SQL, deploy SQL, seeds, Edge Functions.
- `docs`: ghi chu kien truc, SOP, va huong dan van hanh.

Muc tieu cua README nay la giup:

1. Clone repo va chay local nhanh.
2. Hieu workspace nao dung cho viec gi.
3. Khong vo tinh pha vo env, Expo, hoac schema Supabase.

## Tech stack

- **Package manager**: npm workspaces
- **Web**: Next.js 16, React 19, TypeScript
- **Mobile**: Expo SDK 54, React Native 0.81, Expo Router 6
- **Shared layer**: TypeScript package workspace
- **Database/Auth/Storage**: Supabase
- **Validation**: Zod
- **Linting**: ESLint
- **Build orchestration**: script wrappers trong `scripts/`

## Cau truc repo

```text
.
|- apps/
|  |- web/                  # Next.js app
|  |  |- src/app/           # routes, API routes
|  |  |- src/components/    # UI components
|  |  |- src/lib/           # data, auth, helpers
|  |
|  |- mobile/               # Expo app
|     |- app/               # Expo Router screens
|     |- src/               # shared mobile logic
|     |- android/           # tracked native Android project
|
|- packages/
|  |- shared/
|     |- src/               # contracts, helpers, shared types
|
|- scripts/                 # repo-level helper scripts
|- supabase/                # SQL, patches, seeds, Edge Functions
|- docs/                    # architecture + operations notes
|- package.json             # workspace root
|- .env.local               # local env source for scripts and apps
```

## Prerequisites

Can it nhat:

- Node.js 20+
- npm 10+
- Git

Cho mobile Android:

- Android Studio
- Android SDK
- `ANDROID_HOME`
- `ANDROID_SDK_ROOT`
- `%ANDROID_SDK_ROOT%\platform-tools` trong `PATH`

Cho Supabase remote:

- Supabase project
- `SUPABASE_SERVICE_ROLE_KEY`
- neu chay `supabase db push --linked`, can them `SUPABASE_DB_PASSWORD`

## Getting started

### 1. Clone repo

```bash
git clone <your-repo-url>
cd nails-app
```

### 2. Cai dependency

```bash
npm install
```

### 3. Tao va dien env

Repo nay su dung root `.env.local` lam nguon env chinh cho web va cac scripts mobile.

Neu chua co file:

```bash
copy .env.local.example .env.local
```

Neu repo khong co file example, tao thu cong `.env.local` va dien cac bien toi thieu o phan [Bien moi truong](#bien-moi-truong).

### 4. Chay web

```bash
npm run dev
```

Mac dinh web workspace chay qua:

```bash
npm run dev --workspace @nails/web
```

### 5. Chay mobile

Kiem tra env mobile truoc:

```bash
npm run mobile:env
```

Chay Expo theo LAN:

```bash
npm run mobile:go:lan
```

Neu can tunnel:

```bash
npm run mobile:go
```

Neu dang dung flow Cloudflare:

```bash
npm run mobile:go:cloudflare
```

## Bien moi truong

### Web va shared scripts

Toi thieu:

| Variable | Bat buoc | Mo ta |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | URL project Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public anon key cho web client |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes cho server routes / scripts | Service role key cho API routes va scripts |
| `NEXT_PUBLIC_APP_URL` | Nen co | Public base URL cua web app |

Web runtime dung cac bien nay truc tiep trong:

- `apps/web/src/lib/supabase.ts`
- `apps/web/src/app/api/app-session/route.ts`
- `apps/web/src/app/api/app-session/validate/route.ts`

### Mobile public env

Mobile doc `EXPO_PUBLIC_*` la hop dong chinh:

| Variable | Bat buoc | Mo ta |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | Supabase URL cho mobile |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key cho mobile |
| `EXPO_PUBLIC_API_BASE_URL` | Yes | Base URL de mobile goi Next API |
| `EXPO_PUBLIC_PASSWORD_RESET_URL` | Yes | URL reset password |
| `EXPO_PUBLIC_WEB_API_BASE_URL` | Optional | Override URL web API |
| `EXPO_PUBLIC_BOOKING_API_BASE_URL` | Optional | Fallback cho booking API |
| `EXPO_PUBLIC_DEFAULT_ORG_ID` | Optional | Default org hint |
| `EXPO_PUBLIC_DEFAULT_BRANCH_ID` | Optional | Default branch hint |

Mobile script `npm run mobile:env` se:

- doc root `.env.local`
- map mot so bien `NEXT_PUBLIC_*` cu sang `EXPO_PUBLIC_*`
- sync file env local cho workspace mobile
- fail som neu thieu cac key quan trong

### Telegram va route secrets

Neu dung Telegram bot flows tren web, can them mot hoac nhieu bien sau:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_BOOKING_CHAT_ID`
- `TELEGRAM_WEBHOOK_SECRET`
- `TELEGRAM_INTERNAL_ROUTE_SECRET`
- `BOOKING_TELEGRAM_ALERT_MEDIA_URL`
- `TELEGRAM_STATE_DIR`

## Lenh chinh

### Root commands

| Command | Mo ta |
| --- | --- |
| `npm install` | Cai dependency cho toan monorepo |
| `npm run dev` | Chay web app |
| `npm run build` | Build web app |
| `npm run start` | Start web production build |
| `npm run lint` | Lint web + mobile |
| `npm run typecheck` | Typecheck web + mobile |
| `npm run services:seed:priceboard` | Cap nhat seed dich vu tu bang gia mau |

### Web commands

| Command | Mo ta |
| --- | --- |
| `npm run web:dev` | Chay Next.js web app |
| `npm run web:build` | Build workspace web |
| `npm run web:start` | Start build web |
| `npm run web:lint` | Lint workspace web |
| `npm run web:typecheck` | Typecheck workspace web |

### Mobile commands

| Command | Mo ta |
| --- | --- |
| `npm run mobile:start` | Chay Expo start |
| `npm run mobile:go:lan` | Expo Go qua LAN |
| `npm run mobile:go` | Expo Go qua tunnel |
| `npm run mobile:go:cloudflare` | Mobile dev flow qua Cloudflare |
| `npm run mobile:android` | Run Android lane |
| `npm run mobile:prebuild` | Prebuild Android khong install |
| `npm run mobile:config` | In Expo config JSON |
| `npm run mobile:doctor` | Chay `expo-doctor` |
| `npm run mobile:env` | Validate va sync env cho mobile |
| `npm run mobile:ios` | Run iOS lane neu moi truong ho tro |
| `npm run mobile:lint` | Lint mobile |
| `npm run mobile:typecheck` | Typecheck mobile |

## Phat trien web

Web source chinh nam o:

- `apps/web/src/app`
- `apps/web/src/components`
- `apps/web/src/lib`

Nhung khu vuc dang quan trong:

- `src/app/api/*`: API routes cho booking, app session, Telegram, uploads
- `src/lib/supabase.ts`: Supabase clients
- `src/lib/route-secrets.ts`: webhook / internal route guard
- `src/lib/public-app-url.ts`: public base URL resolution

Khi sua web:

1. Chay `npm run web:lint`
2. Chay `npm run web:typecheck`
3. Neu sua API route co lien quan auth, kiem tra ca mobile flow neu endpoint duoc mobile goi

## Phat trien mobile

Mobile app dung:

- Expo SDK `54`
- Expo Router
- tracked native Android project trong `apps/mobile/android`

### Luu y quan trong cho Expo Go

- Repo nay da duoc keo ve Expo SDK 54 de tuong thich voi Expo Go tren dien thoai.
- `expo-doctor` da duoc clean. Check `appConfigFieldsNotSyncedCheck` dang bi disable co chu dich trong `apps/mobile/package.json`, vi repo co `android/` duoc track song song voi app config.
- Neu muon bat lai check do:

```json
{
  "expo": {
    "doctor": {
      "appConfigFieldsNotSyncedCheck": {
        "enabled": true
      }
    }
  }
}
```

### Auth tren mobile

Tinh trang hien tai:

- Google sign-in con hoat dong
- Apple sign-in da bi go bo khoi UI, provider flow, config va dependency

### Badge thong bao

Admin notification badge tren mobile da duoc tinh theo tong:

- action notifications dang mo
- unread feed events

Nen khi tab "Dong su kien" co item moi, badge ben ngoai se tang dung.

## Supabase va SQL

Thu muc `supabase/` duoc chia thanh:

- `bootstrap.sql`: one-shot setup cho project moi
- `deploy.sql`: deploy core schema theo huong legacy
- `migrations/`: migration co thu tu
- `patches/`: SQL patch chia theo nhom
- `seeds/`: seed va backfill
- `functions/`: Edge Functions

### Workflow de xuat

Cho project moi:

1. Mo SQL Editor trong Supabase.
2. Chay `supabase/bootstrap.sql`.
3. Tao auth user dau tien.
4. User dau tien se duoc bind vao org/branch mac dinh va nhan role `OWNER`.

Cho project dang ton tai:

1. Uu tien tao file moi trong `supabase/migrations/`.
2. Chi dat SQL sua nong / runtime vao `supabase/patches/`.
3. Neu da link CLI voi project:

```bash
npx supabase db push --linked
```

4. Neu can chay verify script:

```bash
npx supabase db query --linked --file supabase/patches/<file>.sql
```

### File quan trong hien tai

- `supabase/bootstrap.sql`
- `supabase/deploy.sql`
- `supabase/migrations/20260526203000_harden_admin_notification_and_org_policies.sql`
- `supabase/patches/20260526_verify_harden_admin_notification_and_org_policies.sql`

## Kiem tra truoc khi merge

Repo hien chua co bo test root rieng, nen toi thieu phai chay:

```bash
npm run lint
npm run typecheck
```

Neu vua sua mobile lane:

```bash
npm run mobile:doctor
```

Neu sua env mobile:

```bash
npm run mobile:env
```

Neu sua SQL:

- ghi ro migration hoac patch nao da doi
- ghi ro da apply remote chua
- neu apply that, note them verify step trong PR hoac commit context

## Tai lieu bo sung

- [docs/README.md](./docs/README.md): chi muc tai lieu
- [docs/architecture/repository-summary.md](./docs/architecture/repository-summary.md): tong quan kien truc repo
- [docs/operations/sop.md](./docs/operations/sop.md): SOP van hanh, release, backup, troubleshooting
- [docs/operations/expo-dev-operations.md](./docs/operations/expo-dev-operations.md): huong dan Expo / Cloudflare dev flow
- [supabase/README.md](./supabase/README.md): chi tiet bo SQL va patch layout

## Troubleshooting

### 1. Mobile khong doc duoc API tren dien thoai that

Nguyen nhan thuong gap:

- `EXPO_PUBLIC_API_BASE_URL` dang tro vao `localhost`

Kiem tra:

```bash
npm run mobile:env
```

Neu can test tren may that, dung:

- LAN IP cua may dev
- tunnel
- Cloudflare flow

### 2. Web boot len loi Supabase env

Neu thay loi kieu:

```text
Missing Supabase env: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Hay bo sung lai `.env.local` o root.

### 3. `expo-doctor` bao warning non-CNG

Repo nay co `apps/mobile/android` duoc track. Warning do da duoc tat bang config doctor trong `apps/mobile/package.json`. Day la lua chon co chu dich, khong phai loi dependency.

### 4. `supabase db push --linked` doi password

Export password truoc:

```bash
set SUPABASE_DB_PASSWORD=your-password
```

hoac tren PowerShell:

```powershell
$env:SUPABASE_DB_PASSWORD="your-password"
```

### 5. Typecheck pass o workspace, nhung app van loi runtime

Hay kiem tra them:

- env da map dung chua
- mobile co sync env local chua
- route secret co du key chua
- migration da apply remote chua

## Ghi chu cho contributor

- Uu tien TypeScript cho app va shared code.
- Ten file theo kebab-case.
- Component React dung PascalCase.
- Hook dat theo `use-*`.
- SQL ben vung dat trong `supabase/migrations`.
- SQL sua nong dat trong `supabase/patches`.

Neu can cap nhat README nay, dung thong tin that cua repo. Khong ghi duong dan tuyet doi may local vao file.
