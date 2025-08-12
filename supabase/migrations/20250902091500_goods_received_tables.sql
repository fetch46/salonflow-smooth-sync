-- Goods Received tables used by the inventory receiving workflow
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Header table
CREATE TABLE IF NOT EXISTS public.goods_received (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NULL,
  purchase_id uuid NULL,
  received_date date NOT NULL DEFAULT CURRENT_DATE,
  warehouse_id uuid NULL,
  location_id uuid NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Items table
CREATE TABLE IF NOT EXISTS public.goods_received_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goods_received_id uuid NOT NULL,
  purchase_item_id uuid NULL,
  quantity numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add core FKs and conditional FKs to avoid failures in lean environments
DO $$ BEGIN
  -- goods_received.organization_id -> organizations
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organizations'
  ) THEN
    ALTER TABLE public.goods_received
    DROP CONSTRAINT IF EXISTS goods_received_organization_id_fkey;
    ALTER TABLE public.goods_received
    ADD CONSTRAINT goods_received_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;

  -- goods_received.warehouse_id -> warehouses
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'warehouses'
  ) THEN
    ALTER TABLE public.goods_received
    DROP CONSTRAINT IF EXISTS goods_received_warehouse_id_fkey;
    ALTER TABLE public.goods_received
    ADD CONSTRAINT goods_received_warehouse_id_fkey
      FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE SET NULL;
  END IF;

  -- goods_received.location_id -> business_locations
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'business_locations'
  ) THEN
    ALTER TABLE public.goods_received
    DROP CONSTRAINT IF EXISTS goods_received_location_id_fkey;
    ALTER TABLE public.goods_received
    ADD CONSTRAINT goods_received_location_id_fkey
      FOREIGN KEY (location_id) REFERENCES public.business_locations(id) ON DELETE SET NULL;
  END IF;

  -- goods_received.purchase_id -> purchases (if exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'purchases'
  ) THEN
    ALTER TABLE public.goods_received
    DROP CONSTRAINT IF EXISTS goods_received_purchase_id_fkey;
    ALTER TABLE public.goods_received
    ADD CONSTRAINT goods_received_purchase_id_fkey
      FOREIGN KEY (purchase_id) REFERENCES public.purchases(id) ON DELETE SET NULL;
  END IF;

  -- goods_received_items.goods_received_id -> goods_received
  ALTER TABLE public.goods_received_items
  DROP CONSTRAINT IF EXISTS goods_received_items_goods_received_id_fkey;
  ALTER TABLE public.goods_received_items
  ADD CONSTRAINT goods_received_items_goods_received_id_fkey
    FOREIGN KEY (goods_received_id) REFERENCES public.goods_received(id) ON DELETE CASCADE;

  -- goods_received_items.purchase_item_id -> purchase_items (if exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'purchase_items'
  ) THEN
    ALTER TABLE public.goods_received_items
    DROP CONSTRAINT IF EXISTS goods_received_items_purchase_item_id_fkey;
    ALTER TABLE public.goods_received_items
    ADD CONSTRAINT goods_received_items_purchase_item_id_fkey
      FOREIGN KEY (purchase_item_id) REFERENCES public.purchase_items(id) ON DELETE SET NULL;
  END IF;
END $$;

-- updated_at trigger helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_goods_received_updated_at') THEN
    CREATE TRIGGER trg_goods_received_updated_at
    BEFORE UPDATE ON public.goods_received
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_goods_received_items_updated_at') THEN
    CREATE TRIGGER trg_goods_received_items_updated_at
    BEFORE UPDATE ON public.goods_received_items
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_goods_received_org ON public.goods_received(organization_id);
CREATE INDEX IF NOT EXISTS idx_goods_received_purchase ON public.goods_received(purchase_id);
CREATE INDEX IF NOT EXISTS idx_goods_received_location ON public.goods_received(location_id);
CREATE INDEX IF NOT EXISTS idx_goods_received_warehouse ON public.goods_received(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_goods_received_date ON public.goods_received(received_date);
CREATE INDEX IF NOT EXISTS idx_goods_received_items_header ON public.goods_received_items(goods_received_id);
CREATE INDEX IF NOT EXISTS idx_goods_received_items_purchase_item ON public.goods_received_items(purchase_item_id);

-- RLS permissive for dev
ALTER TABLE public.goods_received ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_received_items ENABLE ROW LEVEL SECURITY;

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