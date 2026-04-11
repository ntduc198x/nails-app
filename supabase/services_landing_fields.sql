alter table public.services
  add column if not exists short_description text,
  add column if not exists image_url text,
  add column if not exists display_order int not null default 0,
  add column if not exists featured_in_lookbook boolean not null default false;

create index if not exists idx_services_org_active_display_order
  on public.services (org_id, active, featured_in_lookbook, display_order asc, created_at asc);
