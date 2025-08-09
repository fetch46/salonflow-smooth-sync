BEGIN;

-- Add account_subtype column if missing
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS account_subtype TEXT;

-- Drop existing subtype constraint if present to allow updates
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounts_subtype_valid') THEN
    ALTER TABLE public.accounts DROP CONSTRAINT accounts_subtype_valid;
  END IF;
END $$;

-- Add constraint for valid (type, subtype) combinations
ALTER TABLE public.accounts
ADD CONSTRAINT accounts_subtype_valid
CHECK (
  (account_type = 'Asset' AND account_subtype IN ('Cash','Bank','Fixed Asset','Accounts Receivable','Stock','Inventory'))
  OR (account_type = 'Income' AND account_subtype IN ('Income','Other Income'))
  OR (account_type = 'Liability' AND account_subtype IN ('Accounts Payable','Current Liability','Other Liability','Non Current Liability'))
  OR (account_type = 'Expense' AND account_subtype IN ('Expense','Cost of Goods Sold','Other Expense'))
  OR (account_type = 'Equity' AND account_subtype IN ('Equity'))
);

-- Backfill common defaults by well-known codes
UPDATE public.accounts SET account_subtype = 'Cash' WHERE account_code = '1001' AND (account_subtype IS NULL OR account_subtype = '');
UPDATE public.accounts SET account_subtype = 'Bank' WHERE account_code = '1002' AND (account_subtype IS NULL OR account_subtype = '');
UPDATE public.accounts SET account_subtype = 'Accounts Receivable' WHERE account_code = '1100' AND (account_subtype IS NULL OR account_subtype = '');
UPDATE public.accounts SET account_subtype = 'Stock' WHERE account_code = '1200' AND (account_subtype IS NULL OR account_subtype = '');
UPDATE public.accounts SET account_subtype = 'Accounts Payable' WHERE account_code = '2001' AND (account_subtype IS NULL OR account_subtype = '');
UPDATE public.accounts SET account_subtype = 'Current Liability' WHERE account_code = '2100' AND (account_subtype IS NULL OR account_subtype = '');
UPDATE public.accounts SET account_subtype = 'Equity' WHERE account_code IN ('3001','3002') AND (account_subtype IS NULL OR account_subtype = '');
UPDATE public.accounts SET account_subtype = 'Income' WHERE account_code IN ('4001','4002') AND (account_subtype IS NULL OR account_subtype = '');
UPDATE public.accounts SET account_subtype = 'Cost of Goods Sold' WHERE account_code = '5001' AND (account_subtype IS NULL OR account_subtype = '');
UPDATE public.accounts SET account_subtype = 'Expense' WHERE account_code IN ('5100','5200','5300','5400','5500') AND (account_subtype IS NULL OR account_subtype = '');

-- Helpful index
CREATE INDEX IF NOT EXISTS idx_accounts_subtype ON public.accounts(account_subtype);

-- Ask PostgREST to reload schema
DO $$ BEGIN PERFORM pg_notify('pgrst', 'reload schema'); END $$;

COMMIT;