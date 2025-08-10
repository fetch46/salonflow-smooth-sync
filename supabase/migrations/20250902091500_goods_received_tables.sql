-- Goods Received tables
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='goods_received'
  ) THEN
    CREATE TABLE public.goods_received (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
      location_id UUID NOT NULL REFERENCES public.business_locations(id),
      grn_number TEXT NULL,
      received_date DATE NOT NULL DEFAULT CURRENT_DATE,
      notes TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_by UUID NULL
    );
    CREATE INDEX IF NOT EXISTS idx_goods_received_org ON public.goods_received(organization_id);
    CREATE INDEX IF NOT EXISTS idx_goods_received_purchase ON public.goods_received(purchase_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='goods_received_items'
  ) THEN
    CREATE TABLE public.goods_received_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      goods_received_id UUID NOT NULL REFERENCES public.goods_received(id) ON DELETE CASCADE,
      purchase_item_id UUID NOT NULL REFERENCES public.purchase_items(id) ON DELETE CASCADE,
      item_id UUID NOT NULL REFERENCES public.inventory_items(id),
      quantity NUMERIC(12,4) NOT NULL CHECK (quantity >= 0),
      unit_cost NUMERIC(12,4) NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_gr_items_header ON public.goods_received_items(goods_received_id);
    CREATE INDEX IF NOT EXISTS idx_gr_items_purchase_item ON public.goods_received_items(purchase_item_id);
  END IF;
END $$;

-- Optional: simple number generator for GRN
CREATE OR REPLACE FUNCTION public.generate_grn_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'GRN-' || to_char(now(), 'YYYYMMDD') || '-' || lpad((floor(random()*100000))::text, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- Ensure select permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goods_received TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goods_received_items TO authenticated;