BEGIN;

-- 0) Ensure business_locations exists (idempotent safety)
CREATE TABLE IF NOT EXISTS public.business_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  address TEXT,
  phone TEXT,
  manager_id UUID REFERENCES public.staff(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Guarded migration from legacy storage_locations to business_locations
DO $$
DECLARE
  v_exists boolean;
  r RECORD;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'storage_locations'
  ) INTO v_exists;

  IF NOT v_exists THEN
    -- Nothing to migrate
    RETURN;
  END IF;

  -- 1) Build mapping from old storage_locations per organization to new business_locations
  EXECUTE '
    CREATE TEMP TABLE tmp_location_map (
      old_location_id UUID NOT NULL,
      organization_id UUID NOT NULL,
      new_location_id UUID NOT NULL,
      PRIMARY KEY (old_location_id, organization_id)
    ) ON COMMIT DROP';

  EXECUTE '
    WITH refs AS (
      SELECT DISTINCT il.location_id AS old_id, ii.organization_id AS org_id
      FROM public.inventory_levels il
      JOIN public.inventory_items ii ON ii.id = il.item_id
      WHERE il.location_id IS NOT NULL AND ii.organization_id IS NOT NULL
      UNION
      SELECT DISTINCT it.from_location_id AS old_id, ii.organization_id AS org_id
      FROM public.inventory_transfers it
      JOIN public.inventory_items ii ON ii.id = it.item_id
      WHERE it.from_location_id IS NOT NULL AND ii.organization_id IS NOT NULL
      UNION
      SELECT DISTINCT it.to_location_id AS old_id, ii.organization_id AS org_id
      FROM public.inventory_transfers it
      JOIN public.inventory_items ii ON ii.id = it.item_id
      WHERE it.to_location_id IS NOT NULL AND ii.organization_id IS NOT NULL
      UNION
      SELECT DISTINCT icl.location_id AS old_id, ii.organization_id AS org_id
      FROM public.inventory_cost_layers icl
      JOIN public.inventory_items ii ON ii.id = icl.item_id
      WHERE icl.location_id IS NOT NULL AND ii.organization_id IS NOT NULL
      UNION
      SELECT DISTINCT ic.location_id AS old_id, ii.organization_id AS org_id
      FROM public.inventory_consumptions ic
      JOIN public.inventory_items ii ON ii.id = ic.item_id
      WHERE ic.location_id IS NOT NULL AND ii.organization_id IS NOT NULL
    ), src AS (
      SELECT r.old_id, r.org_id, sl.name
      FROM refs r
      LEFT JOIN public.storage_locations sl ON sl.id = r.old_id
      WHERE r.old_id IS NOT NULL AND r.org_id IS NOT NULL
    )
    INSERT INTO tmp_location_map (old_location_id, organization_id, new_location_id)
    SELECT s.old_id, s.org_id, bl.id
    FROM src s
    JOIN LATERAL (
      WITH found AS (
        SELECT id FROM public.business_locations bl
        WHERE bl.organization_id = s.org_id AND bl.name = COALESCE(s.name, ''Location'') || '' (Migrated)''
        LIMIT 1
      ), ins AS (
        INSERT INTO public.business_locations (organization_id, name, is_active, is_default)
        SELECT s.org_id, COALESCE(s.name, ''Location'') || '' (Migrated)'', true, false
        WHERE NOT EXISTS (SELECT 1 FROM found)
        RETURNING id
      )
      SELECT id FROM found
      UNION ALL
      SELECT id FROM ins
      LIMIT 1
    ) bl ON TRUE
    ON CONFLICT DO NOTHING';

  -- 2) Update foreign key values on referencing tables to new business location ids
  EXECUTE '
    UPDATE public.inventory_levels il
    SET location_id = m.new_location_id
    FROM tmp_location_map m
    JOIN public.inventory_items ii ON ii.id = il.item_id
    WHERE il.location_id = m.old_location_id AND ii.organization_id = m.organization_id';

  EXECUTE '
    UPDATE public.inventory_transfers it
    SET from_location_id = m.new_location_id
    FROM tmp_location_map m
    JOIN public.inventory_items ii ON ii.id = it.item_id
    WHERE it.from_location_id = m.old_location_id AND ii.organization_id = m.organization_id';

  EXECUTE '
    UPDATE public.inventory_transfers it
    SET to_location_id = m.new_location_id
    FROM tmp_location_map m
    JOIN public.inventory_items ii ON ii.id = it.item_id
    WHERE it.to_location_id = m.old_location_id AND ii.organization_id = m.organization_id';

  EXECUTE '
    UPDATE public.inventory_cost_layers icl
    SET location_id = m.new_location_id
    FROM tmp_location_map m
    JOIN public.inventory_items ii ON ii.id = icl.item_id
    WHERE icl.location_id = m.old_location_id AND ii.organization_id = m.organization_id';

  EXECUTE '
    UPDATE public.inventory_consumptions ic
    SET location_id = m.new_location_id
    FROM tmp_location_map m
    JOIN public.inventory_items ii ON ii.id = ic.item_id
    WHERE ic.location_id = m.old_location_id AND ii.organization_id = m.organization_id';

  -- 3) Drop existing foreign keys to storage_locations, then add new FKs to business_locations
  FOR r IN
    SELECT conrelid::regclass AS table_name, conname
    FROM pg_constraint c
    JOIN pg_class cl ON c.conrelid = cl.oid
    JOIN pg_namespace nsp ON cl.relnamespace = nsp.oid
    WHERE c.contype = 'f'
      AND c.confrelid::regclass::text = 'public.storage_locations'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.table_name, r.conname);
  END LOOP;

  -- Recreate FKs to business_locations
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_levels'
  ) THEN
    EXECUTE 'ALTER TABLE public.inventory_levels
      ADD CONSTRAINT IF NOT EXISTS inventory_levels_location_id_fkey
      FOREIGN KEY (location_id) REFERENCES public.business_locations(id) ON DELETE CASCADE';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_transfers'
  ) THEN
    EXECUTE 'ALTER TABLE public.inventory_transfers
      ADD CONSTRAINT IF NOT EXISTS inventory_transfers_from_location_id_fkey
      FOREIGN KEY (from_location_id) REFERENCES public.business_locations(id) ON DELETE RESTRICT';

    EXECUTE 'ALTER TABLE public.inventory_transfers
      ADD CONSTRAINT IF NOT EXISTS inventory_transfers_to_location_id_fkey
      FOREIGN KEY (to_location_id) REFERENCES public.business_locations(id) ON DELETE RESTRICT';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_cost_layers'
  ) THEN
    EXECUTE 'ALTER TABLE public.inventory_cost_layers
      ADD CONSTRAINT IF NOT EXISTS inventory_cost_layers_location_id_fkey
      FOREIGN KEY (location_id) REFERENCES public.business_locations(id) ON DELETE CASCADE';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_consumptions'
  ) THEN
    EXECUTE 'ALTER TABLE public.inventory_consumptions
      ADD CONSTRAINT IF NOT EXISTS inventory_consumptions_location_id_fkey
      FOREIGN KEY (location_id) REFERENCES public.business_locations(id) ON DELETE CASCADE';
  END IF;

  -- 4) Drop unused storage_locations table if no longer referenced
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'storage_locations'
  ) THEN
    EXECUTE 'DROP TABLE public.storage_locations';
  END IF;
END $$;

-- 5) Notify PostgREST to reload schema
DO $$ BEGIN PERFORM pg_notify('pgrst', 'reload schema'); END $$;

COMMIT;