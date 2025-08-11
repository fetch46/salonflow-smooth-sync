-- Migration: Add Bank/Cash Reconciliation and Accounting Period Locking
-- Dependencies: accounts, account_transactions, purchases, expenses, receipt_payments (if exist)

-- Create enum for reconciliation status
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reconciliation_status') THEN
    CREATE TYPE reconciliation_status AS ENUM ('open', 'reconciled', 'locked');
  END IF;
END $$;

-- Accounting periods table for locking
CREATE TABLE IF NOT EXISTS accounting_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open','locked')) DEFAULT 'locked',
  reason TEXT,
  locked_by UUID,
  locked_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (organization_id, period_start, period_end)
);

-- Bank statements header
CREATE TABLE IF NOT EXISTS bank_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  statement_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  opening_balance NUMERIC(14,2),
  closing_balance NUMERIC(14,2),
  uploaded_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Bank statement lines
CREATE TABLE IF NOT EXISTS bank_statement_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id UUID NOT NULL REFERENCES bank_statements(id) ON DELETE CASCADE,
  line_date DATE NOT NULL,
  description TEXT,
  debit NUMERIC(14,2) DEFAULT 0,
  credit NUMERIC(14,2) DEFAULT 0,
  amount NUMERIC(14,2) GENERATED ALWAYS AS (COALESCE(credit,0) - COALESCE(debit,0)) STORED,
  balance NUMERIC(14,2),
  external_reference TEXT,
  hash TEXT,
  matched BOOLEAN DEFAULT false,
  matched_transaction_id UUID,
  reconciled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bank_statement_lines_statement_hash ON bank_statement_lines(statement_id, hash) WHERE hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bank_statement_lines_statement_date ON bank_statement_lines(statement_id, line_date);

-- Reconciliation summary per account & period
CREATE TABLE IF NOT EXISTS bank_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  starting_balance NUMERIC(14,2),
  ending_balance NUMERIC(14,2),
  status reconciliation_status NOT NULL DEFAULT 'open',
  reconciled_by UUID,
  reconciled_at TIMESTAMPTZ,
  UNIQUE (organization_id, account_id, period_start, period_end)
);

-- Matches between statement lines and ledger transactions
CREATE TABLE IF NOT EXISTS bank_reconciliation_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id UUID NOT NULL REFERENCES bank_reconciliations(id) ON DELETE CASCADE,
  statement_line_id UUID NOT NULL REFERENCES bank_statement_lines(id) ON DELETE CASCADE,
  account_transaction_id UUID NOT NULL REFERENCES account_transactions(id) ON DELETE CASCADE,
  match_amount NUMERIC(14,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (statement_line_id, account_transaction_id)
);

-- Helper function: check if a date is in a locked period for an org
CREATE OR REPLACE FUNCTION is_date_locked(p_org UUID, p_date DATE)
RETURNS BOOLEAN AS $$
DECLARE
  v_locked BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM accounting_periods ap
    WHERE ap.organization_id = p_org
      AND ap.status = 'locked'
      AND p_date BETWEEN ap.period_start AND ap.period_end
  ) INTO v_locked;
  RETURN COALESCE(v_locked, false);
END;
$$ LANGUAGE plpgsql STABLE;

-- Trigger function to prevent changes during locked periods
CREATE OR REPLACE FUNCTION prevent_locked_period_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_org UUID;
  v_date DATE;
  v_row JSONB;
  v_date_text TEXT;
  v_location UUID;
