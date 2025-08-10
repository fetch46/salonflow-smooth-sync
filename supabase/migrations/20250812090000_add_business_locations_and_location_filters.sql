-- Add Business Locations and Location Filters for Reporting
BEGIN;

-- 1) Create business_locations table
CREATE TABLE IF NOT EXISTS public.business_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  address TEXT,
  phone TEXT,
  manager_id UUID REFERENCES public.staff(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_business_locations_org ON public.business_locations(organization_id);
CREATE INDEX IF NOT EXISTS idx_business_locations_active ON public.business_locations(is_active);

-- Enable RLS and permissive policy (aligning with existing receipt policies)
ALTER TABLE public.business_locations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'business_locations' AND policyname = 'Public access to business_locations'
  ) THEN
    CREATE POLICY "Public access to business_locations" ON public.business_locations FOR ALL USING (true);
  END IF;
END $$;

-- 2) Add location_id to key operational tables (idempotent)
DO $$ BEGIN
  -- receipts
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='receipts' AND column_name='location_id'
  ) THEN
    ALTER TABLE public.receipts ADD COLUMN location_id UUID REFERENCES public.business_locations(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_receipts_location_id ON public.receipts(location_id);
  END IF;

  -- receipt_items (optional, derive via receipt; add for convenience)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='receipt_items' AND column_name='location_id'
  ) THEN
    ALTER TABLE public.receipt_items ADD COLUMN location_id UUID REFERENCES public.business_locations(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_receipt_items_location_id ON public.receipt_items(location_id);
  END IF;

  -- receipt_payments
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='receipt_payments' AND column_name='location_id'
  ) THEN
    ALTER TABLE public.receipt_payments ADD COLUMN location_id UUID REFERENCES public.business_locations(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_receipt_payments_location_id ON public.receipt_payments(location_id);
  END IF;

  -- expenses
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='expenses' AND column_name='location_id'
  ) THEN
    ALTER TABLE public.expenses ADD COLUMN location_id UUID REFERENCES public.business_locations(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_expenses_location_id ON public.expenses(location_id);
  END IF;

  -- purchases
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='purchases' AND column_name='location_id'
  ) THEN
    ALTER TABLE public.purchases ADD COLUMN location_id UUID REFERENCES public.business_locations(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_purchases_location_id ON public.purchases(location_id);
  END IF;

  -- appointments (for future location-aware scheduling)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='appointments' AND column_name='location_id'
  ) THEN
    ALTER TABLE public.appointments ADD COLUMN location_id UUID REFERENCES public.business_locations(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_appointments_location_id ON public.appointments(location_id);
  END IF;

  -- account_transactions (for P&L and Balance Sheet by location)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='account_transactions' AND column_name='location_id'
  ) THEN
    ALTER TABLE public.account_transactions ADD COLUMN location_id UUID REFERENCES public.business_locations(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_account_transactions_location_id ON public.account_transactions(location_id);
  END IF;
END $$;

-- 3) Update posting functions to carry location_id into the ledger
-- Receipt posting: include location from receipt
CREATE OR REPLACE FUNCTION public.post_receipt_to_ledger()
RETURNS TRIGGER AS $$
DECLARE
  ar_account UUID;
  revenue_account UUID;
