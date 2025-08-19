-- Fix ambiguous column reference caused by PL/pgSQL variable name "job_number"
-- Replace the function to use a distinct variable name and qualify the column

CREATE OR REPLACE FUNCTION public.generate_job_number(p_organization_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    next_number INTEGER;
    v_job_number TEXT;
BEGIN
    SELECT COALESCE(MAX(CAST(SUBSTRING(jc.job_number FROM 'JC(\d+)') AS INTEGER)), 0) + 1
    INTO next_number
    FROM public.job_cards AS jc
    WHERE jc.organization_id = p_organization_id
      AND jc.job_number ~ '^JC\d+$';

    v_job_number := 'JC' || LPAD(next_number::TEXT, 3, '0');
    RETURN v_job_number;
END;
$$;

