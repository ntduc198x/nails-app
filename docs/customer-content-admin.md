# Customer Content Admin Guide

Tai lieu nay huong dan cach quan tri du lieu cho hai man customer:

- `(customer)/index`
- `(customer)/explore`

Noi dung duoi day dung theo code hien tai trong repo va route aggregate moi.

## 1. Luong du lieu hien tai

### `(customer)/index`

Man Home doc du lieu tu:

- `services`
- `customer_content_posts`
- `marketing_offers`

API tong hop:

- `GET /api/customer/home-feed`

Code lien quan:

- `apps/web/src/app/api/customer/home-feed/route.ts`
- `apps/mobile/src/hooks/use-customer-home-feed.ts`
- `apps/mobile/app/(customer)/index.tsx`

### `(customer)/explore`

Man Explore doc du lieu tu:

- `storefront_profile`
- `services`
- `storefront_products`
- `storefront_team_members`
- `storefront_gallery`
- `marketing_offers`

API tong hop:

- `GET /api/customer/explore`

Code lien quan:

- `apps/web/src/app/api/customer/explore/route.ts`
- `apps/mobile/src/hooks/use-customer-explore.ts`
- `apps/mobile/app/(customer)/explore.tsx`

## 2. Patch SQL can chay truoc

Truoc khi them du lieu Explore, chay patch:

- `supabase/customer_explore_storefront_2026_04.sql`

Patch nay tao cac bang moi:

- `storefront_profile`
- `storefront_team_members`
- `storefront_products`
- `storefront_gallery`

Va mo rong bang `services` voi cac cot:

- `featured_in_home`
- `featured_in_explore`
- `lookbook_category`
- `lookbook_badge`
- `lookbook_tone`
- `duration_label`
- `display_order_home`
- `display_order_explore`

## 3. Cach do du lieu cho `(customer)/index`

### 3.1. Block "Mau dang hot"

Block nay lay tu bang `services`.

Can quan tam cac cot:

- `active = true`
- `featured_in_home = true`
- `name`
- `short_description`
- `image_url`
- `duration_min`
- `base_price`
- `lookbook_category`
- `lookbook_badge`
- `lookbook_tone`
- `duration_label`
- `display_order_home`

SQL mau:

```sql
update public.services
set
  featured_in_home = true,
  lookbook_category = 'noi-bat',
  lookbook_badge = 'Hot',
  lookbook_tone = 'Noi bat',
  duration_label = '75 phut',
  display_order_home = 1
where id = 'SERVICE_ID_1';
```

Them them 1 dich vu moi:

```sql
insert into public.services (
  org_id,
  branch_id,
  name,
  short_description,
  image_url,
  duration_min,
  base_price,
  active,
  featured_in_home,
  featured_in_explore,
  lookbook_category,
  lookbook_badge,
  lookbook_tone,
  duration_label,
  display_order_home,
  display_order_explore
) values (
  'ORG_ID',
  'BRANCH_ID',
  'Cat eye silver',
  'Mau cat eye anh bac cho layout toi gian va sang.',
  'https://your-cdn/service-cat-eye.jpg',
  75,
  299000,
  true,
  true,
  true,
  'noi-bat',
  'Hot',
  'Noi bat',
  '75 phut',
  1,
  2
);
```

### 3.2. Block "Xu huong lam dep hom nay"

Block nay lay tu `customer_content_posts`.

Can quan tam:

- `status = 'published'`
- `title`
- `summary`
- `body`
- `cover_image_url`
- `content_type`
- `source_platform`
- `priority`
- `published_at`

SQL mau:

```sql
insert into public.customer_content_posts (
  org_id,
  title,
  summary,
  body,
  cover_image_url,
  content_type,
  source_platform,
  status,
  priority,
  published_at
) values (
  'ORG_ID',
  'Nail chrome dang quay lai',
  'Tong hop cac mau chrome de dat lich nhanh trong tuan nay.',
  'Noi dung day du ve xu huong chrome...',
  'https://your-cdn/post-chrome.jpg',
  'trend',
  'admin',
  'published',
  1,
  now()
);
```

