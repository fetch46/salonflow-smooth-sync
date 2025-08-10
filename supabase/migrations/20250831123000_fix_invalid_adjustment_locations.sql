-- Fix invalid location references on inventory_adjustments to prevent FK violations during approval
DO $$
DECLARE
  v_default_location uuid;
BEGIN
  -- Choose a default active location if available (prefer is_default=true)
  SELECT bl.id
  INTO v_default_location
  FROM public.business_locations bl
  WHERE COALESCE(bl.is_active, true) = true
  ORDER BY COALESCE(bl.is_default, false) DESC, bl.created_at NULLS LAST, bl.id
  LIMIT 1;

  -- Set invalid or missing location_id to default location if present; otherwise NULL
  UPDATE public.inventory_adjustments ia
  SET location_id = COALESCE(v_default_location, NULL)
  WHERE ia.location_id IS NULL
     OR ia.location_id NOT IN (SELECT id FROM public.business_locations);
END $$;

-- Optional: verify constraint exists (no-op if already present)
DO $$ BEGIN
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
END $$;