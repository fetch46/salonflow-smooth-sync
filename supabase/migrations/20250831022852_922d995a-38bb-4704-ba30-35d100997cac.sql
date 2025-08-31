-- Fix the final function search path issue
ALTER FUNCTION set_updated_at() SET search_path = 'public';