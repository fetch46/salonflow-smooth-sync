-- Enforce unique business location names per organization
-- Safe/idempotent migration

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'business_locations'
  ) THEN
    -- Add unique constraint if it does not already exist
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints tc
      WHERE tc.table_schema = 'public'
        AND tc.table_name = 'business_locations'
        AND tc.constraint_type = 'UNIQUE'
        AND tc.constraint_name = 'business_locations_org_name_key'
    ) THEN
      BEGIN
        ALTER TABLE public.business_locations
        ADD CONSTRAINT business_locations_org_name_key UNIQUE (organization_id, name);
      EXCEPTION WHEN duplicate_table THEN
        -- Another concurrent deploy created it; ignore
        NULL;
      WHEN others THEN
        -- If there are duplicates, raise a clear message
        RAISE EXCEPTION USING MESSAGE = 'Cannot add unique constraint (organization_id, name) on business_locations due to duplicate rows. Please deduplicate names per organization before applying.';
      END;
    END IF;
  END IF;
END $$;

-- Helpful index for lookups by (organization_id, name) if the unique constraint cannot be created as a unique index in some environments
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'business_locations'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE schemaname = 'public' AND indexname = 'idx_business_locations_org_name'
    ) THEN
      CREATE INDEX idx_business_locations_org_name ON public.business_locations(organization_id, name);
    END IF;
  END IF;
END $$;