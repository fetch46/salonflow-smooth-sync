-- Purchase Receiving and Payments Migration
-- 1) Inventory updates when purchase items are received
-- 2) Update purchase status based on received quantities
-- 3) Purchase payments table and RPC with double-entry journal posting

-- Ensure pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Create purchase_payments table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'purchase_payments'
  ) THEN
    EXECUTE $$
      CREATE TABLE public.purchase_payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
        purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
        account_id UUID NOT NULL REFERENCES public.accounts(id),
        amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
        payment_date DATE NOT NULL,
        reference TEXT NULL,
        notes TEXT NULL,
        created_by UUID NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    $$;
    -- Optional indexes
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_purchase_payments_purchase_id ON public.purchase_payments(purchase_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_purchase_payments_org ON public.purchase_payments(organization_id)';
  END IF;
END $$;

-- 2. Ensure inventory_levels has a unique constraint to upsert by (item_id, location_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint c
    JOIN   pg_class t ON t.oid = c.conrelid
    JOIN   pg_namespace n ON n.oid = t.relnamespace
    WHERE  n.nspname='public' AND t.relname='inventory_levels' AND c.conname='inventory_levels_item_location_key'
  ) THEN
    BEGIN
      ALTER TABLE public.inventory_levels
      ADD CONSTRAINT inventory_levels_item_location_key UNIQUE (item_id, location_id);
    EXCEPTION WHEN duplicate_table THEN
      -- ignore
      NULL;
    END;
  END IF;
END $$;

-- 3. Function to apply inventory changes and update purchase status when items are received
CREATE OR REPLACE FUNCTION public.apply_purchase_receipt()
RETURNS TRIGGER AS $$
DECLARE
  v_delta NUMERIC;
  v_location_id UUID;
  v_total_qty NUMERIC;
  v_total_received NUMERIC;
  v_status TEXT;
BEGIN
  v_delta := COALESCE(NEW.received_quantity, 0) - COALESCE(OLD.received_quantity, 0);

  -- Update inventory_levels at the purchase's receiving location
  SELECT p.location_id INTO v_location_id
  FROM public.purchases p
  WHERE p.id = NEW.purchase_id;

  IF v_delta <> 0 AND v_location_id IS NOT NULL THEN
    -- Upsert inventory level for the item at this location
    INSERT INTO public.inventory_levels (item_id, location_id, quantity)
    VALUES (NEW.item_id, v_location_id, GREATEST(0, v_delta))
    ON CONFLICT (item_id, location_id)
    DO UPDATE SET quantity = GREATEST(0, COALESCE(public.inventory_levels.quantity, 0) + EXCLUDED.quantity - GREATEST(0, 0));

    -- If delta was negative (undo), adjust directly
    IF v_delta < 0 THEN
      UPDATE public.inventory_levels
      SET quantity = GREATEST(0, COALESCE(quantity, 0) + v_delta)
      WHERE item_id = NEW.item_id AND location_id = v_location_id;
    END IF;
  END IF;

  -- Update purchase status based on totals
  SELECT COALESCE(SUM(quantity), 0), COALESCE(SUM(received_quantity), 0)
  INTO v_total_qty, v_total_received
  FROM public.purchase_items
  WHERE purchase_id = NEW.purchase_id;

  IF v_total_received <= 0 THEN
    v_status := 'pending';
  ELSIF v_total_received < v_total_qty THEN
    v_status := 'partial';
  ELSE
    v_status := 'received';
  END IF;

  UPDATE public.purchases
  SET status = v_status
  WHERE id = NEW.purchase_id AND COALESCE(status, '') IS DISTINCT FROM v_status;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger to call the function after purchase_items.received_quantity changes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_purchase_items_after_receive'
  ) THEN
    CREATE TRIGGER trg_purchase_items_after_receive
    AFTER UPDATE OF received_quantity ON public.purchase_items
    FOR EACH ROW
    EXECUTE FUNCTION public.apply_purchase_receipt();
  END IF;
END $$;

-- 5. Helper: find account id by account_code within organization
CREATE OR REPLACE FUNCTION public.get_account_id_by_code(p_org_id UUID, p_code TEXT)
RETURNS UUID AS $$
DECLARE v_id UUID; BEGIN
  SELECT id INTO v_id FROM public.accounts WHERE organization_id = p_org_id AND account_code = p_code LIMIT 1;
  RETURN v_id;
END; $$ LANGUAGE plpgsql STABLE;

-- 6. RPC: pay_purchase - record payment and post ledger (Dr A/P 2001, Cr selected Cash/Bank)
CREATE OR REPLACE FUNCTION public.pay_purchase(
  p_org_id UUID,
  p_purchase_id UUID,
  p_account_id UUID,
  p_amount NUMERIC,
  p_payment_date DATE,
  p_reference TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_ap_account_id UUID;
  v_purchase_org UUID;
  v_purchase_number TEXT;
BEGIN
  IF COALESCE(p_amount, 0) <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Validate purchase belongs to org
  SELECT organization_id, purchase_number INTO v_purchase_org, v_purchase_number
  FROM public.purchases WHERE id = p_purchase_id;
  IF v_purchase_org IS NULL OR v_purchase_org <> p_org_id THEN
    RAISE EXCEPTION 'Purchase does not belong to this organization';
  END IF;

  -- Insert payment row
  INSERT INTO public.purchase_payments (
    organization_id, purchase_id, account_id, amount, payment_date, reference, notes
  ) VALUES (
    p_org_id, p_purchase_id, p_account_id, p_amount, p_payment_date, p_reference, p_notes
  );

  -- Find Accounts Payable account (code 2001)
  v_ap_account_id := public.get_account_id_by_code(p_org_id, '2001');
  IF v_ap_account_id IS NULL THEN
    RAISE EXCEPTION 'Accounts Payable (2001) account not found for organization';
  END IF;

  -- Post double-entry to account_transactions
  INSERT INTO public.account_transactions (
    account_id, transaction_date, description, debit_amount, credit_amount, reference_type, reference_id
  ) VALUES
    (v_ap_account_id, p_payment_date, CONCAT('Purchase ', COALESCE(v_purchase_number, p_purchase_id::text), ' payment'), p_amount, 0, 'purchase_payment', p_purchase_id::text),
    (p_account_id,  p_payment_date, CONCAT('Purchase ', COALESCE(v_purchase_number, p_purchase_id::text), ' payment'), 0, p_amount, 'purchase_payment', p_purchase_id::text);

  -- If fully paid, mark purchase as closed
  PERFORM 1 FROM public.purchases WHERE id = p_purchase_id; -- ensure row exists
  WITH agg AS (
    SELECT COALESCE(SUM(pp.amount), 0) AS paid
    FROM public.purchase_payments pp
    WHERE pp.purchase_id = p_purchase_id
  ), tot AS (
    SELECT total_amount FROM public.purchases WHERE id = p_purchase_id
  )
  UPDATE public.purchases p
  SET status = 'closed'
  FROM agg, tot
  WHERE p.id = p_purchase_id
    AND COALESCE(agg.paid, 0) >= COALESCE(tot.total_amount, 0)
    AND p.status IS DISTINCT FROM 'closed';

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.pay_purchase(UUID, UUID, UUID, NUMERIC, DATE, TEXT, TEXT) TO authenticated;