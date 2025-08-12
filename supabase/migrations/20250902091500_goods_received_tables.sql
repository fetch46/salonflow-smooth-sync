-- Goods Received (GRN) tables
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.goods_received (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  received_date DATE NOT NULL DEFAULT CURRENT_DATE,
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  location_id UUID REFERENCES public.business_locations(id) ON DELETE SET NULL,
  grn_number TEXT UNIQUE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.goods_received_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goods_received_id UUID NOT NULL REFERENCES public.goods_received(id) ON DELETE CASCADE,
  purchase_item_id UUID NOT NULL REFERENCES public.purchase_items(id) ON DELETE RESTRICT,
  quantity NUMERIC NOT NULL CHECK (quantity >= 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_goods_received_updated_at') THEN
    CREATE TRIGGER trg_goods_received_updated_at BEFORE UPDATE ON public.goods_received FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_goods_received_items_updated_at') THEN
    CREATE TRIGGER trg_goods_received_items_updated_at BEFORE UPDATE ON public.goods_received_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

ALTER TABLE public.goods_received ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_received_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='goods_received' AND policyname='Allow all (goods_received)') THEN
    CREATE POLICY "Allow all (goods_received)" ON public.goods_received FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='goods_received_items' AND policyname='Allow all (goods_received_items)') THEN
    CREATE POLICY "Allow all (goods_received_items)" ON public.goods_received_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;