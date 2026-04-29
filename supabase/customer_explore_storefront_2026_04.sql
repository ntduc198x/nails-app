-- Normalize customer Explore/storefront data model
-- Run after bootstrap.sql or on an existing project that already has orgs/branches/services.

alter table public.services
  add column if not exists featured_in_home boolean not null default false,
  add column if not exists featured_in_explore boolean not null default false,
  add column if not exists lookbook_category text,
  add column if not exists lookbook_badge text,
  add column if not exists lookbook_tone text,
  add column if not exists duration_label text,
  add column if not exists display_order_home int not null default 0,
  add column if not exists display_order_explore int not null default 0;

update public.services
set
  featured_in_home = coalesce(featured_in_home, false) or coalesce(featured_in_lookbook, false),
  featured_in_explore = coalesce(featured_in_explore, false) or coalesce(featured_in_lookbook, false),
  duration_label = coalesce(nullif(trim(duration_label), ''), case when duration_min is not null then duration_min::text || ' phut' else null end),
  display_order_home = case when display_order_home = 0 then coalesce(display_order_explore, 0) else display_order_home end,
  display_order_explore = case when display_order_explore = 0 then coalesce(display_order_home, 0) else display_order_explore end,
  lookbook_tone = coalesce(
    nullif(trim(lookbook_tone), ''),
    case
      when lower(coalesce(name, '') || ' ' || coalesce(short_description, '')) like '%cat eye%'
        or lower(coalesce(name, '') || ' ' || coalesce(short_description, '')) like '%chrome%'
        or lower(coalesce(name, '') || ' ' || coalesce(short_description, '')) like '%flash%'
        or lower(coalesce(name, '') || ' ' || coalesce(short_description, '')) like '%art%'
        or lower(coalesce(name, '') || ' ' || coalesce(short_description, '')) like '%design%'
        then 'Noi bat'
      when lower(coalesce(name, '') || ' ' || coalesce(short_description, '')) like '%french%'
        or lower(coalesce(name, '') || ' ' || coalesce(short_description, '')) like '%luxury%'
        or lower(coalesce(name, '') || ' ' || coalesce(short_description, '')) like '%glazed%'
        or lower(coalesce(name, '') || ' ' || coalesce(short_description, '')) like '%charm%'
        then 'Sang trong'
      when lower(coalesce(name, '') || ' ' || coalesce(short_description, '')) like '%spa%'
        or lower(coalesce(name, '') || ' ' || coalesce(short_description, '')) like '%care%'
        or lower(coalesce(name, '') || ' ' || coalesce(short_description, '')) like '%duong%'
        or lower(coalesce(name, '') || ' ' || coalesce(short_description, '')) like '%phuc hoi%'
        then 'Cham soc'
      else 'Nhe nhang'
    end
  ),
  lookbook_badge = coalesce(
    nullif(trim(lookbook_badge), ''),
    case
      when lower(coalesce(name, '') || ' ' || coalesce(short_description, '')) like '%cat eye%'
        or lower(coalesce(name, '') || ' ' || coalesce(short_description, '')) like '%chrome%'
        or lower(coalesce(name, '') || ' ' || coalesce(short_description, '')) like '%flash%'
        then 'Hot'
      when lower(coalesce(name, '') || ' ' || coalesce(short_description, '')) like '%french%'
        or lower(coalesce(name, '') || ' ' || coalesce(short_description, '')) like '%nude%'
        or lower(coalesce(name, '') || ' ' || coalesce(short_description, '')) like '%milk%'
        then 'Trend'
      when lower(coalesce(name, '') || ' ' || coalesce(short_description, '')) like '%design%'
        or lower(coalesce(name, '') || ' ' || coalesce(short_description, '')) like '%art%'
        or lower(coalesce(name, '') || ' ' || coalesce(short_description, '')) like '%charm%'
        then 'Noi bat'
      else 'Lookbook'
    end
  ),
  lookbook_category = coalesce(
    nullif(trim(lookbook_category), ''),
    case
      when lower(coalesce(name, '') || ' ' || coalesce(short_description, '')) like '%french%'
        or lower(coalesce(name, '') || ' ' || coalesce(short_description, '')) like '%luxury%'
        or lower(coalesce(name, '') || ' ' || coalesce(short_description, '')) like '%glazed%'
        or lower(coalesce(name, '') || ' ' || coalesce(short_description, '')) like '%charm%'
        then 'sang-trong'
      when lower(coalesce(name, '') || ' ' || coalesce(short_description, '')) like '%cat eye%'
        or lower(coalesce(name, '') || ' ' || coalesce(short_description, '')) like '%chrome%'
        or lower(coalesce(name, '') || ' ' || coalesce(short_description, '')) like '%flash%'
        or lower(coalesce(name, '') || ' ' || coalesce(short_description, '')) like '%art%'
        or lower(coalesce(name, '') || ' ' || coalesce(short_description, '')) like '%design%'
        then 'noi-bat'
      when lower(coalesce(name, '') || ' ' || coalesce(short_description, '')) like '%olive%'
        or lower(coalesce(name, '') || ' ' || coalesce(short_description, '')) like '%matcha%'
        or lower(coalesce(name, '') || ' ' || coalesce(short_description, '')) like '%ombre%'
        then 'ca-tinh'
      else 'don-gian'
    end
  )