BEGIN
  SELECT id INTO ar_account FROM public.accounts 
  WHERE account_code = '1100' AND organization_id = NEW.organization_id
  LIMIT 1;
  SELECT id INTO revenue_account FROM public.accounts 
  WHERE account_code = '4001' AND organization_id = NEW.organization_id
  LIMIT 1;

  IF ar_account IS NOT NULL AND revenue_account IS NOT NULL THEN
    INSERT INTO public.account_transactions (account_id, transaction_date, description, debit_amount, credit_amount, reference_type, reference_id, location_id)
    VALUES (ar_account, CURRENT_DATE, 'Receipt ' || NEW.receipt_number || ' (AR)', NEW.total_amount, 0, 'receipt', NEW.id, NEW.location_id);

    INSERT INTO public.account_transactions (account_id, transaction_date, description, debit_amount, credit_amount, reference_type, reference_id, location_id)
    VALUES (revenue_account, CURRENT_DATE, 'Receipt ' || NEW.receipt_number || ' (Revenue)', 0, NEW.subtotal, 'receipt', NEW.id, NEW.location_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Receipt payment posting: include location from payment if set, else from receipt
CREATE OR REPLACE FUNCTION public.post_receipt_payment_to_ledger()
RETURNS TRIGGER AS $$
DECLARE
  ar_account UUID;
  cash_account UUID;
  v_location UUID;
BEGIN
  SELECT id INTO ar_account FROM public.accounts 
  WHERE account_code = '1100' AND organization_id = NEW.organization_id
  LIMIT 1;

  IF NEW.method = 'cash' OR NEW.method = 'mpesa' THEN
    SELECT id INTO cash_account FROM public.accounts 
    WHERE account_code = '1001' AND organization_id = NEW.organization_id
    LIMIT 1;
  ELSE
    SELECT id INTO cash_account FROM public.accounts 
    WHERE account_code = '1002' AND organization_id = NEW.organization_id
    LIMIT 1;
  END IF;

  -- Determine location
  v_location := NEW.location_id;
  IF v_location IS NULL THEN
    SELECT location_id INTO v_location FROM public.receipts WHERE id = NEW.receipt_id;
  END IF;

  IF cash_account IS NOT NULL AND ar_account IS NOT NULL THEN
    INSERT INTO public.account_transactions (account_id, transaction_date, description, debit_amount, credit_amount, reference_type, reference_id, location_id)
    VALUES (cash_account, NEW.payment_date, 'Receipt Payment', NEW.amount, 0, 'receipt_payment', NEW.id, v_location);

    INSERT INTO public.account_transactions (account_id, transaction_date, description, debit_amount, credit_amount, reference_type, reference_id, location_id)
    VALUES (ar_account, NEW.payment_date, 'Receipt Payment', 0, NEW.amount, 'receipt_payment', NEW.id, v_location);
  END IF;

  UPDATE public.receipts r
  SET amount_paid = COALESCE(r.amount_paid,0) + NEW.amount,
      status = CASE 
        WHEN COALESCE(r.amount_paid,0) + NEW.amount >= r.total_amount THEN 'paid' 
        WHEN COALESCE(r.amount_paid,0) + NEW.amount > 0 THEN 'partial' 
        ELSE r.status END,
      updated_at = now()
  WHERE r.id = NEW.receipt_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Receipt item product posting: include receipt location
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

  SELECT r.*
  INTO rcpt
  FROM public.receipts r
  WHERE r.id = NEW.receipt_id;

  SELECT id INTO inventory_account FROM public.accounts 
  WHERE account_code = '1200' AND organization_id = rcpt.organization_id LIMIT 1;

  SELECT id INTO cogs_account FROM public.accounts 
  WHERE account_code = '5001' AND organization_id = rcpt.organization_id LIMIT 1;

  SELECT cost_price INTO unit_cost FROM public.inventory_items WHERE id = NEW.product_id;
  amt := COALESCE(unit_cost, 0) * COALESCE(NEW.quantity, 1);

  IF amt > 0 AND inventory_account IS NOT NULL AND cogs_account IS NOT NULL THEN
    INSERT INTO public.account_transactions (account_id, transaction_date, description, debit_amount, credit_amount, reference_type, reference_id, location_id)
    VALUES (cogs_account, COALESCE(rcpt.created_at::date, CURRENT_DATE), 'COGS for product on receipt ' || COALESCE(rcpt.receipt_number, ''), amt, 0, 'receipt_item', NEW.id, rcpt.location_id);

    INSERT INTO public.account_transactions (account_id, transaction_date, description, debit_amount, credit_amount, reference_type, reference_id, location_id)
    VALUES (inventory_account, COALESCE(rcpt.created_at::date, CURRENT_DATE), 'Inventory out for receipt ' || COALESCE(rcpt.receipt_number, ''), 0, amt, 'receipt_item', NEW.id, rcpt.location_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Expense posting: include expense location
CREATE OR REPLACE FUNCTION public.post_expense_to_ledger()
RETURNS TRIGGER AS $$
DECLARE
  expense_account UUID;
  cash_or_bank UUID;
  amt NUMERIC;
BEGIN
  SELECT id INTO expense_account FROM public.accounts 
  WHERE account_code = '5400' AND organization_id = NEW.organization_id
  LIMIT 1;

  IF NEW.payment_method = 'Cash' OR NEW.payment_method = 'cash' THEN
    SELECT id INTO cash_or_bank FROM public.accounts 
    WHERE account_code = '1001' AND organization_id = NEW.organization_id
    LIMIT 1;
  ELSE
    SELECT id INTO cash_or_bank FROM public.accounts 
    WHERE account_code = '1002' AND organization_id = NEW.organization_id
    LIMIT 1;
  END IF;

  amt := COALESCE(NEW.amount, 0);

  IF NEW.status = 'paid' AND amt > 0 AND expense_account IS NOT NULL AND cash_or_bank IS NOT NULL THEN
    INSERT INTO public.account_transactions (account_id, transaction_date, description, debit_amount, credit_amount, reference_type, reference_id, location_id)
    VALUES (expense_account, NEW.expense_date, 'Expense ' || NEW.expense_number, amt, 0, 'expense', NEW.id, NEW.location_id);

    INSERT INTO public.account_transactions (account_id, transaction_date, description, debit_amount, credit_amount, reference_type, reference_id, location_id)
    VALUES (cash_or_bank, NEW.expense_date, 'Expense ' || NEW.expense_number, 0, amt, 'expense', NEW.id, NEW.location_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Purchase posting: include purchase location
CREATE OR REPLACE FUNCTION public.post_purchase_to_ledger()
RETURNS TRIGGER AS $$
DECLARE
  inventory_account UUID;
  ap_account UUID;
  amt NUMERIC;
BEGIN
  SELECT id INTO inventory_account FROM public.accounts 
  WHERE account_code = '1200' AND organization_id = NEW.organization_id
  LIMIT 1;
  SELECT id INTO ap_account FROM public.accounts 
  WHERE account_code = '2001' AND organization_id = NEW.organization_id
  LIMIT 1;
  amt := COALESCE(NEW.total_amount, 0);
  IF NEW.status = 'received' AND amt > 0 AND inventory_account IS NOT NULL AND ap_account IS NOT NULL THEN
    INSERT INTO public.account_transactions (account_id, transaction_date, description, debit_amount, credit_amount, reference_type, reference_id, location_id)
    VALUES (inventory_account, NEW.purchase_date, 'Purchase ' || NEW.purchase_number, amt, 0, 'purchase', NEW.id, NEW.location_id);
    INSERT INTO public.account_transactions (account_id, transaction_date, description, debit_amount, credit_amount, reference_type, reference_id, location_id)
    VALUES (ap_account, NEW.purchase_date, 'Purchase ' || NEW.purchase_number, 0, amt, 'purchase', NEW.id, NEW.location_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4) Keep updated_at triggers consistent
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relname = 'business_locations' AND t.tgname = 'update_business_locations_updated_at'
  ) THEN
    EXECUTE 'CREATE TRIGGER update_business_locations_updated_at BEFORE UPDATE ON public.business_locations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
  END IF;
END $$;

-- 5) Refresh PostgREST schema cache
DO $$ BEGIN PERFORM pg_notify('pgrst', 'reload schema'); END $$;

COMMIT;