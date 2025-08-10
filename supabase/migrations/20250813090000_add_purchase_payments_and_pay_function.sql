-- Create purchase_payments table and pay_purchase function
BEGIN;

-- 1) purchase_payments table
CREATE TABLE IF NOT EXISTS public.purchase_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference TEXT,
  notes TEXT,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_payments_purchase_id ON public.purchase_payments(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_payments_account_id ON public.purchase_payments(account_id);
CREATE INDEX IF NOT EXISTS idx_purchase_payments_org ON public.purchase_payments(organization_id);

-- Enable RLS and tenant policy
ALTER TABLE public.purchase_payments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN PERFORM 1 FROM pg_proc WHERE proname = 'create_tenant_policy'; END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='purchase_payments'
  ) THEN
    PERFORM public.create_tenant_policy('purchase_payments');
  END IF;
END $$;

-- 2) Posting function for purchase payment to ledger (AP vs Cash/Bank)
CREATE OR REPLACE FUNCTION public.post_purchase_payment_to_ledger()
RETURNS TRIGGER AS $$
DECLARE
  ap_account UUID;
BEGIN
  -- Find Accounts Payable (2001) within same organization
  SELECT a.id INTO ap_account
  FROM public.accounts a
  WHERE a.organization_id = NEW.organization_id AND a.account_code = '2001'
  LIMIT 1;

  IF ap_account IS NULL THEN
    -- If AP not found, do nothing
    RETURN NEW;
  END IF;

  -- Debit Accounts Payable
  INSERT INTO public.account_transactions (account_id, transaction_date, description, debit_amount, credit_amount, reference_type, reference_id)
  VALUES (ap_account, NEW.payment_date, 'Payment for Purchase', NEW.amount, 0, 'purchase_payment', NEW.id);

  -- Credit selected cash/bank account
  INSERT INTO public.account_transactions (account_id, transaction_date, description, debit_amount, credit_amount, reference_type, reference_id)
  VALUES (NEW.account_id, NEW.payment_date, 'Payment for Purchase', 0, NEW.amount, 'purchase_payment', NEW.id);

  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_post_purchase_payment_to_ledger ON public.purchase_payments;
CREATE TRIGGER trg_post_purchase_payment_to_ledger
AFTER INSERT ON public.purchase_payments
FOR EACH ROW
EXECUTE FUNCTION public.post_purchase_payment_to_ledger();

-- 3) RPC: pay_purchase - inserts payment, subtracts from account balance safely, posts ledger via trigger
CREATE OR REPLACE FUNCTION public.pay_purchase(
  p_org_id UUID,
  p_purchase_id UUID,
  p_account_id UUID,
  p_amount NUMERIC,
  p_payment_date DATE DEFAULT CURRENT_DATE,
  p_reference TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_total NUMERIC;
  v_paid_to_date NUMERIC;
  v_org_check UUID;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than 0';
  END IF;

  -- Validate purchase belongs to org
  SELECT organization_id, total_amount INTO v_org_check, v_total FROM public.purchases WHERE id = p_purchase_id;
  IF v_org_check IS NULL OR v_org_check <> p_org_id THEN
    RAISE EXCEPTION 'Purchase does not belong to organization';
  END IF;

  -- Validate account belongs to org
  IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE id = p_account_id AND organization_id = p_org_id) THEN
    RAISE EXCEPTION 'Account does not belong to organization';
  END IF;

  -- Sum previous payments for this purchase
  SELECT COALESCE(SUM(amount), 0) INTO v_paid_to_date
  FROM public.purchase_payments
  WHERE purchase_id = p_purchase_id;

  IF v_paid_to_date + p_amount > v_total THEN
    RAISE EXCEPTION 'Payment exceeds remaining balance. Remaining: %', (v_total - v_paid_to_date);
  END IF;

  -- Insert payment
  INSERT INTO public.purchase_payments (purchase_id, account_id, amount, payment_date, reference, notes, organization_id)
  VALUES (p_purchase_id, p_account_id, p_amount, COALESCE(p_payment_date, CURRENT_DATE), p_reference, p_notes, p_org_id);

  -- Subtract from account balance (cash/bank)
  UPDATE public.accounts SET balance = COALESCE(balance,0) - p_amount, updated_at = NOW() WHERE id = p_account_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.pay_purchase(UUID, UUID, UUID, NUMERIC, DATE, TEXT, TEXT) TO authenticated;

COMMIT;