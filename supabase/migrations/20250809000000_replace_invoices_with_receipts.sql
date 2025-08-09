-- Replace Invoices with Receipts and add posting triggers

-- 1) Drop invoice tables if they exist
DROP TABLE IF EXISTS public.invoice_items CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;

-- 2) Create receipts tables
CREATE TABLE IF NOT EXISTS public.receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_number TEXT NOT NULL UNIQUE,
  customer_id UUID REFERENCES public.clients(id),
  job_card_id UUID REFERENCES public.job_cards(id),
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  amount_paid NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','partial','paid','cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add organization_id to receipts if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='receipts' AND column_name='organization_id'
  ) THEN
    ALTER TABLE public.receipts ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.receipt_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_id UUID NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id),
  product_id UUID REFERENCES public.inventory_items(id),
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_price NUMERIC NOT NULL DEFAULT 0,
  staff_id UUID REFERENCES public.staff(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add organization_id to receipt_items if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='receipt_items' AND column_name='organization_id'
  ) THEN
    ALTER TABLE public.receipt_items ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.receipt_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_id UUID NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL CHECK (method IN ('cash','card','bank_transfer','mpesa')),
  reference_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add organization_id to receipt_payments if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='receipt_payments' AND column_name='organization_id'
  ) THEN
    ALTER TABLE public.receipt_payments ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 3) Enable RLS
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_payments ENABLE ROW LEVEL SECURITY;

-- Public policies (adjust per auth model)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'receipts' AND policyname = 'Public access to receipts'
  ) THEN
    CREATE POLICY "Public access to receipts" ON public.receipts FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'receipt_items' AND policyname = 'Public access to receipt_items'
  ) THEN
    CREATE POLICY "Public access to receipt_items" ON public.receipt_items FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'receipt_payments' AND policyname = 'Public access to receipt_payments'
  ) THEN
    CREATE POLICY "Public access to receipt_payments" ON public.receipt_payments FOR ALL USING (true);
  END IF;
END $$;

-- 4) Indexes
CREATE INDEX IF NOT EXISTS idx_receipts_number ON public.receipts(receipt_number);
CREATE INDEX IF NOT EXISTS idx_receipts_customer ON public.receipts(customer_id);
CREATE INDEX IF NOT EXISTS idx_receipts_status ON public.receipts(status);
CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt_id ON public.receipt_items(receipt_id);
CREATE INDEX IF NOT EXISTS idx_receipt_payments_receipt_id ON public.receipt_payments(receipt_id);

-- 5) Triggers for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_receipts_updated_at
  BEFORE UPDATE ON public.receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_receipt_items_updated_at
  BEFORE UPDATE ON public.receipt_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_receipt_payments_updated_at
  BEFORE UPDATE ON public.receipt_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 6) Posting triggers to account_transactions
-- Helper: post AR and Revenue on receipt creation
CREATE OR REPLACE FUNCTION public.post_receipt_to_ledger()
RETURNS TRIGGER AS $$
DECLARE
  ar_account UUID;
  revenue_account UUID;
BEGIN
  -- Get Accounts Receivable and default Services Revenue accounts for same org
  SELECT id INTO ar_account FROM public.accounts 
  WHERE account_code = '1100' AND organization_id = NEW.organization_id
  LIMIT 1;
  SELECT id INTO revenue_account FROM public.accounts 
  WHERE account_code = '4001' AND organization_id = NEW.organization_id
  LIMIT 1;

  IF ar_account IS NOT NULL AND revenue_account IS NOT NULL THEN
    -- Debit Accounts Receivable
    INSERT INTO public.account_transactions (account_id, transaction_date, description, debit_amount, credit_amount, reference_type, reference_id)
    VALUES (ar_account, CURRENT_DATE, 'Receipt ' || NEW.receipt_number || ' (AR)', NEW.total_amount, 0, 'receipt', NEW.id);

    -- Credit Revenue
    INSERT INTO public.account_transactions (account_id, transaction_date, description, debit_amount, credit_amount, reference_type, reference_id)
    VALUES (revenue_account, CURRENT_DATE, 'Receipt ' || NEW.receipt_number || ' (Revenue)', 0, NEW.subtotal, 'receipt', NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_post_receipt_to_ledger ON public.receipts;
CREATE TRIGGER trg_post_receipt_to_ledger
AFTER INSERT ON public.receipts
FOR EACH ROW
EXECUTE FUNCTION public.post_receipt_to_ledger();

-- Post Cash/Bank and reduce AR on payment
CREATE OR REPLACE FUNCTION public.post_receipt_payment_to_ledger()
RETURNS TRIGGER AS $$
DECLARE
  ar_account UUID;
  cash_account UUID;
BEGIN
  SELECT id INTO ar_account FROM public.accounts 
  WHERE account_code = '1100' AND organization_id = NEW.organization_id
  LIMIT 1;

  -- Map method to cash/bank accounts within org
  IF NEW.method = 'cash' OR NEW.method = 'mpesa' THEN
    SELECT id INTO cash_account FROM public.accounts 
    WHERE account_code = '1001' AND organization_id = NEW.organization_id
    LIMIT 1; -- Cash
  ELSE
    SELECT id INTO cash_account FROM public.accounts 
    WHERE account_code = '1002' AND organization_id = NEW.organization_id
    LIMIT 1; -- Bank
  END IF;

  IF cash_account IS NOT NULL AND ar_account IS NOT NULL THEN
    -- Debit Cash/Bank
    INSERT INTO public.account_transactions (account_id, transaction_date, description, debit_amount, credit_amount, reference_type, reference_id)
    VALUES (cash_account, NEW.payment_date, 'Receipt Payment', NEW.amount, 0, 'receipt_payment', NEW.id);

    -- Credit Accounts Receivable
    INSERT INTO public.account_transactions (account_id, transaction_date, description, debit_amount, credit_amount, reference_type, reference_id)
    VALUES (ar_account, NEW.payment_date, 'Receipt Payment', 0, NEW.amount, 'receipt_payment', NEW.id);
  END IF;

  -- Update receipt summary
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

DROP TRIGGER IF EXISTS trg_post_receipt_payment_to_ledger ON public.receipt_payments;
CREATE TRIGGER trg_post_receipt_payment_to_ledger
AFTER INSERT ON public.receipt_payments
FOR EACH ROW
EXECUTE FUNCTION public.post_receipt_payment_to_ledger();