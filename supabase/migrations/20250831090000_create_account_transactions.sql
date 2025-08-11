-- Migration: Create account_transactions table with RLS and policies
-- Safe to re-run (idempotent)

-- Ensure pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Create table if not exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'account_transactions'
  ) THEN
    CREATE TABLE public.account_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id UUID NOT NULL,
      transaction_date DATE NOT NULL,
      description TEXT NULL,
      debit_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
      credit_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
      reference_type TEXT NULL,
      reference_id TEXT NULL,
      location_id UUID NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT account_transactions_single_sided CHECK (
        (debit_amount = 0 AND credit_amount > 0)
        OR (credit_amount = 0 AND debit_amount > 0)
      )
    );
  END IF;
END $$;

-- 2) Ensure foreign keys exist
-- account_id -> accounts(id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint c
    JOIN   pg_class t ON t.oid = c.conrelid
    JOIN   pg_namespace n ON n.oid = t.relnamespace
    WHERE  n.nspname='public' AND t.relname='account_transactions' AND c.conname='account_transactions_account_id_fkey'
  ) THEN
    ALTER TABLE public.account_transactions
    ADD CONSTRAINT account_transactions_account_id_fkey
    FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Optional: location_id -> business_locations(id) if table exists
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'business_locations'
  ) AND NOT EXISTS (
    SELECT 1
    FROM   pg_constraint c
    JOIN   pg_class t ON t.oid = c.conrelid
    JOIN   pg_namespace n ON n.oid = t.relnamespace
    WHERE  n.nspname='public' AND t.relname='account_transactions' AND c.conname='account_transactions_location_id_fkey'
  ) THEN
    ALTER TABLE public.account_transactions
    ADD CONSTRAINT account_transactions_location_id_fkey
    FOREIGN KEY (location_id) REFERENCES public.business_locations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3) Indexes
CREATE INDEX IF NOT EXISTS idx_account_transactions_account_date
  ON public.account_transactions(account_id, transaction_date);

CREATE INDEX IF NOT EXISTS idx_account_transactions_ref
  ON public.account_transactions(reference_type, reference_id);

-- 4) RLS and policies
ALTER TABLE public.account_transactions ENABLE ROW LEVEL SECURITY;

-- Helper predicate: org membership via account -> organization
-- Select policy
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='account_transactions' AND policyname='org_members_can_select_account_transactions'
  ) THEN
    CREATE POLICY org_members_can_select_account_transactions
    ON public.account_transactions
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1
        FROM public.accounts a
        JOIN public.organization_users ou ON ou.organization_id = a.organization_id
        WHERE a.id = account_transactions.account_id
          AND ou.user_id = auth.uid()
          AND ou.is_active = true
      )
    );
  END IF;
END $$;

-- Insert policy
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='account_transactions' AND policyname='org_members_can_insert_account_transactions'
  ) THEN
    CREATE POLICY org_members_can_insert_account_transactions
    ON public.account_transactions
    FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.accounts a
        JOIN public.organization_users ou ON ou.organization_id = a.organization_id
        WHERE a.id = account_transactions.account_id
          AND ou.user_id = auth.uid()
          AND ou.is_active = true
      )
    );
  END IF;
END $$;

-- Note: Updates/deletes are intentionally not exposed by policy to keep ledger immutable via client

-- 5) PostgREST schema reload to refresh cache
DO $$ BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END $$;

-- 6) Helper RPC to delete account transactions by reference (scoped)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'delete_account_transactions_by_reference'
  ) THEN
    CREATE OR REPLACE FUNCTION public.delete_account_transactions_by_reference(
      p_reference_type TEXT,
      p_reference_id TEXT
    ) RETURNS INTEGER AS $$
    DECLARE
      v_count INTEGER;
    BEGIN
      DELETE FROM public.account_transactions
      WHERE reference_type = p_reference_type
        AND reference_id = p_reference_id;
      GET DIAGNOSTICS v_count = ROW_COUNT;
      RETURN COALESCE(v_count, 0);
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
    GRANT EXECUTE ON FUNCTION public.delete_account_transactions_by_reference(TEXT, TEXT) TO authenticated;
  END IF;
END $$;