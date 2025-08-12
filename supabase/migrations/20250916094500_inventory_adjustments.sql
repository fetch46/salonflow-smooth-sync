-- Inventory adjustments and items
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.inventory_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_number text NOT NULL UNIQUE,
  adjustment_date date NOT NULL DEFAULT CURRENT_DATE,
  adjustment_type text NOT NULL DEFAULT 'Stock Count',
  reason text NOT NULL DEFAULT 'Physical count discrepancy',
  status text NOT NULL DEFAULT 'pending',
  notes text NULL,
  total_items integer NOT NULL DEFAULT 0,
  warehouse_id uuid NULL,
  location_id uuid NULL,
  created_by uuid NULL,
  approved_by uuid NULL,
  approved_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventory_adjustment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_id uuid NOT NULL,
  item_id uuid NOT NULL,
  current_quantity numeric NOT NULL DEFAULT 0,
  adjusted_quantity numeric NOT NULL DEFAULT 0,
  difference numeric NOT NULL DEFAULT 0,
  unit_cost numeric NULL,
  total_cost numeric NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Foreign keys
DO $$ BEGIN
  -- items -> inventory_items
  ALTER TABLE public.inventory_adjustment_items
  DROP CONSTRAINT IF EXISTS inventory_adjustment_items_item_id_fkey;
  ALTER TABLE public.inventory_adjustment_items
  ADD CONSTRAINT inventory_adjustment_items_item_id_fkey
    FOREIGN KEY (item_id) REFERENCES public.inventory_items(id) ON DELETE CASCADE;

  -- header items link
  ALTER TABLE public.inventory_adjustment_items
  DROP CONSTRAINT IF EXISTS inventory_adjustment_items_adjustment_id_fkey;
  ALTER TABLE public.inventory_adjustment_items
  ADD CONSTRAINT inventory_adjustment_items_adjustment_id_fkey
    FOREIGN KEY (adjustment_id) REFERENCES public.inventory_adjustments(id) ON DELETE CASCADE;

  -- header warehouse/location (if exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'warehouses'
  ) THEN
    ALTER TABLE public.inventory_adjustments
    DROP CONSTRAINT IF EXISTS inventory_adjustments_warehouse_id_fkey;
    ALTER TABLE public.inventory_adjustments
    ADD CONSTRAINT inventory_adjustments_warehouse_id_fkey
      FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE SET NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'business_locations'
  ) THEN
    ALTER TABLE public.inventory_adjustments
    DROP CONSTRAINT IF EXISTS inventory_adjustments_location_id_fkey;
    ALTER TABLE public.inventory_adjustments
    ADD CONSTRAINT inventory_adjustments_location_id_fkey
      FOREIGN KEY (location_id) REFERENCES public.business_locations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- updated_at triggers
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_inventory_adjustments_updated_at') THEN
    CREATE TRIGGER trg_inventory_adjustments_updated_at
    BEFORE UPDATE ON public.inventory_adjustments
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_inventory_adjustment_items_updated_at') THEN
    CREATE TRIGGER trg_inventory_adjustment_items_updated_at
    BEFORE UPDATE ON public.inventory_adjustment_items
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_date ON public.inventory_adjustments(adjustment_date);
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_status ON public.inventory_adjustments(status);
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_location ON public.inventory_adjustments(location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_warehouse ON public.inventory_adjustments(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_adjustment_items_adjustment ON public.inventory_adjustment_items(adjustment_id);
CREATE INDEX IF NOT EXISTS idx_inventory_adjustment_items_item ON public.inventory_adjustment_items(item_id);

-- RLS permissive for dev
ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_adjustment_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'inventory_adjustments' AND policyname = 'Allow all (inventory_adjustments)'
  ) THEN
    CREATE POLICY "Allow all (inventory_adjustments)" ON public.inventory_adjustments
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'inventory_adjustment_items' AND policyname = 'Allow all (inventory_adjustment_items)'
  ) THEN
    CREATE POLICY "Allow all (inventory_adjustment_items)" ON public.inventory_adjustment_items
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;