begin;

alter table public.services enable row level security;

drop policy if exists "public read lookbook services" on public.services;
create policy "public read lookbook services" on public.services
for select
using (
  active = true
  and (
    featured_in_lookbook = true
    or featured_in_home = true
    or featured_in_explore = true
  )
);

drop policy if exists "anon read home services" on public.services;
create policy "anon read home services" on public.services
for select
to anon
using (active = true and featured_in_home = true);

drop policy if exists "anon read explore services" on public.services;
create policy "anon read explore services" on public.services
for select
to anon
using (active = true and featured_in_explore = true);

drop policy if exists "anon read lookbook services" on public.services;
create policy "anon read lookbook services" on public.services
for select
to anon
using (active = true and featured_in_lookbook = true);

commit;
