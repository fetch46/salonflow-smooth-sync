-- Create accounts table and rebuild function
-- Safe, idempotent migration for Supabase (Postgres)

-- Ensure extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Common updated_at trigger function (idempotent)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

-- accounts table
CREATE TABLE IF NOT EXISTS public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_code text NOT NULL,
  account_name text NOT NULL,
  account_type text NOT NULL CHECK (account_type IN ('Asset','Liability','Equity','Income','Expense')),
  account_subtype text NULL, -- e.g., 'Stock' for inventory assets
  normal_balance text NOT NULL CHECK (normal_balance IN ('debit','credit')),
  description text NULL,
  balance numeric(14,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  parent_account_id uuid NULL REFERENCES public.accounts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, account_code)
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_accounts_org ON public.accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON public.accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_accounts_subtype ON public.accounts(account_subtype);
CREATE INDEX IF NOT EXISTS idx_accounts_parent ON public.accounts(parent_account_id);

-- updated_at trigger
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_accounts_updated_at') THEN
    CREATE TRIGGER trg_accounts_updated_at BEFORE UPDATE ON public.accounts
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- Enable RLS and permissive policy for dev/demo (tighten for prod)
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'accounts' AND policyname = 'Allow all (accounts)'
  ) THEN
    CREATE POLICY "Allow all (accounts)" ON public.accounts
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- RPC to rebuild chart of accounts per-organization (idempotent upsert; optional cleanup)
CREATE OR REPLACE FUNCTION public.rebuild_organization_chart_of_accounts(
  p_organization_id uuid,
  p_force boolean DEFAULT false
) RETURNS json AS $$
DECLARE
  v_inserted int := 0;
  v_updated int := 0;
  v_deleted int := 0;
BEGIN
  -- Validate org exists
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_organization_id) THEN
    RAISE EXCEPTION 'Organization % does not exist', p_organization_id;
  END IF;

  WITH default_accounts(code, name, type, subtype, normal_balance, description) AS (
    VALUES
      ('1001','Cash','Asset','Cash','debit','Cash on hand and in registers'),
      ('1002','Bank Account','Asset','Bank','debit','Primary business bank account'),
      ('1100','Accounts Receivable','Asset','Accounts Receivable','debit','Money owed by customers'),
      ('1200','Inventory','Asset','Stock','debit','Inventory on hand'),
      ('1500','Equipment','Asset','Fixed Asset','debit','Equipment and fixtures'),
      ('2001','Accounts Payable','Liability','Accounts Payable','credit','Money owed to suppliers'),
      ('2100','Sales Tax Payable','Liability','Current Liability','credit','Sales tax collected'),
      ('2300','Unearned Revenue','Liability','Current Liability','credit','Customer deposits/advance payments'),
      ('3001','Owner Equity','Equity','Equity','credit','Owner investment'),
      ('3002','Retained Earnings','Equity','Equity','credit','Accumulated profits'),
      ('4001','Service Revenue','Income','Income','credit','Revenue from services'),
      ('4002','Product Sales Revenue','Income','Income','credit','Revenue from product sales'),
      ('5001','Cost of Goods Sold','Expense','Cost of Goods Sold','debit','Cost of products sold'),
      ('5100','Staff Wages','Expense','Expense','debit','Salaries and wages'),
      ('5200','Rent Expense','Expense','Expense','debit','Premises rent'),
      ('5300','Utilities Expense','Expense','Expense','debit','Electricity, water, internet'),
      ('5400','Supplies Expense','Expense','Expense','debit','General supplies'),
      ('5500','Marketing Expense','Expense','Expense','debit','Advertising and promotion')
  ), upserted AS (
    INSERT INTO public.accounts (
      organization_id, account_code, account_name, account_type, account_subtype, normal_balance, description, is_active
    )
    SELECT p_organization_id, code, name, type, subtype, normal_balance, description, true
    FROM default_accounts da
    ON CONFLICT (organization_id, account_code) DO UPDATE SET
      account_name = EXCLUDED.account_name,
      account_type = EXCLUDED.account_type,
      account_subtype = EXCLUDED.account_subtype,
      normal_balance = EXCLUDED.normal_balance,
      description = EXCLUDED.description,
      is_active = true
    RETURNING (xmax = 0) AS was_insert
  )
  SELECT 
    SUM(CASE WHEN was_insert THEN 1 ELSE 0 END)::int,
    SUM(CASE WHEN NOT was_insert THEN 1 ELSE 0 END)::int
  INTO v_inserted, v_updated
  FROM upserted;

  IF p_force THEN
    WITH default_codes AS (
      SELECT code FROM (
        VALUES
          ('1001'),('1002'),('1100'),('1200'),('1500'),('2001'),('2100'),('2300'),
          ('3001'),('3002'),('4001'),('4002'),('5001'),('5100'),('5200'),('5300'),('5400'),('5500')
      ) AS t(code)
    ), deletable AS (
      SELECT a.id
      FROM public.accounts a
      LEFT JOIN default_codes dc ON a.account_code = dc.code
      WHERE a.organization_id = p_organization_id
        AND dc.code IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.inventory_item_accounts iia
          WHERE iia.sales_account_id = a.id OR iia.purchase_account_id = a.id OR iia.inventory_account_id = a.id
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.account_transactions atx WHERE atx.account_id = a.id
        )
    ), deleted AS (
      DELETE FROM public.accounts a
      USING deletable d
      WHERE a.id = d.id
      RETURNING 1
    )
    SELECT COUNT(*)::int INTO v_deleted FROM deleted;
  END IF;

  RETURN json_build_object('inserted', v_inserted, 'updated', v_updated, 'deleted', v_deleted);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.rebuild_organization_chart_of_accounts(uuid, boolean) TO anon, authenticated;