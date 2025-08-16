@@ .. @@
 -- Grant execute permission
 GRANT EXECUTE ON FUNCTION setup_new_organization TO authenticated;
 
+-- Create business_listings table for the business directory
+CREATE TABLE IF NOT EXISTS public.business_listings (
+    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
+    name text NOT NULL,
+    slug text UNIQUE NOT NULL,
+    description text NULL,
+    category text NULL,
+    city text NULL,
+    country text NULL,
+    logo_url text NULL,
+    website_url text NULL,
+    rating numeric NULL,
+    review_count integer NULL,
+    is_featured boolean NOT NULL DEFAULT false,
+    is_active boolean NOT NULL DEFAULT true,
+    created_at timestamptz NOT NULL DEFAULT now(),
+    updated_at timestamptz NOT NULL DEFAULT now()
+);
+
+-- Create indexes for business_listings
+CREATE INDEX IF NOT EXISTS idx_business_listings_name ON public.business_listings(name);
+CREATE INDEX IF NOT EXISTS idx_business_listings_featured ON public.business_listings(is_featured);
+CREATE INDEX IF NOT EXISTS idx_business_listings_active ON public.business_listings(is_active);
+
+-- Enable RLS for business_listings
+ALTER TABLE public.business_listings ENABLE ROW LEVEL SECURITY;
+
+-- Create RLS policy for business_listings
+DO $$
+BEGIN
+    IF NOT EXISTS (
+        SELECT 1 FROM pg_policies 
+        WHERE schemaname = 'public' 
+        AND tablename = 'business_listings' 
+        AND policyname = 'Allow all (business_listings)'
+    ) THEN
+        CREATE POLICY "Allow all (business_listings)" 
+        ON public.business_listings 
+        FOR ALL TO anon, authenticated 
+        USING (true) 
+        WITH CHECK (true);
+    END IF;
+END $$;
+
+-- Create landing_settings table for CMS functionality
+CREATE TABLE IF NOT EXISTS public.landing_settings (
+    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
+    hero_title text NULL,
+    hero_subtitle text NULL,
+    highlights text[] NULL,
+    pricing_copy text NULL,
+    cta_primary_text text NULL,
+    cta_secondary_text text NULL,
+    updated_by uuid NULL,
+    created_at timestamptz NOT NULL DEFAULT now(),
+    updated_at timestamptz NOT NULL DEFAULT now()
+);
+
+-- Enable RLS for landing_settings
+ALTER TABLE public.landing_settings ENABLE ROW LEVEL SECURITY;
+
+-- Create RLS policy for landing_settings
+DO $$
+BEGIN
+    IF NOT EXISTS (
+        SELECT 1 FROM pg_policies 
+        WHERE schemaname = 'public' 
+        AND tablename = 'landing_settings' 
+        AND policyname = 'Allow all (landing_settings)'
+    ) THEN
+        CREATE POLICY "Allow all (landing_settings)" 
+        ON public.landing_settings 
+        FOR ALL TO anon, authenticated 
+        USING (true) 
+        WITH CHECK (true);
+    END IF;
+END $$;
+
 -- 3. Ensure subscription plans exist
 INSERT INTO subscription_plans (name, slug, description, price_monthly, price_yearly, max_users, max_locations, features, is_active, sort_order) VALUES