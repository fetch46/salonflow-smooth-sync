-- Ensure PostgREST reloads schema after creating receipts-related tables
-- Fixes: "Could not find the table 'public.receipts' in the schema cache"
DO $$ BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END $$;