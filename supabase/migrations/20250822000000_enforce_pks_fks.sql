-- Enforce/repair primary keys, foreign keys, uniques, and indexes used by the app

-- Helper to safely add a primary key on id if missing
DO $$ BEGIN
  FOR r IN (
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'clients','staff','services','appointments','inventory_items','inventory_levels',
        'service_kits','job_cards','job_card_products','expenses','purchases','purchase_items',
        'suppliers','accounts','account_transactions','sales','sale_items','invoices','invoice_items',
        'inventory_adjustments','inventory_adjustment_items','staff_commissions','report_definitions','report_favorites','report_runs'
      )
  ) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      WHERE tc.table_schema = r.table_schema AND tc.table_name = r.table_name AND tc.constraint_type = 'PRIMARY KEY'
    ) THEN
      EXECUTE format('ALTER TABLE %I.%I ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid()', r.table_schema, r.table_name);
      EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I PRIMARY KEY (id)', r.table_schema, r.table_name, r.table_name || '_pkey');
    END IF;
  END LOOP;
END $$;

-- Ensure common foreign keys exist (conditional)
DO $$ BEGIN
  -- purchase_items.purchase_id -> purchases.id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='purchase_items') THEN
    ALTER TABLE public.purchase_items
    DROP CONSTRAINT IF EXISTS purchase_items_purchase_id_fkey;
    ALTER TABLE public.purchase_items
    ADD CONSTRAINT purchase_items_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES public.purchases(id) ON DELETE CASCADE;
  END IF;

  -- goods_received_items.goods_received_id -> goods_received.id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='goods_received_items') THEN
    ALTER TABLE public.goods_received_items
    DROP CONSTRAINT IF EXISTS goods_received_items_goods_received_id_fkey;
    ALTER TABLE public.goods_received_items
    ADD CONSTRAINT goods_received_items_goods_received_id_fkey FOREIGN KEY (goods_received_id) REFERENCES public.goods_received(id) ON DELETE CASCADE;
  END IF;

  -- inventory_item_accounts.item_id -> inventory_items.id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='inventory_item_accounts') THEN
    ALTER TABLE public.inventory_item_accounts
    DROP CONSTRAINT IF EXISTS inventory_item_accounts_item_id_fkey;
    ALTER TABLE public.inventory_item_accounts
    ADD CONSTRAINT inventory_item_accounts_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventory_items(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Helpful unique constraints and indexes
CREATE UNIQUE INDEX IF NOT EXISTS ux_accounts_org_code ON public.accounts(organization_id, account_code);
CREATE UNIQUE INDEX IF NOT EXISTS ux_inventory_item_accounts_item ON public.inventory_item_accounts(item_id);
CREATE INDEX IF NOT EXISTS idx_organization_users_org ON public.organization_users(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_users_user ON public.organization_users(user_id);