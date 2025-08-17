-- Add address column to business_locations if missing
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'business_locations'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'business_locations' 
        AND column_name = 'address'
    ) THEN
      ALTER TABLE public.business_locations
      ADD COLUMN address text NULL;
    END IF;
  END IF;
END $$;