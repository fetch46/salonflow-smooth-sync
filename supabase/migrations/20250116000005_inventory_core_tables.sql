-- Core inventory tables: inventory_items and inventory_levels
-- Safe, idempotent creation with permissive RLS for development

-- Ensure pgcrypto for gen_random_uuid
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Common updated_at trigger function (idempotent)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

-- inventory_items
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NULL,
  name text NOT NULL,
  description text NULL,
  sku text NULL UNIQUE,
  unit text NULL,
  reorder_point integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  cost_price numeric NULL,
  selling_price numeric NULL,
  type text NOT NULL DEFAULT 'good', -- 'good' or 'service'
  category text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add FK to organizations if table exists
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'organizations'
  ) THEN
    ALTER TABLE public.inventory_items
    DROP CONSTRAINT IF EXISTS inventory_items_organization_id_fkey;
    ALTER TABLE public.inventory_items
    ADD CONSTRAINT inventory_items_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- updated_at trigger
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_inventory_items_updated_at') THEN
    CREATE TRIGGER trg_inventory_items_updated_at
    BEFORE UPDATE ON public.inventory_items
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_inventory_items_active ON public.inventory_items(is_active);
CREATE INDEX IF NOT EXISTS idx_inventory_items_name ON public.inventory_items(name);
CREATE INDEX IF NOT EXISTS idx_inventory_items_org ON public.inventory_items(organization_id);

-- Enable RLS and permissive policy for dev
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'inventory_items' AND policyname = 'Allow all (inventory_items)'
  ) THEN
    CREATE POLICY "Allow all (inventory_items)" ON public.inventory_items
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- inventory_levels (supports either location_id or warehouse_id, or both)
CREATE TABLE IF NOT EXISTS public.inventory_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL,
  location_id uuid NULL,
  warehouse_id uuid NULL,
  quantity numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Foreign keys (conditional to avoid failures if refs are missing)
DO $$ BEGIN
  -- item_id -> inventory_items
  ALTER TABLE public.inventory_levels
  DROP CONSTRAINT IF EXISTS inventory_levels_item_id_fkey;
  ALTER TABLE public.inventory_levels
  ADD CONSTRAINT inventory_levels_item_id_fkey FOREIGN KEY (item_id)
    REFERENCES public.inventory_items(id) ON DELETE CASCADE;

  -- location_id -> business_locations (if exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'business_locations'
  ) THEN
    ALTER TABLE public.inventory_levels
    DROP CONSTRAINT IF EXISTS inventory_levels_location_id_fkey;
    ALTER TABLE public.inventory_levels
    ADD CONSTRAINT inventory_levels_location_id_fkey FOREIGN KEY (location_id)
      REFERENCES public.business_locations(id) ON DELETE CASCADE;
  END IF;

  -- warehouse_id -> warehouses (if exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'warehouses'
  ) THEN
    ALTER TABLE public.inventory_levels
    DROP CONSTRAINT IF EXISTS inventory_levels_warehouse_id_fkey;
    ALTER TABLE public.inventory_levels
    ADD CONSTRAINT inventory_levels_warehouse_id_fkey FOREIGN KEY (warehouse_id)
      REFERENCES public.warehouses(id) ON DELETE CASCADE;
  END IF;
END $$;

-- updated_at trigger
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_inventory_levels_updated_at') THEN
    CREATE TRIGGER trg_inventory_levels_updated_at
    BEFORE UPDATE ON public.inventory_levels
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- Unique constraints (allowing NULL with partial indexes)
CREATE UNIQUE INDEX IF NOT EXISTS ux_inventory_levels_item_location
  ON public.inventory_levels(item_id, location_id) WHERE location_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_inventory_levels_item_warehouse
  ON public.inventory_levels(item_id, warehouse_id) WHERE warehouse_id IS NOT NULL;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_inventory_levels_item ON public.inventory_levels(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_levels_location ON public.inventory_levels(location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_levels_warehouse ON public.inventory_levels(warehouse_id);

-- Enable RLS and permissive policy for dev
ALTER TABLE public.inventory_levels ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'inventory_levels' AND policyname = 'Allow all (inventory_levels)'
  ) THEN
    CREATE POLICY "Allow all (inventory_levels)" ON public.inventory_levels
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;