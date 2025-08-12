-- RPCs for goods received workflow

CREATE OR REPLACE FUNCTION public.record_goods_received(
  p_org_id UUID,
  p_purchase_id UUID,
  p_location_id UUID,
  p_warehouse_id UUID,
  p_received_date DATE,
  p_notes TEXT,
  p_lines JSONB
) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_gr_id UUID;
  v_grn TEXT;
  v_line JSONB;
  v_purchase_item_id UUID;
  v_qty NUMERIC;
  v_item_id UUID;
BEGIN
  -- Create header
  v_grn := 'GRN-' || to_char(now(), 'YYYYMMDDHH24MISS');
  INSERT INTO public.goods_received (organization_id, purchase_id, received_date, warehouse_id, location_id, grn_number, notes)
  VALUES (p_org_id, p_purchase_id, p_received_date, p_warehouse_id, p_location_id, v_grn, p_notes)
  RETURNING id INTO v_gr_id;

  -- For each line: update purchase_items, inventory_levels and insert detail
  FOR v_line IN SELECT * FROM jsonb_array_elements(COALESCE(p_lines, '[]'::jsonb)) LOOP
    v_purchase_item_id := (v_line->>'purchase_item_id')::uuid;
    v_qty := COALESCE((v_line->>'quantity')::numeric, 0);
    IF v_qty <= 0 THEN CONTINUE; END IF;

    SELECT pi.item_id INTO v_item_id FROM public.purchase_items pi WHERE pi.id = v_purchase_item_id;

    -- Insert detail
    INSERT INTO public.goods_received_items (goods_received_id, purchase_item_id, quantity)
    VALUES (v_gr_id, v_purchase_item_id, v_qty);

    -- Update received quantity on purchase_items (bounded by ordered quantity)
    UPDATE public.purchase_items pi
    SET received_quantity = LEAST(pi.quantity, pi.received_quantity + v_qty)
    WHERE pi.id = v_purchase_item_id;

    -- Upsert inventory_levels by location
    PERFORM 1 FROM public.inventory_levels il WHERE il.item_id = v_item_id AND il.location_id = p_location_id;
    IF NOT FOUND THEN
      INSERT INTO public.inventory_levels (item_id, location_id, quantity)
      VALUES (v_item_id, p_location_id, v_qty);
    ELSE
      UPDATE public.inventory_levels SET quantity = quantity + v_qty WHERE item_id = v_item_id AND location_id = p_location_id;
    END IF;

    -- Upsert inventory_levels by warehouse
    PERFORM 1 FROM public.inventory_levels il WHERE il.item_id = v_item_id AND il.warehouse_id = p_warehouse_id;
    IF NOT FOUND THEN
      INSERT INTO public.inventory_levels (item_id, warehouse_id, quantity)
      VALUES (v_item_id, p_warehouse_id, v_qty);
    ELSE
      UPDATE public.inventory_levels SET quantity = quantity + v_qty WHERE item_id = v_item_id AND warehouse_id = p_warehouse_id;
    END IF;
  END LOOP;

  -- Update purchase header status
  PERFORM public.update_purchase_status(p_purchase_id);

  RETURN v_gr_id;
END;
$$;

