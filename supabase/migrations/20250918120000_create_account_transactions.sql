-- Create account_transactions table to support double-entry ledger
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.account_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  transaction_date date NOT NULL DEFAULT (now()::date),
  description text NULL,
  debit_amount numeric(14,2) NOT NULL DEFAULT 0,
  credit_amount numeric(14,2) NOT NULL DEFAULT 0,
  reference_type text NULL,
  reference_id text NULL,
  location_id uuid NULL REFERENCES public.business_locations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_account_transactions_account ON public.account_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_account_transactions_date ON public.account_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_account_transactions_ref ON public.account_transactions(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_account_transactions_location ON public.account_transactions(location_id);

-- Row Level Security
ALTER TABLE public.account_transactions ENABLE ROW LEVEL SECURITY;

-- Simple permissive RLS (adjust for production)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'account_transactions' AND policyname = 'Allow all (account_transactions)'
  ) THEN
    CREATE POLICY "Allow all (account_transactions)" ON public.account_transactions
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- RPC to delete by reference (used by app for best-effort cleanup)
CREATE OR REPLACE FUNCTION public.delete_account_transactions_by_reference(
  p_reference_type text,
  p_reference_id text
) RETURNS bigint AS $$
DECLARE
  deleted_count bigint;
BEGIN
  DELETE FROM public.account_transactions
  WHERE reference_type = p_reference_type
    AND reference_id = p_reference_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.delete_account_transactions_by_reference(text, text) TO anon, authenticated;