-- Create a public bucket for staff media (avatars and gallery)
insert into storage.buckets (id, name, public)
values ('staff-media', 'staff-media', true)
on conflict (id) do nothing;

-- Enable RLS on storage.objects if not already enabled
alter table if exists storage.objects enable row level security;

-- Public read access to staff-media bucket
create policy if not exists "Public read access to staff-media"
  on storage.objects for select
  using (bucket_id = 'staff-media');

-- Authenticated users can upload to staff-media
create policy if not exists "Authenticated upload to staff-media"
  on storage.objects for insert
  with check (bucket_id = 'staff-media' and auth.role() = 'authenticated');

-- Authenticated users can update their own objects in staff-media
create policy if not exists "Authenticated update staff-media"
  on storage.objects for update
  using (bucket_id = 'staff-media' and auth.role() = 'authenticated')
  with check (bucket_id = 'staff-media' and auth.role() = 'authenticated');

-- Authenticated users can delete from staff-media
create policy if not exists "Authenticated delete staff-media"
  on storage.objects for delete
  using (bucket_id = 'staff-media' and auth.role() = 'authenticated');