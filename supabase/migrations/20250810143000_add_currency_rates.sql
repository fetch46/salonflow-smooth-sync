-- Currency rates for converting from USD to other currencies
-- One row per target currency code; rate means 1 USD = rate <code>

CREATE TABLE IF NOT EXISTS public.currency_rates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code text NOT NULL UNIQUE,
  rate numeric(18,6) NOT NULL,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.currency_rates ENABLE ROW LEVEL SECURITY;

-- Policies: public read, super admins manage
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'currency_rates' AND policyname = 'Public can SELECT currency rates'
  ) THEN
    CREATE POLICY "Public can SELECT currency rates"
    ON public.currency_rates
    FOR SELECT
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'currency_rates' AND policyname = 'Super admins can INSERT currency rates'
  ) THEN
    CREATE POLICY "Super admins can INSERT currency rates"
    ON public.currency_rates
    FOR INSERT
    WITH CHECK (public.is_super_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'currency_rates' AND policyname = 'Super admins can UPDATE currency rates'
  ) THEN
    CREATE POLICY "Super admins can UPDATE currency rates"
    ON public.currency_rates
    FOR UPDATE
    USING (public.is_super_admin(auth.uid()))
    WITH CHECK (public.is_super_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'currency_rates' AND policyname = 'Super admins can DELETE currency rates'
  ) THEN
    CREATE POLICY "Super admins can DELETE currency rates"
    ON public.currency_rates
    FOR DELETE
    USING (public.is_super_admin(auth.uid()));
  END IF;
END $$;

-- Updated at trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_currency_rates_updated_at'
  ) THEN
    CREATE TRIGGER update_currency_rates_updated_at
    BEFORE UPDATE ON public.currency_rates
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Seed a few default rates if missing (rates are illustrative; update in admin as needed)
INSERT INTO public.currency_rates (code, rate, source)
VALUES
  ('USD', 1.000000, 'static seed'),
  ('KES', 129.000000, 'static seed'),
  ('EUR', 0.920000, 'static seed'),
  ('GBP', 0.780000, 'static seed')
ON CONFLICT (code) DO NOTHING;