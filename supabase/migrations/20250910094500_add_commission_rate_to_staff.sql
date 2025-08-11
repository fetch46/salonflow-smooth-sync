-- Add commission_rate to staff if missing (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'staff' 
      AND column_name = 'commission_rate'
  ) THEN
    EXECUTE 'ALTER TABLE public.staff ADD COLUMN commission_rate numeric(5,2) NULL';
  END IF;
END $$;

-- Ensure a sane 0-100 bounds check exists (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'staff_commission_rate_bounds_chk'
  ) THEN
    EXECUTE 'ALTER TABLE public.staff
             ADD CONSTRAINT staff_commission_rate_bounds_chk
             CHECK (commission_rate IS NULL OR (commission_rate >= 0 AND commission_rate <= 100))';
  END IF;
END $$;

-- Optionally backfill: leave NULLs as-is; UI handles defaults

-- Reload PostgREST schema so the new column is available immediately
DO $$ BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END $$;