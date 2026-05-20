# Nails App Monorepo

Monorepo nay gom 3 phan chinh:

- `apps/web`: Next.js web app
- `apps/mobile`: Expo / React Native mobile app
- `packages/shared`: shared contracts, types, va helpers

## Bat dau nhanh

```bash
npm install
npm run dev
```

Mobile lane:

```bash
npm run mobile:go:cloudflare
```

## Lenh chinh

- `npm run dev`: chay web app
- `npm run build`: build web app
- `npm run lint`: lint web + mobile
- `npm run typecheck`: typecheck web + mobile
- `npm run services:seed:priceboard`: seed lai bang `services` tu bang gia mau

## Tai lieu

- [docs/README.md](D:/Code/debug/nails-app/docs/README.md): chi muc tai lieu
- [repository-summary.md](D:/Code/debug/nails-app/docs/architecture/repository-summary.md): tong quan ky thuat
- [sop.md](D:/Code/debug/nails-app/docs/operations/sop.md): van hanh, backup, release, troubleshooting
- [expo-dev-operations.md](D:/Code/debug/nails-app/docs/operations/expo-dev-operations.md): Expo/Cloudflare mobile dev
- [supabase/README.md](D:/Code/debug/nails-app/supabase/README.md): cau truc SQL, patches, migrations, seeds

## Ghi chu

- Root package chi dong vai tro workspace orchestrator.
- Root `.env` / `.env.local` van la nguon env chinh cho web va mobile scripts.
- Source web nam trong `apps/web/src`; source mobile nam trong `apps/mobile/app` va `apps/mobile/src`.
