-- Add location_id to inventory_adjustments with FK to business_locations and index (idempotent)
DO $$ BEGIN
  -- Add column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='inventory_adjustments' AND column_name='location_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.inventory_adjustments ADD COLUMN location_id uuid NULL';
  END IF;

  -- Add FK constraint if missing
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='inventory_adjustments' AND column_name='location_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='inventory_adjustments_location_id_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE public.inventory_adjustments 
             ADD CONSTRAINT inventory_adjustments_location_id_fkey 
             FOREIGN KEY (location_id) REFERENCES public.business_locations(id) ON DELETE SET NULL';
  END IF;

  -- Create index if missing
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_location_id ON public.inventory_adjustments(location_id)';
END $$;

-- Reload PostgREST schema cache
DO $$ BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END $$;