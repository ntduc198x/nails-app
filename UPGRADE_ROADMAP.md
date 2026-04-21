# Nâng cấp App - Roadmap chi tiết

## 1. Sign up cần thêm field điền tên

### Hiện tại
- **Login page**: Chỉ có email + password
- **Signup flow**:
  1. Người dùng nhập email + password
  2. Supabase tạo auth user
  3. App gọi `getOrCreateRole()` → tạo profile với `display_name = "User"` (mặc định)
- **Kết quả**: Không có field để nhập tên ngay khi signup

### Khuyến nghị nâng cấp

**Cách 1: Thêm field tên vào signup page (nhẹ)**
- Chỉ thêm 1 input: "Tên nhân viên / Tên của bạn"
- Sau signup, update profile với tên vừa nhập
- Không cần thay đổi DB schema
- Không cần thay đổi RLS/Policies

**Cách 2: Thêm field tên + branch (đủ hợp lý)**
- Input: Tên nhân viên
- Select: Branch (nếu org nhiều chi nhánh)
- Sau signup:
  - Update profile với tên + branch_id
  - RLS policies đã có sẵn nên vẫn ổn

---

## 2. Nâng cấp page ca làm / chấm công

### Hiện tại
- **Table `time_entries`** (dòng 1109 trong deploy.sql):
  ```sql
  create table if not exists time_entries (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references orgs(id) on delete cascade,
    staff_user_id uuid not null,
    clock_in timestamptz not null,
    clock_out timestamptz,
    created_at timestamptz not null default now()
  );
  ```

- **UI (shifts/page.tsx)**:
  - Hiển thị: Staff (user_id hoặc display_name), Clock in, Clock out
  - Button: Clock in / Clock out
  - Không có branch, role, notes, break flag, duration

### Phân tích khía cạnh cần nâng cấp

#### Khía cạnh 1: Thông tin hiển thị
- Hiện tại chỉ hiển thị tên từ profiles.display_name
- Thiếu:
  - Branch name
  - Role
  - Timestamp duration (giờ làm thực tế)
  - Notes / remark
  - Is break flag (giờ nghỉ)
  - Status (active / archived)

#### Khía cạnh 2: Data model
- `time_entries` chỉ có basic fields
- Thiếu:
  - `branch_id` (nếu org có nhiều chi nhánh)
  - `role_id` (để phân biệt nhân sự khác nhau)
  - `notes` (ghi chú riêng)
  - `is_break` (kiểu ca nghỉ)
  - `expected_duration_min` (giờ làm mong muốn)
  - `tags` (nghỉ ăn trưa, sick leave, v.v.)

#### Khía cạnh 3: UX
- Thiếu:
  - List theo branch (nếu có nhiều chi nhánh)
  - Filter theo role
  - Filter theo date range
  - Export giờ làm ra CSV
  - Chỉnh sửa ca (cho OWNER/ADMIN)
  - Archive / Delete ca (cho OWNER/ADMIN)

---

## 3. Các option nâng cấp chi tiết

### Option A: Nâng cấp UI trước (không thay đổi DB)

**Ưu điểm:**
- Thay đổi nhanh
- Không cần migrate DB
- Không cần update RLS
- Không cần test lại nhiều

**Nhược điểm:**
- Không lưu thêm branch/role trong time_entries
- Chỉ hỗ trợ thông tin hiển thị tạm thời
- Không hỗ trợ filtering theo branch/role sau này

**Thay đổi:**
- **Shifts page**:
  - Lấy branch_name từ branches table qua RPC hoặc join
  - Lấy role từ user_roles table
  - Tính duration bằng clock_out - clock_in
  - Thêm notes field vào UI (có thể để empty cho chưa có notes)
  - Thêm is_break flag (toggle trong UI)
  - Thêm filter theo branch (select)
  - Thêm filter theo role (select)
  - Thêm export CSV giờ làm

---

### Option B: Nâng cấp DB + UI (bền vững)

**Ưu điểm:**
- Data model tốt hơn
- Hỗ trợ query/filter sâu hơn
- Dễ mở rộng sau này

**Nhược điểm:**
- Cần migrate DB (ALTER TABLE)
- Cần update RLS policies
- Cần test lại các RPCs liên quan

**Thay đổi DB:**

```sql
-- 1. Thêm branch_id vào time_entries
ALTER TABLE time_entries
ADD COLUMN IF NOT EXISTS branch_id uuid references branches(id);

-- 2. Thêm role_id vào time_entries
ALTER TABLE time_entries
ADD COLUMN IF NOT EXISTS role_id uuid references user_roles(id);

-- 3. Thêm notes
ALTER TABLE time_entries
ADD COLUMN IF NOT EXISTS notes text;

-- 4. Thêm is_break flag
ALTER TABLE time_entries
ADD COLUMN IF NOT EXISTS is_break boolean default false;

-- 5. Thêm expected_duration_min
ALTER TABLE time_entries
ADD COLUMN IF NOT EXISTS expected_duration_min int default null;

-- 6. Thêm tags (array)
ALTER TABLE time_entries
ADD COLUMN IF NOT EXISTS tags text[] default '{}';

-- 7. Add indexes
CREATE INDEX IF NOT EXISTS idx_time_entries_branch ON time_entries(org_id, branch_id, clock_in DESC);
CREATE INDEX IF NOT EXISTS idx_time_entries_role ON time_entries(org_id, role_id, clock_in DESC);
```