### 3.3. Block "Quyen loi thanh vien"

Block nay lay tu `marketing_offers`.

Can quan tam:

- `is_active = true`
- `title`
- `description`
- `badge`
- `starts_at`
- `ends_at`

SQL mau:

```sql
insert into public.marketing_offers (
  org_id,
  title,
  description,
  badge,
  is_active,
  starts_at,
  ends_at
) values (
  'ORG_ID',
  'Giam 15% combo gel + charm',
  'Ap dung cho booking trong khung gio 10:00 - 15:00.',
  'Member',
  true,
  now(),
  now() + interval '14 day'
);
```

## 4. Cach do du lieu cho `(customer)/explore`

### 4.1. Storefront hero

Block hero Explore lay tu `storefront_profile`.

Can quan tam:

- `is_active = true`
- `slug`
- `name`
- `category`
- `description`
- `cover_image_url`
- `logo_image_url`
- `rating`
- `reviews_label`
- `address_line`
- `map_url`
- `opening_hours`
- `phone`
- `messenger_url`
- `instagram_url`
- `highlights`

SQL mau:

```sql
insert into public.storefront_profile (
  org_id,
  branch_id,
  slug,
  name,
  category,
  description,
  cover_image_url,
  logo_image_url,
  rating,
  reviews_label,
  address_line,
  map_url,
  opening_hours,
  phone,
  messenger_url,
  instagram_url,
  highlights,
  is_active
) values (
  'ORG_ID',
  'BRANCH_ID',
  'cham-beauty',
  'CHAM BEAUTY',
  'Nail & Beauty',
  'Storefront phuc vu man Explore tren mobile.',
  'https://your-cdn/storefront-cover.jpg',
  'https://your-cdn/storefront-logo.jpg',
  4.9,
  '128 danh gia',
  'Dia chi cua cua hang',
  'https://maps.app.goo.gl/your-link',
  '09:00 - 21:00',
  '0912345678',
  'https://m.me/your-page',
  'https://instagram.com/your-page',
  '["Uy tin","Chat luong","Tan tam"]'::jsonb,
  true
);
```

Neu da co storefront active, update:

```sql
update public.storefront_profile
set
  name = 'CHAM BEAUTY',
  description = 'Storefront phuc vu man Explore tren mobile.',
  cover_image_url = 'https://your-cdn/storefront-cover.jpg',
  address_line = 'Dia chi moi',
  opening_hours = '09:00 - 21:00'
where slug = 'cham-beauty';
```

### 4.2. Block "Dich vu noi bat"

Block nay van lay tu `services`, nhung dung scope Explore.

Can quan tam:

- `active = true`
- `featured_in_explore = true`
- `display_order_explore`
- `lookbook_category`
- `lookbook_badge`
- `lookbook_tone`

SQL mau:

```sql
update public.services
set
  featured_in_explore = true,
  lookbook_category = 'sang-trong',
  lookbook_badge = 'Trend',
  lookbook_tone = 'Sang trong',
  duration_label = '90 phut',
  display_order_explore = 1
where id = 'SERVICE_ID_2';
```

### 4.3. Block "San pham & phu kien"

Block nay lay tu `storefront_products`.

Can quan tam:

- `storefront_id`
- `name`
- `subtitle`
- `price_label`
- `image_url`
- `product_type`
- `display_order`
- `is_active`
- `is_featured`

SQL mau:

```sql
insert into public.storefront_products (
  org_id,
  storefront_id,
  name,
  subtitle,
  price_label,
  image_url,
  product_type,
  display_order,
  is_active,
  is_featured
) values (
  'ORG_ID',
  'STOREFRONT_ID',
  'Charm dinh mong',
  'Phu kien trang tri',
  '79000d',
  'https://your-cdn/product-charm.jpg',
  'accessory',
  1,
  true,
  true
);
```

### 4.4. Block "Doi ngu nhan vien"

Block nay lay tu `storefront_team_members`.

