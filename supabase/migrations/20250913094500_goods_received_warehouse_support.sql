-- Add warehouse_id to goods_received and integrate warehouses into receiving logic
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='goods_received' AND column_name='warehouse_id'
  ) THEN
    ALTER TABLE public.goods_received
      ADD COLUMN warehouse_id UUID NULL;
    ALTER TABLE public.goods_received
      ADD CONSTRAINT goods_received_warehouse_id_fkey
      FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_goods_received_warehouse ON public.goods_received(warehouse_id);
  END IF;
END $$;

-- Best-effort backfill goods_received.warehouse_id from default warehouse at the same location
UPDATE public.goods_received gr
SET warehouse_id = (
  SELECT w.id FROM public.warehouses w
  WHERE w.location_id = gr.location_id AND w.is_active = true
  ORDER BY w.is_default DESC, w.name ASC
  LIMIT 1
)
WHERE gr.warehouse_id IS NULL;

-- Update RPC: record_goods_received to accept p_warehouse_id and set session for trigger
CREATE OR REPLACE FUNCTION public.record_goods_received(
  p_org_id UUID,
  p_purchase_id UUID,
  p_location_id UUID,
  p_warehouse_id UUID,
  p_received_date DATE,
  p_notes TEXT,
  p_lines JSONB
) RETURNS UUID AS $$
DECLARE
  v_header_id UUID;
  v_item RECORD;
  v_pi RECORD;
  v_new_received NUMERIC;
BEGIN
  -- Validate organization membership via purchase
  PERFORM 1 FROM public.purchases p
  WHERE p.id = p_purchase_id AND p.organization_id = p_org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase not found for organization';
  END IF;

  -- Validate location belongs to the organization
  PERFORM 1 FROM public.business_locations bl WHERE bl.id = p_location_id AND bl.organization_id = p_org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Location does not belong to organization';
  END IF;

  -- Validate warehouse belongs to the organization
  PERFORM 1 FROM public.warehouses w WHERE w.id = p_warehouse_id AND w.organization_id = p_org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Warehouse does not belong to organization';
  END IF;

  -- Insert header (persist both location and warehouse)
  INSERT INTO public.goods_received (organization_id, purchase_id, location_id, warehouse_id, received_date, notes, grn_number)
  VALUES (p_org_id, p_purchase_id, p_location_id, p_warehouse_id, p_received_date, p_notes, public.generate_grn_number())
  RETURNING id INTO v_header_id;

  -- Ensure purchase carries the receiving location
  UPDATE public.purchases SET location_id = p_location_id WHERE id = p_purchase_id AND (location_id IS DISTINCT FROM p_location_id OR location_id IS NULL);

  -- Tell triggers which warehouse to use for inventory updates during this transaction
  PERFORM set_config('app.receiving_warehouse_id', p_warehouse_id::text, true);

  -- Iterate lines: [{ purchase_item_id, quantity }]
  FOR v_item IN SELECT (l->>'purchase_item_id')::uuid AS purchase_item_id, COALESCE((l->>'quantity')::numeric, 0) AS quantity
                FROM jsonb_array_elements(COALESCE(p_lines, '[]'::jsonb)) AS l
  LOOP
    IF v_item.quantity <= 0 THEN CONTINUE; END IF;

    -- Fetch purchase item
    SELECT pi.id, pi.purchase_id, pi.item_id, pi.quantity, COALESCE(pi.received_quantity, 0) AS received_quantity, pi.unit_cost
    INTO v_pi
    FROM public.purchase_items pi
    WHERE pi.id = v_item.purchase_item_id AND pi.purchase_id = p_purchase_id
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Purchase item % not found for this purchase', v_item.purchase_item_id;
    END IF;

    -- Insert receipt item
    INSERT INTO public.goods_received_items (goods_received_id, purchase_item_id, item_id, quantity, unit_cost)
    VALUES (v_header_id, v_pi.id, v_pi.item_id, GREATEST(0, v_item.quantity), v_pi.unit_cost);

    -- Update received quantity (bounded by ordered) -> trigger will handle inventory and status
    v_new_received := LEAST(v_pi.quantity, v_pi.received_quantity + v_item.quantity);
    UPDATE public.purchase_items SET received_quantity = v_new_received WHERE id = v_pi.id;
  END LOOP;

  RETURN v_header_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.record_goods_received(UUID, UUID, UUID, UUID, DATE, TEXT, JSONB) TO authenticated;

-- Update RPC: update_goods_received to accept p_warehouse_id and set session for trigger
CREATE OR REPLACE FUNCTION public.update_goods_received(
  p_org_id UUID,
  p_goods_received_id UUID,
  p_location_id UUID,
  p_warehouse_id UUID,
  p_received_date DATE,
  p_notes TEXT,
  p_quantities JSONB -- object map: { purchase_item_id: qty }
) RETURNS VOID AS $$
DECLARE
  v_header RECORD;
  v_existing RECORD;
  v_pi RECORD;
  v_old_qty NUMERIC;
  v_new_qty NUMERIC;
  v_delta NUMERIC;
