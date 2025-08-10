-- Add location_id to services and enforce mandatory when possible
BEGIN;

-- 1) Add column if missing
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='services' AND column_name='location_id'
  ) THEN
    ALTER TABLE public.services ADD COLUMN location_id UUID;
  END IF;
END $$;

-- 2) Ensure FK constraint to business_locations exists (RESTRICT deletes)
DO $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'services'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND tc.constraint_name = 'services_location_id_fkey'
  ) INTO v_exists;

  IF NOT v_exists THEN
    ALTER TABLE public.services
      ADD CONSTRAINT services_location_id_fkey
      FOREIGN KEY (location_id)
      REFERENCES public.business_locations(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

-- 3) Helpful index
CREATE INDEX IF NOT EXISTS idx_services_location_id ON public.services(location_id);

-- 4) Backfill location_id using per-organization default location if NULL
--    Prefer is_default=true, else any active location, else any location
UPDATE public.services s
SET location_id = bl.id
FROM LATERAL (
  SELECT bl1.id
  FROM public.business_locations bl1
  WHERE bl1.organization_id = s.organization_id
    AND bl1.is_default = true
  LIMIT 1
) bl
WHERE s.location_id IS NULL
  AND bl.id IS NOT NULL;

UPDATE public.services s
SET location_id = bl.id
FROM LATERAL (
  SELECT bl2.id
  FROM public.business_locations bl2
  WHERE bl2.organization_id = s.organization_id
    AND bl2.is_active = true
  ORDER BY bl2.is_default DESC, bl2.created_at ASC
  LIMIT 1
) bl
WHERE s.location_id IS NULL
  AND bl.id IS NOT NULL;

-- 5) If no NULLs remain, enforce NOT NULL
DO $$
DECLARE
  v_null_count bigint;
BEGIN
  SELECT COUNT(*) INTO v_null_count FROM public.services WHERE location_id IS NULL;
  IF v_null_count = 0 THEN
    ALTER TABLE public.services ALTER COLUMN location_id SET NOT NULL;
  END IF;
END $$;

-- 6) Touch updated_at for consistency (optional)
UPDATE public.services SET updated_at = now() WHERE true;

-- 7) Notify PostgREST of schema change
DO $$ BEGIN PERFORM pg_notify('pgrst', 'reload schema'); END $$;

COMMIT;