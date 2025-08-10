-- Ensure PostgREST reloads schema after creating/modifying business_locations and related objects
DO $$ BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END $$;