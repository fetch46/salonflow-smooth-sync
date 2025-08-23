-- Fix job_number ambiguous reference with CASCADE
-- First alter the job_cards table to remove the default
ALTER TABLE public.job_cards ALTER COLUMN job_number DROP DEFAULT;

-- Now drop the function with CASCADE
DROP FUNCTION IF EXISTS public.generate_job_number() CASCADE;

-- Create new function with organization context
CREATE OR REPLACE FUNCTION public.generate_job_number(p_organization_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    next_number INTEGER;
    job_number TEXT;
BEGIN
    SELECT COALESCE(MAX(CAST(SUBSTRING(job_number FROM 'JC(\d+)') AS INTEGER)), 0) + 1
    INTO next_number
    FROM public.job_cards
    WHERE organization_id = p_organization_id
      AND job_number ~ '^JC\d+$';
    job_number := 'JC' || LPAD(next_number::TEXT, 3, '0');
    RETURN job_number;
END;
$$;

-- Create the trigger function
CREATE OR REPLACE FUNCTION public.set_job_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    IF NEW.job_number IS NULL OR NEW.job_number = '' THEN
        NEW.job_number := public.generate_job_number(NEW.organization_id);
    END IF;
    RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER set_job_number
    BEFORE INSERT ON public.job_cards
    FOR EACH ROW
    EXECUTE FUNCTION public.set_job_number();