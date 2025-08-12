-- Consolidated SQL to fix Product creation: ensures core inventory tables and links exist
-- Safe to run multiple times (idempotent)

-- Required extension for UUIDs
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Common updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

-- business_locations (minimal)
CREATE TABLE IF NOT EXISTS public.business_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_schema = 'public' AND table_name = 'business_locations' AND constraint_name = 'business_locations_organization_id_fkey'
  ) THEN
    ALTER TABLE public.business_locations
      ADD CONSTRAINT business_locations_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_business_locations_updated_at') THEN
    CREATE TRIGGER trg_business_locations_updated_at
    BEFORE UPDATE ON public.business_locations
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_business_locations_org ON public.business_locations(organization_id);
CREATE INDEX IF NOT EXISTS idx_business_locations_active ON public.business_locations(is_active);
CREATE INDEX IF NOT EXISTS idx_business_locations_default ON public.business_locations(is_default);
CREATE INDEX IF NOT EXISTS idx_business_locations_name ON public.business_locations(name);

ALTER TABLE public.business_locations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'business_locations' AND policyname = 'Allow all (business_locations)'
  ) THEN
    CREATE POLICY "Allow all (business_locations)" ON public.business_locations
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- warehouses
CREATE TABLE IF NOT EXISTS public.warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.business_locations(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS warehouses_org_idx ON public.warehouses(organization_id);
CREATE INDEX IF NOT EXISTS warehouses_location_idx ON public.warehouses(location_id);
CREATE INDEX IF NOT EXISTS warehouses_active_idx ON public.warehouses(is_active);
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'warehouses' AND policyname = 'Allow all (warehouses)'
  ) THEN
    CREATE POLICY "Allow all (warehouses)" ON public.warehouses
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Add default_warehouse_id to business_locations if missing and FK
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'business_locations' AND column_name = 'default_warehouse_id'
  ) THEN
    ALTER TABLE public.business_locations ADD COLUMN default_warehouse_id uuid NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_schema = 'public' AND tc.table_name = 'business_locations'
      AND tc.constraint_type = 'FOREIGN KEY' AND tc.constraint_name = 'business_locations_default_warehouse_id_fkey'
  ) THEN
    ALTER TABLE public.business_locations
      ADD CONSTRAINT business_locations_default_warehouse_id_fkey
      FOREIGN KEY (default_warehouse_id) REFERENCES public.warehouses(id) ON DELETE SET NULL;
  END IF;
END $$;

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
  type text NOT NULL DEFAULT 'good',
  category text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

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

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_inventory_items_updated_at') THEN
    CREATE TRIGGER trg_inventory_items_updated_at
    BEFORE UPDATE ON public.inventory_items
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_inventory_items_active ON public.inventory_items(is_active);
CREATE INDEX IF NOT EXISTS idx_inventory_items_name ON public.inventory_items(name);
CREATE INDEX IF NOT EXISTS idx_inventory_items_org ON public.inventory_items(organization_id);
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

-- inventory_levels
CREATE TABLE IF NOT EXISTS public.inventory_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL,
  location_id uuid NULL,
  warehouse_id uuid NULL,
  quantity numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.inventory_levels
  DROP CONSTRAINT IF EXISTS inventory_levels_item_id_fkey;
  ALTER TABLE public.inventory_levels
  ADD CONSTRAINT inventory_levels_item_id_fkey FOREIGN KEY (item_id)
    REFERENCES public.inventory_items(id) ON DELETE CASCADE;

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

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_inventory_levels_updated_at') THEN
    CREATE TRIGGER trg_inventory_levels_updated_at
    BEFORE UPDATE ON public.inventory_levels
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_inventory_levels_item_location
  ON public.inventory_levels(item_id, location_id) WHERE location_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_inventory_levels_item_warehouse
  ON public.inventory_levels(item_id, warehouse_id) WHERE warehouse_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_levels_item ON public.inventory_levels(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_levels_location ON public.inventory_levels(location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_levels_warehouse ON public.inventory_levels(warehouse_id);
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

-- inventory_item_accounts mapping (critical for ProductForm)
CREATE TABLE IF NOT EXISTS public.inventory_item_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  sales_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  purchase_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  inventory_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  is_taxable BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_inventory_item_accounts_item ON public.inventory_item_accounts(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_item_accounts_sales_acc ON public.inventory_item_accounts(sales_account_id);
CREATE INDEX IF NOT EXISTS idx_inventory_item_accounts_purchase_acc ON public.inventory_item_accounts(purchase_account_id);
CREATE INDEX IF NOT EXISTS idx_inventory_item_accounts_inventory_acc ON public.inventory_item_accounts(inventory_account_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_inventory_item_accounts_updated_at') THEN
    CREATE TRIGGER trg_inventory_item_accounts_updated_at BEFORE UPDATE ON public.inventory_item_accounts
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

ALTER TABLE public.inventory_item_accounts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'inventory_item_accounts' AND policyname = 'Allow all (inventory_item_accounts)'
  ) THEN
    CREATE POLICY "Allow all (inventory_item_accounts)" ON public.inventory_item_accounts
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;