-- Inventory item account mappings (per-product accounts)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.inventory_item_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  sales_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  purchase_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  inventory_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  is_taxable BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique mapping per item (supports upsert onConflict: 'item_id')
CREATE UNIQUE INDEX IF NOT EXISTS ux_inventory_item_accounts_item ON public.inventory_item_accounts(item_id);

-- Helpful lookup indexes
CREATE INDEX IF NOT EXISTS idx_inventory_item_accounts_sales_acc ON public.inventory_item_accounts(sales_account_id);
CREATE INDEX IF NOT EXISTS idx_inventory_item_accounts_purchase_acc ON public.inventory_item_accounts(purchase_account_id);
CREATE INDEX IF NOT EXISTS idx_inventory_item_accounts_inventory_acc ON public.inventory_item_accounts(inventory_account_id);

-- Reuse generic updated_at trigger if present
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_inventory_item_accounts_updated_at') THEN
    CREATE TRIGGER trg_inventory_item_accounts_updated_at BEFORE UPDATE ON public.inventory_item_accounts
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- Enable RLS and allow all for dev/demo (adjust in production)
ALTER TABLE public.inventory_item_accounts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'inventory_item_accounts' AND policyname = 'Allow all (inventory_item_accounts)'
  ) THEN
    CREATE POLICY "Allow all (inventory_item_accounts)" ON public.inventory_item_accounts
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;