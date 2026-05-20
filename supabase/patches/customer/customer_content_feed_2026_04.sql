begin;

create table if not exists public.customer_content_posts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  source_platform text not null default 'telegram',
  source_message_id text,
  title text not null,
  summary text not null default '',
  body text not null default '',
  cover_image_url text,
  content_type text not null default 'trend' check (content_type in ('trend', 'care', 'news', 'offer_hint')),
  status text not null default 'draft' check (status in ('draft', 'approved', 'published', 'archived')),
  published_at timestamptz,
  priority int not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_customer_content_posts_source_message
  on public.customer_content_posts (source_platform, source_message_id)
  where source_message_id is not null;

create index if not exists idx_customer_content_posts_org_status_published
  on public.customer_content_posts (org_id, status, priority asc, published_at desc nulls last);

alter table public.customer_content_posts enable row level security;

drop policy if exists "service role full access customer content posts" on public.customer_content_posts;
create policy "service role full access customer content posts" on public.customer_content_posts
for all
to service_role
using (true)
with check (true);

drop policy if exists "authenticated read published customer content posts" on public.customer_content_posts;
create policy "authenticated read published customer content posts" on public.customer_content_posts
for select
to authenticated
using (status = 'published');

drop policy if exists "anon read published customer content posts" on public.customer_content_posts;
create policy "anon read published customer content posts" on public.customer_content_posts
for select
to anon
using (status = 'published');

drop policy if exists "authenticated read active marketing offers" on public.marketing_offers;
create policy "authenticated read active marketing offers" on public.marketing_offers
for select
to authenticated
using (
  is_active = true
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at >= now())
);

drop policy if exists "anon read active marketing offers" on public.marketing_offers;
create policy "anon read active marketing offers" on public.marketing_offers
for select
to anon
using (
  is_active = true
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at >= now())
);

drop trigger if exists trg_customer_content_posts_updated_at on public.customer_content_posts;
create trigger trg_customer_content_posts_updated_at
before update on public.customer_content_posts
for each row
execute function public.touch_updated_at();

commit;
