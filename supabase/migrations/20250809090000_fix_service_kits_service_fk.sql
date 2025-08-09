BEGIN;

-- Remove any orphaned service_kits rows that point to non-existent services
DELETE FROM public.service_kits sk
WHERE NOT EXISTS (
  SELECT 1 FROM public.services s WHERE s.id = sk.service_id
);

-- Drop the existing incorrect foreign key if it exists
ALTER TABLE public.service_kits
  DROP CONSTRAINT IF EXISTS service_kits_service_id_fkey;

-- Add the corrected foreign key referencing services(id)
ALTER TABLE public.service_kits
  ADD CONSTRAINT service_kits_service_id_fkey
  FOREIGN KEY (service_id)
  REFERENCES public.services(id)
  ON DELETE CASCADE;

COMMIT;