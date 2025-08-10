-- Add table for per-item account mappings and tax flag
BEGIN;

CREATE TABLE IF NOT EXISTS public.inventory_item_accounts (
  item_id UUID PRIMARY KEY REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  sales_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  purchase_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  inventory_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  is_taxable BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relname = 'inventory_item_accounts' AND t.tgname = 'update_inventory_item_accounts_updated_at'
  ) THEN
    EXECUTE 'CREATE TRIGGER update_inventory_item_accounts_updated_at BEFORE UPDATE ON public.inventory_item_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
  END IF;
END $$;

-- Ensure unique constraint on inventory_levels for upserts (item_id, location_id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='inventory_levels' AND indexname='inventory_levels_item_id_location_id_key'
  ) THEN
    BEGIN
      ALTER TABLE public.inventory_levels ADD CONSTRAINT inventory_levels_item_id_location_id_key UNIQUE (item_id, location_id);
    EXCEPTION WHEN duplicate_table THEN
      NULL;
    END;
  END IF;
END $$;

-- RLS permissive policy to match existing approach
ALTER TABLE public.inventory_item_accounts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'inventory_item_accounts' AND policyname = 'Public access to inventory_item_accounts'
  ) THEN
    CREATE POLICY "Public access to inventory_item_accounts" ON public.inventory_item_accounts FOR ALL USING (true);
  END IF;
END $$;

-- Refresh PostgREST cache
DO $$ BEGIN PERFORM pg_notify('pgrst', 'reload schema'); END $$;

COMMIT;