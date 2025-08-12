-- Migrate legacy storage_locations to business_locations when feasible
-- Safe, no-op if prerequisites not met

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'storage_locations'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'business_locations'
  ) THEN
    -- Attempt minimal migration only if organizations table and a single org exist
    IF EXISTS (
      SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organizations'
    ) THEN
      -- If there is exactly one organization, map all legacy storage locations to it
      IF (SELECT COUNT(*) FROM public.organizations) = 1 THEN
        INSERT INTO public.business_locations (id, organization_id, name, is_active, is_default)
        SELECT
          gen_random_uuid(),
          (SELECT id FROM public.organizations LIMIT 1),
          sl.name,
          COALESCE(sl.is_active, true),
          false
        FROM public.storage_locations sl
        WHERE NOT EXISTS (
          SELECT 1 FROM public.business_locations bl WHERE bl.name = sl.name
        );
      END IF;
    END IF;
  END IF;
END $$;