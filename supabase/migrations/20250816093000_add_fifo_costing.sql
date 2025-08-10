BEGIN;

-- 1) FIFO Costing: Create inventory cost layers
CREATE TABLE IF NOT EXISTS public.inventory_cost_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.business_locations(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('purchase','adjustment','opening')),
  source_id UUID,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  quantity NUMERIC NOT NULL DEFAULT 0,
  remaining_quantity NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_cost_layers_item_loc ON public.inventory_cost_layers(item_id, location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_cost_layers_remaining ON public.inventory_cost_layers(item_id, location_id, remaining_quantity);
CREATE INDEX IF NOT EXISTS idx_inventory_cost_layers_source ON public.inventory_cost_layers(source_type, source_id);

ALTER TABLE public.inventory_cost_layers ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'inventory_cost_layers' AND policyname = 'Public access to inventory_cost_layers'
  ) THEN
    CREATE POLICY "Public access to inventory_cost_layers" ON public.inventory_cost_layers FOR ALL USING (true);
  END IF;
END $$;

CREATE TRIGGER update_inventory_cost_layers_updated_at
BEFORE UPDATE ON public.inventory_cost_layers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 2) FIFO Costing: Create inventory consumption records per receipt item
CREATE TABLE IF NOT EXISTS public.inventory_consumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  receipt_item_id UUID NOT NULL REFERENCES public.receipt_items(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.business_locations(id) ON DELETE CASCADE,
  layer_id UUID REFERENCES public.inventory_cost_layers(id) ON DELETE SET NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_consumptions_receipt_item ON public.inventory_consumptions(receipt_item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_consumptions_item_loc ON public.inventory_consumptions(item_id, location_id);

ALTER TABLE public.inventory_consumptions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'inventory_consumptions' AND policyname = 'Public access to inventory_consumptions'
  ) THEN
    CREATE POLICY "Public access to inventory_consumptions" ON public.inventory_consumptions FOR ALL USING (true);
  END IF;
END $$;

CREATE TRIGGER update_inventory_consumptions_updated_at
BEFORE UPDATE ON public.inventory_consumptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Function: consume inventory using FIFO for a given receipt_item
CREATE OR REPLACE FUNCTION public.consume_inventory_for_receipt_item(p_receipt_item_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_item RECORD;
  v_qty_to_consume NUMERIC;
  v_total_cost NUMERIC := 0;
  v_take NUMERIC;
  v_unit_cost NUMERIC;
  v_layer RECORD;
  v_location UUID;
BEGIN
  -- Load receipt item and resolve product, org, location, quantity
  SELECT rci.id,
         rci.product_id,
         COALESCE(rci.quantity, 0) AS quantity,
         COALESCE(rci.location_id, r.location_id) AS location_id,
         COALESCE(rci.organization_id, r.organization_id) AS organization_id
  INTO v_item
  FROM public.receipt_items rci
  JOIN public.receipts r ON r.id = rci.receipt_id
  WHERE rci.id = p_receipt_item_id;

  IF v_item.product_id IS NULL OR v_item.quantity <= 0 THEN
    RETURN 0;
  END IF;

  v_location := v_item.location_id;
  IF v_location IS NULL THEN
    -- If location cannot be determined, do not consume inventory
    RETURN 0;
  END IF;

  -- Reverse any prior consumption for idempotency (updates can reuse this)
  FOR v_layer IN (
    SELECT ic.layer_id, ic.quantity, ic.unit_cost
    FROM public.inventory_consumptions ic
    WHERE ic.receipt_item_id = p_receipt_item_id
  ) LOOP
    IF v_layer.layer_id IS NOT NULL THEN
      UPDATE public.inventory_cost_layers
      SET remaining_quantity = remaining_quantity + v_layer.quantity,
          updated_at = now()
      WHERE id = v_layer.layer_id;
    END IF;
    -- add back to inventory level (allow negatives to revert correctly)
    UPDATE public.inventory_levels
    SET quantity = COALESCE(quantity, 0) + v_layer.quantity,
        updated_at = now()
    WHERE item_id = v_item.product_id AND location_id = v_location;
  END LOOP;
  DELETE FROM public.inventory_consumptions WHERE receipt_item_id = p_receipt_item_id;

  v_qty_to_consume := v_item.quantity;

  -- Consume from layers in FIFO order
  FOR v_layer IN (
    SELECT *
    FROM public.inventory_cost_layers
    WHERE item_id = v_item.product_id
      AND location_id = v_location
      AND remaining_quantity > 0
    ORDER BY received_at ASC, created_at ASC
    FOR UPDATE
  ) LOOP
    EXIT WHEN v_qty_to_consume <= 0;
    v_take := LEAST(v_layer.remaining_quantity, v_qty_to_consume);
    IF v_take <= 0 THEN
      CONTINUE;
    END IF;

    -- Record consumption
    INSERT INTO public.inventory_consumptions (
      organization_id, receipt_item_id, item_id, location_id, layer_id,
      quantity, unit_cost, total_cost
    ) VALUES (
      v_item.organization_id, p_receipt_item_id, v_item.product_id, v_location, v_layer.id,
      v_take, v_layer.unit_cost, v_take * v_layer.unit_cost
    );

    -- Decrement layer and inventory level
    UPDATE public.inventory_cost_layers
    SET remaining_quantity = remaining_quantity - v_take,
        updated_at = now()
    WHERE id = v_layer.id;

    UPDATE public.inventory_levels
    SET quantity = COALESCE(quantity, 0) - v_take,
        updated_at = now()
    WHERE item_id = v_item.product_id AND location_id = v_location;

    v_total_cost := v_total_cost + (v_take * v_layer.unit_cost);
    v_qty_to_consume := v_qty_to_consume - v_take;
  END LOOP;

  -- If shortage remains, consume at fallback unit cost and allow negative inventory
  IF v_qty_to_consume > 0 THEN
    SELECT COALESCE(cost_price, 0) INTO v_unit_cost FROM public.inventory_items WHERE id = v_item.product_id;
    INSERT INTO public.inventory_consumptions (
      organization_id, receipt_item_id, item_id, location_id, layer_id,
      quantity, unit_cost, total_cost
    ) VALUES (
      v_item.organization_id, p_receipt_item_id, v_item.product_id, v_location, NULL,
      v_qty_to_consume, v_unit_cost, v_qty_to_consume * v_unit_cost
    );

    UPDATE public.inventory_levels
    SET quantity = COALESCE(quantity, 0) - v_qty_to_consume,
        updated_at = now()
    WHERE item_id = v_item.product_id AND location_id = v_location;

    v_total_cost := v_total_cost + (v_qty_to_consume * v_unit_cost);
  END IF;

  RETURN COALESCE(v_total_cost, 0);
END;
$$ LANGUAGE plpgsql;

-- 4) Extend purchase receiving sync to also create/update cost layers
CREATE OR REPLACE FUNCTION public.sync_inventory_on_purchase_receive()
RETURNS TRIGGER AS $$
DECLARE
  v_delta NUMERIC;
  v_location UUID;
  v_total INT;
  v_fully INT;
  v_any INT;
  v_status TEXT;
  v_org UUID;
  v_cost NUMERIC;
  v_taken NUMERIC;
  v_layer RECORD;
BEGIN
  v_delta := COALESCE(NEW.received_quantity, 0) - COALESCE(OLD.received_quantity, 0);
  IF v_delta = 0 THEN
    RETURN NEW;
  END IF;

  SELECT location_id, organization_id INTO v_location, v_org FROM public.purchases WHERE id = NEW.purchase_id;

  -- Sync inventory levels (allow increases; decreases are bounded at 0 as before)
  IF v_location IS NOT NULL THEN
    IF v_delta > 0 THEN
      INSERT INTO public.inventory_levels (item_id, location_id, quantity)
      VALUES (NEW.item_id, v_location, v_delta)
      ON CONFLICT (item_id, location_id)
      DO UPDATE SET quantity = public.inventory_levels.quantity + EXCLUDED.quantity,
                    updated_at = now();

      -- Create a new cost layer for the received quantity
      INSERT INTO public.inventory_cost_layers (
        organization_id, item_id, location_id, source_type, source_id, received_at,
        unit_cost, quantity, remaining_quantity
      ) VALUES (
        v_org, NEW.item_id, v_location, 'purchase', NEW.id, now(),
        COALESCE(NEW.unit_cost, 0), v_delta, v_delta
      );
    ELSE
      -- Reversing received quantity: reduce layers from most recent for this purchase item first
      v_taken := -v_delta; -- amount to remove from layers
      FOR v_layer IN (
        SELECT * FROM public.inventory_cost_layers
        WHERE source_type = 'purchase' AND source_id = NEW.id AND remaining_quantity > 0
        ORDER BY received_at DESC, created_at DESC
        FOR UPDATE
      ) LOOP
        EXIT WHEN v_taken <= 0;
        IF v_layer.remaining_quantity <= 0 THEN CONTINUE; END IF;
        v_cost := LEAST(v_layer.remaining_quantity, v_taken);
        UPDATE public.inventory_cost_layers
        SET remaining_quantity = remaining_quantity - v_cost,
            updated_at = now()
        WHERE id = v_layer.id;
        v_taken := v_taken - v_cost;
      END LOOP;

      UPDATE public.inventory_levels
      SET quantity = GREATEST(0, COALESCE(quantity, 0) + v_delta),
          updated_at = now()
      WHERE item_id = NEW.item_id AND location_id = v_location;
    END IF;
  END IF;

  -- Recompute purchase status
  SELECT COUNT(*) INTO v_total FROM public.purchase_items WHERE purchase_id = NEW.purchase_id;
  SELECT COUNT(*) INTO v_fully FROM public.purchase_items WHERE purchase_id = NEW.purchase_id AND COALESCE(received_quantity, 0) >= COALESCE(quantity, 0);
  SELECT COUNT(*) INTO v_any FROM public.purchase_items WHERE purchase_id = NEW.purchase_id AND COALESCE(received_quantity, 0) > 0;

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

-- 5) Replace receipt item posting to use FIFO consumption and re-post ledger on changes
CREATE OR REPLACE FUNCTION public.post_receipt_item_product_to_ledger()
RETURNS TRIGGER AS $$
DECLARE
  inventory_account UUID;
  cogs_account UUID;
  amt NUMERIC;
  rcpt RECORD;
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Reverse ledger and consumption on delete
    DELETE FROM public.account_transactions
    WHERE reference_type = 'receipt_item' AND reference_id = OLD.id;

    -- Reverse any consumption
    PERFORM public.consume_inventory_for_receipt_item(OLD.id); -- this will add back then re-consume 0, effectively clearing
    DELETE FROM public.inventory_consumptions WHERE receipt_item_id = OLD.id;

    RETURN OLD;
  END IF;

  IF NEW.product_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT r.* INTO rcpt FROM public.receipts r WHERE r.id = NEW.receipt_id;

  SELECT id INTO inventory_account FROM public.accounts 
  WHERE account_code = '1200' AND organization_id = rcpt.organization_id LIMIT 1;

  SELECT id INTO cogs_account FROM public.accounts 
  WHERE account_code = '5001' AND organization_id = rcpt.organization_id LIMIT 1;

  -- Rebuild consumption and compute cost
  amt := public.consume_inventory_for_receipt_item(NEW.id);

  -- Repost ledger: delete prior entries for this receipt_item
  DELETE FROM public.account_transactions
  WHERE reference_type = 'receipt_item' AND reference_id = NEW.id;

  IF amt > 0 AND inventory_account IS NOT NULL AND cogs_account IS NOT NULL THEN
    INSERT INTO public.account_transactions (account_id, transaction_date, description, debit_amount, credit_amount, reference_type, reference_id, location_id)
    VALUES (cogs_account, COALESCE(rcpt.created_at::date, CURRENT_DATE), 'COGS for product on receipt ' || COALESCE(rcpt.receipt_number, ''), amt, 0, 'receipt_item', NEW.id, rcpt.location_id);

    INSERT INTO public.account_transactions (account_id, transaction_date, description, debit_amount, credit_amount, reference_type, reference_id, location_id)
    VALUES (inventory_account, COALESCE(rcpt.created_at::date, CURRENT_DATE), 'Inventory out for receipt ' || COALESCE(rcpt.receipt_number, ''), 0, amt, 'receipt_item', NEW.id, rcpt.location_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure triggers exist for insert, update, and delete
DROP TRIGGER IF EXISTS trg_post_receipt_item_product_to_ledger ON public.receipt_items;
CREATE TRIGGER trg_post_receipt_item_product_to_ledger
AFTER INSERT OR UPDATE OF quantity, product_id, receipt_id, location_id ON public.receipt_items
FOR EACH ROW
EXECUTE FUNCTION public.post_receipt_item_product_to_ledger();

DROP TRIGGER IF EXISTS trg_post_receipt_item_product_to_ledger_del ON public.receipt_items;
CREATE TRIGGER trg_post_receipt_item_product_to_ledger_del
AFTER DELETE ON public.receipt_items
FOR EACH ROW
EXECUTE FUNCTION public.post_receipt_item_product_to_ledger();

-- 6) Backfill: create cost layers from existing received purchase items
DO $$
DECLARE
  rec RECORD;
  v_org UUID;
  v_loc UUID;
