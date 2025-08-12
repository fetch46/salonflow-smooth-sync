-- Purchase receiving helpers and payments infrastructure
-- Safe, idempotent migration

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Purchase payments table
CREATE TABLE IF NOT EXISTS public.purchase_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NULL,
  purchase_id uuid NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  account_id uuid NULL REFERENCES public.accounts(id) ON DELETE SET NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  payment_date date NOT NULL DEFAULT (now()::date),
  reference text NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure org FK if organizations table exists
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organizations'
  ) THEN
    ALTER TABLE public.purchase_payments
    DROP CONSTRAINT IF EXISTS purchase_payments_organization_id_fkey;
    ALTER TABLE public.purchase_payments
    ADD CONSTRAINT purchase_payments_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_purchase_payments_purchase ON public.purchase_payments(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_payments_account ON public.purchase_payments(account_id);
CREATE INDEX IF NOT EXISTS idx_purchase_payments_date ON public.purchase_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_purchase_payments_org ON public.purchase_payments(organization_id);

-- RLS permissive for dev/demo
ALTER TABLE public.purchase_payments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'purchase_payments' AND policyname = 'Allow all (purchase_payments)'
  ) THEN
    CREATE POLICY "Allow all (purchase_payments)" ON public.purchase_payments
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- RPC: pay_purchase
-- Records a payment and posts ledger entries: Dr AP (2001), Cr Cash/Bank (p_account_id)
CREATE OR REPLACE FUNCTION public.pay_purchase(
  p_org_id uuid,
  p_purchase_id uuid,
  p_account_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_reference text,
  p_notes text
) RETURNS uuid AS $$
DECLARE
  v_payment_id uuid;
  v_ap_account_id uuid;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Resolve Accounts Payable account (code 2001) within org
  SELECT id INTO v_ap_account_id
  FROM public.accounts
  WHERE organization_id = p_org_id AND account_code = '2001'
  LIMIT 1;

  IF v_ap_account_id IS NULL THEN
    RAISE EXCEPTION 'Accounts Payable (2001) account not found for organization %', p_org_id;
  END IF;

  INSERT INTO public.purchase_payments (
    organization_id, purchase_id, account_id, amount, payment_date, reference, notes
  ) VALUES (
    p_org_id, p_purchase_id, p_account_id, p_amount, COALESCE(p_payment_date, now()::date), p_reference, p_notes
  ) RETURNING id INTO v_payment_id;

  -- Post ledger: Dr AP, Cr Cash/Bank
  INSERT INTO public.account_transactions (
    account_id, transaction_date, description, debit_amount, credit_amount, reference_type, reference_id
  ) VALUES
    (v_ap_account_id, COALESCE(p_payment_date, now()::date), 'Purchase payment', p_amount, 0, 'purchase_payment', p_purchase_id::text),
    (p_account_id, COALESCE(p_payment_date, now()::date), 'Purchase payment', 0, p_amount, 'purchase_payment', p_purchase_id::text);

  RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.pay_purchase(uuid, uuid, uuid, numeric, date, text, text) TO anon, authenticated;