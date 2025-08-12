-- Inventory transfers between business locations
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.inventory_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL,
  from_location_id uuid NOT NULL,
  to_location_id uuid NOT NULL,
  quantity numeric NOT NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Foreign keys (conditional for locations)
DO $$ BEGIN
  -- item -> inventory_items
  ALTER TABLE public.inventory_transfers
  DROP CONSTRAINT IF EXISTS inventory_transfers_item_id_fkey;
  ALTER TABLE public.inventory_transfers
  ADD CONSTRAINT inventory_transfers_item_id_fkey
    FOREIGN KEY (item_id) REFERENCES public.inventory_items(id) ON DELETE CASCADE;

  -- from_location -> business_locations (if exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'business_locations'
  ) THEN
    ALTER TABLE public.inventory_transfers
    DROP CONSTRAINT IF EXISTS inventory_transfers_from_location_id_fkey;
    ALTER TABLE public.inventory_transfers
    ADD CONSTRAINT inventory_transfers_from_location_id_fkey
      FOREIGN KEY (from_location_id) REFERENCES public.business_locations(id) ON DELETE CASCADE;

    ALTER TABLE public.inventory_transfers
    DROP CONSTRAINT IF EXISTS inventory_transfers_to_location_id_fkey;
    ALTER TABLE public.inventory_transfers
    ADD CONSTRAINT inventory_transfers_to_location_id_fkey
      FOREIGN KEY (to_location_id) REFERENCES public.business_locations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_inventory_transfers_updated_at') THEN
    CREATE TRIGGER trg_inventory_transfers_updated_at
    BEFORE UPDATE ON public.inventory_transfers
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_item ON public.inventory_transfers(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_from ON public.inventory_transfers(from_location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_to ON public.inventory_transfers(to_location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_created ON public.inventory_transfers(created_at);

-- RLS permissive for dev
ALTER TABLE public.inventory_transfers ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'inventory_transfers' AND policyname = 'Allow all (inventory_transfers)'
  ) THEN
    CREATE POLICY "Allow all (inventory_transfers)" ON public.inventory_transfers
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;