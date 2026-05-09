# REPOSITORY SUMMARY - NAILS APP

## 1. TỔNG QUAN PROJECT

### 1.1 Thông tin cơ bản

- **Tên Project**: Nails App
- **Loại**: Monorepo với Web (Next.js) và Mobile (React Native/Expo)
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **Tính năng chính**: Quản lý salon nail, đặt lịch, CRM, Telegram bot, Lookbook, Báo cáo

### 1.2 Cấu trúc thư mục

```
nails-app/
├── apps/
│   ├── web/              # Next.js web application
│   └── mobile/           # React Native/Expo mobile application
├── packages/
│   └── shared/           # Shared TypeScript types and utilities
├── supabase/             # Database schema and migrations
├── scripts/              # Development and deployment scripts
├── package.json          # Root workspace configuration
└── tsconfig.json         # Base TypeScript configuration
```

---

## 2. WEB APPLICATION (`apps/web`)

### 2.1 Công nghệ

- **Framework**: Next.js 15 (App Router)
- **UI**: React 19 with TypeScript
- **Styling**: CSS Modules + Global CSS
- **Backend**: Supabase client

### 2.2 Cấu trúc source (`apps/web/src/`)

```
apps/web/src/
├── app/                  # Next.js App Router pages
│   ├── page.tsx           # Landing page (public)
│   ├── login/             # Login page
│   ├── account/          # User account page
│   ├── auth/callback/    # OAuth callback handler
│   ├── receipt/[token]/  # Receipt page
│   ├── stories/[id]/      # Lookbook story page
│   ├── manage/           # Admin dashboard pages
│   │   ├── page.tsx      # Dashboard home
│   │   ├── appointments/
│   │   ├── booking-requests/
│   │   ├── checkout/
│   │   ├── customers/
│   │   ├── landing/
│   │   ├── reports/
│   │   ├── services/
│   │   ├── shifts/
│   │   ├── team/
│   │   ├── tax-books/
│   │   └── resources/
│   └── api/              # API routes
│       ├── booking-request/
│       ├── customer/
│       ├── lookbook/
│       └── telegram/
├── components/           # Reusable React components
│   ├── landing/          # Landing page components
│   ├── manage-*.tsx      # Admin dashboard components
│   └── *.tsx             # Shared components
└── lib/                  # Business logic and utilities
    ├── supabase.ts       # Supabase client configuration
    ├── auth.ts           # Authentication & authorization
    ├── domain.ts         # Organization context
    ├── booking-requests.ts # Booking request management
    ├── shift-*.ts        # Shift management
    ├── crm.ts            # CRM operations
    ├── reporting.ts      # Reporting functions
    ├── telegram-bot.ts   # Telegram integration
    └── *.ts              # Other utilities
```

### 2.3 Các trang quan trọng

#### Public Pages

| Page | File | Description |
|------|------|-------------|
| Landing | `app/page.tsx` | Public landing page with service showcase |
| Login | `app/login/page.tsx` | User login page |
| Account | `app/account/page.tsx` | User account management |
| Auth Callback | `app/auth/callback/page.tsx` | OAuth provider callback |
| Receipt | `app/receipt/[token]/page.tsx` | View receipt by token |
| Stories | `app/stories/[id]/page.tsx` | Lookbook story viewer |

#### Admin Dashboard Pages (`/manage`)

| Route | Page | Description |
|-------|------|-------------|
| `/manage` | Dashboard | Main admin dashboard |
| `/manage/appointments` | Appointments | Manage appointments calendar |
| `/manage/booking-requests` | Booking Requests | Manage booking requests |
| `/manage/checkout` | Checkout | Point of sale / checkout |
| `/manage/customers` | Customers | Customer list and management |
| `/manage/customers/[customerId]` | Customer Detail | Individual customer view |
| `/manage/landing` | Landing Page | Landing page content management |
| `/manage/reports` | Reports | Business reports and analytics |
| `/manage/reports/[ticketId]` | Report Detail | Specific report view |
| `/manage/services` | Services | Service catalog management |
| `/manage/shifts` | Shifts | Staff schedule management |
| `/manage/team` | Team | Team member management |
| `/manage/tax-books` | Tax Books | Tax documentation |
| `/manage/resources` | Resources | Resource/equipment management |
| `/manage/account` | Account | Account settings |

### 2.4 API Routes (`/api`)

#### Booking Request API

- `POST /api/booking-request` - Create booking request

#### Customer API

- `GET /api/customer/explore` - Customer explore/feed
- `GET /api/customer/home-feed` - Home feed for customers

#### Lookbook API

- `GET /api/lookbook` - Get lookbook content

#### Telegram API