-- Helper to update purchase status based on items received
CREATE OR REPLACE FUNCTION public.update_purchase_status(p_purchase_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_any_received BOOLEAN;
  v_all_received BOOLEAN;
BEGIN
  SELECT
    BOOL_OR(received_quantity > 0),
    BOOL_AND(received_quantity >= quantity)
  INTO v_any_received, v_all_received
  FROM public.purchase_items WHERE purchase_id = p_purchase_id;

  UPDATE public.purchases
  SET status = CASE WHEN v_all_received THEN 'completed' WHEN v_any_received THEN 'partial' ELSE 'pending' END,
      updated_at = now()
  WHERE id = p_purchase_id;
END; $$;

-- RPC for updating an existing goods_received entry by replacing its items
CREATE OR REPLACE FUNCTION public.update_goods_received(
  p_org_id UUID,
  p_goods_received_id UUID,
  p_location_id UUID,
  p_warehouse_id UUID,
  p_received_date DATE,
  p_notes TEXT,
  p_quantities JSONB
) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
  v_purchase_id UUID;
  r_old RECORD;
  v_item_id UUID;
  v_new_qty NUMERIC;
  v_pi_id UUID;
BEGIN
  -- Identify purchase header
  SELECT gr.purchase_id INTO v_purchase_id FROM public.goods_received gr WHERE gr.id = p_goods_received_id;

  -- Subtract existing quantities from inventory_levels (both location and warehouse)
  FOR r_old IN
    SELECT gri.*, pi.item_id
    FROM public.goods_received_items gri
    JOIN public.purchase_items pi ON pi.id = gri.purchase_item_id
    WHERE gri.goods_received_id = p_goods_received_id
  LOOP
    -- location
    UPDATE public.inventory_levels SET quantity = GREATEST(0, quantity - r_old.quantity)
    WHERE item_id = r_old.item_id AND location_id = p_location_id;
    -- warehouse
    UPDATE public.inventory_levels SET quantity = GREATEST(0, quantity - r_old.quantity)
    WHERE item_id = r_old.item_id AND warehouse_id = p_warehouse_id;
  END LOOP;

  -- Replace header values
  UPDATE public.goods_received
  SET received_date = p_received_date,
      warehouse_id = p_warehouse_id,
      location_id = p_location_id,
      notes = p_notes,
      updated_at = now()
  WHERE id = p_goods_received_id;

  -- Delete and recreate items
  DELETE FROM public.goods_received_items WHERE goods_received_id = p_goods_received_id;

  -- Insert new items and apply inventory deltas
  FOR v_pi_id, v_new_qty IN
    SELECT (key)::uuid AS purchase_item_id, (value)::numeric AS quantity
    FROM jsonb_each_text(COALESCE(p_quantities, '{}'::jsonb))
  LOOP
    IF v_new_qty IS NULL OR v_new_qty <= 0 THEN CONTINUE; END IF;
    SELECT pi.item_id INTO v_item_id FROM public.purchase_items pi WHERE pi.id = v_pi_id;

    INSERT INTO public.goods_received_items (goods_received_id, purchase_item_id, quantity)
    VALUES (p_goods_received_id, v_pi_id, v_new_qty);

    -- location
    PERFORM 1 FROM public.inventory_levels WHERE item_id = v_item_id AND location_id = p_location_id;
    IF NOT FOUND THEN
      INSERT INTO public.inventory_levels (item_id, location_id, quantity)
      VALUES (v_item_id, p_location_id, v_new_qty);
    ELSE
      UPDATE public.inventory_levels SET quantity = quantity + v_new_qty
      WHERE item_id = v_item_id AND location_id = p_location_id;
    END IF;

    -- warehouse
    PERFORM 1 FROM public.inventory_levels WHERE item_id = v_item_id AND warehouse_id = p_warehouse_id;
    IF NOT FOUND THEN
      INSERT INTO public.inventory_levels (item_id, warehouse_id, quantity)
      VALUES (v_item_id, p_warehouse_id, v_new_qty);
    ELSE
      UPDATE public.inventory_levels SET quantity = quantity + v_new_qty
      WHERE item_id = v_item_id AND warehouse_id = p_warehouse_id;
    END IF;
  END LOOP;

  -- Recompute received_quantity per purchase_item across all receipts
  UPDATE public.purchase_items pi SET received_quantity = sub.total_received
  FROM (
    SELECT gri.purchase_item_id, SUM(gri.quantity) AS total_received
    FROM public.goods_received_items gri
    JOIN public.goods_received gr ON gr.id = gri.goods_received_id
    WHERE gr.purchase_id = v_purchase_id
    GROUP BY gri.purchase_item_id
  ) sub
  WHERE pi.id = sub.purchase_item_id;

  -- Update purchase status
  PERFORM public.update_purchase_status(v_purchase_id);
END; $$;