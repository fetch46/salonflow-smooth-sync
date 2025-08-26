-- Fix ambiguous job_number reference in generate_job_number function
CREATE OR REPLACE FUNCTION public.generate_job_number(p_organization_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    next_number INTEGER;
    generated_job_number TEXT;
BEGIN
    SELECT COALESCE(MAX(CAST(SUBSTRING(jc.job_number FROM 'JC(\d+)') AS INTEGER)), 0) + 1
    INTO next_number
    FROM public.job_cards jc
    WHERE jc.organization_id = p_organization_id
      AND jc.job_number ~ '^JC\d+$';
    generated_job_number := 'JC' || LPAD(next_number::TEXT, 3, '0');
    RETURN generated_job_number;
END;
$function$;