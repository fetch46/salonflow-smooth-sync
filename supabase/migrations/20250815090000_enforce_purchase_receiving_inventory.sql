-- Enforce delete restrictions and auto-inventory sync for Purchases receiving
BEGIN;

-- 1) Prevent deleting a purchase that has any received items
CREATE OR REPLACE FUNCTION public.enforce_no_delete_received_purchase()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.purchase_items
    WHERE purchase_id = OLD.id
      AND COALESCE(received_quantity, 0) > 0
  ) THEN
    RAISE EXCEPTION 'Cannot delete purchase with received items. Undo receiving first.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_no_delete_received_purchase ON public.purchases;
CREATE TRIGGER trg_no_delete_received_purchase
BEFORE DELETE ON public.purchases
FOR EACH ROW
EXECUTE FUNCTION public.enforce_no_delete_received_purchase();

-- 2) Prevent deleting a purchase item that has any received quantity
CREATE OR REPLACE FUNCTION public.enforce_no_delete_received_item()
RETURNS TRIGGER AS $$
BEGIN
  IF COALESCE(OLD.received_quantity, 0) > 0 THEN
    RAISE EXCEPTION 'Cannot delete a purchase item that has received quantity. Undo receiving first.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_no_delete_received_item ON public.purchase_items;
CREATE TRIGGER trg_no_delete_received_item
BEFORE DELETE ON public.purchase_items
FOR EACH ROW
EXECUTE FUNCTION public.enforce_no_delete_received_item();

-- 3) Validate received_quantity within [0, quantity]
CREATE OR REPLACE FUNCTION public.enforce_received_quantity_bounds()
RETURNS TRIGGER AS $$
BEGIN
  IF COALESCE(NEW.received_quantity, 0) < 0 THEN
    RAISE EXCEPTION 'received_quantity cannot be negative';
  END IF;
  IF COALESCE(NEW.received_quantity, 0) > COALESCE(NEW.quantity, 0) THEN
    RAISE EXCEPTION 'received_quantity cannot exceed ordered quantity';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_received_quantity_bounds ON public.purchase_items;
CREATE TRIGGER trg_enforce_received_quantity_bounds
BEFORE UPDATE OF received_quantity ON public.purchase_items
FOR EACH ROW
EXECUTE FUNCTION public.enforce_received_quantity_bounds();

-- 4) Auto-sync inventory levels and purchase status when receiving changes
CREATE OR REPLACE FUNCTION public.sync_inventory_on_purchase_receive()
RETURNS TRIGGER AS $$
DECLARE
  v_delta NUMERIC;
  v_location UUID;
  v_total INT;
  v_fully INT;
  v_any INT;
  v_status TEXT;
BEGIN
  v_delta := COALESCE(NEW.received_quantity, 0) - COALESCE(OLD.received_quantity, 0);
  IF v_delta = 0 THEN
    RETURN NEW;
  END IF;

  SELECT location_id INTO v_location FROM public.purchases WHERE id = NEW.purchase_id;

  -- If no location set on the purchase, skip inventory sync (app should set it before receiving)
  IF v_location IS NOT NULL THEN
    IF v_delta > 0 THEN
      INSERT INTO public.inventory_levels (item_id, location_id, quantity)
      VALUES (NEW.item_id, v_location, v_delta)
      ON CONFLICT (item_id, location_id)
      DO UPDATE SET quantity = public.inventory_levels.quantity + EXCLUDED.quantity;
    ELSE
      UPDATE public.inventory_levels
      SET quantity = GREATEST(0, COALESCE(quantity, 0) + v_delta)
      WHERE item_id = NEW.item_id AND location_id = v_location;
    END IF;
  END IF;

  -- Recompute purchase status
  SELECT COUNT(*) INTO v_total
  FROM public.purchase_items
  WHERE purchase_id = NEW.purchase_id;

  SELECT COUNT(*) INTO v_fully
  FROM public.purchase_items
  WHERE purchase_id = NEW.purchase_id
    AND COALESCE(received_quantity, 0) >= COALESCE(quantity, 0);

  SELECT COUNT(*) INTO v_any
  FROM public.purchase_items
  WHERE purchase_id = NEW.purchase_id
    AND COALESCE(received_quantity, 0) > 0;

  IF v_total > 0 AND v_fully = v_total THEN
    v_status := 'received';
  ELSIF v_any > 0 THEN
    v_status := 'partial';
  ELSE
    v_status := 'pending';
  END IF;

  UPDATE public.purchases SET status = v_status, updated_at = NOW() WHERE id = NEW.purchase_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_inventory_on_purchase_receive ON public.purchase_items;
CREATE TRIGGER trg_sync_inventory_on_purchase_receive
AFTER UPDATE OF received_quantity ON public.purchase_items
FOR EACH ROW
EXECUTE FUNCTION public.sync_inventory_on_purchase_receive();

COMMIT;