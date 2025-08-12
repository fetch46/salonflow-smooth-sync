-- Business locations, Warehouses, Inventory Items, and Inventory Levels
-- Idempotent migration to (re)create core inventory + warehousing structures

-- Required extension for UUIDs
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Organizations table may already exist; do not create here.

-- Business locations
CREATE TABLE IF NOT EXISTS public.business_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  name TEXT NOT NULL,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Warehouses per location
CREATE TABLE IF NOT EXISTS public.warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  location_id UUID NOT NULL REFERENCES public.business_locations(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

-- Inventory items (minimal schema for this feature set)
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT,
  unit TEXT,
  category TEXT,
  cost_price NUMERIC,
  selling_price NUMERIC,
  reorder_point INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  type TEXT NOT NULL DEFAULT 'good',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inventory_items_org ON public.inventory_items(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_inventory_items_org_sku ON public.inventory_items(organization_id, sku) WHERE sku IS NOT NULL;

-- Inventory levels support BOTH warehouse_id and location_id for compatibility
CREATE TABLE IF NOT EXISTS public.inventory_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.business_locations(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CHECK (quantity >= 0)
);

-- Uniqueness per (item, warehouse) when warehouse present
CREATE UNIQUE INDEX IF NOT EXISTS ux_inventory_levels_item_wh
  ON public.inventory_levels(item_id, warehouse_id)
  WHERE warehouse_id IS NOT NULL;
-- Uniqueness per (item, location) when location present (for backward compatibility)
CREATE UNIQUE INDEX IF NOT EXISTS ux_inventory_levels_item_loc
  ON public.inventory_levels(item_id, location_id)
  WHERE location_id IS NOT NULL;

-- Simple updated_at triggers
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_business_locations_updated_at') THEN
    CREATE TRIGGER trg_business_locations_updated_at BEFORE UPDATE ON public.business_locations
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_warehouses_updated_at') THEN
    CREATE TRIGGER trg_warehouses_updated_at BEFORE UPDATE ON public.warehouses
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_inventory_items_updated_at') THEN
    CREATE TRIGGER trg_inventory_items_updated_at BEFORE UPDATE ON public.inventory_items
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_inventory_levels_updated_at') THEN
    CREATE TRIGGER trg_inventory_levels_updated_at BEFORE UPDATE ON public.inventory_levels
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- RLS: enable and allow authenticated access (broad for dev)
ALTER TABLE public.business_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_levels ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  -- business_locations
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'business_locations' AND policyname = 'Allow all (business_locations)'
  ) THEN
    CREATE POLICY "Allow all (business_locations)" ON public.business_locations
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
  -- warehouses
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'warehouses' AND policyname = 'Allow all (warehouses)'
  ) THEN
    CREATE POLICY "Allow all (warehouses)" ON public.warehouses
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
  -- inventory_items
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'inventory_items' AND policyname = 'Allow all (inventory_items)'
  ) THEN
    CREATE POLICY "Allow all (inventory_items)" ON public.inventory_items
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
  -- inventory_levels
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'inventory_levels' AND policyname = 'Allow all (inventory_levels)'
  ) THEN
    CREATE POLICY "Allow all (inventory_levels)" ON public.inventory_levels
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;