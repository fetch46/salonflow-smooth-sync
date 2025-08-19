-- Reporting core tables: report definitions, favorites, and recent runs
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Report definitions (predefined and custom)
CREATE TABLE IF NOT EXISTS public.report_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,           -- e.g., 'pnl', 'balance_sheet', 'trial_balance', 'revenue_by_location'
  name text NOT NULL,
  description text NULL,
  category text NOT NULL DEFAULT 'Financial',
  config jsonb NOT NULL DEFAULT '{}', -- arbitrary config for renderer/parameters
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- User favorites for quick access
CREATE TABLE IF NOT EXISTS public.report_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  report_key text NOT NULL REFERENCES public.report_definitions(key) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, report_key)
);

-- Recent runs (for caching and audit)
CREATE TABLE IF NOT EXISTS public.report_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_key text NOT NULL REFERENCES public.report_definitions(key) ON DELETE CASCADE,
  user_id uuid NULL,
  organization_id uuid NULL,
  location_id uuid NULL,
  period_start date NULL,
  period_end date NULL,
  params jsonb NOT NULL DEFAULT '{}',
  result jsonb NULL,
  duration_ms integer NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Simple updated_at trigger reused
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_report_definitions_updated_at') THEN
    CREATE TRIGGER trg_report_definitions_updated_at
    BEFORE UPDATE ON public.report_definitions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_report_runs_key_created ON public.report_runs(report_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_runs_org_loc ON public.report_runs(organization_id, location_id);

-- RLS permissive for dev
ALTER TABLE public.report_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_runs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'report_definitions' AND policyname = 'Allow all (report_definitions)'
  ) THEN
    CREATE POLICY "Allow all (report_definitions)" ON public.report_definitions
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'report_favorites' AND policyname = 'Allow all (report_favorites)'
  ) THEN
    CREATE POLICY "Allow all (report_favorites)" ON public.report_favorites
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'report_runs' AND policyname = 'Allow all (report_runs)'
  ) THEN
    CREATE POLICY "Allow all (report_runs)" ON public.report_runs
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Seed basic report definitions
INSERT INTO public.report_definitions (key, name, description, category)
VALUES
  ('pnl', 'Profit & Loss', 'Income, COGS and Expenses over a period', 'Financial'),
  ('balance_sheet', 'Balance Sheet', 'Assets, Liabilities and Equity as of a specific date', 'Financial'),
  ('trial_balance', 'Trial Balance', 'Debits and Credits by account for the selected period', 'Financial'),
  ('revenue_by_location', 'Revenue by Location', 'Income by business location for the selected period', 'Financial'),
  ('invoice_details', 'Invoice Details', 'Invoices with paid and balance for the selected period', 'Financial'),
  ('payment_details', 'Payment Details', 'Payments received with references for the selected period', 'Financial')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category;