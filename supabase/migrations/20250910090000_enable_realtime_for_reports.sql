-- Enable Realtime for P&L-related tables so frontend can auto-refresh on deletes
DO $$ BEGIN
  -- Ensure publication exists and add account_transactions
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'account_transactions'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.account_transactions';
    END IF;

    -- Add expenses
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'expenses'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses';
    END IF;

    -- Add receipt_payments if table exists
    IF EXISTS (
      SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='receipt_payments'
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'receipt_payments'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.receipt_payments';
    END IF;
  ELSE
    -- Fallback: create publication including these tables if publication missing (non-standard in Supabase)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='receipt_payments') THEN
      EXECUTE 'CREATE PUBLICATION supabase_realtime FOR TABLE public.account_transactions, public.expenses, public.receipt_payments';
    ELSE
      EXECUTE 'CREATE PUBLICATION supabase_realtime FOR TABLE public.account_transactions, public.expenses';
    END IF;
  END IF;
END $$;