where active = true;

create table if not exists public.storefront_profile (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,
  slug text not null,
  name text not null,
  category text,
  description text,
  cover_image_url text,
  logo_image_url text,
  rating numeric(3, 2),
  reviews_label text,
  address_line text,
  map_url text,
  opening_hours text,
  phone text,
  messenger_url text,
  instagram_url text,
  highlights jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists idx_storefront_profile_slug on public.storefront_profile (slug);
create unique index if not exists idx_storefront_profile_active_org on public.storefront_profile (org_id) where is_active = true;

create table if not exists public.storefront_team_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  storefront_id uuid not null references public.storefront_profile(id) on delete cascade,
  profile_id uuid references public.profiles(user_id) on delete set null,
  display_name text not null,
  role_label text,
  avatar_url text,
  bio text,
  display_order int not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_storefront_team_members_storefront_visible
  on public.storefront_team_members (storefront_id, is_visible, display_order);

create table if not exists public.storefront_products (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  storefront_id uuid not null references public.storefront_profile(id) on delete cascade,
  name text not null,
  subtitle text,
  price_label text,
  image_url text,
  product_type text,
  display_order int not null default 0,
  is_active boolean not null default true,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_storefront_products_storefront_active
  on public.storefront_products (storefront_id, is_active, display_order);

create table if not exists public.storefront_gallery (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  storefront_id uuid not null references public.storefront_profile(id) on delete cascade,
  title text,
  image_url text not null,
  kind text,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_storefront_gallery_storefront_active
  on public.storefront_gallery (storefront_id, is_active, display_order);

alter table public.storefront_profile enable row level security;
alter table public.storefront_team_members enable row level security;
alter table public.storefront_products enable row level security;
alter table public.storefront_gallery enable row level security;

drop policy if exists "org read storefront profile" on public.storefront_profile;
create policy "org read storefront profile" on public.storefront_profile
for select using (org_id = public.my_org_id());

drop policy if exists "owner manager reception write storefront profile" on public.storefront_profile;
create policy "owner manager reception write storefront profile" on public.storefront_profile
for all using (
  org_id = public.my_org_id() and
  (public.has_role('OWNER') or public.has_role('MANAGER') or public.has_role('RECEPTION'))
)
with check (
  org_id = public.my_org_id() and
  (public.has_role('OWNER') or public.has_role('MANAGER') or public.has_role('RECEPTION'))
);

drop policy if exists "org read storefront team members" on public.storefront_team_members;
create policy "org read storefront team members" on public.storefront_team_members
for select using (org_id = public.my_org_id());

drop policy if exists "owner manager reception write storefront team members" on public.storefront_team_members;
create policy "owner manager reception write storefront team members" on public.storefront_team_members
for all using (
  org_id = public.my_org_id() and
  (public.has_role('OWNER') or public.has_role('MANAGER') or public.has_role('RECEPTION'))
)
with check (
  org_id = public.my_org_id() and
  (public.has_role('OWNER') or public.has_role('MANAGER') or public.has_role('RECEPTION'))
);

drop policy if exists "org read storefront products" on public.storefront_products;
create policy "org read storefront products" on public.storefront_products
for select using (org_id = public.my_org_id());

drop policy if exists "owner manager reception write storefront products" on public.storefront_products;
create policy "owner manager reception write storefront products" on public.storefront_products
for all using (
  org_id = public.my_org_id() and
  (public.has_role('OWNER') or public.has_role('MANAGER') or public.has_role('RECEPTION'))
)
with check (
  org_id = public.my_org_id() and
  (public.has_role('OWNER') or public.has_role('MANAGER') or public.has_role('RECEPTION'))
);

drop policy if exists "org read storefront gallery" on public.storefront_gallery;
create policy "org read storefront gallery" on public.storefront_gallery
for select using (org_id = public.my_org_id());

drop policy if exists "owner manager reception write storefront gallery" on public.storefront_gallery;
create policy "owner manager reception write storefront gallery" on public.storefront_gallery
for all using (
  org_id = public.my_org_id() and
  (public.has_role('OWNER') or public.has_role('MANAGER') or public.has_role('RECEPTION'))
)
with check (
  org_id = public.my_org_id() and
  (public.has_role('OWNER') or public.has_role('MANAGER') or public.has_role('RECEPTION'))
);

create or replace function public.touch_storefront_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_storefront_profile on public.storefront_profile;
create trigger trg_touch_storefront_profile
before update on public.storefront_profile
for each row execute function public.touch_storefront_updated_at();

drop trigger if exists trg_touch_storefront_team_members on public.storefront_team_members;
create trigger trg_touch_storefront_team_members
before update on public.storefront_team_members
for each row execute function public.touch_storefront_updated_at();

drop trigger if exists trg_touch_storefront_products on public.storefront_products;
create trigger trg_touch_storefront_products
before update on public.storefront_products
for each row execute function public.touch_storefront_updated_at();

drop trigger if exists trg_touch_storefront_gallery on public.storefront_gallery;
create trigger trg_touch_storefront_gallery
before update on public.storefront_gallery
for each row execute function public.touch_storefront_updated_at();

with seed_ctx as (
  select o.id as org_id, b.id as branch_id
  from public.orgs o
  join public.branches b on b.org_id = o.id
  order by o.created_at asc, b.created_at asc
  limit 1
)
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
)
select
  seed_ctx.org_id,
  seed_ctx.branch_id,
  'cham-beauty',
  'CHAM BEAUTY',
  'Nail & Beauty',
  'Khong gian storefront cho mobile Explore, gom lookbook, doi ngu, san pham va thong tin cua hang.',
  'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?q=80&w=1200',
  'https://images.unsplash.com/photo-1604654894610-df63bc536371?q=80&w=800',
  4.9,
  '128 danh gia',
  '38A ngach 358/40 Bui Xuong Trach, Khuong Dinh, Thanh Xuan, Ha Noi',
  'https://maps.app.goo.gl/Qu9oyq4emP3iWHDd6',
  'Mo cua: 09:00 - 21:00 (Tat ca ngay)',
  '0916080398',
  'https://m.me/chambeautyyy',
  'https://www.instagram.com/cham.beautyy',
  '["Uy tin","Chat luong","Tan tam"]'::jsonb,
  true
from seed_ctx
where not exists (
  select 1 from public.storefront_profile existing where existing.org_id = seed_ctx.org_id and existing.is_active = true
);

with active_storefront as (
  select id, org_id
  from public.storefront_profile
  where is_active = true
  order by created_at asc
  limit 1
)
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
)
select
  active_storefront.org_id,
  active_storefront.id,
  p.user_id,
  coalesce(nullif(trim(p.display_name), ''), 'Nhan vien ' || row_number() over (order by p.created_at asc)),
  case
    when ur.role = 'OWNER' then 'Chu cua hang'
    when ur.role = 'MANAGER' then 'Quan ly'
    else 'Nail Artist'
  end,
  p.avatar_url,
  'Thanh vien duoc hien thi tren customer Explore.',
  row_number() over (order by p.created_at asc),
  true
from active_storefront
join public.profiles p on p.org_id = active_storefront.org_id
join public.user_roles ur on ur.user_id = p.user_id and ur.org_id = p.org_id
where ur.role in ('OWNER', 'MANAGER', 'TECH')
  and not exists (
    select 1 from public.storefront_team_members existing where existing.storefront_id = active_storefront.id
  )
limit 4;

with active_storefront as (
  select id, org_id
  from public.storefront_profile
  where is_active = true
  order by created_at asc
  limit 1
)
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
)
select
  active_storefront.org_id,
  active_storefront.id,
  seed.name,
  seed.subtitle,
  seed.price_label,
  seed.image_url,
  seed.product_type,
  seed.display_order,
  true,
  seed.is_featured
