-- Ensure commission_rate exists on staff table
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'staff'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'staff' AND column_name = 'commission_rate'
    ) THEN
      ALTER TABLE public.staff ADD COLUMN commission_rate numeric(5,2) NULL;
    END IF;
  END IF;
END $$;