-- Extend Landing CMS: create tables if missing and add columns for full landing configurability
-- This migration is idempotent and safe to run multiple times

BEGIN;

-- Helper: ensure set_updated_at() exists before creating triggers
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at'
  ) THEN
    CREATE OR REPLACE FUNCTION public.set_updated_at()
    RETURNS trigger AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  END IF;
END $$;

-- Table: landing_settings
CREATE TABLE IF NOT EXISTS public.landing_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL
);

-- Core hero/header/footer fields
ALTER TABLE public.landing_settings ADD COLUMN IF NOT EXISTS brand_name text;
ALTER TABLE public.landing_settings ADD COLUMN IF NOT EXISTS brand_logo_url text;
ALTER TABLE public.landing_settings ADD COLUMN IF NOT EXISTS nav_links jsonb; -- [{label, href}]
ALTER TABLE public.landing_settings ADD COLUMN IF NOT EXISTS hero_title text;
ALTER TABLE public.landing_settings ADD COLUMN IF NOT EXISTS hero_subtitle text;
ALTER TABLE public.landing_settings ADD COLUMN IF NOT EXISTS hero_badge_text text;
ALTER TABLE public.landing_settings ADD COLUMN IF NOT EXISTS hero_image_url text;
ALTER TABLE public.landing_settings ADD COLUMN IF NOT EXISTS highlights text[];
ALTER TABLE public.landing_settings ADD COLUMN IF NOT EXISTS partner_logos jsonb; -- [{name, logo_url}]

-- Features
ALTER TABLE public.landing_settings ADD COLUMN IF NOT EXISTS features_title text;
ALTER TABLE public.landing_settings ADD COLUMN IF NOT EXISTS features_subtitle text;
ALTER TABLE public.landing_settings ADD COLUMN IF NOT EXISTS features jsonb; -- [{icon, title, description}]
ALTER TABLE public.landing_settings ADD COLUMN IF NOT EXISTS extra_features jsonb; -- same shape

-- Pricing
ALTER TABLE public.landing_settings ADD COLUMN IF NOT EXISTS pricing_title text;
ALTER TABLE public.landing_settings ADD COLUMN IF NOT EXISTS pricing_copy text;
ALTER TABLE public.landing_settings ADD COLUMN IF NOT EXISTS billing_monthly_label text;
ALTER TABLE public.landing_settings ADD COLUMN IF NOT EXISTS billing_yearly_label text;
ALTER TABLE public.landing_settings ADD COLUMN IF NOT EXISTS plan_cta_label text;
ALTER TABLE public.landing_settings ADD COLUMN IF NOT EXISTS most_popular_badge_text text;

-- Featured businesses section
ALTER TABLE public.landing_settings ADD COLUMN IF NOT EXISTS featured_enabled boolean DEFAULT true;
ALTER TABLE public.landing_settings ADD COLUMN IF NOT EXISTS featured_title text;
ALTER TABLE public.landing_settings ADD COLUMN IF NOT EXISTS featured_subtitle text;

-- CTA section (bottom)
ALTER TABLE public.landing_settings ADD COLUMN IF NOT EXISTS cta_section_title text;
ALTER TABLE public.landing_settings ADD COLUMN IF NOT EXISTS cta_section_subtitle text;
ALTER TABLE public.landing_settings ADD COLUMN IF NOT EXISTS cta_primary_text text; -- used in hero by legacy
ALTER TABLE public.landing_settings ADD COLUMN IF NOT EXISTS cta_primary_link text;
ALTER TABLE public.landing_settings ADD COLUMN IF NOT EXISTS cta_secondary_text text; -- used in hero by legacy
ALTER TABLE public.landing_settings ADD COLUMN IF NOT EXISTS cta_secondary_link text;
ALTER TABLE public.landing_settings ADD COLUMN IF NOT EXISTS cta_bottom_primary_text text;
ALTER TABLE public.landing_settings ADD COLUMN IF NOT EXISTS cta_bottom_primary_link text;
ALTER TABLE public.landing_settings ADD COLUMN IF NOT EXISTS cta_bottom_secondary_text text;
ALTER TABLE public.landing_settings ADD COLUMN IF NOT EXISTS cta_bottom_secondary_link text;

-- FAQ
ALTER TABLE public.landing_settings ADD COLUMN IF NOT EXISTS faq_title text;
ALTER TABLE public.landing_settings ADD COLUMN IF NOT EXISTS faq_subtitle text;
ALTER TABLE public.landing_settings ADD COLUMN IF NOT EXISTS faqs jsonb; -- [{question, answer}]

-- Footer
ALTER TABLE public.landing_settings ADD COLUMN IF NOT EXISTS footer_brand_name text;
ALTER TABLE public.landing_settings ADD COLUMN IF NOT EXISTS footer_description text;
ALTER TABLE public.landing_settings ADD COLUMN IF NOT EXISTS footer_columns jsonb; -- [{title, links:[{label, href}]}]

-- Trigger to maintain updated_at
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_landing_settings_updated_at'
  ) THEN
    CREATE TRIGGER trg_landing_settings_updated_at
    BEFORE UPDATE ON public.landing_settings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- RLS and policies
ALTER TABLE public.landing_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'landing_settings' AND policyname = 'landing_settings_select_all'
  ) THEN
    CREATE POLICY landing_settings_select_all ON public.landing_settings
      FOR SELECT TO anon, authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'landing_settings' AND policyname = 'landing_settings_write_super_admin'
  ) THEN
    CREATE POLICY landing_settings_write_super_admin ON public.landing_settings
      FOR ALL TO authenticated
      USING (public.is_super_admin(auth.uid()))
      WITH CHECK (public.is_super_admin(auth.uid()));
  END IF;
END $$;

-- Table: business_listings (for featured businesses)
CREATE TABLE IF NOT EXISTS public.business_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL,
  name text NOT NULL,
  slug text UNIQUE NULL,
  description text NULL,
  category text NULL,
  city text NULL,
  country text NULL,
  logo_url text NULL,
  website_url text NULL,
  rating numeric NULL,
  review_count integer NULL DEFAULT 0,
  is_featured boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_business_listings_updated_at'
  ) THEN
    CREATE TRIGGER trg_business_listings_updated_at
    BEFORE UPDATE ON public.business_listings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

ALTER TABLE public.business_listings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'business_listings' AND policyname = 'business_listings_select_all'
  ) THEN
    CREATE POLICY business_listings_select_all ON public.business_listings
      FOR SELECT TO anon, authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'business_listings' AND policyname = 'business_listings_write_super_admin'
  ) THEN
    CREATE POLICY business_listings_write_super_admin ON public.business_listings
      FOR ALL TO authenticated
      USING (public.is_super_admin(auth.uid()))
      WITH CHECK (public.is_super_admin(auth.uid()));
  END IF;
END $$;

COMMIT;