-- Create landing_settings table
create table if not exists public.landing_settings (
  id uuid primary key default gen_random_uuid(),
  hero_title text,
  hero_subtitle text,
  highlights jsonb not null default '[]'::jsonb,
  pricing_copy text,
  cta_primary_text text,
  cta_secondary_text text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Ensure updated_at auto-updates
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_landing_settings_updated
before update on public.landing_settings
for each row execute function public.set_updated_at();

-- Seed a default row if table empty
insert into public.landing_settings (hero_title, hero_subtitle, highlights, pricing_copy, cta_primary_text, cta_secondary_text)
select 
  'Streamline Your Salon',
  'The all-in-one platform for modern salon management',
  '["Online booking","Client management","POS","Analytics"]'::jsonb,
  'Simple, transparent pricing for every stage of your growth.',
  'Get Started Free',
  'Book a Demo'
where not exists (select 1 from public.landing_settings);

alter table public.landing_settings enable row level security;

-- RLS Policies for landing_settings
-- Allow everyone to read landing settings (public content)
create policy if not exists landing_settings_public_read
  on public.landing_settings
  for select
  using (true);

-- Only super admins can insert/update/delete
create policy if not exists landing_settings_super_admin_write
  on public.landing_settings
  for all
  to authenticated
  using (coalesce(is_super_admin(auth.uid()), false))
  with check (coalesce(is_super_admin(auth.uid()), false));

-- Create business_listings table
create table if not exists public.business_listings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text generated always as (regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')) stored,
  description text,
  category text,
  city text,
  country text,
  logo_url text,
  website_url text,
  rating numeric(2,1) check (rating is null or (rating >= 0 and rating <= 5)),
  review_count integer default 0 check (review_count >= 0),
  is_featured boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  unique(slug)
);

create trigger trg_business_listings_updated
before update on public.business_listings
for each row execute function public.set_updated_at();

-- Helpful indexes
create index if not exists idx_business_listings_category on public.business_listings(category);
create index if not exists idx_business_listings_city on public.business_listings(city);
create index if not exists idx_business_listings_featured on public.business_listings(is_featured) where is_active = true;
create index if not exists idx_business_listings_active on public.business_listings(is_active);

alter table public.business_listings enable row level security;

-- Allow public to read only active listings
create policy if not exists business_listings_public_read
  on public.business_listings
  for select
  using (is_active = true or coalesce(is_super_admin(auth.uid()), false));

-- Only super admins can write
create policy if not exists business_listings_super_admin_write
  on public.business_listings
  for all
  to authenticated
  using (coalesce(is_super_admin(auth.uid()), false))
  with check (coalesce(is_super_admin(auth.uid()), false));

-- Optional seed example listings
insert into public.business_listings (name, description, category, city, country, logo_url, website_url, rating, review_count, is_featured, is_active)
values
  ('Velvet Salon', 'Premium hair and beauty salon', 'Salon', 'New York', 'USA', null, 'https://velvetsalon.example.com', 4.8, 237, true, true),
  ('Glow Bar', 'Skincare and spa services', 'Spa', 'Los Angeles', 'USA', null, 'https://glowbar.example.com', 4.6, 142, true, true),
  ('Chic Cuts', 'Modern cuts and styling', 'Salon', 'Chicago', 'USA', null, 'https://chiccuts.example.com', 4.4, 98, false, true)
  on conflict do nothing;