**Cập nhật RLS:**

```sql
-- Read policies (hiện tại đã cho TECH read được, không cần thêm)
-- Write policies (hiện tại đã cho TECH write được, không cần thêm)
```

**Cập nhật UI:**

- Lấy branch_name từ branches
- Lấy role từ user_roles
- Tính duration
- Hiển thị notes
- Hiển thị is_break
- Filter theo branch/role
- Export CSV

---

### Option C: Half-baked (hybrid)

**Ý tưởng:**
- Nâng cấp UI trước (Option A)
- Sau đó, khi cần, nâng cấp DB thêm fields cần thiết

**Ưu điểm:**
- Thử nghiệm nhanh
- Không commit ngay vào DB
- Dễ rollback UI nếu không cần DB changes

**Nhược điểm:**
- Phải làm lại lần nữa sau khi quyết định cần DB
- Có thể code xong rồi không dùng được

---

## 4. Đề xuất thực tế cho anh Đức

### Phase 1: Nâng cấp nhẹ (1-2 tiếng)

**Bước 1.1: Sign up thêm field tên**
- Thêm input "Tên nhân viên"
- Sau signup, update profile với tên vừa nhập
- Không cần change DB

**Bước 1.2: Nâng cấp UI shifts page (Option A)**
- Lấy branch_name từ branches
- Lấy role từ user_roles
- Tính duration
- Thêm notes input
- Thêm is_break toggle
- Thêm filter theo branch (cho OWNER/ADMIN)
- Thêm export CSV giờ làm

**Lợi ích:**
- Nhận feedback ngay
- Không commit vào DB
- Dễ rollback

### Phase 2: Nâng cấp DB (nếu cần sau)

**Bước 2.1: Chia thời gian**
- Nếu anh thấy UI hoạt động tốt → không cần DB changes
- Nếu anh thấy cần filter/query sâu hơn → làm Phase 2

**Bước 2.2: Nâng cấp DB (Option B)**
- Migrate DB thêm fields (branch_id, role_id, notes, is_break, etc.)
- Update RLS (nếu cần)
- Update UI để sử dụng thêm fields này
- Thêm RPCs nếu cần

---

## 5. Kế hoạch triển khai chi tiết

### Step 1: Sign up thêm tên (5-10 phút)
**File**: `src/app/login/page.tsx`

```tsx
// Thêm state
const [name, setName] = useState("");

// Form thêm input
<input
  className="w-full input"
  type="text"
  placeholder="Tên nhân viên / Tên của bạn"
  value={name}
  onChange={(e) => setName(e.target.value)}
/>

// Trên onSubmit, update profile
if (mode === "signup") {
  const { data, error } = await supabase.auth.signUp({ email, password });

  // Update profile với tên vừa nhập
  if (data.user) {
    await supabase.from("profiles").update({ display_name: name }).eq("user_id", data.user.id);
  }

  // ...
}
```

### Step 2: Nâng cấp UI shifts page (1-2 tiếng)

**File**: `src/app/shifts/page.tsx`

**Thay đổi chính:**
- Thêm branch select filter (cho OWNER)
- Thêm role select filter
- Thêm notes input (create new entry)
- Thêm is_break toggle
- Export CSV giờ làm
- Display duration, branch_name, role

---

## 6. Nên chọn hướng nào?

**Nếu anh muốn nhanh:**
- Chọn Option A (nâng cấp UI trước)
- Làm Sign up thêm tên
- Nâng cấp UI shifts page theo hướng Option A

**Nếu anh muốn bền vững:**
- Chọn Option B (nâng cấp DB + UI)
- Nâng cấp DB thêm fields
- Nâng cấp UI đầy đủ

**Nếu anh không chắc:**
- Chọn Option C (hybrid)
- Làm Phase 1 trước
- Sau đó quyết định có cần Phase 2 không

---

## 7. Gợi ý next steps cho anh

**Nếu anh muốn em thực hiện ngay:**

**Option 1 (nhanh):**
- Em nâng cấp UI shifts page theo Option A
- Sign up thêm field tên
- Không thay đổi DB

**Option 2 (bền vững):**
- Em nâng cấp DB theo Option B
- Update UI để sử dụng thêm fields
- Nâng cấp RLS (nếu cần)

**Hỏi anh:**
1. Anh muốn nhanh (Option 1) hay bền vững (Option 2)?
2. Anh muốn có branch select trong signup không?
3. Anh có nhiều chi nhánh không?
4. Anh muốn export giờ làm ra CSV không?
5. Anh muốn filter giờ làm theo branch/role không?
