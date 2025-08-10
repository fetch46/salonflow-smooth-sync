-- Ensure accounts table exists and reload PostgREST schema
-- Safe to re-run

BEGIN;

-- Make sure UUID extension exists for uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1) Ensure accounts table exists
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
    EXECUTE 'CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON public.accounts
             FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
  END IF;
END $$;

-- Ensure per-organization uniqueness (organization_id, account_code)
DO $$
DECLARE
  v_exists boolean;
BEGIN
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

-- 2) Ask PostgREST to reload schema (fixes: Could not find the table "public.accounts" in the schema cache)
DO $$ BEGIN PERFORM pg_notify('pgrst', 'reload schema'); END $$;

COMMIT;