- `POST /api/telegram` - Main Telegram webhook
- `POST /api/telegram/callback` - Telegram callback
- `POST /api/telegram/content` - Content management
- `POST /api/telegram/setup` - Bot setup
- `POST /api/telegram/notify` - Send notifications
- `POST /api/telegram/dev` - Development endpoints
- `POST /api/telegram/appointments-overdue` - Overdue appointment notifications
- `POST /api/telegram/daily-summary` - Daily summary notifications

### 2.5 Key Library Files

| File | Purpose | Dependencies |
|------|---------|---------------|
| `lib/supabase.ts` | Supabase client initialization | `@supabase/supabase-js` |
| `lib/auth.ts` | Authentication & role management | `supabase.ts`, `domain.ts`, `@nails/shared` |
| `lib/domain.ts` | Organization context | - |
| `lib/booking-requests.ts` | Booking request CRUD | `supabase.ts`, `domain.ts`, `booking-capacity.ts` |
| `lib/shift-plans.ts` | Shift planning | `supabase.ts`, `domain.ts` |
| `lib/shift-attendance.ts` | Shift attendance tracking | `supabase.ts`, `domain.ts` |
| `lib/shift-staff-profiles.ts` | Staff profile management | `supabase.ts` |
| `lib/shift-forecast.ts` | Shift forecasting | - |
| `lib/crm.ts` | CRM operations | `supabase.ts`, `domain.ts` |
| `lib/reporting.ts` | Report generation | `supabase.ts`, `domain.ts` |
| `lib/telegram-bot.ts` | Telegram bot integration | `supabase.ts` |
| `lib/tax-books.ts` | Tax book management | `supabase.ts`, `domain.ts` |
| `lib/invite-codes.ts` | Invite code management | `supabase.ts` |
| `lib/app-session.ts` | Session management | `supabase.ts` |
| `lib/role-labels.ts` | Role label definitions | - |
| `lib/mock-data.ts` | Mock data for development | - |
| `lib/landing-content.ts` | Landing page content | `supabase.ts` |
| `lib/landing-booking.ts` | Landing page booking | `supabase.ts` |
| `lib/manage-landing-auth.ts` | Landing auth management | - |
| `lib/manage-setup-auth.ts` | Setup auth management | - |
| `lib/device-fingerprint.ts` | Device identification | - |
| `lib/booking-capacity.ts` | Booking capacity logic | `supabase.ts` |
| `lib/service-images.ts` | Service image management | - |
| `lib/route-secrets.ts` | Route secrets | - |
| `lib/web-auth.ts` | Web authentication | - |

### 2.6 Key Components

| Component | Location | Description |
|-----------|----------|-------------|
| `app-shell.tsx` | `components/` | Main app layout shell |
| `manage-*.tsx` | `components/` | Admin dashboard components |
| `landing-*.tsx` | `components/landing/` | Landing page components |
| `deferred-render.tsx` | `components/` | Deferred rendering utility |
| `app-lazy-image.tsx` | `components/` | Lazy image loading |

---

## 3. MOBILE APPLICATION (`apps/mobile`)

### 3.1 Công nghệ

- **Framework**: React Native with Expo
- **Language**: TypeScript
- **Navigation**: Expo Router
- **State Management**: React Context + Custom hooks
- **Storage**: AsyncStorage + Expo SecureStore

### 3.2 Cấu trúc source (`apps/mobile/src/`)

```
apps/mobile/src/
├── features/
│   ├── admin/            # Admin feature modules
│   │   ├── ui.tsx        # Admin UI components
│   │   ├── manage-ui.tsx # Management UI
│   │   ├── manage.ts     # Management logic
│   │   ├── services-data.ts # Service data
│   │   ├── content-images.ts # Content images
│   │   ├── shifts/       # Shift management
│   │   │   └── data.ts   # Shift data
│   │   ├── navigation.ts # Admin navigation
│   │   └── notifications.ts # Notifications
│   └── customer/         # Customer feature modules
│       ├── ui.tsx        # Customer UI components
│       ├── data.ts       # Customer data
│       ├── strings.ts    # Localization strings
│       ├── image-preview-modal.tsx # Image preview
│       └── cached-image.tsx # Cached images
├── components/           # Shared components
│   ├── cached-app-image.tsx
│   └── masonry-grid.tsx
├── hooks/                # Custom React hooks
│   ├── use-customer-*.ts # Customer hooks
│   ├── use-admin-*.ts    # Admin hooks
│   └── use-*.ts          # General hooks
├── lib/                  # Utilities
│   ├── supabase.ts       # Supabase client
│   ├── env.ts            # Environment variables
│   ├── device.ts        # Device utilities
│   ├── app-session.ts    # Session management
│   ├── safe-storage.ts   # Secure storage
│   ├── profile-upsert.ts # Profile upsert
│   ├── profile-cache.ts  # Profile caching
│   ├── customer-image-url.ts
│   ├── customer-image-cache.ts
│   └── customer-feed-cache.ts
├── providers/            # React Context providers
│   ├── session-provider.tsx
│   └── customer-preferences-provider.tsx
├── design/
│   └── premium-theme.ts  # Theme configuration
└── app.json             # Expo configuration
```

