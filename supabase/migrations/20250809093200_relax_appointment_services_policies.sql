-- Ensure appointment_services table exists with expected columns
CREATE TABLE IF NOT EXISTS public.appointment_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id),
  staff_id UUID REFERENCES public.staff(id),
  duration_minutes INTEGER,
  price NUMERIC(10,2),
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.appointment_services ENABLE ROW LEVEL SECURITY;

-- Drop existing generic policies if any to avoid duplicates
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'appointment_services' AND policyname = 'Users can view appointment services'
  ) THEN
    DROP POLICY "Users can view appointment services" ON public.appointment_services;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'appointment_services' AND policyname = 'Users can manage appointment services'
  ) THEN
    DROP POLICY "Users can manage appointment services" ON public.appointment_services;
  END IF;
END$$;

-- Create permissive policies for authenticated org users
CREATE POLICY "Org users can view appointment services"
ON public.appointment_services
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_users ou
    WHERE ou.user_id = auth.uid() AND ou.is_active = true
  )
);

CREATE POLICY "Org users can insert appointment services"
ON public.appointment_services
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_users ou
    WHERE ou.user_id = auth.uid() AND ou.is_active = true
  )
);

CREATE POLICY "Org users can update appointment services"
ON public.appointment_services
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_users ou
    WHERE ou.user_id = auth.uid() AND ou.is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_users ou
    WHERE ou.user_id = auth.uid() AND ou.is_active = true
  )
);

CREATE POLICY "Org users can delete appointment services"
ON public.appointment_services
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_users ou
    WHERE ou.user_id = auth.uid() AND ou.is_active = true
  )
);