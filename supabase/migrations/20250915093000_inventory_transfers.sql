-- Inventory Transfers table to support stock movement between locations
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.inventory_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  from_location_id UUID NOT NULL REFERENCES public.business_locations(id) ON DELETE RESTRICT,
  to_location_id UUID NOT NULL REFERENCES public.business_locations(id) ON DELETE RESTRICT,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_inventory_transfers_updated_at') THEN
    CREATE TRIGGER trg_inventory_transfers_updated_at BEFORE UPDATE ON public.inventory_transfers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_inventory_transfers_item ON public.inventory_transfers(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_from ON public.inventory_transfers(from_location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_to ON public.inventory_transfers(to_location_id);

ALTER TABLE public.inventory_transfers ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='inventory_transfers' AND policyname='Allow all (inventory_transfers)'
  ) THEN
    CREATE POLICY "Allow all (inventory_transfers)" ON public.inventory_transfers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;