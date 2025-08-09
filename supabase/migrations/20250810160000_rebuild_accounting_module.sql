-- Rebuild Accounting Module: accounts + account_transactions and org-safe policies
-- Safe to re-run. Uses guards to avoid duplicate objects.

BEGIN;

-- 1) Ensure accounts table exists and is org-tenant safe
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_code TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL,
  normal_balance TEXT NOT NULL DEFAULT 'debit',
  description TEXT,
  balance DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  parent_account_id UUID REFERENCES public.accounts(id),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure updated_at trigger exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relname = 'accounts' AND t.tgname = 'update_accounts_updated_at'
  ) THEN
    -- The function update_updated_at_column should already exist from base schema
    EXECUTE 'CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON public.accounts
             FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
  END IF;
END $$;

-- Drop global-unique on account_code if present; replace with per-org unique
DO $$
DECLARE
  v_constraint_name text;
  v_exists boolean;
BEGIN
  -- Find a unique constraint on only (account_code)
  SELECT pc.conname
  INTO v_constraint_name
  FROM pg_constraint pc
  JOIN pg_class c ON c.oid = pc.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'accounts'
    AND pc.contype = 'u'
    AND (SELECT array_agg(att.attname ORDER BY att.attnum)
         FROM unnest(pc.conkey) WITH ORDINALITY AS cols(attnum, ord)
         JOIN pg_attribute att ON att.attrelid = pc.conrelid AND att.attnum = cols.attnum
        ) = ARRAY['account_code'];

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.accounts DROP CONSTRAINT %I', v_constraint_name);
  END IF;

  -- Ensure per-organization uniqueness exists
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint pc
    JOIN pg_class c ON c.oid = pc.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'accounts'
      AND pc.contype = 'u'
      AND (SELECT array_agg(att.attname ORDER BY att.attnum)
           FROM unnest(pc.conkey) WITH ORDINALITY AS cols(attnum, ord)
           JOIN pg_attribute att ON att.attrelid = pc.conrelid AND att.attnum = cols.attnum
          ) = ARRAY['organization_id','account_code']
  ) INTO v_exists;

  IF NOT v_exists THEN
    EXECUTE 'ALTER TABLE public.accounts
             ADD CONSTRAINT accounts_org_code_unique UNIQUE (organization_id, account_code)';
  END IF;
END $$;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_accounts_organization_id ON public.accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_accounts_code ON public.accounts(account_code);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON public.accounts(account_type);

-- 2) Ensure account_transactions exists
CREATE TABLE IF NOT EXISTS public.account_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL,
  description TEXT NOT NULL,
  debit_amount DECIMAL(10,2) DEFAULT 0,
  credit_amount DECIMAL(10,2) DEFAULT 0,
  reference_type TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_transactions_account_id ON public.account_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_account_transactions_date ON public.account_transactions(transaction_date);

-- 3) RLS: enable and add org-safe policies for account_transactions using account -> organization join
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_transactions ENABLE ROW LEVEL SECURITY;

-- Create policies for account_transactions only if they don't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='account_transactions'
      AND policyname='Org users can SELECT account_transactions'
  ) THEN
    EXECUTE $$CREATE POLICY "Org users can SELECT account_transactions" ON public.account_transactions
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.accounts a
          JOIN public.organization_users ou ON ou.organization_id = a.organization_id
          WHERE a.id = account_transactions.account_id
            AND ou.user_id = auth.uid()
            AND ou.is_active = true
        )
      )$$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='account_transactions'
      AND policyname='Org users can INSERT account_transactions'
  ) THEN
    EXECUTE $$CREATE POLICY "Org users can INSERT account_transactions" ON public.account_transactions
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.accounts a
          JOIN public.organization_users ou ON ou.organization_id = a.organization_id
          WHERE a.id = account_transactions.account_id
            AND ou.user_id = auth.uid()
            AND ou.role IN ('owner','admin','manager','staff')
            AND ou.is_active = true
        )
      )$$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='account_transactions'
      AND policyname='Org users can UPDATE account_transactions'
  ) THEN
    EXECUTE $$CREATE POLICY "Org users can UPDATE account_transactions" ON public.account_transactions
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.accounts a
          JOIN public.organization_users ou ON ou.organization_id = a.organization_id
          WHERE a.id = account_transactions.account_id
            AND ou.user_id = auth.uid()
            AND ou.role IN ('owner','admin','manager','staff')
            AND ou.is_active = true
        )
      )$$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='account_transactions'
      AND policyname='Org admins can DELETE account_transactions'
  ) THEN
    EXECUTE $$CREATE POLICY "Org admins can DELETE account_transactions" ON public.account_transactions
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM public.accounts a
          JOIN public.organization_users ou ON ou.organization_id = a.organization_id
          WHERE a.id = account_transactions.account_id
            AND ou.user_id = auth.uid()
            AND ou.role IN ('owner','admin')
            AND ou.is_active = true
        )
      )$$;
  END IF;
