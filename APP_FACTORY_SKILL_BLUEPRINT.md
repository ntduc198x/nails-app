# App Factory Skill Blueprint

## Mục tiêu

Chuẩn hóa logic của repo này thành một skill có thể tạo ra các app vận hành nội bộ theo cùng phong cách:

- `Next.js App Router + React client pages`
- `Supabase làm backend + RLS + SECURITY DEFINER RPC`
- `mobile-first cho khu vực manage`
- `role-based navigation + role-based action gating`
- `domain layer tập trung trong /src/lib`
- `workflow modules` thay vì CRUD rời rạc

Blueprint này không mô tả riêng nghiệp vụ nails. Nó trích ra bộ khung có thể tái sử dụng cho các app như salon, spa, clinic, studio, retail ops, booking desk, internal office ops.

## Logic cốt lõi cần skill hóa

Repo này nên được chuẩn hóa theo một logic duy nhất:

`Mỗi app = một hệ workflow vận hành theo module, trong đó UI chỉ là lớp điều phối, business logic tập trung ở domain layer, quyền hạn được chặn ở cả UI và DB, và mọi màn manage đều mobile-first.`

Đây là logic đúng nhất để biến thành skill vì nó đang lặp lại gần như toàn repo.

## 1. Khung kiến trúc chuẩn

### 1.1. Cấu trúc lớp

- `src/app`
  - route public
  - route manage
  - route api
- `src/components`
  - shell/layout
  - mobile primitives
  - section widgets dùng lại
- `src/lib`
  - auth / role
  - domain functions
  - helper business logic
  - supabase client
- `supabase/deploy.sql`
  - schema
  - RLS
  - RPC
  - indexes
  - integrity guards

### 1.2. Nguyên tắc phân lớp

- Page không query DB trực tiếp nếu đã có thể đưa xuống `src/lib/domain.ts`.
- Page chịu trách nhiệm:
  - state UI
  - filter/sort/view state
  - optimistic UI nhẹ
  - điều hướng
- `domain.ts` chịu trách nhiệm:
  - CRUD
  - workflow mutation
  - cache TTL ngắn
  - org context
  - Supabase fallback theo schema
- DB chịu trách nhiệm:
  - RLS
  - integrity constraints
  - RPC cho nghiệp vụ nhạy cảm

## 2. Hợp đồng của một module

Mỗi module quản trị trong app nên tuân theo contract này:

### 2.1. Module gồm 5 phần

1. `route page`
2. `domain functions`
3. `role access`
4. `quick nav placement`
5. `db schema/RPC nếu cần`

### 2.2. Page contract

Mỗi page `manage/*` nên có:

- `AppShell`
- `ManageQuickNav`
- `MobileSectionHeader`
- ít nhất 1 `manage-surface`
- trạng thái chuẩn:
  - `loading`
  - `refreshing`
  - `submitting`
  - `error`
- `load()` dạng `useCallback`
- `useEffect(() => void load({ force: true }))`
- `canEdit/canManage/canViewFinancial...` tính từ role
- desktop block + mobile block riêng khi cần

### 2.3. Domain contract

Mỗi module trong `src/lib/domain.ts` hoặc file domain riêng nên có:

- `listX(opts?)`
- `createX(input)`
- `updateX(input)`
- `deleteX(id)` hoặc workflow-specific verbs
- invalidate cache sau mutation
- `ensureOrgContext()` trước truy vấn nghiệp vụ
- fallback nếu schema field chưa tồn tại

### 2.4. Workflow-first naming

Ưu tiên verb nghiệp vụ thay vì verb CRUD chung:

- tốt:
  - `moveToTrash`
  - `restoreFromTrash`
  - `updateAppointmentStatus`
  - `createCheckout`
  - `convertBookingRequestToAppointment`
- tránh:
  - `submitData`
  - `handleAction`
  - `processItem`

## 3. Chuẩn UI/UX cần skill hóa

### 3.1. App shell

App quản trị phải có:

- sticky header
- grouped navigation theo domain
- role-aware menu visibility
- mobile menu riêng
- account/logout block rõ ràng

### 3.2. Mobile-first manage UI

Khu `manage` phải mặc định tối ưu cho mobile:

- action lớn, dễ bấm
- `MobileCollapsible` cho filter/panel dài
- `MobileStickyActions` cho CTA chính
- desktop và mobile có thể render tách riêng nếu nghiệp vụ phức tạp

### 3.3. Visual system

Tất cả màn quản trị nên dùng chung token:

- `manage-surface`
- `manage-info-box`
- `manage-error-box`
- `manage-quick-link`
- `manage-quick-link-accent`
- `btn`, `btn-primary`, `btn-outline`

Skill tương lai phải ưu tiên tái sử dụng các primitive này thay vì sinh CSS mới cho từng màn.

### 3.4. Form pattern

Form chuẩn trong repo này là:

- label nhỏ, uppercase nhẹ
- input bo góc lớn
- inline field cho mobile/compact layout
- parse numeric ngay ở client
- save/cancel rõ ràng
- không auto-save trừ khi nghiệp vụ yêu cầu thật

## 4. Chuẩn role và quyền

### 4.1. Nguồn sự thật

Role phải được kiểm ở 3 lớp:

1. menu visibility trong `AppShell`
2. action gating trong page
3. RLS/RPC trong Supabase

Không tin riêng UI.

### 4.2. Bộ role chuẩn

- `OWNER`
- `MANAGER`
- `RECEPTION`
- `ACCOUNTANT`
- `TECH`

Skill nên cho phép map sang ngành khác, nhưng vẫn giữ tư duy:

- role toàn quyền
- role vận hành
- role tài chính
- role tác nghiệp

