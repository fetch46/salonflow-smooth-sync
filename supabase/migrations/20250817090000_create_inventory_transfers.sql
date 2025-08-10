BEGIN;

-- Create table to log inventory transfers between locations
CREATE TABLE IF NOT EXISTS public.inventory_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  from_location_id UUID NOT NULL REFERENCES public.business_locations(id) ON DELETE RESTRICT,
  to_location_id UUID NOT NULL REFERENCES public.business_locations(id) ON DELETE RESTRICT,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_transfers_created_at ON public.inventory_transfers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_item ON public.inventory_transfers(item_id, created_at DESC);

ALTER TABLE public.inventory_transfers ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'inventory_transfers' AND policyname = 'Public access to inventory_transfers'
  ) THEN
    CREATE POLICY "Public access to inventory_transfers" ON public.inventory_transfers FOR ALL USING (true);
  END IF;
END $$;

-- Reuse standard updated_at trigger if present
CREATE TRIGGER update_inventory_transfers_updated_at
BEFORE UPDATE ON public.inventory_transfers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;