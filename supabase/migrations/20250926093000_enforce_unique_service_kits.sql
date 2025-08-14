-- Enforce uniqueness of (service_id, good_id) in public.service_kits
-- 1) Safely remove any existing duplicates, keeping the most recently updated/created row
-- 2) Add a unique index to prevent future duplicates

BEGIN;

-- Step 1: De-duplicate existing rows with the same (service_id, good_id)
WITH duplicates AS (
	SELECT 
		id,
		ROW_NUMBER() OVER (
			PARTITION BY service_id, good_id 
			ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
		) AS rn
	FROM public.service_kits
)
DELETE FROM public.service_kits sk
USING duplicates d
WHERE sk.id = d.id
  AND d.rn > 1;

-- Step 2: Create a unique index to enforce one row per (service_id, good_id)
CREATE UNIQUE INDEX IF NOT EXISTS ux_service_kits_service_good 
ON public.service_kits(service_id, good_id);

COMMIT;