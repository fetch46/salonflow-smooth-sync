-- 0) Ensure organization_id exists on appointments and is backfilled
DO $$
BEGIN
  -- Add column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'appointments' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.appointments ADD COLUMN organization_id uuid;
  END IF;

  -- Backfill from staff
  UPDATE public.appointments a
  SET organization_id = s.organization_id
  FROM public.staff s
  WHERE a.organization_id IS NULL AND a.staff_id = s.id;

  -- Backfill from clients
  UPDATE public.appointments a
  SET organization_id = c.organization_id
  FROM public.clients c
  WHERE a.organization_id IS NULL AND a.client_id = c.id;

  -- Backfill from services
  UPDATE public.appointments a
  SET organization_id = sv.organization_id
  FROM public.services sv
  WHERE a.organization_id IS NULL AND a.service_id = sv.id;

  -- Try to enforce NOT NULL if possible; ignore if some rows remain NULL
  BEGIN
    ALTER TABLE public.appointments ALTER COLUMN organization_id SET NOT NULL;
  EXCEPTION WHEN others THEN
    NULL;
  END;
END $$;

-- 1) De-duplicate existing rows that conflict on (organization_id, staff_id, appointment_date, appointment_time)
WITH ranked AS (
  SELECT
    id,
    organization_id,
    staff_id,
    appointment_date,
    appointment_time,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY organization_id, staff_id, appointment_date, appointment_time
      ORDER BY created_at, id
    ) AS rn
  FROM public.appointments
  WHERE staff_id IS NOT NULL AND organization_id IS NOT NULL
), to_delete AS (
  SELECT id FROM ranked WHERE rn > 1
)
DELETE FROM public.appointments a
USING to_delete d
WHERE a.id = d.id;

-- 2) Create a partial unique index to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS ux_appointments_org_staff_slot
  ON public.appointments(organization_id, staff_id, appointment_date, appointment_time)
  WHERE staff_id IS NOT NULL AND organization_id IS NOT NULL;

