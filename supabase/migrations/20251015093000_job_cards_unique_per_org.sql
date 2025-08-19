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

  -- Deduplicate existing rows that have the same (organization_id, job_number)
  -- Keep the first occurrence and suffix subsequent duplicates to ensure uniqueness
  PERFORM 1 FROM public.job_cards; -- no-op to ensure table exists in some environments
  WITH duplicates AS (
    SELECT 
      id,
      organization_id,
      job_number,
      ROW_NUMBER() OVER (
        PARTITION BY organization_id, job_number 
        ORDER BY created_at NULLS LAST, id
      ) AS rn
    FROM public.job_cards
  )
  UPDATE public.job_cards jc
  SET job_number = jc.job_number || '-' || (d.rn - 1)::text || '-' || SUBSTRING(jc.id::text, 1, 4)
  FROM duplicates d
  WHERE jc.id = d.id
    AND d.rn > 1;

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
      -- If there are still duplicates, raise a clear message
      RAISE EXCEPTION USING MESSAGE = 'Cannot add unique constraint (organization_id, job_number) on job_cards due to duplicate rows. Automatic deduplication failed. Please inspect and resolve conflicts.';
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

-- Auto-generate org-scoped job numbers on insert when not provided
DO $$
BEGIN
  -- Trigger function
  CREATE OR REPLACE FUNCTION public.set_job_cards_job_number()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $$
  BEGIN
    IF NEW.job_number IS NULL OR NEW.job_number = '' THEN
      -- Prevent races among inserts within the same organization
      PERFORM pg_advisory_xact_lock((('x' || substr(md5(NEW.organization_id::text), 1, 16))::bit(64))::bigint);
      NEW.job_number := public.generate_job_number(NEW.organization_id);
    END IF;
    RETURN NEW;
  END;
  $$;

  -- Create trigger if missing
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_job_cards_set_job_number'
  ) THEN
    CREATE TRIGGER trg_job_cards_set_job_number
      BEFORE INSERT ON public.job_cards
      FOR EACH ROW
      EXECUTE FUNCTION public.set_job_cards_job_number();
  END IF;
END $$;

