-- Warehouses and per-warehouse inventory support (idempotent)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Create warehouses table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='warehouses'
  ) THEN
    CREATE TABLE public.warehouses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      location_id UUID NOT NULL REFERENCES public.business_locations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      is_default BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_warehouses_org ON public.warehouses(organization_id);
    CREATE INDEX IF NOT EXISTS idx_warehouses_location ON public.warehouses(location_id);
    CREATE INDEX IF NOT EXISTS idx_warehouses_active ON public.warehouses(is_active);
  END IF;
END $$;

-- 2) Add warehouse_id to inventory_levels
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='inventory_levels' AND column_name='warehouse_id'
  ) THEN
    ALTER TABLE public.inventory_levels ADD COLUMN warehouse_id UUID NULL;
  END IF;

  -- FK for warehouse_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='inventory_levels' AND column_name='warehouse_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='inventory_levels_warehouse_id_fkey'
  ) THEN
    ALTER TABLE public.inventory_levels
      ADD CONSTRAINT inventory_levels_warehouse_id_fkey
      FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE CASCADE;
  END IF;

  -- Unique index by (item_id, warehouse_id) for rows with a warehouse
  CREATE UNIQUE INDEX IF NOT EXISTS inventory_levels_item_warehouse_unique
    ON public.inventory_levels(item_id, warehouse_id)
    WHERE warehouse_id IS NOT NULL;

  -- Support lookups
  CREATE INDEX IF NOT EXISTS idx_inventory_levels_warehouse_id ON public.inventory_levels(warehouse_id);
END $$;

-- 3) Add warehouse_id to inventory_adjustments and migrate usage from locations when available
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='inventory_adjustments' AND column_name='warehouse_id'
  ) THEN
    ALTER TABLE public.inventory_adjustments ADD COLUMN warehouse_id UUID NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='inventory_adjustments' AND column_name='warehouse_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='inventory_adjustments_warehouse_id_fkey'
  ) THEN
    ALTER TABLE public.inventory_adjustments
      ADD CONSTRAINT inventory_adjustments_warehouse_id_fkey
      FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE SET NULL;
  END IF;

  CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_warehouse_id ON public.inventory_adjustments(warehouse_id);
END $$;

-- 4) Seed a default warehouse per active location if none exists
DO $$
DECLARE
  rec RECORD;
  v_exists BOOLEAN;
BEGIN
  FOR rec IN 
    SELECT bl.id AS location_id, bl.organization_id
    FROM public.business_locations bl
    WHERE COALESCE(bl.is_active, true) = true
  LOOP
    SELECT EXISTS(
      SELECT 1 FROM public.warehouses w WHERE w.location_id = rec.location_id
    ) INTO v_exists;

    IF NOT v_exists THEN
      INSERT INTO public.warehouses (organization_id, location_id, name, is_active, is_default)
      VALUES (rec.organization_id, rec.location_id, 'Main Warehouse', true, true);
    END IF;
  END LOOP;
END $$;

-- 5) Best-effort backfill inventory_adjustments.warehouse_id from location defaults
DO $$
BEGIN
  UPDATE public.inventory_adjustments ia
  SET warehouse_id = (
    SELECT w.id FROM public.warehouses w
    WHERE w.location_id = ia.location_id
    ORDER BY w.is_default DESC, w.created_at
    LIMIT 1
  )
  WHERE ia.warehouse_id IS NULL AND ia.location_id IS NOT NULL;
END $$;

-- 6) Notify PostgREST to reload schema
DO $$ BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END $$;