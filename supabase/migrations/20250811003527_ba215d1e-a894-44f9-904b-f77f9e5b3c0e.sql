-- Secure the marker function by setting an empty search_path
CREATE OR REPLACE FUNCTION public._lov_refresh_types_marker()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  RETURN true;
END;
$$;