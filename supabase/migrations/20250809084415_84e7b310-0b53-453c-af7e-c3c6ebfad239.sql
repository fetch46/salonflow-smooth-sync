-- Create currencies table for system-wide currency management
CREATE TABLE IF NOT EXISTS public.currencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  symbol text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;

-- Policies: public read, super admins manage
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'currencies' AND policyname = 'Public can SELECT currencies'
  ) THEN
    CREATE POLICY "Public can SELECT currencies"
    ON public.currencies
    FOR SELECT
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'currencies' AND policyname = 'Super admins can INSERT currencies'
  ) THEN
    CREATE POLICY "Super admins can INSERT currencies"
    ON public.currencies
    FOR INSERT
    WITH CHECK (public.is_super_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'currencies' AND policyname = 'Super admins can UPDATE currencies'
  ) THEN
    CREATE POLICY "Super admins can UPDATE currencies"
    ON public.currencies
    FOR UPDATE
    USING (public.is_super_admin(auth.uid()))
    WITH CHECK (public.is_super_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'currencies' AND policyname = 'Super admins can DELETE currencies'
  ) THEN
    CREATE POLICY "Super admins can DELETE currencies"
    ON public.currencies
    FOR DELETE
    USING (public.is_super_admin(auth.uid()));
  END IF;
END $$;

-- Updated at trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_currencies_updated_at'
  ) THEN
    CREATE TRIGGER update_currencies_updated_at
    BEFORE UPDATE ON public.currencies
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Add currency_id to organizations
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS currency_id uuid REFERENCES public.currencies(id);

-- Allow organization owners to update their organizations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'organizations' AND policyname = 'Owners can UPDATE their organizations'
  ) THEN
    CREATE POLICY "Owners can UPDATE their organizations"
    ON public.organizations
    FOR UPDATE
    USING (EXISTS (
      SELECT 1 FROM public.organization_users ou
      WHERE ou.organization_id = organizations.id
        AND ou.user_id = auth.uid()
        AND ou.role = 'owner'
        AND ou.is_active = true
    ))
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.organization_users ou
      WHERE ou.organization_id = organizations.id
        AND ou.user_id = auth.uid()
        AND ou.role = 'owner'
        AND ou.is_active = true
    ));
  END IF;
END $$;