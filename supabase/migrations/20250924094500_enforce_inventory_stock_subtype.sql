-- Enforce that inventory_item_accounts.inventory_account_id points to an Asset account with subtype 'Stock' or 'Stocks'
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_item_accounts'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'account_subtype'
  ) THEN
    ALTER TABLE public.inventory_item_accounts
    DROP CONSTRAINT IF EXISTS chk_inventory_item_accounts_inventory_is_stock;
    
    ALTER TABLE public.inventory_item_accounts
    ADD CONSTRAINT chk_inventory_item_accounts_inventory_is_stock
    CHECK (
      inventory_account_id IS NULL OR EXISTS (
        SELECT 1 FROM public.accounts a
        WHERE a.id = inventory_account_id
          AND a.account_type = 'Asset'
          AND (a.account_subtype = 'Stock' OR a.account_subtype = 'Stocks')
      )
    );
  END IF;
END $$;

-- Normalize default Inventory account subtype if missing or different
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'account_subtype'
  ) THEN
    UPDATE public.accounts
    SET account_subtype = 'Stock'
    WHERE account_type = 'Asset'
      AND account_name = 'Inventory'
      AND (account_subtype IS NULL OR account_subtype NOT IN ('Stock','Stocks'));
  END IF;
END $$;

-- Backfill: ensure every inventory item has a mapping row pointing to a Stock/Stocks asset account
DO $$ DECLARE
  v_item RECORD;
  v_inv_acc UUID;
BEGIN
  -- Only proceed if required tables/columns exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='inventory_items') AND
     EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='inventory_item_accounts') AND
     EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='accounts' AND column_name='account_subtype') THEN

    FOR v_item IN
      SELECT ii.id AS item_id, ii.organization_id
      FROM public.inventory_items ii
      LEFT JOIN public.inventory_item_accounts iia ON iia.item_id = ii.id
      WHERE iia.id IS NULL
    LOOP
      -- Resolve the organization's Inventory asset account with subtype Stock/Stocks
      SELECT a.id INTO v_inv_acc
      FROM public.accounts a
      WHERE a.organization_id = v_item.organization_id
        AND a.account_type = 'Asset'
        AND (a.account_subtype = 'Stock' OR a.account_subtype = 'Stocks')
      ORDER BY a.account_code ASC
      LIMIT 1;

      IF v_inv_acc IS NOT NULL THEN
        INSERT INTO public.inventory_item_accounts (item_id, inventory_account_id, is_taxable)
        VALUES (v_item.item_id, v_inv_acc, false)
        ON CONFLICT (item_id) DO UPDATE SET inventory_account_id = EXCLUDED.inventory_account_id;
      END IF;
    END LOOP;

  END IF;
END $$;