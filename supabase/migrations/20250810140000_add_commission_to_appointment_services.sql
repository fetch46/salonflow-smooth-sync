-- Add commission_percentage to appointment_services if missing
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'appointment_services' AND column_name = 'commission_percentage'
  ) THEN
    ALTER TABLE public.appointment_services ADD COLUMN commission_percentage NUMERIC(5,2);
  END IF;
END $$;