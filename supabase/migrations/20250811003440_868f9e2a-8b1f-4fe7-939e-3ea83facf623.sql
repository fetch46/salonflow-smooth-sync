-- Harmless migration to trigger Supabase types regeneration
-- This creates a tiny marker function in public schema
DROP FUNCTION IF EXISTS public._lov_refresh_types_marker();
CREATE OR REPLACE FUNCTION public._lov_refresh_types_marker()
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  -- no-op: used to trigger types refresh after migration
  RETURN true;
END;
$$;