BEGIN;

-- 1) Create accounts table if missing (tenant-aware)
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_code TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('Asset','Liability','Equity','Income','Expense')),
  account_subtype TEXT,
  normal_balance TEXT NOT NULL DEFAULT 'debit' CHECK (normal_balance IN ('debit','credit')),
  description TEXT,
  balance NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  parent_account_id UUID REFERENCES public.accounts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure per-organization unique account code
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'accounts_org_code_unique'
  ) THEN
    ALTER TABLE public.accounts
      ADD CONSTRAINT accounts_org_code_unique UNIQUE (organization_id, account_code);
  END IF;
END$$;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_accounts_org ON public.accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_accounts_code ON public.accounts(account_code);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON public.accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_accounts_subtype ON public.accounts(account_subtype);

-- 2) updated_at trigger (ensure function exists and trigger is set)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'update_updated_at_column'
  ) THEN
    EXECUTE $$CREATE OR REPLACE FUNCTION public.update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;$$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relname = 'accounts' AND t.tgname = 'update_accounts_updated_at'
  ) THEN
    EXECUTE 'CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON public.accounts
             FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
  END IF;
END$$;

-- 3) Enable RLS and add org-safe policies
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- SELECT policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='accounts' AND policyname='Org users can SELECT accounts'
  ) THEN
    EXECUTE $$CREATE POLICY "Org users can SELECT accounts" ON public.accounts
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.organization_users ou
          WHERE ou.organization_id = accounts.organization_id
            AND ou.user_id = auth.uid()
            AND ou.is_active = true
        )
      )$$;
  END IF;
END$$;

-- INSERT policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='accounts' AND policyname='Org users can INSERT accounts'
  ) THEN
    EXECUTE $$CREATE POLICY "Org users can INSERT accounts" ON public.accounts
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.organization_users ou
          WHERE ou.organization_id = accounts.organization_id
            AND ou.user_id = auth.uid()
            AND ou.role IN ('owner','admin','manager','staff')
            AND ou.is_active = true
        )
      )$$;
  END IF;
END$$;

-- UPDATE policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='accounts' AND policyname='Org users can UPDATE accounts'
  ) THEN
    EXECUTE $$CREATE POLICY "Org users can UPDATE accounts" ON public.accounts
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.organization_users ou
          WHERE ou.organization_id = accounts.organization_id
            AND ou.user_id = auth.uid()
            AND ou.role IN ('owner','admin','manager','staff')
            AND ou.is_active = true
        )
      )$$;
  END IF;
END$$;

-- DELETE policy (admins/owners)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='accounts' AND policyname='Org admins can DELETE accounts'
  ) THEN
    EXECUTE $$CREATE POLICY "Org admins can DELETE accounts" ON public.accounts
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM public.organization_users ou
          WHERE ou.organization_id = accounts.organization_id
            AND ou.user_id = auth.uid()
            AND ou.role IN ('owner','admin')
            AND ou.is_active = true
        )
      )$$;
  END IF;
END$$;

-- 4) Refresh PostgREST schema cache to fix: "Could not find the table 'public.accounts' in the schema cache"
DO $$ BEGIN PERFORM pg_notify('pgrst', 'reload schema'); END $$;

COMMIT;