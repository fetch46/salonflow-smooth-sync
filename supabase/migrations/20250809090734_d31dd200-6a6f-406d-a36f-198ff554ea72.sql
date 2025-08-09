-- Create countries table for system-wide country management
CREATE TABLE IF NOT EXISTS public.countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'countries' AND policyname = 'Public can SELECT countries'
  ) THEN
    CREATE POLICY "Public can SELECT countries"
    ON public.countries
    FOR SELECT
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'countries' AND policyname = 'Super admins can INSERT countries'
  ) THEN
    CREATE POLICY "Super admins can INSERT countries"
    ON public.countries
    FOR INSERT
    WITH CHECK (is_super_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'countries' AND policyname = 'Super admins can UPDATE countries'
  ) THEN
    CREATE POLICY "Super admins can UPDATE countries"
    ON public.countries
    FOR UPDATE
    USING (is_super_admin(auth.uid()))
    WITH CHECK (is_super_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'countries' AND policyname = 'Super admins can DELETE countries'
  ) THEN
    CREATE POLICY "Super admins can DELETE countries"
    ON public.countries
    FOR DELETE
    USING (is_super_admin(auth.uid()));
  END IF;
END $$;

-- Trigger to auto-update updated_at
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_countries_updated_at'
  ) THEN
    CREATE TRIGGER update_countries_updated_at
    BEFORE UPDATE ON public.countries
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;
