-- Add default_warehouse_id to business_locations to support default warehouse per location
ALTER TABLE IF EXISTS public.business_locations
ADD COLUMN IF NOT EXISTS default_warehouse_id uuid NULL;

-- Add foreign key constraint to warehouses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name = 'business_locations'
      AND tc.constraint_name = 'business_locations_default_warehouse_id_fkey'
  ) THEN
    ALTER TABLE public.business_locations
    ADD CONSTRAINT business_locations_default_warehouse_id_fkey
    FOREIGN KEY (default_warehouse_id)
    REFERENCES public.warehouses(id)
    ON DELETE SET NULL;
  END IF;
END $$;