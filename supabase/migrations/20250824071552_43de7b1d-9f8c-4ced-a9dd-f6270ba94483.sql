-- Fix missing appointment_services table and related issues
CREATE TABLE IF NOT EXISTS public.appointment_services (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id uuid NOT NULL,
  service_id uuid NOT NULL,
  staff_id uuid,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total_price numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.appointment_services ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Public access to appointment_services" 
ON public.appointment_services 
FOR ALL 
USING (true);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_appointment_services_appointment_id ON public.appointment_services(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_services_service_id ON public.appointment_services(service_id);

-- Create trigger for updated_at
CREATE TRIGGER update_appointment_services_updated_at
BEFORE UPDATE ON public.appointment_services
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();