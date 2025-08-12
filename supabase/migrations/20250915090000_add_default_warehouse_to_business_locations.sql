-- Create warehouses table if it does not exist
CREATE TABLE IF NOT EXISTS public.warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.business_locations(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS warehouses_org_idx ON public.warehouses(organization_id);
CREATE INDEX IF NOT EXISTS warehouses_location_idx ON public.warehouses(location_id);
CREATE INDEX IF NOT EXISTS warehouses_active_idx ON public.warehouses(is_active);

-- Add default_warehouse_id to business_locations if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'business_locations' 
      AND column_name = 'default_warehouse_id'
  ) THEN
    ALTER TABLE public.business_locations
      ADD COLUMN default_warehouse_id uuid NULL;
  END IF;
END $$;

-- Add foreign key from business_locations.default_warehouse_id to warehouses(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'business_locations'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND tc.constraint_name = 'business_locations_default_warehouse_id_fkey'
  ) THEN
    ALTER TABLE public.business_locations
      ADD CONSTRAINT business_locations_default_warehouse_id_fkey
      FOREIGN KEY (default_warehouse_id)
      REFERENCES public.warehouses(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- RLS enablement (optional if already enabled globally)
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies to scope by organization
-- Assumes profiles table and auth.uid() are used elsewhere; adjust to your org scoping model as needed
-- Select policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'warehouses' AND policyname = 'warehouses_select_by_org'
  ) THEN
    CREATE POLICY warehouses_select_by_org ON public.warehouses
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.organization_users ou
          WHERE ou.organization_id = warehouses.organization_id
            AND ou.user_id = auth.uid()
            AND ou.is_active = true
        )
      );
  END IF;
END $$;

-- Insert policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'warehouses' AND policyname = 'warehouses_insert_by_org'
  ) THEN
    CREATE POLICY warehouses_insert_by_org ON public.warehouses
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.organization_users ou
          WHERE ou.organization_id = warehouses.organization_id
            AND ou.user_id = auth.uid()
            AND ou.is_active = true
        )
      );
  END IF;
END $$;

-- Update policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'warehouses' AND policyname = 'warehouses_update_by_org'
  ) THEN
    CREATE POLICY warehouses_update_by_org ON public.warehouses
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.organization_users ou
          WHERE ou.organization_id = warehouses.organization_id
            AND ou.user_id = auth.uid()
            AND ou.is_active = true
        )
      ) WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.organization_users ou
          WHERE ou.organization_id = warehouses.organization_id
            AND ou.user_id = auth.uid()
            AND ou.is_active = true
        )
      );
  END IF;
END $$;

-- Delete policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'warehouses' AND policyname = 'warehouses_delete_by_org'
  ) THEN
    CREATE POLICY warehouses_delete_by_org ON public.warehouses
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM public.organization_users ou
          WHERE ou.organization_id = warehouses.organization_id
            AND ou.user_id = auth.uid()
            AND ou.is_active = true
        )
      );
  END IF;
END $$;