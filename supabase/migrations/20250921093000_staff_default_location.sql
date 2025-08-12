-- Add staff default location relation table
CREATE TABLE IF NOT EXISTS public.staff_default_locations (
  staff_id uuid PRIMARY KEY REFERENCES public.staff(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.business_locations(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_staff_default_locations_touch ON public.staff_default_locations;
CREATE TRIGGER trg_staff_default_locations_touch
BEFORE UPDATE ON public.staff_default_locations
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Simple RLS assuming organization-scoped access via policies already exist on underlying tables
ALTER TABLE public.staff_default_locations ENABLE ROW LEVEL SECURITY;

-- Allow staff/location managers to manage default locations if they can access both tables
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'staff_default_locations' AND policyname = 'staff_default_locations_rw'
  ) THEN
    CREATE POLICY staff_default_locations_rw ON public.staff_default_locations
    USING (
      EXISTS (
        SELECT 1 FROM public.staff s
        WHERE s.id = staff_id
      ) AND EXISTS (
        SELECT 1 FROM public.business_locations bl
        WHERE bl.id = location_id
      )
    ) WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.staff s
        WHERE s.id = staff_id
      ) AND EXISTS (
        SELECT 1 FROM public.business_locations bl
        WHERE bl.id = location_id
      )
    );
  END IF;
END $$;