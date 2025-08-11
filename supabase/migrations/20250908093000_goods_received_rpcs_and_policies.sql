-- RPCs and RLS for Goods Received
-- Safe to run multiple times

-- 1) Enable RLS on goods_received tables (idempotent)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='goods_received'
  ) THEN
    EXECUTE 'ALTER TABLE public.goods_received ENABLE ROW LEVEL SECURITY';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='goods_received_items'
  ) THEN
    EXECUTE 'ALTER TABLE public.goods_received_items ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- 2) Policies allowing org members to manage their rows (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='goods_received' AND policyname='org_members_manage_goods_received'
  ) THEN
    CREATE POLICY org_members_manage_goods_received ON public.goods_received
      USING (organization_id IN (SELECT organization_id FROM public.organization_users WHERE user_id = auth.uid()))
      WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_users WHERE user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='goods_received_items' AND policyname='org_members_manage_goods_received_items'
  ) THEN
    CREATE POLICY org_members_manage_goods_received_items ON public.goods_received_items
      USING ((SELECT organization_id FROM public.goods_received gr WHERE gr.id = goods_received_id) IN (SELECT organization_id FROM public.organization_users WHERE user_id = auth.uid()))
      WITH CHECK ((SELECT organization_id FROM public.goods_received gr WHERE gr.id = goods_received_id) IN (SELECT organization_id FROM public.organization_users WHERE user_id = auth.uid()));
  END IF;
END $$;

-- 3) RPC to record a new goods receipt atomically
CREATE OR REPLACE FUNCTION public.record_goods_received(
  p_org_id UUID,
  p_purchase_id UUID,
  p_location_id UUID,
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

  -- Insert header
  INSERT INTO public.goods_received (organization_id, purchase_id, location_id, received_date, notes, grn_number)
  VALUES (p_org_id, p_purchase_id, p_location_id, p_received_date, p_notes, public.generate_grn_number())
  RETURNING id INTO v_header_id;

  -- Ensure purchase carries the receiving location
  UPDATE public.purchases SET location_id = p_location_id WHERE id = p_purchase_id AND (location_id IS DISTINCT FROM p_location_id OR location_id IS NULL);

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

    -- Update received quantity (bounded by ordered)
    v_new_received := LEAST(v_pi.quantity, v_pi.received_quantity + v_item.quantity);
    UPDATE public.purchase_items SET received_quantity = v_new_received WHERE id = v_pi.id;
  END LOOP;

  RETURN v_header_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.record_goods_received(UUID, UUID, UUID, DATE, TEXT, JSONB) TO authenticated;

-- 4) RPC to update an existing goods receipt atomically and apply deltas
CREATE OR REPLACE FUNCTION public.update_goods_received(
  p_org_id UUID,
  p_goods_received_id UUID,
  p_location_id UUID,
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

  -- Update header and purchase location
  UPDATE public.goods_received SET location_id = p_location_id, received_date = p_received_date, notes = p_notes WHERE id = p_goods_received_id;
  UPDATE public.purchases SET location_id = p_location_id WHERE id = v_header.purchase_id AND (location_id IS DISTINCT FROM p_location_id OR location_id IS NULL);

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
      -- Adjust goods_received_items rows: simplest approach replace to desired state
      -- Delete existing rows for this purchase_item_id
      DELETE FROM public.goods_received_items WHERE goods_received_id = p_goods_received_id AND purchase_item_id = v_pi.id;
      -- Insert new row if new_qty > 0
      IF v_new_qty > 0 THEN
        INSERT INTO public.goods_received_items (goods_received_id, purchase_item_id, item_id, quantity, unit_cost)
        VALUES (p_goods_received_id, v_pi.id, v_pi.item_id, v_new_qty, v_pi.unit_cost);
      END IF;

      -- Update purchase_items.received_quantity bounded by ordered
      UPDATE public.purchase_items
      SET received_quantity = GREATEST(0, LEAST(v_pi.quantity, v_pi.received_quantity + v_delta))
      WHERE id = v_pi.id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.update_goods_received(UUID, UUID, UUID, DATE, TEXT, JSONB) TO authenticated;