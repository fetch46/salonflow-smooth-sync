-- Add income_account_id to services and set up FK/index
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'income_account_id'
  ) THEN
    ALTER TABLE public.services
      ADD COLUMN income_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index to speed up joins/filtering on income_account_id
CREATE INDEX IF NOT EXISTS idx_services_income_account_id ON public.services(income_account_id);

-- Optional backfill could be added here if a default Service Revenue account exists per organization.
-- Leaving NULL to allow UI to enforce selection for new services while preserving existing rows.
