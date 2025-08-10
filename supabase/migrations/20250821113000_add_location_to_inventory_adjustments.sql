BEGIN;

-- 1) Add location_id to inventory_adjustments
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'inventory_adjustments' AND column_name = 'location_id'
  ) THEN
    ALTER TABLE public.inventory_adjustments 
      ADD COLUMN location_id UUID REFERENCES public.business_locations(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_location_id ON public.inventory_adjustments(location_id);
  END IF;
END $$;

-- 2) Update apply/revert functions to use adjustment.location_id when provided
CREATE OR REPLACE FUNCTION public.apply_inventory_adjustment(p_adjustment_id UUID)
RETURNS VOID AS $$
DECLARE
  v_loc UUID;
  r_item RECORD;
BEGIN
  -- Prefer the location selected on the adjustment, otherwise fall back
  SELECT COALESCE(ia.location_id, public.get_default_business_location_id())
    INTO v_loc
  FROM public.inventory_adjustments ia
  WHERE ia.id = p_adjustment_id;

  IF v_loc IS NULL THEN
    RETURN;
  END IF;

  FOR r_item IN (
    SELECT item_id, difference
    FROM public.inventory_adjustment_items
    WHERE adjustment_id = p_adjustment_id
  ) LOOP
    INSERT INTO public.inventory_levels (item_id, location_id, quantity)
    VALUES (r_item.item_id, v_loc, COALESCE(r_item.difference, 0))
    ON CONFLICT (item_id, location_id)
    DO UPDATE SET quantity = COALESCE(public.inventory_levels.quantity, 0) + COALESCE(EXCLUDED.quantity, 0),
                  updated_at = now();
  END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.revert_inventory_adjustment(p_adjustment_id UUID)
RETURNS VOID AS $$
DECLARE
  v_loc UUID;
  r_item RECORD;
BEGIN
  SELECT COALESCE(ia.location_id, public.get_default_business_location_id())
    INTO v_loc
  FROM public.inventory_adjustments ia
  WHERE ia.id = p_adjustment_id;

  IF v_loc IS NULL THEN
    RETURN;
  END IF;

  FOR r_item IN (
    SELECT item_id, difference
    FROM public.inventory_adjustment_items
    WHERE adjustment_id = p_adjustment_id
  ) LOOP
    UPDATE public.inventory_levels
    SET quantity = COALESCE(quantity, 0) - COALESCE(r_item.difference, 0),
        updated_at = now()
    WHERE item_id = r_item.item_id AND location_id = v_loc;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 3) Ensure triggers remain in place
DROP TRIGGER IF EXISTS trg_inventory_adjustment_status ON public.inventory_adjustments;
CREATE TRIGGER trg_inventory_adjustment_status
AFTER UPDATE OF status ON public.inventory_adjustments
FOR EACH ROW
EXECUTE FUNCTION public.trg_inventory_adjustment_status();

DROP TRIGGER IF EXISTS trg_inventory_adjustment_before_delete ON public.inventory_adjustments;
CREATE TRIGGER trg_inventory_adjustment_before_delete
BEFORE DELETE ON public.inventory_adjustments
FOR EACH ROW
EXECUTE FUNCTION public.trg_inventory_adjustment_status();

-- 4) Notify PostgREST to reload schema
DO $$ BEGIN PERFORM pg_notify('pgrst', 'reload schema'); END $$;

COMMIT;