BEGIN
  v_row := to_jsonb(NEW);

  IF TG_TABLE_NAME = 'receipt_payments' THEN
    v_date := COALESCE(NEW.payment_date, CURRENT_DATE);
    -- Try to get organization_id via receipts -> organization_id or via receipt.location_id -> business_locations
    SELECT r.organization_id, r.location_id INTO v_org, v_location FROM receipts r WHERE r.id = NEW.receipt_id LIMIT 1;
    IF v_org IS NULL AND v_location IS NOT NULL THEN
      SELECT bl.organization_id INTO v_org FROM business_locations bl WHERE bl.id = v_location LIMIT 1;
    END IF;
  ELSIF TG_TABLE_NAME = 'purchases' THEN
    v_org := COALESCE((v_row->>'organization_id')::uuid, NULL);
    v_location := COALESCE((v_row->>'location_id')::uuid, NULL);
    v_date_text := COALESCE(v_row->>'purchase_date', v_row->>'created_at');
    v_date := COALESCE(NULLIF(v_date_text, '')::date, CURRENT_DATE);
    IF v_org IS NULL AND v_location IS NOT NULL THEN
      SELECT bl.organization_id INTO v_org FROM business_locations bl WHERE bl.id = v_location LIMIT 1;
    END IF;
  ELSIF TG_TABLE_NAME = 'expenses' THEN
    v_org := COALESCE((v_row->>'organization_id')::uuid, NULL);
    v_location := COALESCE((v_row->>'location_id')::uuid, NULL);
    v_date_text := COALESCE(v_row->>'expense_date', v_row->>'created_at');
    v_date := COALESCE(NULLIF(v_date_text, '')::date, CURRENT_DATE);
    IF v_org IS NULL AND v_location IS NOT NULL THEN
      SELECT bl.organization_id INTO v_org FROM business_locations bl WHERE bl.id = v_location LIMIT 1;
    END IF;
  ELSIF TG_TABLE_NAME = 'bank_transfers' THEN
    v_org := COALESCE((v_row->>'organization_id')::uuid, NULL);
    v_date_text := COALESCE(v_row->>'transfer_date', v_row->>'created_at');
    v_date := COALESCE(NULLIF(v_date_text, '')::date, CURRENT_DATE);
  ELSIF TG_TABLE_NAME = 'sales' THEN
    v_org := COALESCE((v_row->>'organization_id')::uuid, NULL);
    v_location := COALESCE((v_row->>'location_id')::uuid, NULL);
    v_date_text := COALESCE(v_row->>'sale_date', v_row->>'created_at');
    v_date := COALESCE(NULLIF(v_date_text, '')::date, CURRENT_DATE);
    IF v_org IS NULL AND v_location IS NOT NULL THEN
      SELECT bl.organization_id INTO v_org FROM business_locations bl WHERE bl.id = v_location LIMIT 1;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  IF v_org IS NULL THEN
    RETURN NEW; -- cannot determine org; do not block
  END IF;

  IF is_date_locked(v_org, v_date) THEN
    RAISE EXCEPTION 'Accounting period is locked for date %', v_date USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Optional bank transfers table if not exists
CREATE TABLE IF NOT EXISTS bank_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  from_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  to_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  transfer_date DATE NOT NULL,
  reference TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Attach triggers to key posting tables if they exist
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='receipt_payments') THEN
    DROP TRIGGER IF EXISTS trg_prevent_locked_period_changes_on_receipt_payments ON receipt_payments;
    CREATE TRIGGER trg_prevent_locked_period_changes_on_receipt_payments
      BEFORE INSERT OR UPDATE ON receipt_payments
      FOR EACH ROW EXECUTE FUNCTION prevent_locked_period_changes();
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='purchases') THEN
    DROP TRIGGER IF EXISTS trg_prevent_locked_period_changes_on_purchases ON purchases;
    CREATE TRIGGER trg_prevent_locked_period_changes_on_purchases
      BEFORE INSERT OR UPDATE ON purchases
      FOR EACH ROW EXECUTE FUNCTION prevent_locked_period_changes();
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='expenses') THEN
    DROP TRIGGER IF EXISTS trg_prevent_locked_period_changes_on_expenses ON expenses;
    CREATE TRIGGER trg_prevent_locked_period_changes_on_expenses
      BEFORE INSERT OR UPDATE ON expenses
      FOR EACH ROW EXECUTE FUNCTION prevent_locked_period_changes();
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='bank_transfers') THEN
    DROP TRIGGER IF EXISTS trg_prevent_locked_period_changes_on_bank_transfers ON bank_transfers;
    CREATE TRIGGER trg_prevent_locked_period_changes_on_bank_transfers
      BEFORE INSERT OR UPDATE ON bank_transfers
      FOR EACH ROW EXECUTE FUNCTION prevent_locked_period_changes();
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='sales') THEN
    DROP TRIGGER IF EXISTS trg_prevent_locked_period_changes_on_sales ON sales;
    CREATE TRIGGER trg_prevent_locked_period_changes_on_sales
      BEFORE INSERT OR UPDATE ON sales
      FOR EACH ROW EXECUTE FUNCTION prevent_locked_period_changes();
  END IF;
END $$;