BEGIN
  -- Load header and validate org
  SELECT gr.*, p.organization_id AS purchase_org
  INTO v_header
  FROM public.goods_received gr
  JOIN public.purchases p ON p.id = gr.purchase_id
  WHERE gr.id = p_goods_received_id;

  IF v_header.id IS NULL OR v_header.purchase_org <> p_org_id THEN
    RAISE EXCEPTION 'Goods received not found or not in organization';
  END IF;

  -- Validate warehouse belongs to the organization
  PERFORM 1 FROM public.warehouses w WHERE w.id = p_warehouse_id AND w.organization_id = p_org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Warehouse does not belong to organization';
  END IF;

  -- Update header and purchase location/warehouse
  UPDATE public.goods_received SET location_id = p_location_id, warehouse_id = p_warehouse_id, received_date = p_received_date, notes = p_notes WHERE id = p_goods_received_id;
  UPDATE public.purchases SET location_id = p_location_id WHERE id = v_header.purchase_id AND (location_id IS DISTINCT FROM p_location_id OR location_id IS NULL);

  -- Tell triggers which warehouse to use for inventory updates during this transaction
  PERFORM set_config('app.receiving_warehouse_id', p_warehouse_id::text, true);

  -- Walk through all purchase items of the purchase and apply deltas
  FOR v_pi IN SELECT pi.id, pi.quantity, COALESCE(pi.received_quantity, 0) AS received_quantity, pi.item_id, pi.unit_cost
              FROM public.purchase_items pi
              WHERE pi.purchase_id = v_header.purchase_id
  LOOP
    -- Find existing receipt quantity for this header
    SELECT COALESCE(SUM(gri.quantity), 0) AS qty
    INTO v_existing
    FROM public.goods_received_items gri
    WHERE gri.goods_received_id = p_goods_received_id AND gri.purchase_item_id = v_pi.id;

    v_old_qty := COALESCE(v_existing.qty, 0);
    v_new_qty := COALESCE((p_quantities ->> v_pi.id)::numeric, 0);
    v_delta := v_new_qty - v_old_qty;

    IF v_delta <> 0 THEN
      -- Adjust goods_received_items rows: replace to desired state
      DELETE FROM public.goods_received_items WHERE goods_received_id = p_goods_received_id AND purchase_item_id = v_pi.id;
      IF v_new_qty > 0 THEN
        INSERT INTO public.goods_received_items (goods_received_id, purchase_item_id, item_id, quantity, unit_cost)
        VALUES (p_goods_received_id, v_pi.id, v_pi.item_id, v_new_qty, v_pi.unit_cost);
      END IF;

      -- Update purchase_items.received_quantity bounded by ordered -> trigger handles inventory and status
      UPDATE public.purchase_items
      SET received_quantity = GREATEST(0, LEAST(v_pi.quantity, v_pi.received_quantity + v_delta))
      WHERE id = v_pi.id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.update_goods_received(UUID, UUID, UUID, UUID, DATE, TEXT, JSONB) TO authenticated;

-- Replace trigger function to support warehouse-aware updates via session variable
CREATE OR REPLACE FUNCTION public.apply_purchase_receipt()
RETURNS TRIGGER AS $$
DECLARE
  v_delta NUMERIC;
  v_location_id UUID;
  v_warehouse_id UUID;
  v_total_qty NUMERIC;
  v_total_received NUMERIC;
  v_status TEXT;
BEGIN
  v_delta := COALESCE(NEW.received_quantity, 0) - COALESCE(OLD.received_quantity, 0);

  -- Prefer session-provided warehouse id if present (set by goods_received RPCs)
  BEGIN
    v_warehouse_id := NULLIF(current_setting('app.receiving_warehouse_id', true), '')::uuid;
  EXCEPTION WHEN others THEN
    v_warehouse_id := NULL;
  END;

  IF v_delta <> 0 THEN
    IF v_warehouse_id IS NOT NULL THEN
      -- Upsert inventory level for the item at the provided warehouse
      INSERT INTO public.inventory_levels (item_id, warehouse_id, quantity)
      VALUES (NEW.item_id, v_warehouse_id, GREATEST(0, v_delta))
      ON CONFLICT (item_id, warehouse_id)
      DO UPDATE SET quantity = GREATEST(0, COALESCE(public.inventory_levels.quantity, 0) + EXCLUDED.quantity);

      -- If delta negative, adjust directly
      IF v_delta < 0 THEN
        UPDATE public.inventory_levels
        SET quantity = GREATEST(0, COALESCE(quantity, 0) + v_delta)
        WHERE item_id = NEW.item_id AND warehouse_id = v_warehouse_id;
      END IF;
    ELSE
      -- Fallback to location-based updates (legacy)
      SELECT p.location_id INTO v_location_id
      FROM public.purchases p
      WHERE p.id = NEW.purchase_id;

      IF v_location_id IS NOT NULL THEN
        INSERT INTO public.inventory_levels (item_id, location_id, quantity)
        VALUES (NEW.item_id, v_location_id, GREATEST(0, v_delta))
        ON CONFLICT (item_id, location_id)
        DO UPDATE SET quantity = GREATEST(0, COALESCE(public.inventory_levels.quantity, 0) + EXCLUDED.quantity);

        IF v_delta < 0 THEN
          UPDATE public.inventory_levels
          SET quantity = GREATEST(0, COALESCE(quantity, 0) + v_delta)
          WHERE item_id = NEW.item_id AND location_id = v_location_id;
        END IF;
      END IF;
    END IF;
  END IF;

  -- Update purchase status based on totals
  SELECT COALESCE(SUM(quantity), 0), COALESCE(SUM(received_quantity), 0)
  INTO v_total_qty, v_total_received
  FROM public.purchase_items
  WHERE purchase_id = NEW.purchase_id;

  IF v_total_received <= 0 THEN
    v_status := 'pending';
  ELSIF v_total_received < v_total_qty THEN
    v_status := 'partial';
  ELSE
    v_status := 'received';
  END IF;

  UPDATE public.purchases
  SET status = v_status
  WHERE id = NEW.purchase_id AND COALESCE(status, '') IS DISTINCT FROM v_status;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;