-- Enforce unique clients per organization (by phone), allowing multiple NULLs
-- 1) Deduplicate existing rows that conflict on (organization_id, phone)
DO $$
DECLARE
  dup_count INTEGER;
BEGIN
  -- Count duplicates where phone IS NOT NULL
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT organization_id, phone
    FROM public.clients
    WHERE phone IS NOT NULL
    GROUP BY organization_id, phone
    HAVING COUNT(*) > 1
  ) d;

  IF dup_count > 0 THEN
    -- Strategy: Keep the earliest created row per (organization_id, phone), nullify phone for the rest
    WITH ranked AS (
      SELECT 
        id,
        organization_id,
        phone,
        created_at,
        ROW_NUMBER() OVER (PARTITION BY organization_id, phone ORDER BY created_at NULLS LAST, id) AS rn
      FROM public.clients
      WHERE phone IS NOT NULL
    )
    UPDATE public.clients c
    SET phone = NULL
    FROM ranked r
    WHERE c.id = r.id
      AND r.rn > 1;
  END IF;
END $$;

-- 2) Create a partial unique index to prevent future duplicates per org when phone is provided
CREATE UNIQUE INDEX IF NOT EXISTS ux_clients_org_phone
ON public.clients(organization_id, phone)
WHERE phone IS NOT NULL;

-- Optional: also keep a helpful lookup index by organization_id for faster filtering if not already present
CREATE INDEX IF NOT EXISTS idx_clients_organization_id ON public.clients(organization_id);

