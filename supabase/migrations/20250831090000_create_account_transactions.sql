-- Minimal account_transactions table to satisfy references
CREATE TABLE IF NOT EXISTS public.account_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  account_id UUID,
  amount NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.account_transactions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='account_transactions' AND policyname='Allow all (account_transactions)'
  ) THEN
    CREATE POLICY "Allow all (account_transactions)" ON public.account_transactions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;