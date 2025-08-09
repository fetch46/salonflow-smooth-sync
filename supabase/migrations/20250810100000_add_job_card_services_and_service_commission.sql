-- Add commission percentage to services if not exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'commission_percentage'
  ) THEN
    ALTER TABLE public.services ADD COLUMN commission_percentage NUMERIC(5,2) DEFAULT 0;
  END IF;
END $$;

-- Create job_card_services table to assign staff per service on a job card
CREATE TABLE IF NOT EXISTS public.job_card_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_card_id UUID NOT NULL REFERENCES public.job_cards(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id),
  staff_id UUID REFERENCES public.staff(id),
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  commission_percentage NUMERIC(5,2) DEFAULT 0,
  duration_minutes INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS and provide permissive policies (adjust to your tenancy model)
ALTER TABLE public.job_card_services ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'job_card_services' AND policyname = 'Public access to job_card_services'
  ) THEN
    CREATE POLICY "Public access to job_card_services" ON public.job_card_services FOR ALL USING (true);
  END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_job_card_services_job_card_id ON public.job_card_services(job_card_id);
CREATE INDEX IF NOT EXISTS idx_job_card_services_staff_id ON public.job_card_services(staff_id);
CREATE INDEX IF NOT EXISTS idx_job_card_services_service_id ON public.job_card_services(service_id);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_job_card_services_updated_at ON public.job_card_services;
CREATE TRIGGER update_job_card_services_updated_at
BEFORE UPDATE ON public.job_card_services
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();