### 3.3 Tính năng chính

#### Admin Features

- Dashboard overview
- Appointment management
- Customer management
- Service management
- Staff shift management
- Notifications
- Content image management

#### Customer Features

- Home feed
- Explore store
- Lookbook viewing
- Favorites
- Membership
- Booking history
- Upcoming bookings
- Guest booking

### 3.4 Key Library Files

| File | Purpose |
|------|---------|
| `lib/supabase.ts` | Supabase client with React Native storage |
| `lib/env.ts` | Mobile environment configuration |
| `lib/device.ts` | Device information utilities |
| `lib/app-session.ts` | Mobile session management |
| `lib/safe-storage.ts` | Secure storage wrapper |
| `lib/profile-upsert.ts` | Profile upsert operations |
| `lib/profile-cache.ts` | Profile caching |
| `lib/customer-image-url.ts` | Image URL generation |
| `lib/customer-image-cache.ts` | Image caching |
| `lib/customer-feed-cache.ts` | Feed caching |

### 3.5 Key Hooks

| Hook | Purpose |
|------|---------|
| `use-customer-home-feed` | Customer home feed data |
| `use-customer-explore` | Explore store data |
| `use-customer-favorites` | Customer favorites |
| `use-customer-membership` | Membership data |
| `use-customer-history` | Booking history |
| `use-customer-upcoming-bookings` | Upcoming bookings |
| `use-lookbook-services` | Lookbook services |
| `use-guest-booking` | Guest booking flow |
| `use-admin-operations` | Admin operations |
| `use-admin-overview` | Admin dashboard |

---

## 4. SHARED PACKAGE (`packages/shared`)

### 4.1 Overview

The shared package contains TypeScript types, interfaces, and utilities used by both web and mobile applications.

### 4.2 Module Structure

| Module | Purpose |
|--------|---------|
| `auth.ts` | Authentication types |
| `session.ts` | Session types |
| `org.ts` | Organization types |
| `roles.ts` | Role definitions |
| `format.ts` | Formatting utilities |
| `validation.ts` | Validation schemas |
| `booking.ts` | Booking types |
| `appointments.ts` | Appointment types |
| `checkout.ts` | Checkout types |
| `dashboard.ts` | Dashboard types |
| `crm.ts` | CRM types |
| `reporting.ts` | Reporting types |
| `services.ts` | Service types |
| `resources.ts` | Resource types |
| `team.ts` | Team types |
| `tax-books.ts` | Tax book types |
| `customer-feed.ts` | Customer feed types |
| `customer-explore.ts` | Customer explore types |
| `customer-personalization.ts` | Personalization types |
| `admin-content.ts` | Admin content types |
| `auto-schedule.ts` | Auto-schedule types |

### 4.3 Dependencies

- **zod**: Data validation library

---

## 5. SUPABASE DATABASE (`supabase/`)

### 5.1 Overview

The supabase directory contains SQL migration files that define the database schema, including tables, views, functions, and seed data.

### 5.2 Main Schema Files

| File | Description |
|------|-------------|
| `bootstrap.sql` | Initial schema setup (4481 lines) |
| `deploy.sql` | Deployment script |

### 5.3 Key Tables (from bootstrap.sql)

- `orgs` - Organizations
- `branches` - Branches/locations
- `profiles` - User profiles
- `user_roles` - User roles and permissions
- `customers` - Customer records
- `resources` - Equipment/resources (chairs, tables, rooms)
- `services` - Services offered
- `appointments` - Scheduled appointments
- `booking_requests` - Booking requests
- And more...

### 5.4 Migration Files by Date

#### April 2026

- `auth_social_customer_patch_2026_04.sql` - Social auth for customers
- `partner_branch_roles_shift_plans_2026_04.sql` - Partner/branch/roles/shift plans
- `shift_plans_2026_04.sql` - Shift plans
- `shift_attendance_requests_2026_04.sql` - Shift attendance
- `staff_shift_profiles_2026_04.sql` - Staff shift profiles
- `customer_content_feed_2026_04.sql` - Content feed
- `customer_explore_storefront_2026_04.sql` - Explore storefront
- `customer_lookbook_public_read_2026_04.sql` - Lookbook public read
- `customer_mobile_schema_2026_04.sql` - Mobile schema
- `crm_patch_2026_04.sql` - CRM patch

#### May 2026

