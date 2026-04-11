-- Create a public bucket for lookbook/service images.
insert into storage.buckets (id, name, public)
values ('service-images', 'service-images', true)
on conflict (id) do update set public = true;

-- Public read policy
create policy if not exists "service-images public read"
on storage.objects for select
using (bucket_id = 'service-images');

-- Authenticated upload/update/delete policy (adjust if you want stricter org-based rules later)
create policy if not exists "service-images authenticated insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'service-images');

create policy if not exists "service-images authenticated update"
on storage.objects for update
to authenticated
using (bucket_id = 'service-images')
with check (bucket_id = 'service-images');

create policy if not exists "service-images authenticated delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'service-images');
