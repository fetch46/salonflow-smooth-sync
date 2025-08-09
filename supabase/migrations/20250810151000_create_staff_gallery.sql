-- Create staff gallery table to store portfolio images
create table if not exists public.staff_gallery (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  storage_path text not null,
  public_url text not null,
  caption text,
  created_at timestamptz not null default now()
);

alter table public.staff_gallery enable row level security;

-- Public read access to staff gallery
create policy if not exists "Public read staff_gallery"
  on public.staff_gallery for select
  using (true);

-- Authenticated users can manage staff_gallery
create policy if not exists "Authenticated insert staff_gallery"
  on public.staff_gallery for insert
  with check (auth.role() = 'authenticated');

create policy if not exists "Authenticated update staff_gallery"
  on public.staff_gallery for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy if not exists "Authenticated delete staff_gallery"
  on public.staff_gallery for delete
  using (auth.role() = 'authenticated');