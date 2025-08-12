-- Add commission_rate to staff if table exists; otherwise create minimal staff table
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='staff') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='staff' AND column_name='commission_rate'
    ) THEN
      ALTER TABLE public.staff ADD COLUMN commission_rate NUMERIC;
    END IF;
  ELSE
    CREATE TABLE public.staff (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID,
      name TEXT,
      commission_rate NUMERIC,
      is_active BOOLEAN DEFAULT TRUE
    );
  END IF;
END $$;