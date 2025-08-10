BEGIN;

-- Function to fetch a default storage location id
CREATE OR REPLACE FUNCTION public.get_default_storage_location_id()
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Prefer an existing location named 'Main Storage'
  SELECT id INTO v_id FROM public.storage_locations WHERE name = 'Main Storage' LIMIT 1;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  -- Otherwise pick the earliest created location
  SELECT id INTO v_id FROM public.storage_locations ORDER BY created_at ASC NULLS LAST, id ASC LIMIT 1;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Apply inventory adjustment to inventory_levels (idempotent guard via status transitions)
CREATE OR REPLACE FUNCTION public.apply_inventory_adjustment(p_adjustment_id UUID)
RETURNS VOID AS $$
DECLARE
  v_loc UUID;
  r_item RECORD;
BEGIN
  -- Resolve a default location to apply the adjustment
  v_loc := public.get_default_storage_location_id();
  IF v_loc IS NULL THEN
    -- No location available; nothing to do
    RETURN;
  END IF;

  FOR r_item IN (
    SELECT item_id, difference
    FROM public.inventory_adjustment_items
    WHERE adjustment_id = p_adjustment_id
  ) LOOP
    -- Upsert inventory level per item/location
    INSERT INTO public.inventory_levels (item_id, location_id, quantity)
    VALUES (r_item.item_id, v_loc, COALESCE(r_item.difference, 0))
    ON CONFLICT (item_id, location_id)
    DO UPDATE SET quantity = COALESCE(public.inventory_levels.quantity, 0) + COALESCE(EXCLUDED.quantity, 0),
                  updated_at = now();
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Revert inventory adjustment from inventory_levels
CREATE OR REPLACE FUNCTION public.revert_inventory_adjustment(p_adjustment_id UUID)
RETURNS VOID AS $$
DECLARE
  v_loc UUID;
  r_item RECORD;
BEGIN
  v_loc := public.get_default_storage_location_id();
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

-- Trigger to apply/revert changes on status transitions
CREATE OR REPLACE FUNCTION public.trg_inventory_adjustment_status()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Apply when becoming approved
    IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
      PERFORM public.apply_inventory_adjustment(NEW.id);
    END IF;
    -- Revert when leaving approved state
    IF OLD.status = 'approved' AND (NEW.status IS DISTINCT FROM 'approved') THEN
      PERFORM public.revert_inventory_adjustment(NEW.id);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    -- Revert only if previously approved
    IF OLD.status = 'approved' THEN
      PERFORM public.revert_inventory_adjustment(OLD.id);
    END IF;
    RETURN OLD;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Ensure triggers exist on inventory_adjustments
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

-- Refresh PostgREST cache
DO $$ BEGIN PERFORM pg_notify('pgrst', 'reload schema'); END $$;

COMMIT;