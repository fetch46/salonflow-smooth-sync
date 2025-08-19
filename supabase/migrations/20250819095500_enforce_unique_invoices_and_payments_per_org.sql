-- Enforce per-organization uniqueness for invoices and payments (received and made)
-- Safe and idempotent where possible

-- 0) Ensure extensions used for UUIDs are present
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Invoices: make invoice_number unique per organization (drop global UNIQUE if present)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.invoices'::regclass
      AND contype = 'u'
      AND conname = 'invoices_invoice_number_key'
  ) THEN
    ALTER TABLE public.invoices DROP CONSTRAINT invoices_invoice_number_key;
  END IF;
END $$;

-- 1a) De-duplicate any existing duplicates within an organization on (organization_id, invoice_number)
WITH ranked AS (
  SELECT
    id,
    organization_id,
    invoice_number,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY organization_id, invoice_number
      ORDER BY created_at NULLS LAST, id
    ) AS rn
  FROM public.invoices
)
UPDATE public.invoices i
SET invoice_number = i.invoice_number || '-' || ranked.rn
FROM ranked
WHERE i.id = ranked.id AND ranked.rn > 1;

-- 1b) Create composite unique index per organization
CREATE UNIQUE INDEX IF NOT EXISTS ux_invoices_org_invoice_number
  ON public.invoices(organization_id, invoice_number);

-- 2) Invoice payments (payments received): ensure table exists and enforce unique reference per organization when provided
CREATE TABLE IF NOT EXISTS public.invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NULL,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  method text NULL,
  reference_number text NULL,
  payment_date date NOT NULL DEFAULT (now()::date),
  location_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2a) Add FK for organization_id if organizations table exists
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organizations'
  ) THEN
    ALTER TABLE public.invoice_payments
    DROP CONSTRAINT IF EXISTS invoice_payments_organization_id_fkey;
    ALTER TABLE public.invoice_payments
    ADD CONSTRAINT invoice_payments_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 2b) Backfill organization_id on invoice_payments from invoices
UPDATE public.invoice_payments p
SET organization_id = i.organization_id
FROM public.invoices i
WHERE p.invoice_id = i.id AND p.organization_id IS NULL;

-- 2c) Helpful indexes
CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON public.invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_date ON public.invoice_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_org ON public.invoice_payments(organization_id);

-- 2d) De-duplicate reference_number per organization (allow multiple NULLs)
DO $$
DECLARE dup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT organization_id, reference_number
    FROM public.invoice_payments
    WHERE reference_number IS NOT NULL AND organization_id IS NOT NULL
    GROUP BY organization_id, reference_number
    HAVING COUNT(*) > 1
  ) d;

  IF dup_count > 0 THEN
    WITH ranked AS (
      SELECT 
        id,
        organization_id,
        reference_number,
        created_at,
        ROW_NUMBER() OVER (PARTITION BY organization_id, reference_number ORDER BY created_at NULLS LAST, id) AS rn
      FROM public.invoice_payments
      WHERE reference_number IS NOT NULL AND organization_id IS NOT NULL
    )
    UPDATE public.invoice_payments p
    SET reference_number = NULL
    FROM ranked r
    WHERE p.id = r.id AND r.rn > 1;
  END IF;
END $$;

-- 2e) Enforce unique reference per org when provided
CREATE UNIQUE INDEX IF NOT EXISTS ux_invoice_payments_org_reference
  ON public.invoice_payments(organization_id, reference_number)
  WHERE reference_number IS NOT NULL AND organization_id IS NOT NULL;

-- 2f) RLS and permissive policy for dev/demo (match purchase_payments)
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'invoice_payments' AND policyname = 'Allow all (invoice_payments)'
  ) THEN
    CREATE POLICY "Allow all (invoice_payments)" ON public.invoice_payments
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 2g) Trigger to keep invoice_payments.organization_id synced with invoices
CREATE OR REPLACE FUNCTION public.set_invoice_payments_org_id()
RETURNS trigger AS $$
BEGIN
  IF NEW.invoice_id IS NOT NULL THEN
    SELECT i.organization_id INTO NEW.organization_id FROM public.invoices i WHERE i.id = NEW.invoice_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_invoice_payments_org_id ON public.invoice_payments;
CREATE TRIGGER trg_set_invoice_payments_org_id
BEFORE INSERT OR UPDATE OF invoice_id ON public.invoice_payments
FOR EACH ROW EXECUTE FUNCTION public.set_invoice_payments_org_id();

-- 3) Purchase payments (payments made): enforce unique reference per organization when provided
-- 3a) De-duplicate existing rows on (organization_id, reference) allowing multiple NULLs
DO $$
DECLARE pp_dup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO pp_dup_count
  FROM (
    SELECT organization_id, reference
    FROM public.purchase_payments
    WHERE reference IS NOT NULL AND organization_id IS NOT NULL
    GROUP BY organization_id, reference
    HAVING COUNT(*) > 1
  ) d;

  IF pp_dup_count > 0 THEN
    WITH ranked AS (
      SELECT 
        id,
        organization_id,
        reference,
        created_at,
        ROW_NUMBER() OVER (PARTITION BY organization_id, reference ORDER BY created_at NULLS LAST, id) AS rn
      FROM public.purchase_payments
      WHERE reference IS NOT NULL AND organization_id IS NOT NULL
    )
    UPDATE public.purchase_payments p
    SET reference = NULL
    FROM ranked r
    WHERE p.id = r.id AND r.rn > 1;
  END IF;
END $$;

-- 3b) Create unique index per organization for purchase payment reference
CREATE UNIQUE INDEX IF NOT EXISTS ux_purchase_payments_org_reference
  ON public.purchase_payments(organization_id, reference)
  WHERE reference IS NOT NULL AND organization_id IS NOT NULL;

-- 3c) Trigger to keep purchase_payments.organization_id synced with purchases
CREATE OR REPLACE FUNCTION public.set_purchase_payments_org_id()
RETURNS trigger AS $$
BEGIN
  IF NEW.purchase_id IS NOT NULL THEN
    SELECT p.organization_id INTO NEW.organization_id FROM public.purchases p WHERE p.id = NEW.purchase_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_purchase_payments_org_id ON public.purchase_payments;
CREATE TRIGGER trg_set_purchase_payments_org_id
BEFORE INSERT OR UPDATE OF purchase_id ON public.purchase_payments
FOR EACH ROW EXECUTE FUNCTION public.set_purchase_payments_org_id();

