# SOP - Nails App Standard Operating Procedures

> **Version:** 1.0  
> **Last Updated:** 2026-05-11  
> **Author:** Chạm - AI Assistant

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [User Guide](#2-user-guide)
3. [Troubleshooting Guide](#3-troubleshooting-guide)
4. [Data Backup Procedures](#4-data-backup-procedures)
5. [Release Procedures](#5-release-procedures)
6. [Appendices](#6-appendices)

---

## 1. Project Overview

### 1.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            NAILS APP ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐                    ┌─────────────────────────────┐     │
│  │   WEB APP   │                    │      MOBILE APP             │     │
│  │  (Next.js)  │                    │  (Expo / React Native)      │     │
│  │             │                    │                             │     │
│  │  - Landing  │                    │  - Customer Shell           │     │
│  │  - Admin    │◄──────────────────►│    - Feed, Explore          │     │
│  │  - Reports  │   Shared Package   │    - Booking, Profile       │     │
│  │  - Settings │                    │  - Admin Shell              │     │
│  │             │                    │    - Overview, Queue        │     │
│  └──────┬──────┘                    │    - Checkout, Scheduling   │     │
│         │                           └──────────────┬──────────────┘     │
│         │                                          │                    │
│         │    ┌─────────────────────────────────────┴──────────────┐     │
│         │    │              SHARED PACKAGE (@nails/shared)        │     │
│         │    │                                                    │     │
│         │    │  - Auth & Session contracts                        │     │
│         │    │  - Role management (OWNER/PARTNER/MANAGER/...      │     │
│         │    │  - Booking & Appointments DTOs                     │     │
│         │    │  - CRM & Dashboard adapters                        │     │
│         │    │  - Customer explore/feed contracts                 │     │
│         │    └────────────────────────────────────────────────────┘     │
│         │                                                       │       │
│         └───────────────────────┬───────────────────────────────┘       │
│                                 │                                       │
│                                 ▼                                       │
│                    ┌────────────────────────┐                           │
│                    │      SUPABASE          │                           │
│                    │                        │                           │
│                    │  - PostgreSQL          │                           │
│                    │  - Auth                │                           │
│                    │  - Realtime            │                           │
│                    │  - Storage             │                           │
│                    │  - RPC + RLS           │                           │
│                    └────────────────────────┘                           │
│                                                                         │
│                    ┌────────────────────────┐                           │
│                    │    TELEGRAM BOT        │                           │
│                    │                        │                           │
│                    │  - Notifications       │                           │
│                    │  - Quick actions       │                           │
│                    │  - Daily summaries     │                           │
│                    └────────────────────────┘                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Tech Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Web Framework | Next.js | 16.2.x |
| Mobile Framework | Expo SDK | 54 |
| Database | PostgreSQL (Supabase) | - |
| Auth | Supabase Auth | - |
| Language | TypeScript | 5.9.x |
| Package Manager | npm (workspaces) | - |

### 1.3 User Roles

| Role | Description | Access Level |
|------|-------------|--------------|
| `OWNER` | Chủ salon | Full access |
| `PARTNER` | Đối tác | Full access (multi-org) |
| `MANAGER` | Quản lý | Full access |
| `RECEPTION` | Lễ tân | Booking, checkout |
| `ACCOUNTANT` | Kế toán | Checkout, reports |
| `TECH` | Kỹ thuật viên | Appointments |
| `USER` | Khách hàng | Customer shell |

### 1.4 Data Model - Branch vs Org

| Entity | Level | Has branch_id | Notes |
|--------|-------|---------------|-------|
| `orgs` | Org | ❌ | Organization level |
| `branches` | Branch | ❌ | Belongs to org |
| `profiles` | User | ✅ `default_branch_id` | User's default branch |
| `user_roles` | User | ✅ | User's role per branch/org |
| `services` | Service | ✅ Nullable | NULL = org-wide, otherwise branch-specific |
| `appointments` | Transaction | ✅ | Per branch |
| `tickets` | Transaction | ✅ | Per branch |
| `payments` | Transaction | ✅ | Per branch |
| `receipts` | Transaction | ✅ | Per branch |
| `customers` | Customer | ❌ | Org-level only |
| `customer_accounts` | Customer link | ❌ | Org-level only |
| `shift_leave_requests` | Request | ❌ | Org-level only |

### 1.4 Mobile Route Structure

```
/
├── (auth)/              # Auth flows (sign-in, sign-up, reset)
├── (customer)/          # Customer shell
│   ├── feed/            # Home feed
│   ├── explore/         # Explore storefront
│   ├── booking/         # Booking flow
│   ├── profile/         # Profile & settings
│   └── history/         # Booking history
└── (admin)/             # Admin shell
    ├── overview/        # Dashboard
    ├── queue/           # Booking requests queue
    ├── appointments/    # Appointments management
    ├── checkout/        # Checkout counter
    ├── scheduling/      # Shift scheduling
    ├── shifts/          # Staff shifts
    ├── manage-team/     # Team management
    ├── manage-customers/# CRM
    ├── manage-services/ # Services management
    ├── manage-resources/# Resources
    ├── manage-content/  # Content (posts, offers)
    ├── manage-reports/  # Reports
    └── manage-tax-books/# Tax books
```

---

## 2. User Guide

### 2.1 Authentication Flow

#### 2.1.1 Sign In (Mobile)

```
┌────────────────────────────────────────────────────────────────┐
│                    MOBILE SIGN-IN FLOW                         │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────┐    ┌──────────────┐    ┌───────────────────┐     │
│  │  Launch  │───►│ Session      │───►│ Route by Role     │     │
│  │   App    │    │ Hydration    │    │                   │     │
│  └──────────┘    └──────────────┘    └───────────────────┘     │
│                       │                        │               │
│                       ▼                        ▼               │
│                  ┌─────────┐           ┌───────────────┐       │
│                  │ Error   │           │ isCustomerRole│       │
│                  └────┬────┘           └───────┬───────┘       │
│                       │                        │               │
│                       ▼                        ▼               │
│                  ┌──────────────┐      ┌──────────────┐        │
│                  │ Redirect to  │      │    YES       │        │
│                  │ /(auth)/sign-in     │ /(customer)/ │        │
│                  └──────────────┘      └──────┬───────┘        │
│                                               │                │
│                                               ▼                │
│                                         ┌──────────────┐       │
│                                         │     NO       │       │
│                                         │ /(admin)/    │       │
│                                         └──────────────┘       │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**Steps:**
1. App launches → `index.tsx` boots
2. `SessionProvider` hydrates from secure storage
3. Validates app session token via RPC
4. Determines role → redirects:
   - `USER` → `/(customer)`
   - `OWNER|PARTNER|MANAGER|RECEPTION|ACCOUNTANT|TECH` → `/(admin)`

#### 2.1.2 Sign In Methods

| Method | Description | Flow |
|--------|-------------|------|
| Email/Password | Traditional sign in | Enter credentials → Validate → Create app session |
| Google OAuth | Social login | Google auth → Callback → Create app session |
| Apple Sign-In | iOS social login | Apple auth → Callback → Create app session |

#### 2.1.3 Sign Up Flow

```
┌────────────────────────────────────────────────────────────────┐
│                      SIGN-UP FLOW                              │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Choose Mode:                                                  │
│  ┌─────────────────────┐    ┌─────────────────────┐            │
│  │    USER (Customer)  │    │   ADMIN (Staff)     │            │
│  │                     │    │                     │            │
│  │ - Browse content    │    │ - Requires invite   │            │
│  │ - Make bookings     │    │   code              │            │
│  │ - View history      │    │ - Select role       │            │
│  └─────────────────────┘    └─────────────────────┘            │
│                                                                │
│  ADMIN Sign Up:                                                │
│  1. Enter invite code                                          │
│  2. System validates code → returns org & role                 │
│  3. Create profile + user_roles record                         │
│  4. Redirect to appropriate admin section                      │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 2.2 Customer Features

#### 2.2.1 Booking Flow (Guest)

```
┌────────────────────────────────────────────────────────────────┐
│                    GUEST BOOKING FLOW                          │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌─────────┐    ┌───────────┐      ┌────────────┐              │
│  │ Explore │───►│ Select    │───►  │ Choose     │              │
│  │ Service │    │ Service   │      │ Date/Time  │              │
│  └─────────┘    └───────────┘      └─────┬──────┘              │
│                                          │                     │
│                                          ▼                     │
│                                    ┌───────────┐               │
│                                    │ Customer  │               │
│                                    │ Info      │               │
│                                    └─────┬─────┘               │
│                                          │                     │
│                                          ▼                     │
│                                    ┌────────────┐              │
│                                    │ Confirm    │              │
│                                    │ Booking    │              │
│                                    └─────┬──────┘              │
│                                          │                     │
│                                          ▼                     │
│  ┌──────────────┐    ┌─────────────────────────────────┐       │
│  │ Telegram     │◄───│ POST /api/booking-request       │       │
│  │ Notification │    │                                 │       │
│  └──────────────┘    │ Creates:                        │       │
│                      │ - booking_requests record       │       │
│                      │ - Sends Telegram notification   │       │
│                      │ - Staff can approve/reject      │       │
│                      └─────────────────────────────────┘       │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**Customer Screens:**
1. **Feed** (`/(customer)/index`) - Home feed with posts, offers
2. **Explore** (`/(customer)/explore`) - Browse services, team, gallery
3. **Booking** (`/(customer)/booking`) - Create new booking
4. **History** (`/(customer)/history`) - Past bookings
5. **Profile** (`/(customer)/profile`) - User profile & settings
6. **Membership** (`/(customer)/membership`) - Loyalty points

### 2.3 Admin Features

#### 2.3.1 Dashboard Overview

```
┌────────────────────────────────────────────────────────────────┐
│                    ADMIN DASHBOARD                             │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────┬──────────────┬──────────────┐                │
│  │   TODAY      │  QUEUE       │  REVENUE     │                │
│  │   --------   │  --------    │  --------    │                │
│  │   24         │   8          │   ₫12.5M     │                │
│  │   bookings   │   pending    │   today      │                │
│  └──────────────┴──────────────┴──────────────┘                │
│                                                                │
│  ┌──────────────┬──────────────┬──────────────┐                │
│  │  CHECKED-IN  │  COMPLETED   │  RATING      │                │
│  │  --------    │  --------    │  --------    │                │
│  │   12         │   18         │   4.8 ★     │                │
│  │   now        │   today      │   (256)      │                │
│  └──────────────┴──────────────┴──────────────┘                │
│                                                                │
│  Quick Actions:                                                │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐               │
│  │ Check-in│ │ Queue   │ │ Reports │ │ Staff   │               │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘               │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

#### 2.3.2 Booking Request Queue

```
┌────────────────────────────────────────────────────────────────┐
│                  BOOKING REQUEST QUEUE                         │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Request List:                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ [Avatar] Nguyễn Văn A                                  │    │
│  │         Classic Manicure - 14:00 today                 │    │
│  │         [Accept] [Reject] [Reschedule]                 │    │
│  └────────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ [Avatar] Trần Thị B                                    │    │
│  │         Gel Pedicure - 16:30 today                     │    │
│  │         [Accept] [Reject] [Reschedule]                 │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                │
│  Actions:                                                      │
│  - Accept: Convert to appointment, notify customer             │
│  - Reject: Cancel request, notify customer                     │
│  - Reschedule: Open time picker, propose new slot              │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

#### 2.3.3 Checkout Flow

```
┌────────────────────────────────────────────────────────────────┐
│                      CHECKOUT FLOW                             │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌────────────────────┐     ┌────────────────────┐             │
│  │  Appointment List  │───► │  Select Services   │             │
│  │  (Checked-in)      │     │  to Checkout       │             │
│  └────────────────────┘     └─────────┬──────────┘             │
│                                       │                        │
│                                       ▼                        │
│                                ┌──────────────┐                │
│                                │  Apply       │                │
│                                │  Discounts   │                │
│                                │  (member,    │                │
│                                │   promo)     │                │
│                                └──────┬───────┘                │
│                                       │                        │
│                                       ▼                        │
│                                ┌──────────────┐                │
│                                │  Payment     │                │
│                                │  Method      │                │
│                                └──────┬───────┘                │
│                                       │                        │
│                                       ▼                        │
│                                ┌──────────────┐                │
│                                │  Complete    │                │
│                                │  Receipt     │                │
│                                └──────────────┘                │
│                                                                │
│  Payment Methods:                                              │
│  - Cash                                                        │
│  - QR Code (VNPay, MoMo, etc.)                                 │
│  - Member points redemption                                    │
│  - Combo/discount codes                                        │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

#### 2.3.4 Scheduling & Shifts

```
┌────────────────────────────────────────────────────────────────┐
│                    SCHEDULING VIEW                             │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Week View:                                                    │
│        Mon     Tue     Wed     Thu     Fri     Sat     Sun     │
│   ┌───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┐    │
│  A│ 8 │ 8 │ 8 │ 8 │ 8 │ 8 │ - │   │ 8 │ 8 │ 8 │ 8 │ 8 │ - │    │
│   ├───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┤    │
│  B│ - │ 8 │ 8 │ 8 │ 8 │ 8 │ 8 │   │ - │ 8 │ 8 │ 8 │ 8 │ 8 │    │
│   ├───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┤    │
│  C│ 8 │ 8 │ - │ 8 │ 8 │ 8 │ 8 │   │ 8 │ 8 │ 8 │ - │ 8 │ 8 │    │
│   └───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┘    │
│                                                                │
│  A = Nguyễn Văn A (Tech)                                       │
│  B = Trần Thị B (Tech)                                         │
│  C = Lê Văn C (Tech)                                           │
│                                                                │
│  Actions:                                                      │
│  - Tap cell: Assign/edit shift                                 │
│  - Drag: Copy shift pattern                                    │
│  - Long press: Quick actions menu                              │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 3. Troubleshooting Guide

### 3.1 Authentication Issues

#### Issue: Login role redirect to customer instead of admin

**Symptoms:** OWNER or MANAGER role users are redirected to `(customer)` shell instead of `(admin)`

**Root Cause:** 
- User has `customer_account` record in database
- OR `registration_mode` is set to "USER"
- Logic incorrectly forces customer role

**Fix Applied (2026-05-11):**
```typescript
// packages/shared/src/session.ts - shouldForceCustomerRole()

// NEW LOGIC: Check user_roles first
const { data: existingRole } = await client
  .from("user_roles")
  .select("role")
  .eq("user_id", user.id)
  .maybeSingle();

if (existingRole?.role && existingRole.role !== "USER") {
  // Has valid internal role → never force customer
  return false;
}
```

#### Issue: Admin Google login creating customer account

**Symptoms:** Admin users logging in via Google are incorrectly added to `customers` and `customer_accounts` tables

**Root Cause:** `link_customer_account_by_phone()` function creates customer without checking if user already has admin profile

**Fix Applied (2026-05-11):**
```sql
-- In link_customer_account_by_phone() function

-- KEY FIX: Check if user already has org_id in profile (admin/manager)
IF v_profile.org_id IS NOT NULL THEN
  RAISE EXCEPTION 'ADMIN_USER_CANT_BE_CUSTOMER';
END IF;
```

**Logic Flow:**
```
User Google Login
       │
       ▼
Check profiles table
       │
 ┌─────┴─────┐
 │           │
 ▼           ▼
Has org_id   No org_id
(Admin)      (Customer)
 │           │
 ▼           ▼
Skip        Link/Create
customer    customer_accounts
creation    + customers
```

#### Issue: Services not filtering by branch correctly

**Symptoms:** Users see services from all branches or no services

**Root Cause:** `branch_id` in services table was being handled incorrectly

**Fix Applied (2026-05-11):**
```typescript
// services.ts - listAdminServicesForMobile()

// Filter by branch_id - show services of current branch + org-wide (null)
if (targetBranchId) {
  query = query.or(`branch_id.eq.${targetBranchId},branch_id.is.null`);
}
```

**Logic:**
- `branch_id = NULL` → Org-wide service (visible to all branches)
- `branch_id = <uuid>` → Branch-specific service (visible only to that branch)
- Query shows: current branch services + org-wide services

#### Issue: Session not persisting after app restart

**Symptoms:** User must sign in every time app restarts

**Diagnosis:**
1. Check if `app_sessions` table has record for user
2. Verify secure storage is working
3. Check RPC `validate_app_session` is functioning

**Solution:**
```bash
# Check app_sessions table
SELECT * FROM app_sessions 
WHERE user_id = '<user_id>' 
ORDER BY created_at DESC 
LIMIT 1;
```

### 3.2 Mobile App Issues

#### Issue: White screen after login (non-OWNER/PARTNER roles)

**Symptoms:** Users with RECEPTION, ACCOUNTANT, TECH roles see white screen

**Root Cause:** Role check logic missing certain roles in redirect condition

**Status:** Fixed in previous updates

#### Issue: Avatar shows square frame instead of circle

**Symptoms:** Avatar image has square border visible

**Fix:**
- Add `transparent` prop to image
- Use `avatarContainer` with proper `borderRadius`

### 3.3 Database Issues

#### Issue: Auth login error 42P10

**Error:** `ON CONFLICT (user_id, org_id, role)` invalid

**Fix:**
```bash
# Run patch
psql -h <host> -U postgres -d nails_app -f supabase/auth_runtime_patch_2026_05_user_roles_conflict.sql
```

#### Issue: Customer account linking error

**Error:** `ON CONFLICT (user_id)` dependency failure

**Fix:**
```bash
# Run patch
psql -h <host> -U postgres -d nails_app -f supabase/customer_mobile_runtime_patch_2026_05.sql
```

### 3.4 Web App Issues

#### Issue: Landing Feed layout shift on focus

**Symptoms:** Page shifts when returning from other tabs

**Fix:** Remove `useFocusEffect` in `manage-content.tsx`

#### Issue: Checkout screen jumping

**Symptoms:** Checkout content jumps on focus

**Fix:** Remove `useFocusEffect` in `checkout.tsx`

### 3.5 Error Code Reference

| Error Code | Meaning | Solution |
|------------|---------|----------|
| `42P10` | Invalid ON CONFLICT | Run user_roles conflict patch |
| `PGRST116` | No rows returned | Expected - handle null gracefully |
| `42883` | Function not found | Run bootstrap.sql to create functions |
| `42703` | Column does not exist | Run schema patches |
| `23502` | NOT NULL violation | Check required fields |

#### Issue: Admin user can't link customer account

**Error:** `ADMIN_USER_CANT_BE_CUSTOMER`

**Cause:** User already has `org_id` in profiles table (is admin)

**Solution:** This is expected behavior - admins cannot be customers. Use a different account for customer features.

---

## 4. Data Backup Procedures

### 4.1 Database Backup

#### 4.1.1 Manual Backup (Supabase Dashboard)

```
Steps:
1. Go to Supabase Dashboard → Your Project
2. Click "Backups" in left sidebar
3. Click "Create manual backup"
4. Wait for backup to complete
5. Download if needed for external storage
```

#### 4.1.2 Automated Backup Schedule

| Backup Type | Frequency | Retention |
|-------------|-----------|-----------|
| Full backup | Daily (00:00 UTC) | 7 days |
| Incremental | Hourly | 24 hours |
| WAL archiving | Continuous | 30 days |

#### 4.1.3 Restore from Backup

```
1. Supabase Dashboard → Settings → Database
2. Click "Restore database"
3. Select backup file
4. Confirm restoration
5. Wait for completion (may take 10-30 minutes)
6. Verify application functionality
```

### 4.2 Application Backup

#### 4.2.1 Code Repository

```bash
# Local backup
cd nails-app
git bundle create backup-$(date +%Y%m%d).bundle --all

# Push to remote
git push origin main
git push origin --tags
```

#### 4.2.2 Environment Variables

```bash
# Export current environment
# Web (.env.local)
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
PUBLIC_API_BASE_URL=

# Mobile (app config + environment)
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_API_BASE_URL=
EXPO_PUBLIC_PASSWORD_RESET_URL=
EXPO_PUBLIC_DEFAULT_ORG_ID=
EXPO_PUBLIC_DEFAULT_BRANCH_ID=
```

**Store securely:**
- Use Supabase dashboard secrets
- Document in password manager
- Keep offline copy in secure location

### 4.3 Image/Media Backup

```
Supabase Storage Buckets:
- avatars/        → User profile images
- services/       → Service images
- gallery/        → Salon gallery
- content/        → Marketing content
- receipts/       → Transaction receipts

Backup: Enable Point-in-time recovery in Supabase
```

### 4.4 Backup Verification Checklist

- [ ] Database backup completes without errors
- [ ] Code repository pushed to remote
- [ ] Environment variables documented
- [ ] Storage buckets have recovery enabled
- [ ] Restore procedure tested (at least annually)

---

## 5. Release Procedures

### 5.1 Pre-Release Checklist

```
Development Complete:
[ ] All features implemented and tested
[ ] No critical bugs open
[ ] Code passes lint and typecheck

Testing:
[ ] Unit tests pass
[ ] Integration tests pass
[ ] Manual testing on staging complete
[ ] Performance acceptable

Security:
[ ] No exposed secrets
[ ] RLS policies verified
[ ] Auth flows tested

Documentation:
[ ] Changelog updated
[ ] API changes documented
[ ] Migration scripts ready (if needed)
```

### 5.2 Build Process

#### 5.2.1 Web App Build

```bash
# Navigate to project root
cd nails-app

# Install dependencies
npm install

# Run typecheck
npm run typecheck

# Run lint
npm run lint

# Build for production
npm run build

# Output: apps/web/out/ or deployment to hosting
```

#### 5.2.2 Mobile App Build (Android)

```bash
# Development build (local)
npm run mobile:start        # Start Metro bundler
npm run mobile:android      # Run on emulator/device

# Production build (APK)
cd apps/mobile
expo prebuild --platform android
cd android
./gradlew assembleRelease

# Output: android/app/build/outputs/apk/release/
```

#### 5.2.3 Build Commands Reference

| Command | Description |
|---------|-------------|
| `npm run dev` | Start web dev server |
| `npm run build` | Build web for production |
| `npm run start` | Start production web |
| `npm run mobile:start` | Start Expo Metro |
| `npm run mobile:go:lan` | Start with LAN tunnel |
| `npm run mobile:android` | Run on Android |
| `npm run mobile:ios` | Run on iOS (Mac only) |
| `npm run typecheck` | TypeScript check all |
| `npm run lint` | ESLint all |

### 5.3 Release Steps

#### 5.3.1 Version Bump

```bash
# Update version in package.json
# Follow semantic versioning: MAJOR.MINOR.PATCH
# e.g., 1.0.0 → 1.1.0

# Update CHANGELOG.md
## [1.1.0] - YYYY-MM-DD
### Added
- New feature descriptions
### Changed
- Updated features
### Fixed
- Bug fixes
```

#### 5.3.2 Database Migration (if needed)

```bash
# Create migration
# supabase/migrations/YYYYMMDD_description.sql

# Apply to staging
psql -h staging-db -U postgres -d nails_app -f supabase/migrations/YYYYMMDD_description.sql

# Test thoroughly

# Apply to production (maintain backup first)
psql -h production-db -U postgres -d nails_app -f supabase/migrations/YYYYMMDD_description.sql
```

#### 5.3.3 Deploy

**Web:**
```bash
# Deploy to hosting (Vercel, Netlify, etc.)
# Or: npm run start (if self-hosting)
```

**Mobile:**
```bash
# Option 1: Local APK
# Build APK → Share via file transfer

# Option 2: EAS Update (if configured)
eas update --branch production

# Option 3: Google Play (Release)
# Upload AAB to Google Play Console
```

### 5.4 Post-Release

```
Monitoring:
[ ] Check error tracking (if configured)
[ ] Monitor performance metrics
[ ] Watch for user reports

Communication:
[ ] Announce release to team
[ ] Update users if significant changes
[ ] Document any issues found
```

### 5.5 Rollback Procedure

```
If critical issue discovered:

1. Stop deployment
2. Identify the problem

Web:
- Revert to previous deployment
- Restore from backup if needed

Mobile:
- Pull previous version from history
- Reject update in Play Store if live

Database:
- Restore from latest backup
- Contact Supabase support if needed
```

---

## 6. Appendices

### A. Database Schema Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    CORE TABLES                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  auth.users ─────────────────────────────────────────────────►  │
│       │                                                         │
│       ├── profiles ─────────────────────────────────────────►   │
│       │        (user_id, org_id, display_name, etc.)            │
│       │                                                         │
│       ├── user_roles ──────────────────────────────────────►    │
│       │        (user_id, org_id, role, branch_id)               │
│       │                                                         │
│       └── customer_accounts ──────────────────────────────►     │
│                (user_id, customer_id, org_id)                   │
│                                                                 │
│  organizations ─────────────────────────────────────────────►   │
│       │                                                         │
│       ├── branches ────────────────────────────────────────►    │
│       │        (org_id, name, address, etc.)                    │
│       │                                                         │
│       ├── services ───────────────────────────────────────►     │
│       │        (org_id, branch_id, name, price, duration, etc.) │
│       │                                                         │
│       ├── staff_profiles ─────────────────────────────────►     │
│       │        (user_id, branch_id, role, schedule)             │
│       │                                                         │
│       └── appointments ───────────────────────────────────►     │
│                (customer_id, branch_id, date_time, status)      │
│                                                                 │
│  booking_requests ─────────────────────────────────────────►    │
│       (customer_id, branch_id, service_id, status, notes)       │
│                                                                 │
│  customer_content_posts ───────────────────────────────────►    │
│       (org_id, type, content, media_url, published_at)          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### B. API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/booking-request` | POST | Create booking request |
| `/api/customer/home-feed` | GET | Customer home feed |
| `/api/customer/explore` | GET | Explore storefront |
| `/api/telegram/*` | POST | Telegram bot handlers |
| `/api/lookbook` | GET | Lookbook data |

### C. Key Files Reference

| File | Purpose |
|------|---------|
| `packages/shared/src/session.ts` | Auth & session logic |
| `packages/shared/src/auth.ts` | Role definitions |
| `apps/mobile/app/index.tsx` | App gate & routing |
| `apps/mobile/src/providers/session-provider.tsx` | Session management |
| `apps/web/src/lib/domain.ts` | Org context |
| `supabase/bootstrap.sql` | Database schema |

### D. Contact & Support

| Channel | Purpose |
|---------|---------|
| Telegram Bot | Real-time notifications & quick actions |
| Supabase Dashboard | Database management |
| GitHub Issues | Bug tracking |

---

## Revision History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-05-11 | Initial SOP | Chạm |
| 1.1 | 2026-05-11 | Added: Branch/Org data model, Admin Google auth fix, Services branch filtering | Chạm |

---

*End of SOP*
