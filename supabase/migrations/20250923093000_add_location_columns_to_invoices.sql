-- Add location_id to invoices and invoice_items, with safe guards and indexes
DO $$
BEGIN
  -- invoices.location_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'location_id'
  ) THEN
    ALTER TABLE public.invoices ADD COLUMN location_id uuid NULL;
  END IF;

  -- invoice_items.location_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoice_items' AND column_name = 'location_id'
  ) THEN
    ALTER TABLE public.invoice_items ADD COLUMN location_id uuid NULL;
  END IF;
END $$;

-- Add FKs if business_locations exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'business_locations'
  ) THEN
    -- invoices FK
    IF NOT EXISTS (
      SELECT 1 
      FROM information_schema.table_constraints tc
      WHERE tc.table_schema = 'public' AND tc.table_name = 'invoices' AND tc.constraint_type = 'FOREIGN KEY'
        AND tc.constraint_name = 'invoices_location_id_fkey'
    ) THEN
      ALTER TABLE public.invoices
        ADD CONSTRAINT invoices_location_id_fkey
        FOREIGN KEY (location_id) REFERENCES public.business_locations(id) ON DELETE SET NULL;
    END IF;

    -- invoice_items FK
    IF NOT EXISTS (
      SELECT 1 
      FROM information_schema.table_constraints tc
      WHERE tc.table_schema = 'public' AND tc.table_name = 'invoice_items' AND tc.constraint_type = 'FOREIGN KEY'
        AND tc.constraint_name = 'invoice_items_location_id_fkey'
    ) THEN
      ALTER TABLE public.invoice_items
        ADD CONSTRAINT invoice_items_location_id_fkey
        FOREIGN KEY (location_id) REFERENCES public.business_locations(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_location_id ON public.invoices(location_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_location_id ON public.invoice_items(location_id);