- `booking_web_delete_partner_patch_2026_05.sql`
- `fix_convert_booking_request_secure.sql`
- `partner_invite_telegram_scope_patch_2026_05.sql`
- `auth_signup_forbidden_role_insert_patch_2026_05.sql`
- `auth_runtime_patch_2026_05_user_roles_conflict.sql`
- `customer_scope_repair_2026_05.sql`
- `customer_mobile_runtime_patch_2026_05.sql`
- `customer_membership_settings_seed_2026_05.sql`
- `customer_lookbook_backfill_2026_05.sql`
- `storefront_products_cham_mock_2026_05.sql`
- `ensure_default_workspace_runtime_patch_2026_05.sql`
- `fresh_project_patch.sql`
- `app_sessions.sql`
- `runtime_patch_2026_04_telegram_booking.sql`

---

## 6. SCRIPTS (`scripts/`)

| Script | Purpose |
|--------|---------|
| `run-web-next.mjs` | Start Next.js development server |
| `run-mobile-expo.mjs` | Start Expo development server |
| `run-mobile-cloudflared.mjs` | Start cloudflared tunnel for mobile |
| `shared-env.mjs` | Share environment variables |
| `update-services-from-priceboard.js` | Update services from priceboard |
| `check-mobile-env.mjs` | Check mobile environment configuration |

---

## 7. NPM SCRIPTS

### Root Scripts

```bash
npm run dev              # Start web development
npm run build            # Build web app
npm run start            # Start web app
npm run lint             # Lint web + mobile
npm run typecheck        # Typecheck web + mobile
```

### Web Scripts

```bash
npm run web:dev
npm run web:build
npm run web:start
npm run web:lint
npm run web:typecheck
```

### Mobile Scripts

```bash
npm run mobile:start
npm run mobile:go:lan
npm run mobile:go:cloudflare
npm run mobile:android
npm run mobile:ios
npm run mobile:lint
npm run mobile:typecheck
```

---

## 8. INTERCONNECTIONS

### 8.1 Web App Dependencies

```
apps/web
├── imports @nails/shared (types, utilities)
├── imports @supabase/supabase-js
├── uses lib/supabase.ts
├── uses lib/auth.ts → imports domain.ts, device-fingerprint.ts
├── uses lib/booking-requests.ts → imports domain.ts, booking-capacity.ts
└── uses lib/shift-*.ts → imports domain.ts
```

### 8.2 Mobile App Dependencies

```
apps/mobile
├── imports @nails/shared (types, utilities)
├── imports @supabase/supabase-js
├── imports expo modules
├── uses lib/supabase.ts → imports env.ts, safe-storage.ts
├── uses lib/env.ts
└── uses various hooks from hooks/
```

### 8.3 Shared Package

```
packages/shared
├── exports types from auth, session, org, roles, etc.
├── imports zod for validation
└── used by both web and mobile
```

### 8.4 Supabase Integration

```
Both apps use Supabase for:
├── Authentication (email, OAuth)
├── Database (PostgreSQL)
├── Realtime subscriptions
└── Storage (for images)
```

---

## 9. DEVELOPMENT WORKFLOW

### 9.1 Local Development

1. **Web**: `npm run dev` starts Next.js at http://localhost:3000
2. **Mobile**: `npm run mobile:go:cloudflare` starts Expo with cloudflare tunnel
3. **Database**: Supabase local or cloud instance

### 9.2 Environment Variables

- Root `.env.local` contains shared environment
- `apps/web/.env.local` for web-specific vars
- `apps/mobile/.env.local` for mobile-specific vars
- `apps/mobile/.env` for Expo vars

---

## 10. KEY INTEGRATIONS

### 10.1 Telegram Bot

- Webhook-based integration
- Notifications for bookings, appointments, daily summaries
- Content management via bot

### 10.2 Authentication

- Supabase Auth (email/password, OAuth)
- Role-based access control (OWNER, PARTNER, MANAGER, RECEPTION, ACCOUNTANT, TECH, USER)
- Device session management

### 10.3 Booking System

- Booking requests with status workflow
- Capacity management
- Convert requests to appointments

---

## 11. FILE NAMING CONVENTIONS

- **Components**: PascalCase (e.g., `ManageBookingRequestsPanel.tsx`)
- **Utilities**: camelCase (e.g., `booking-requests.ts`)
- **Pages**: kebab-case (e.g., `booking-requests/page.tsx`)
- **SQL migrations**: `descriptive_name_date.sql`

---

## 12. NOTES FOR DEVELOPERS

1. **Web app uses @ alias** - configured in tsconfig.json to point to `apps/web/src`
2. **Mobile uses Expo** - requires Expo CLI and environment
3. **Shared package is internal** - not published to npm
4. **Database migrations are additive** - never modify old migration files
5. **Telegram bot requires** - Bot token and webhook configuration
6. **Device sessions** - Used for security and session management

---

*Last updated: May 2026*