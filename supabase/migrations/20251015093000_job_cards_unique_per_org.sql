-- Ensure job card numbers are unique per organization (not globally)
DO $$
BEGIN
  -- Drop existing unique constraint on job_cards.job_number if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_schema = 'public' 
      AND table_name = 'job_cards' 
      AND constraint_type = 'UNIQUE' 
      AND constraint_name IN ('job_cards_job_number_key', 'job_cards_job_number_unique')
  ) THEN
    BEGIN
      ALTER TABLE public.job_cards DROP CONSTRAINT IF EXISTS job_cards_job_number_key;
    EXCEPTION WHEN undefined_object THEN
      -- Ignore if already dropped
      NULL;
    END;
  END IF;

  -- Add a unique constraint on (organization_id, job_number)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_schema = 'public' 
      AND table_name = 'job_cards' 
      AND constraint_type = 'UNIQUE' 
      AND constraint_name = 'job_cards_org_job_number_key'
  ) THEN
    BEGIN
      ALTER TABLE public.job_cards
        ADD CONSTRAINT job_cards_org_job_number_key UNIQUE (organization_id, job_number);
    EXCEPTION WHEN duplicate_table THEN
      -- Created concurrently elsewhere
      NULL;
    WHEN others THEN
      -- If there are duplicates across orgs, raise a clear message
      RAISE EXCEPTION USING MESSAGE = 'Cannot add unique constraint (organization_id, job_number) on job_cards due to duplicate rows. Please deduplicate job numbers per organization before applying.';
    END;
  END IF;
END $$;

-- Helpful index to keep lookups fast
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_job_cards_org_job_number'
  ) THEN
    CREATE INDEX idx_job_cards_org_job_number ON public.job_cards(organization_id, job_number);
  END IF;
END $$;

