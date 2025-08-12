-- Ensure warehouses has updated_at and trigger
DO $$
BEGIN
  -- Add updated_at column if it does not exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'warehouses'
      AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.warehouses
      ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

-- Generic updated_at trigger function (idempotent)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

-- Ensure trigger exists on warehouses
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_warehouses_updated_at'
  ) THEN
    CREATE TRIGGER trg_warehouses_updated_at
    BEFORE UPDATE ON public.warehouses
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;