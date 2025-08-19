-- Enforce per-organization uniqueness for appointments by staff timeslot

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
  WHERE staff_id IS NOT NULL
), to_delete AS (
  SELECT id FROM ranked WHERE rn > 1
)
DELETE FROM public.appointments a
USING to_delete d
WHERE a.id = d.id;

-- 2) Create a partial unique index to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS ux_appointments_org_staff_slot
  ON public.appointments(organization_id, staff_id, appointment_date, appointment_time)
  WHERE staff_id IS NOT NULL;

