BEGIN;

-- 1) Update setup_new_organization to insert account_subtype
CREATE OR REPLACE FUNCTION public.setup_new_organization(org_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_user UUID;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  -- Verify user is owner of this organization
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_users 
    WHERE organization_id = org_id 
      AND user_id = v_user 
      AND role = 'owner' 
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'User must be owner of organization';
  END IF;

  -- Default accounts per organization with subtypes (idempotent)
  INSERT INTO public.accounts (organization_id, account_code, account_name, account_type, account_subtype, normal_balance, description, balance, is_active)
  VALUES
    (org_id, '1001', 'Cash', 'Asset', 'Cash', 'debit', 'Cash on hand and in registers', 0, true),
    (org_id, '1002', 'Bank Account', 'Asset', 'Bank', 'debit', 'Primary business bank account', 0, true),
    (org_id, '1100', 'Accounts Receivable', 'Asset', 'Accounts Receivable', 'debit', 'Money owed by customers', 0, true),
    (org_id, '1200', 'Inventory', 'Asset', 'Stock', 'debit', 'Inventory on hand', 0, true),
    (org_id, '2001', 'Accounts Payable', 'Liability', 'Accounts Payable', 'credit', 'Money owed to suppliers', 0, true),
    (org_id, '2100', 'Sales Tax Payable', 'Liability', 'Current Liability', 'credit', 'Sales tax collected', 0, true),
    (org_id, '3001', 'Owner Equity', 'Equity', 'Equity', 'credit', 'Owner investment', 0, true),
    (org_id, '3002', 'Retained Earnings', 'Equity', 'Equity', 'credit', 'Accumulated profits', 0, true),
    (org_id, '4001', 'Services Revenue', 'Income', 'Income', 'credit', 'Revenue from services', 0, true),
    (org_id, '4002', 'Product Sales Revenue', 'Income', 'Income', 'credit', 'Revenue from product sales', 0, true),
    (org_id, '5001', 'Cost of Goods Sold', 'Expense', 'Cost of Goods Sold', 'debit', 'Direct cost of products sold', 0, true),
    (org_id, '5100', 'Staff Wages', 'Expense', 'Expense', 'debit', 'Salaries and wages', 0, true),
    (org_id, '5200', 'Rent Expense', 'Expense', 'Expense', 'debit', 'Premises rent', 0, true),
    (org_id, '5300', 'Utilities Expense', 'Expense', 'Expense', 'debit', 'Electricity, water, internet', 0, true),
    (org_id, '5400', 'Supplies Expense', 'Expense', 'Expense', 'debit', 'General supplies', 0, true)
  ON CONFLICT (organization_id, account_code) DO NOTHING;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.setup_new_organization(UUID) TO authenticated;

-- 2) Post COGS and Inventory credit when a product receipt item is created
CREATE OR REPLACE FUNCTION public.post_receipt_item_product_to_ledger()
RETURNS TRIGGER AS $$
DECLARE
  inventory_account UUID;
  cogs_account UUID;
  unit_cost NUMERIC;
  amt NUMERIC;
  rcpt RECORD;
BEGIN
  IF NEW.product_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT r.*, a_org.id AS ar_id
  INTO rcpt
  FROM public.receipts r
  LEFT JOIN public.accounts a_org ON a_org.account_code = '1100' AND a_org.organization_id = r.organization_id
  WHERE r.id = NEW.receipt_id;

  -- Resolve accounts within same organization as the receipt
  SELECT id INTO inventory_account FROM public.accounts 
  WHERE account_code = '1200' AND organization_id = rcpt.organization_id LIMIT 1;

  SELECT id INTO cogs_account FROM public.accounts 
  WHERE account_code = '5001' AND organization_id = rcpt.organization_id LIMIT 1;

  SELECT cost_price INTO unit_cost FROM public.inventory_items WHERE id = NEW.product_id;

  amt := COALESCE(unit_cost, 0) * COALESCE(NEW.quantity, 1);

  IF amt > 0 AND inventory_account IS NOT NULL AND cogs_account IS NOT NULL THEN
    -- Debit COGS
    INSERT INTO public.account_transactions (account_id, transaction_date, description, debit_amount, credit_amount, reference_type, reference_id)
    VALUES (cogs_account, COALESCE(rcpt.created_at::date, CURRENT_DATE), 'COGS for product on receipt ' || COALESCE(rcpt.receipt_number, ''), amt, 0, 'receipt_item', NEW.id);

    -- Credit Inventory
    INSERT INTO public.account_transactions (account_id, transaction_date, description, debit_amount, credit_amount, reference_type, reference_id)
    VALUES (inventory_account, COALESCE(rcpt.created_at::date, CURRENT_DATE), 'Inventory out for receipt ' || COALESCE(rcpt.receipt_number, ''), 0, amt, 'receipt_item', NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_post_receipt_item_product_to_ledger ON public.receipt_items;
CREATE TRIGGER trg_post_receipt_item_product_to_ledger
AFTER INSERT ON public.receipt_items
FOR EACH ROW
EXECUTE FUNCTION public.post_receipt_item_product_to_ledger();

-- 3) Refresh schema cache
DO $$ BEGIN PERFORM pg_notify('pgrst', 'reload schema'); END $$;

COMMIT;