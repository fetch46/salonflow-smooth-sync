-- Goods received RPCs and additional policies (idempotent)

-- Confirm permissive policies exist (tables migration may have created them already)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'goods_received' AND policyname = 'Allow all (goods_received)'
  ) THEN
    CREATE POLICY "Allow all (goods_received)" ON public.goods_received
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'goods_received_items' AND policyname = 'Allow all (goods_received_items)'
  ) THEN
    CREATE POLICY "Allow all (goods_received_items)" ON public.goods_received_items
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- RPC: create a goods_received header with optional items
CREATE OR REPLACE FUNCTION public.create_goods_received(
  p_organization_id uuid,
  p_purchase_id uuid,
  p_location_id uuid,
  p_received_date date DEFAULT (now()::date),
  p_notes text DEFAULT NULL,
  p_items jsonb DEFAULT '[]'
) RETURNS uuid AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.goods_received(organization_id, purchase_id, location_id, received_date, notes)
  VALUES (p_organization_id, p_purchase_id, p_location_id, COALESCE(p_received_date, now()::date), p_notes)
  RETURNING id INTO v_id;

  -- Optional items payload: [{ purchase_item_id, quantity }]
  IF p_items IS NOT NULL THEN
    INSERT INTO public.goods_received_items(goods_received_id, purchase_item_id, quantity)
    SELECT v_id, (it->>'purchase_item_id')::uuid, COALESCE((it->>'quantity')::numeric, 0)
    FROM jsonb_array_elements(p_items) it
    WHERE (it->>'purchase_item_id') IS NOT NULL AND COALESCE((it->>'quantity')::numeric, 0) > 0;
  END IF;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.create_goods_received(uuid, uuid, uuid, date, text, jsonb) TO anon, authenticated;