BEGIN
  FOR rec IN (
    SELECT pi.*, p.organization_id, p.location_id, COALESCE(pi.received_quantity, 0) AS received_qty
    FROM public.purchase_items pi
    JOIN public.purchases p ON p.id = pi.purchase_id
    WHERE COALESCE(pi.received_quantity, 0) > 0
  ) LOOP
    INSERT INTO public.inventory_cost_layers (
      organization_id, item_id, location_id, source_type, source_id, received_at,
      unit_cost, quantity, remaining_quantity
    )
    SELECT rec.organization_id, rec.item_id, rec.location_id, 'purchase', rec.id, now(),
           COALESCE(rec.unit_cost, 0), rec.received_qty, rec.received_qty
    WHERE NOT EXISTS (
      SELECT 1 FROM public.inventory_cost_layers WHERE source_type = 'purchase' AND source_id = rec.id
    );
  END LOOP;
END $$;

-- 7) Backfill: opening layers for items with inventory but no layers
DO $$
DECLARE
  il RECORD;
  v_cost NUMERIC;
  v_org UUID;
BEGIN
  FOR il IN (
    SELECT il.item_id, il.location_id, il.quantity
    FROM public.inventory_levels il
    WHERE COALESCE(il.quantity, 0) > 0
  ) LOOP
    -- Skip if any layer exists for this item/location
    IF EXISTS (
      SELECT 1 FROM public.inventory_cost_layers l WHERE l.item_id = il.item_id AND l.location_id = il.location_id
    ) THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(cost_price, 0) INTO v_cost FROM public.inventory_items WHERE id = il.item_id;
    -- organization_id best-effort: derive from any purchase at this location, else NULL
    v_org := NULL;
    INSERT INTO public.inventory_cost_layers (
      organization_id, item_id, location_id, source_type, source_id, received_at,
      unit_cost, quantity, remaining_quantity
    ) VALUES (
      v_org, il.item_id, il.location_id, 'opening', NULL, now(),
      v_cost, il.quantity, il.quantity
    );
  END LOOP;
END $$;

-- 8) Refresh PostgREST schema cache
DO $$ BEGIN PERFORM pg_notify('pgrst', 'reload schema'); END $$;

COMMIT;