END $$;

-- 4) Seed helper: setup_new_organization (idempotent)
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

  -- Default accounts per organization (safe on re-run)
  INSERT INTO public.accounts (organization_id, account_code, account_name, account_type, normal_balance, description, balance, is_active)
  VALUES
    (org_id, '1001', 'Cash', 'Asset', 'debit', 'Cash on hand and in registers', 0, true),
    (org_id, '1002', 'Bank Account', 'Asset', 'debit', 'Primary business bank account', 0, true),
    (org_id, '1100', 'Accounts Receivable', 'Asset', 'debit', 'Money owed by customers', 0, true),
    (org_id, '1200', 'Inventory', 'Asset', 'debit', 'Inventory on hand', 0, true),
    (org_id, '2001', 'Accounts Payable', 'Liability', 'credit', 'Money owed to suppliers', 0, true),
    (org_id, '2100', 'Sales Tax Payable', 'Liability', 'credit', 'Sales tax collected', 0, true),
    (org_id, '3001', 'Owner Equity', 'Equity', 'credit', 'Owner investment', 0, true),
    (org_id, '3002', 'Retained Earnings', 'Equity', 'credit', 'Accumulated profits', 0, true),
    (org_id, '4001', 'Services Revenue', 'Income', 'credit', 'Revenue from services', 0, true),
    (org_id, '4002', 'Product Sales Revenue', 'Income', 'credit', 'Revenue from product sales', 0, true),
    (org_id, '5001', 'Cost of Goods Sold', 'Expense', 'debit', 'Direct cost of products sold', 0, true),
    (org_id, '5100', 'Staff Wages', 'Expense', 'debit', 'Salaries and wages', 0, true),
    (org_id, '5200', 'Rent Expense', 'Expense', 'debit', 'Premises rent', 0, true),
    (org_id, '5300', 'Utilities Expense', 'Expense', 'debit', 'Electricity, water, internet', 0, true),
    (org_id, '5400', 'Supplies Expense', 'Expense', 'debit', 'General supplies', 0, true)
  ON CONFLICT (organization_id, account_code) DO NOTHING;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.setup_new_organization(UUID) TO authenticated;

-- 5) Convenience view: trial balance per organization
CREATE OR REPLACE VIEW public.vw_trial_balance AS
SELECT 
  a.organization_id,
  a.id AS account_id,
  a.account_code,
  a.account_name,
  a.account_type,
  a.normal_balance,
  COALESCE(SUM(atx.debit_amount),0) AS total_debits,
  COALESCE(SUM(atx.credit_amount),0) AS total_credits,
  COALESCE(SUM(atx.debit_amount - atx.credit_amount),0) AS net_debit,
  COALESCE(SUM(atx.credit_amount - atx.debit_amount),0) AS net_credit
FROM public.accounts a
LEFT JOIN public.account_transactions atx ON atx.account_id = a.id
GROUP BY a.organization_id, a.id, a.account_code, a.account_name, a.account_type, a.normal_balance;

-- 6) Ask PostgREST to reload schema to avoid cache errors
-- This fixes: "Could not find the table 'public.accounts' in the schema cache"
DO $$ BEGIN PERFORM pg_notify('pgrst', 'reload schema'); END $$;

COMMIT;