# Repository Guidelines

## Project Structure & Module Organization
This repository is an npm workspace monorepo. Primary code lives in `apps/web` for the Next.js web app, `apps/mobile` for the Expo/React Native app, and `packages/shared/src` for shared contracts, validation, and domain helpers. Web source is organized under `apps/web/src/app`, `components`, and `lib`. Mobile routes live in `apps/mobile/app`, with reusable logic in `apps/mobile/src`. Database work is tracked in `supabase/migrations`, `supabase/patches`, `supabase/seeds`, and `supabase/functions`. Operational notes and architecture docs live in `docs/`.

## Build, Test, and Development Commands
Run `npm install` once at the root.

- `npm run dev`: starts the web app workspace locally.
- `npm run build`: builds the web app for production.
- `npm run lint`: runs ESLint for both web and mobile.
- `npm run typecheck`: runs TypeScript checks for both web and mobile.
- `npm run mobile:start`: starts Expo locally.
- `npm run mobile:go:cloudflare`: starts the mobile dev flow through Cloudflare.
- `npm run mobile:android`: launches the Android build flow.
- `npm run services:seed:priceboard`: updates service seed data from the sample price board.

## Coding Style & Naming Conventions
Use TypeScript for app and shared code. Follow the existing style: 2-space indentation, semicolons, single-purpose modules, and descriptive filenames in kebab-case such as `landing-booking.ts` or `manage-quick-nav.tsx`. Keep React components in PascalCase, hooks in `use-*` files, and shared domain helpers grouped by feature in `packages/shared/src`. Linting is enforced with ESLint via `eslint.config.mjs`; run lint before opening a PR.

## Testing Guidelines
There is no dedicated automated test suite in the root workspace yet. Until one is added, treat `npm run lint` and `npm run typecheck` as required pre-merge checks. For data or schema changes, include the exact migration or seed file touched and document manual verification steps in the PR.

## Commit & Pull Request Guidelines
Recent history favors short, imperative commit subjects such as `Fix landing admin and auth build regressions` and `chore: clean repo structure`. Use the same pattern: start with `Fix`, `Add`, `Refactor`, or `chore:` and keep the scope concrete. PRs should include a brief summary, affected areas (`apps/web`, `apps/mobile`, `supabase`, etc.), validation commands run, and screenshots for UI changes.

## Configuration & Data Notes
Root `.env.local` is the main environment source for shared scripts. Do not commit secrets. Prefer new SQL files in `supabase/migrations` for durable schema changes; keep one-off repair scripts isolated in `supabase/patches`.