from active_storefront
cross join (
  values
    ('Charm dinh mong anh bac', 'Phu kien ban tai cua hang', '79.000d', 'https://images.unsplash.com/photo-1522337660859-02fbefca4702?q=80&w=1200', 'accessory', 1, true),
    ('Son gel nude milk', 'Tong mau de phoi lookbook', '149.000d', 'https://images.unsplash.com/photo-1632345031435-8727f6897d53?q=80&w=1200', 'polish', 2, true),
    ('Dau duong vien mong', 'Cham soc sau khi lam mong', '95.000d', 'https://images.unsplash.com/photo-1610992015732-2449b76344bc?q=80&w=1200', 'care', 3, false),
    ('Set phu kien nail box', 'Goi phu kien cho layout sang trong', '169.000d', 'https://images.unsplash.com/photo-1604654894610-df63bc536371?q=80&w=1200', 'accessory', 4, false)
) as seed(name, subtitle, price_label, image_url, product_type, display_order, is_featured)
where not exists (
  select 1 from public.storefront_products existing where existing.storefront_id = active_storefront.id
);

with active_storefront as (
  select id, org_id
  from public.storefront_profile
  where is_active = true
  order by created_at asc
  limit 1
)
insert into public.storefront_gallery (
  org_id,
  storefront_id,
  title,
  image_url,
  kind,
  display_order,
  is_active
)
select
  active_storefront.org_id,
  active_storefront.id,
  seed.title,
  seed.image_url,
  seed.kind,
  seed.display_order,
  true
from active_storefront
cross join (
  values
    ('Khong gian storefront', 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?q=80&w=1200', 'salon', 1),
    ('Ban tiep don', 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?q=80&w=1200', 'decor', 2),
    ('Mau french chic', 'https://images.unsplash.com/photo-1522337660859-02fbefca4702?q=80&w=1200', 'work', 3),
    ('Mau milky glow', 'https://images.unsplash.com/photo-1632345031435-8727f6897d53?q=80&w=1200', 'work', 4),
    ('Team tai cua hang', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=800', 'team', 5),
    ('Goc decor anh kim', 'https://images.unsplash.com/photo-1604654894610-df63bc536371?q=80&w=1200', 'decor', 6)
) as seed(title, image_url, kind, display_order)
where not exists (
  select 1 from public.storefront_gallery existing where existing.storefront_id = active_storefront.id
);
