-- Add organization_id and location_id to services with FKs and indexes (idempotent)
DO $$ BEGIN
  -- Add organization_id if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='services' AND column_name='organization_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.services ADD COLUMN organization_id uuid NULL';
  END IF;

  -- Add location_id if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='services' AND column_name='location_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.services ADD COLUMN location_id uuid NULL';
  END IF;

  -- Add FK for organization_id if column exists and FK not present
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='services' AND column_name='organization_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='services_organization_id_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE public.services 
             ADD CONSTRAINT services_organization_id_fkey 
             FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL';
  END IF;

  -- Add FK for location_id if column exists and FK not present
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='services' AND column_name='location_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='services_location_id_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE public.services 
             ADD CONSTRAINT services_location_id_fkey 
             FOREIGN KEY (location_id) REFERENCES public.business_locations(id) ON DELETE SET NULL';
  END IF;

  -- Indexes
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_services_organization_id ON public.services(organization_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_services_location_id ON public.services(location_id)';
END $$;

-- Best-effort backfill of location_id using default business location when possible
DO $$ DECLARE
  rec RECORD;
  v_default_location UUID;
BEGIN
  FOR rec IN SELECT id, organization_id FROM public.services WHERE location_id IS NULL LOOP
    IF rec.organization_id IS NOT NULL THEN
      SELECT bl.id INTO v_default_location
      FROM public.business_locations bl
      WHERE bl.organization_id = rec.organization_id AND bl.is_default = true
      LIMIT 1;

      IF v_default_location IS NULL THEN
        SELECT bl.id INTO v_default_location
        FROM public.business_locations bl
        WHERE bl.organization_id = rec.organization_id
        ORDER BY bl.created_at NULLS LAST, bl.id
        LIMIT 1;
      END IF;

      IF v_default_location IS NOT NULL THEN
        UPDATE public.services SET location_id = v_default_location WHERE id = rec.id;
      END IF;
    END IF;
  END LOOP;
END $$;

-- Reload PostgREST schema cache so new columns are visible immediately
DO $$ BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END $$;