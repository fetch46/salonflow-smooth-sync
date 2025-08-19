-- Enforce inventory transfers to be between warehouses
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'inventory_transfers' AND column_name = 'from_warehouse_id'
  ) THEN
    ALTER TABLE public.inventory_transfers ADD COLUMN from_warehouse_id uuid NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'inventory_transfers' AND column_name = 'to_warehouse_id'
  ) THEN
    ALTER TABLE public.inventory_transfers ADD COLUMN to_warehouse_id uuid NULL;
  END IF;
END $$;

-- Foreign keys to warehouses if the table exists
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'warehouses'
  ) THEN
    ALTER TABLE public.inventory_transfers
      DROP CONSTRAINT IF EXISTS inventory_transfers_from_warehouse_id_fkey;
    ALTER TABLE public.inventory_transfers
      ADD CONSTRAINT inventory_transfers_from_warehouse_id_fkey
        FOREIGN KEY (from_warehouse_id) REFERENCES public.warehouses(id) ON DELETE CASCADE;

    ALTER TABLE public.inventory_transfers
      DROP CONSTRAINT IF EXISTS inventory_transfers_to_warehouse_id_fkey;
    ALTER TABLE public.inventory_transfers
      ADD CONSTRAINT inventory_transfers_to_warehouse_id_fkey
        FOREIGN KEY (to_warehouse_id) REFERENCES public.warehouses(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Make legacy location columns nullable to allow warehouse-only records
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'inventory_transfers' AND column_name = 'from_location_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.inventory_transfers ALTER COLUMN from_location_id DROP NOT NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'inventory_transfers' AND column_name = 'to_location_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.inventory_transfers ALTER COLUMN to_location_id DROP NOT NULL;
  END IF;
END $$;

-- Optional backfill from business_locations.default_warehouse_id when present
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'business_locations' AND column_name = 'default_warehouse_id'
  ) THEN
    UPDATE public.inventory_transfers t
    SET from_warehouse_id = COALESCE(t.from_warehouse_id, bl_from.default_warehouse_id)
    FROM public.business_locations bl_from
    WHERE t.from_location_id = bl_from.id AND t.from_warehouse_id IS NULL;

    UPDATE public.inventory_transfers t
    SET to_warehouse_id = COALESCE(t.to_warehouse_id, bl_to.default_warehouse_id)
    FROM public.business_locations bl_to
    WHERE t.to_location_id = bl_to.id AND t.to_warehouse_id IS NULL;
  END IF;
END $$;

-- Null out legacy location columns after backfill so that warehouses are authoritative
UPDATE public.inventory_transfers SET from_location_id = NULL WHERE from_warehouse_id IS NOT NULL;
UPDATE public.inventory_transfers SET to_location_id = NULL WHERE to_warehouse_id IS NOT NULL;

-- Add a CHECK constraint to enforce warehouse-only going forward
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'inventory_transfers' AND constraint_name = 'inventory_transfers_warehouse_only_chk'
  ) THEN
    ALTER TABLE public.inventory_transfers
      ADD CONSTRAINT inventory_transfers_warehouse_only_chk
      CHECK (
        from_warehouse_id IS NOT NULL AND to_warehouse_id IS NOT NULL
        AND from_location_id IS NULL AND to_location_id IS NULL
      ) NOT VALID;
    -- Attempt to validate; if it fails, old rows remain unvalidated but new rows must satisfy the constraint
    BEGIN
      ALTER TABLE public.inventory_transfers VALIDATE CONSTRAINT inventory_transfers_warehouse_only_chk;
    EXCEPTION WHEN others THEN
      -- Ignore validation errors for legacy data
      NULL;
    END;
  END IF;
END $$;

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_from_wh ON public.inventory_transfers(from_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_to_wh ON public.inventory_transfers(to_warehouse_id);

-- Note: We intentionally keep location columns for backward compatibility.
-- New writes should populate warehouse columns only.