-- Indices
CREATE INDEX IF NOT EXISTS idx_accounting_periods_org_dates ON accounting_periods(organization_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_bank_statements_org_account ON bank_statements(organization_id, account_id);

-- RLS policies (basic, may need refinement in project)
ALTER TABLE accounting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_statement_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_reconciliation_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transfers ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to access rows by their organization via organizations mapping
-- Note: adjust to your app's RLS model; placeholder policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='accounting_periods' AND policyname='org_members_can_manage_accounting_periods'
  ) THEN
    CREATE POLICY org_members_can_manage_accounting_periods ON accounting_periods
      USING (organization_id IN (SELECT organization_id FROM organization_users WHERE user_id = auth.uid()))
      WITH CHECK (organization_id IN (SELECT organization_id FROM organization_users WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bank_statements' AND policyname='org_members_can_manage_bank_statements'
  ) THEN
    CREATE POLICY org_members_can_manage_bank_statements ON bank_statements
      USING (organization_id IN (SELECT organization_id FROM organization_users WHERE user_id = auth.uid()))
      WITH CHECK (organization_id IN (SELECT organization_id FROM organization_users WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bank_statement_lines' AND policyname='org_members_can_manage_bank_statement_lines'
  ) THEN
    CREATE POLICY org_members_can_manage_bank_statement_lines ON bank_statement_lines
      USING ((SELECT organization_id FROM bank_statements bs WHERE bs.id = statement_id) IN (SELECT organization_id FROM organization_users WHERE user_id = auth.uid()))
      WITH CHECK ((SELECT organization_id FROM bank_statements bs WHERE bs.id = statement_id) IN (SELECT organization_id FROM organization_users WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bank_reconciliations' AND policyname='org_members_can_manage_bank_reconciliations'
  ) THEN
    CREATE POLICY org_members_can_manage_bank_reconciliations ON bank_reconciliations
      USING (organization_id IN (SELECT organization_id FROM organization_users WHERE user_id = auth.uid()))
      WITH CHECK (organization_id IN (SELECT organization_id FROM organization_users WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bank_reconciliation_matches' AND policyname='org_members_can_manage_bank_reconciliation_matches'
  ) THEN
    CREATE POLICY org_members_can_manage_bank_reconciliation_matches ON bank_reconciliation_matches
      USING ((SELECT organization_id FROM bank_reconciliations br WHERE br.id = reconciliation_id) IN (SELECT organization_id FROM organization_users WHERE user_id = auth.uid()))
      WITH CHECK ((SELECT organization_id FROM bank_reconciliations br WHERE br.id = reconciliation_id) IN (SELECT organization_id FROM organization_users WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bank_transfers' AND policyname='org_members_can_manage_bank_transfers'
  ) THEN
    CREATE POLICY org_members_can_manage_bank_transfers ON bank_transfers
      USING (organization_id IN (SELECT organization_id FROM organization_users WHERE user_id = auth.uid()))
      WITH CHECK (organization_id IN (SELECT organization_id FROM organization_users WHERE user_id = auth.uid()));
  END IF;
END $$;

-- RPC: delete a receipt payment and its ledger entries
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'delete_receipt_payment_and_ledger'
  ) THEN
    CREATE OR REPLACE FUNCTION public.delete_receipt_payment_and_ledger(
      p_payment_id UUID
    ) RETURNS BOOLEAN AS $$
    DECLARE
      v_receipt_id UUID;
      v_payment_date DATE;
      v_org UUID;
    BEGIN
      -- Find receipt and date for period lock check
      SELECT rp.receipt_id, rp.payment_date INTO v_receipt_id, v_payment_date
      FROM public.receipt_payments rp
      WHERE rp.id = p_payment_id;

      IF v_receipt_id IS NULL THEN
        RETURN FALSE;
      END IF;

      -- Determine organization via receipt or receipt->location
      SELECT r.organization_id INTO v_org FROM public.receipts r WHERE r.id = v_receipt_id;

      IF v_org IS NOT NULL AND is_date_locked(v_org, COALESCE(v_payment_date, CURRENT_DATE)) THEN
        RAISE EXCEPTION 'Accounting period is locked for date %', v_payment_date USING ERRCODE = 'P0001';
      END IF;

      -- Delete ledger entries that match this specific payment (by reference + date + amount)
      DELETE FROM public.account_transactions atx
      WHERE atx.reference_type = 'receipt_payment'
        AND atx.reference_id = v_receipt_id::text
        AND atx.transaction_date = COALESCE(v_payment_date, CURRENT_DATE)
        AND (
          atx.debit_amount = (SELECT COALESCE(amount, 0) FROM public.receipt_payments WHERE id = p_payment_id)
          OR atx.credit_amount = (SELECT COALESCE(amount, 0) FROM public.receipt_payments WHERE id = p_payment_id)
        );

      -- Delete the payment itself
      DELETE FROM public.receipt_payments WHERE id = p_payment_id;

      RETURN TRUE;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    GRANT EXECUTE ON FUNCTION public.delete_receipt_payment_and_ledger(UUID) TO authenticated;
  END IF;
END $$;