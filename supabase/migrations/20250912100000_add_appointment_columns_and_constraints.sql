-- Add missing columns to appointments table
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS customer_email TEXT,
  ADD COLUMN IF NOT EXISTS customer_phone TEXT,
  ADD COLUMN IF NOT EXISTS service_name TEXT,
  ADD COLUMN IF NOT EXISTS price NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.business_locations(id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_appointments_location_id ON public.appointments(location_id);
CREATE INDEX IF NOT EXISTS idx_appointments_client_id ON public.appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_staff_id ON public.appointments(staff_id);
CREATE INDEX IF NOT EXISTS idx_appointments_organization_id ON public.appointments(organization_id);

-- Add constraints to make fields mandatory (after updating existing records)
-- First, update any NULL values to prevent constraint violations
UPDATE public.appointments 
SET location_id = (
  SELECT id FROM public.business_locations 
  WHERE organization_id = appointments.organization_id 
  LIMIT 1
)
WHERE location_id IS NULL;

UPDATE public.appointments 
SET staff_id = (
  SELECT id FROM public.staff 
  WHERE organization_id = appointments.organization_id 
    AND is_active = true 
  LIMIT 1
)
WHERE staff_id IS NULL;

-- Now add NOT NULL constraints for mandatory fields
ALTER TABLE public.appointments
  ALTER COLUMN location_id SET NOT NULL,
  ALTER COLUMN staff_id SET NOT NULL,
  ALTER COLUMN appointment_date SET NOT NULL,
  ALTER COLUMN appointment_time SET NOT NULL;

-- Add check constraint to ensure customer_phone is provided
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_customer_phone_required 
  CHECK (customer_phone IS NOT NULL AND customer_phone != '');

-- Create a function to validate appointments before insert/update
CREATE OR REPLACE FUNCTION public.validate_appointment()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate location_id is provided
  IF NEW.location_id IS NULL THEN
    RAISE EXCEPTION 'Location is required for appointments';
  END IF;

  -- Validate staff_id is provided
  IF NEW.staff_id IS NULL THEN
    RAISE EXCEPTION 'Staff assignment is required for appointments';
  END IF;

  -- Validate appointment_date is provided
  IF NEW.appointment_date IS NULL THEN
    RAISE EXCEPTION 'Appointment date is required';
  END IF;

  -- Validate appointment_time is provided
  IF NEW.appointment_time IS NULL THEN
    RAISE EXCEPTION 'Appointment time is required';
  END IF;

  -- Validate customer_phone is provided
  IF NEW.customer_phone IS NULL OR NEW.customer_phone = '' THEN
    RAISE EXCEPTION 'Customer phone number is required';
  END IF;

  -- Validate that location belongs to the same organization
  IF NOT EXISTS (
    SELECT 1 FROM public.business_locations 
    WHERE id = NEW.location_id 
      AND organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'Invalid location selected';
  END IF;

  -- Validate that staff belongs to the same organization
  IF NOT EXISTS (
    SELECT 1 FROM public.staff 
    WHERE id = NEW.staff_id 
      AND organization_id = NEW.organization_id
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Invalid staff member selected';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate appointments
DROP TRIGGER IF EXISTS validate_appointment_trigger ON public.appointments;
CREATE TRIGGER validate_appointment_trigger
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_appointment();

-- Add comment to document the mandatory fields
COMMENT ON TABLE public.appointments IS 'Appointments table with mandatory fields: location_id, staff_id, appointment_date, appointment_time, customer_phone';