Can quan tam:

- `storefront_id`
- `profile_id` co the null
- `display_name`
- `role_label`
- `avatar_url`
- `bio`
- `display_order`
- `is_visible = true`

SQL mau:

```sql
insert into public.storefront_team_members (
  org_id,
  storefront_id,
  profile_id,
  display_name,
  role_label,
  avatar_url,
  bio,
  display_order,
  is_visible
) values (
  'ORG_ID',
  'STOREFRONT_ID',
  null,
  'Linh Nguyen',
  'Nail Artist',
  'https://your-cdn/team-linh.jpg',
  'Chuyen layout cat eye va charm.',
  1,
  true
);
```

An tam thoi mot nhan vien:

```sql
update public.storefront_team_members
set is_visible = false
where id = 'TEAM_MEMBER_ID';
```

### 4.5. Block "Khong gian cua hang"

Block nay lay tu `storefront_gallery`.

Can quan tam:

- `storefront_id`
- `title`
- `image_url`
- `kind`
- `display_order`
- `is_active`

Gia tri `kind` nen dung:

- `salon`
- `decor`
- `work`
- `team`

SQL mau:

```sql
insert into public.storefront_gallery (
  org_id,
  storefront_id,
  title,
  image_url,
  kind,
  display_order,
  is_active
) values (
  'ORG_ID',
  'STOREFRONT_ID',
  'Goc tiep don',
  'https://your-cdn/gallery-reception.jpg',
  'salon',
  1,
  true
);
```

### 4.6. Block "Uu dai dang co"

Explore cung dung lai `marketing_offers`, khong can bang moi.

Chi can dam bao:

- `is_active = true`
- `starts_at` va `ends_at` con hieu luc

## 5. Quy tac sap xep nen dung

### Cho Home

- `services.display_order_home`

### Cho Explore

- `services.display_order_explore`
- `storefront_products.display_order`
- `storefront_team_members.display_order`
- `storefront_gallery.display_order`

Khuyen nghi:

- bat dau tu `1`
- tang deu `1, 2, 3, 4`
- tranh de tat ca bang `0`

## 6. Checklist khi them du lieu moi

### De thay tren `(customer)/index`

- dich vu co `active = true`
- dich vu co `featured_in_home = true`
- dich vu co `image_url`
- bai viet co `status = 'published'`
- uu dai co `is_active = true`

### De thay tren `(customer)/explore`

- phai co 1 `storefront_profile` active
- dich vu co `featured_in_explore = true`
- san pham co `is_active = true`
- nhan vien co `is_visible = true`
- gallery co `is_active = true`
- uu dai van con hieu luc

## 7. Query kiem tra nhanh

### Kiem tra dich vu cho Home

```sql
select
  id,
  name,
  featured_in_home,
  display_order_home
from public.services
where active = true and featured_in_home = true
order by display_order_home asc, name asc;
```

### Kiem tra dich vu cho Explore

```sql
select
  id,
  name,
  featured_in_explore,
  display_order_explore
from public.services
where active = true and featured_in_explore = true
order by display_order_explore asc, name asc;
```

### Kiem tra storefront active

```sql
select
  id,
  slug,
  name,
  is_active
from public.storefront_profile
where is_active = true;
```

### Kiem tra team public

```sql
select
  display_name,
  role_label,
  is_visible,
  display_order
from public.storefront_team_members
where storefront_id = 'STOREFRONT_ID'
order by display_order asc;
```

## 8. Neu muon quan tri bang UI

Phase hien tai cua repo moi dung den customer-facing aggregate API. Admin CRUD cho cac bang sau nen lam o phase tiep theo:

- `storefront_profile`
- `storefront_team_members`
- `storefront_products`
- `storefront_gallery`

Tam thoi, cach nhanh nhat de quan tri noi dung la:

1. Them/sua du lieu bang SQL Editor cua Supabase.
2. Kiem tra lai bang cac query verify o muc 7.
3. Reload app mobile va keo refresh man Home/Explore.
