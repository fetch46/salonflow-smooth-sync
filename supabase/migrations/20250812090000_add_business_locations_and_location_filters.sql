-- Minimal business_locations to support inventory features
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.business_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add FK to organizations if available
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'organizations'
  ) THEN
    ALTER TABLE public.business_locations
    DROP CONSTRAINT IF EXISTS business_locations_organization_id_fkey;
    ALTER TABLE public.business_locations
    ADD CONSTRAINT business_locations_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_business_locations_updated_at') THEN
    CREATE TRIGGER trg_business_locations_updated_at
    BEFORE UPDATE ON public.business_locations
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_business_locations_org ON public.business_locations(organization_id);
CREATE INDEX IF NOT EXISTS idx_business_locations_active ON public.business_locations(is_active);
CREATE INDEX IF NOT EXISTS idx_business_locations_default ON public.business_locations(is_default);
CREATE INDEX IF NOT EXISTS idx_business_locations_name ON public.business_locations(name);

-- RLS permissive for dev
ALTER TABLE public.business_locations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'business_locations' AND policyname = 'Allow all (business_locations)'
  ) THEN
    CREATE POLICY "Allow all (business_locations)" ON public.business_locations
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;