### 4.3. Quy tắc bootstrap

Repo này có một pattern rất mạnh và nên giữ:

- user đầu tiên trong org => owner
- user sau đó => role mặc định thấp
- invite code để cấp role kiểm soát

Đây nên là một capability mặc định của skill.

## 5. Chuẩn data/backend

### 5.1. Org-scoped multi-tenant

Mọi bảng nghiệp vụ đều có:

- `org_id`
- khi cần: `branch_id`

Skill phải mặc định tạo app theo org-scope, không tạo app single-tenant ngầm.

### 5.2. Supabase strategy

Ưu tiên:

- table đơn giản cho read/list
- RPC cho mutation nhạy cảm hoặc nhiều bước
- RLS chặn truy cập sai role

### 5.3. SQL deploy strategy

Repo này gom mọi thứ vào `supabase/deploy.sql`. Đây là pattern tốt cho skill vì:

- dễ bootstrap nhanh
- dễ copy sang project mới
- giảm drift giữa schema và patch

Skill nên sinh:

- 1 file deploy canonical
- bên trong chia section:
  - schema
  - rls
  - rpc
  - indexes
  - integrity

### 5.4. Integrity-first

Skill phải ưu tiên sinh:

- status transition guards
- unique constraints theo workflow
- idempotency table/RPC cho payment hoặc action quan trọng
- soft delete trước hard delete nếu dữ liệu có giá trị vận hành

## 6. Chuẩn workflow thay vì CRUD

Đây là phần quan trọng nhất để skill khác với generator CRUD thông thường.

### 6.1. Module phải xuất phát từ luồng nghiệp vụ

Ví dụ trong repo:

- booking request -> appointment
- appointment -> checked in
- checked in -> checkout
- checkout -> receipt
- active service -> trash -> hard delete

Skill phải bắt người dùng mô tả app theo:

- actors
- states
- transitions
- alerts
- exception cases

Không nên bắt đầu từ “cần bao nhiêu table”.

### 6.2. Mỗi entity nên có lifecycle rõ ràng

Ví dụ:

- service:
  - active
  - trashed
  - deleted forever
- appointment:
  - booked
  - checked_in
  - done
  - cancelled

Skill tương lai nên sinh lifecycle matrix trước khi sinh page.

## 7. Chuẩn page generator

Một skill tạo app theo blueprint này nên sinh page theo template:

### 7.1. Danh sách module

- `dashboard/manage root`
- `operations modules`
- `setup modules`
- `reports modules`
- `account module`

### 7.2. Template một page manage

- imports chuẩn:
  - `AppShell`
  - `MobileSectionHeader`
  - `MobileCollapsible`
  - `MobileStickyActions`
  - `ManageQuickNav`
  - domain functions
- local types cho row/form
- local UI primitives nếu cần
- `load()`
- derived `useMemo`
- handlers
- desktop render
- mobile render

### 7.3. Khi nào dùng desktop/mobile render riêng

Dùng render tách đôi khi:

- danh sách dài
- nhiều action theo row
- form có nhiều trường
- filter nhiều tầng

Không cố ép một JSX chung cho mọi breakpoint nếu làm UI xấu.

## 8. Chuẩn code style cho skill

Skill nên cưỡng bức các rule sau:

- module business đi qua domain layer
- không gọi Supabase tràn lan từ page
- naming rõ domain
- có loading/refreshing/submitting/error
- soft delete cho dữ liệu cấu hình quan trọng
- mobile-first cho khu vực vận hành
- role gate ở UI và DB
- quick nav giữa các page cùng domain
- cache invalidate rõ sau mutation
- hỗ trợ fallback khi DB schema chưa đầy đủ trong giai đoạn nâng cấp

## 9. Những gì skill cần hỏi trước khi sinh app

Skill nên bắt buộc hỏi hoặc suy ra 9 nhóm thông tin:

1. domain app là gì
2. actor/role là gì
3. module workflow nào tồn tại
4. entity nào cần soft delete
5. entity nào có lifecycle trạng thái
6. module nào có financial/report/export
7. public route nào tồn tại
8. cần branch/org scope hay không
9. action nào phải đi qua RPC/idempotency

## 10. Cấu trúc skill đề xuất

Tên skill nên theo hướng:

`ops-app-factory`

Hoặc nếu muốn gắn mạnh với phong cách repo này:

`mobile-ops-supabase-factory`

### 10.1. SKILL.md nên chứa

- triết lý workflow-first
- cách hỏi requirement
- cách map role/module/entity
- contract page/domain/sql
- checklist sinh app

### 10.2. references/ nên chứa

- `module-contract.md`
- `role-matrix.md`
- `page-template.md`
- `supabase-schema-patterns.md`
- `workflow-lifecycle-patterns.md`

### 10.3. assets/ nên chứa

- app shell template
- manage page template
- domain file template
- deploy.sql template
- quick nav template

## 11. Prompt contract cho skill sau này

Khi dùng skill, prompt tốt nên là:

- “Tạo cho tôi app quản trị spa theo blueprint mobile ops này”
- “Sinh app clinic có booking, check-in, invoice, role-based manage”
- “Dùng ops-app-factory để dựng app vận hành showroom có setup, operations, reports”

Không nên dùng prompt quá mơ hồ kiểu:

- “build me an app”

## 12. Kết luận

Nếu phải nén toàn bộ repo này về một quy chuẩn duy nhất, thì quy chuẩn đó là:

`Generate internal apps as role-based, org-scoped, mobile-first workflow systems where each module is modeled as a stateful business flow, powered by a centralized domain layer and enforced by Supabase RLS/RPC.`

Đây là lõi nên dùng để tạo skill.
