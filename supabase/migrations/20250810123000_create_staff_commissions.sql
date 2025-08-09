-- Create staff_commissions table and triggers to compute commissions from receipt_items

-- 1) Table
CREATE TABLE IF NOT EXISTS public.staff_commissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID REFERENCES public.staff(id),
  receipt_id UUID NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
  receipt_item_id UUID NOT NULL REFERENCES public.receipt_items(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id),
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 0, -- percentage at time of posting
  gross_amount NUMERIC NOT NULL DEFAULT 0,         -- quantity * unit_price
  commission_amount NUMERIC NOT NULL DEFAULT 0,    -- gross_amount * commission_rate / 100
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','paid','void')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (receipt_item_id)
);

-- 2) RLS and permissive policy (adjust per tenancy model)
ALTER TABLE public.staff_commissions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'staff_commissions' AND policyname = 'Public access to staff_commissions'
  ) THEN
    CREATE POLICY "Public access to staff_commissions" ON public.staff_commissions FOR ALL USING (true);
  END IF;
END $$;

-- 3) Indexes
CREATE INDEX IF NOT EXISTS idx_staff_commissions_staff_id ON public.staff_commissions(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_commissions_receipt_id ON public.staff_commissions(receipt_id);
CREATE INDEX IF NOT EXISTS idx_staff_commissions_status ON public.staff_commissions(status);

-- 4) updated_at trigger (reuse shared helper if present)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_staff_commissions_updated_at ON public.staff_commissions;
CREATE TRIGGER update_staff_commissions_updated_at
BEFORE UPDATE ON public.staff_commissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Function to compute or remove a commission for a given receipt_item
CREATE OR REPLACE FUNCTION public.sync_staff_commission_for_receipt_item(p_receipt_item_id UUID)
RETURNS VOID AS $$
DECLARE
  v_item RECORD;
  v_rate NUMERIC(5,2);
  v_gross NUMERIC;
  v_commission NUMERIC;
BEGIN
  -- Load receipt item with joins for rate lookup
  SELECT rci.id,
         rci.receipt_id,
         rci.service_id,
         rci.staff_id,
         rci.quantity,
         rci.unit_price,
         s.commission_percentage AS service_rate,
         st.commission_rate AS staff_rate
  INTO v_item
  FROM public.receipt_items rci
  LEFT JOIN public.services s ON s.id = rci.service_id
  LEFT JOIN public.staff st ON st.id = rci.staff_id
  WHERE rci.id = p_receipt_item_id;

  IF NOT FOUND THEN
    -- If the item no longer exists, ensure commission is removed
    DELETE FROM public.staff_commissions WHERE receipt_item_id = p_receipt_item_id;
    RETURN;
  END IF;

  -- Compute base values
  v_rate := COALESCE(v_item.service_rate, v_item.staff_rate, 0);
  v_gross := COALESCE(v_item.quantity, 1) * COALESCE(v_item.unit_price, 0);
  v_commission := (v_gross * COALESCE(v_rate, 0)) / 100.0;

  -- If no staff assigned or no positive commission context, remove existing commission
  IF v_item.staff_id IS NULL OR v_gross <= 0 OR COALESCE(v_rate, 0) <= 0 THEN
    DELETE FROM public.staff_commissions WHERE receipt_item_id = v_item.id;
    RETURN;
  END IF;

  -- Upsert commission snapshot for this receipt item
  INSERT INTO public.staff_commissions (
    staff_id,
    receipt_id,
    receipt_item_id,
    service_id,
    commission_rate,
    gross_amount,
    commission_amount,
    status
  ) VALUES (
    v_item.staff_id,
    v_item.receipt_id,
    v_item.id,
    v_item.service_id,
    COALESCE(v_rate, 0),
    COALESCE(v_gross, 0),
    COALESCE(v_commission, 0),
    'pending'
  )
  ON CONFLICT (receipt_item_id) DO UPDATE SET
    staff_id = EXCLUDED.staff_id,
    receipt_id = EXCLUDED.receipt_id,
    service_id = EXCLUDED.service_id,
    commission_rate = EXCLUDED.commission_rate,
    gross_amount = EXCLUDED.gross_amount,
    commission_amount = EXCLUDED.commission_amount,
    updated_at = now();
END;
$$ LANGUAGE plpgsql;

-- 6) Triggers on receipt_items to keep commissions in sync
-- Wrapper trigger function to call the sync by item id
CREATE OR REPLACE FUNCTION public.trg_sync_staff_commission()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.sync_staff_commission_for_receipt_item(COALESCE(NEW.id, OLD.id));
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_staff_commission_on_receipt_items_ins ON public.receipt_items;
CREATE TRIGGER trg_sync_staff_commission_on_receipt_items_ins
AFTER INSERT ON public.receipt_items
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_staff_commission();

DROP TRIGGER IF EXISTS trg_sync_staff_commission_on_receipt_items_upd ON public.receipt_items;
CREATE TRIGGER trg_sync_staff_commission_on_receipt_items_upd
AFTER UPDATE OF quantity, unit_price, staff_id, service_id, receipt_id ON public.receipt_items
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_staff_commission();

DROP TRIGGER IF EXISTS trg_sync_staff_commission_on_receipt_items_del ON public.receipt_items;
CREATE TRIGGER trg_sync_staff_commission_on_receipt_items_del
AFTER DELETE ON public.receipt_items
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_staff_commission();

-- 7) Backfill utility to rebuild commissions from existing receipt_items
CREATE OR REPLACE FUNCTION public.rebuild_staff_commissions()
RETURNS VOID AS $$
DECLARE
  r RECORD;
BEGIN
  -- Clear existing pending commissions to avoid duplicates; keep approved/paid as-is
  DELETE FROM public.staff_commissions WHERE status = 'pending';
  FOR r IN SELECT id FROM public.receipt_items LOOP
    PERFORM public.sync_staff_commission_for_receipt_item(r.id);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Perform an initial backfill
SELECT public.rebuild_staff_commissions();