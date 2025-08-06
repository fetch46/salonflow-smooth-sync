-- Fix security warning by setting search_path for function
CREATE OR REPLACE FUNCTION generate_job_number()
RETURNS TEXT 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    next_number INTEGER;
    job_number TEXT;
BEGIN
    -- Get the next number in sequence
    SELECT COALESCE(MAX(CAST(SUBSTRING(job_number FROM 'JC(\d+)') AS INTEGER)), 0) + 1
    INTO next_number
    FROM job_cards
    WHERE job_number ~ '^JC\d+$';
    
    -- Format as JC001, JC002, etc.
    job_number := 'JC' || LPAD(next_number::TEXT, 3, '0');
    
    RETURN job_number;
END;
$$;