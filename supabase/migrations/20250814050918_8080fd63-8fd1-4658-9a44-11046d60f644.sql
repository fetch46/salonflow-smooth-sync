-- Fix function search_path and harden SECURITY DEFINER functions
-- This migration standardizes search_path to 'public' for all app functions and re-creates them idempotently.

-- 1) Trigger: handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (
    user_id, 
    full_name, 
    email,
    phone,
    business_name,
    business_phone,
    business_email,
    role
  )
  VALUES (
    new.id, 
    COALESCE(
      CONCAT(new.raw_user_meta_data ->> 'first_name', ' ', new.raw_user_meta_data ->> 'last_name'),
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    new.email,
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'business_name',
    new.raw_user_meta_data ->> 'business_phone',
    new.raw_user_meta_data ->> 'business_email',
    COALESCE(new.raw_user_meta_data ->> 'role', 'staff')
  );
  RETURN new;
END;
$$;

-- 2) user_has_organization
CREATE OR REPLACE FUNCTION public.user_has_organization(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.organization_users 
    WHERE user_id = user_uuid 
      AND is_active = true
  );
$$;

-- 3) get_user_organization_count
CREATE OR REPLACE FUNCTION public.get_user_organization_count(user_uuid uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::integer
  FROM public.organization_users 
  WHERE user_id = user_uuid 
    AND is_active = true;
$$;

-- 4) generate_job_number (scoped per organization)
-- Generates the next sequential number per organization in the format JCNNN
-- If multiple concurrent inserts happen, the unique constraint (organization_id, job_number)
-- will protect against duplicates; callers should retry on conflict.
CREATE OR REPLACE FUNCTION public.generate_job_number(p_organization_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    next_number INTEGER;
    job_number TEXT;
BEGIN
    SELECT COALESCE(MAX(CAST(SUBSTRING(job_number FROM 'JC(\d+)') AS INTEGER)), 0) + 1
    INTO next_number
    FROM public.job_cards
    WHERE organization_id = p_organization_id
      AND job_number ~ '^JC\d+$';
    job_number := 'JC' || LPAD(next_number::TEXT, 3, '0');
    RETURN job_number;
END;
$$;

-- 5) generate_grn_number
CREATE OR REPLACE FUNCTION public.generate_grn_number()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  RETURN 'GRN-' || to_char(now(), 'YYYYMMDD') || '-' || lpad((floor(random()*100000))::text, 5, '0');
END;
$$;

-- 6) set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 7) touch_updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 8) delete_account_transactions_by_reference
CREATE OR REPLACE FUNCTION public.delete_account_transactions_by_reference(p_reference_type text, p_reference_id text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deleted_count bigint;
BEGIN
  DELETE FROM public.account_transactions
  WHERE reference_type = p_reference_type
    AND reference_id = p_reference_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- 9) create_organization_with_user
CREATE OR REPLACE FUNCTION public.create_organization_with_user(org_name text, org_slug text, org_settings jsonb DEFAULT '{}'::jsonb, plan_id uuid DEFAULT NULL::uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_org_id uuid;
  uid uuid;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  INSERT INTO public.organizations (name, slug, settings)
  VALUES (org_name, org_slug, COALESCE(org_settings, '{}'::jsonb))
  RETURNING id INTO new_org_id;

  INSERT INTO public.organization_users (organization_id, user_id, role, is_active)
  VALUES (new_org_id, uid, 'owner', true);

  IF plan_id IS NOT NULL THEN
    INSERT INTO public.organization_subscriptions (organization_id, plan_id, status, interval)
    VALUES (new_org_id, plan_id, 'trial', 'month');
  END IF;

  RETURN new_org_id;
END;
$$;

-- 10) setup_new_organization
CREATE OR REPLACE FUNCTION public.setup_new_organization(org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_users 
    WHERE organization_id = org_id AND user_id = auth.uid() AND role = 'owner' AND is_active = true
  ) THEN
    RAISE EXCEPTION 'User must be owner of organization';
  END IF;

  -- Placeholder for future default data setup
  RETURN true;
END;
$$;

-- 11) post_receipt_to_ledger
CREATE OR REPLACE FUNCTION public.post_receipt_to_ledger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  ar_account UUID;
  revenue_account UUID;
BEGIN
  SELECT id INTO ar_account FROM public.accounts 
  WHERE account_code = '1100' AND organization_id = NEW.organization_id
  LIMIT 1;
  SELECT id INTO revenue_account FROM public.accounts 
  WHERE account_code = '4001' AND organization_id = NEW.organization_id
  LIMIT 1;

  IF ar_account IS NOT NULL AND revenue_account IS NOT NULL THEN
    INSERT INTO public.account_transactions (account_id, transaction_date, description, debit_amount, credit_amount, reference_type, reference_id, location_id)
    VALUES (ar_account, CURRENT_DATE, 'Receipt ' || NEW.receipt_number || ' (AR)', NEW.total_amount, 0, 'receipt', NEW.id, NEW.location_id);

    INSERT INTO public.account_transactions (account_id, transaction_date, description, debit_amount, credit_amount, reference_type, reference_id, location_id)
    VALUES (revenue_account, CURRENT_DATE, 'Receipt ' || NEW.receipt_number || ' (Revenue)', 0, NEW.subtotal, 'receipt', NEW.id, NEW.location_id);
  END IF;

  RETURN NEW;
END;
$$;

-- 12) post_receipt_payment_to_ledger
CREATE OR REPLACE FUNCTION public.post_receipt_payment_to_ledger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  ar_account UUID;
  cash_account UUID;
  v_location UUID;
BEGIN
  SELECT id INTO ar_account FROM public.accounts 
  WHERE account_code = '1100' AND organization_id = NEW.organization_id
  LIMIT 1;

  IF NEW.method = 'cash' OR NEW.method = 'mpesa' THEN
    SELECT id INTO cash_account FROM public.accounts 
    WHERE account_code = '1001' AND organization_id = NEW.organization_id
    LIMIT 1;
  ELSE
    SELECT id INTO cash_account FROM public.accounts 
    WHERE account_code = '1002' AND organization_id = NEW.organization_id
    LIMIT 1;
  END IF;

  v_location := NEW.location_id;
  IF v_location IS NULL THEN
    SELECT location_id INTO v_location FROM public.receipts WHERE id = NEW.receipt_id;
  END IF;

  IF cash_account IS NOT NULL AND ar_account IS NOT NULL THEN
    INSERT INTO public.account_transactions (account_id, transaction_date, description, debit_amount, credit_amount, reference_type, reference_id, location_id)
    VALUES (cash_account, NEW.payment_date, 'Receipt Payment', NEW.amount, 0, 'receipt_payment', NEW.id, v_location);

    INSERT INTO public.account_transactions (account_id, transaction_date, description, debit_amount, credit_amount, reference_type, reference_id, location_id)
    VALUES (ar_account, NEW.payment_date, 'Receipt Payment', 0, NEW.amount, 'receipt_payment', NEW.id, v_location);
  END IF;

  UPDATE public.receipts r
  SET amount_paid = COALESCE(r.amount_paid,0) + NEW.amount,
      status = CASE 
        WHEN COALESCE(r.amount_paid,0) + NEW.amount >= r.total_amount THEN 'paid' 
        WHEN COALESCE(r.amount_paid,0) + NEW.amount > 0 THEN 'partial' 
        ELSE r.status END,
      updated_at = now()
  WHERE r.id = NEW.receipt_id;

  RETURN NEW;
END;
$$;

-- 13) post_receipt_item_product_to_ledger
CREATE OR REPLACE FUNCTION public.post_receipt_item_product_to_ledger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  inventory_account UUID;
  cogs_account UUID;
  unit_cost NUMERIC;
  amt NUMERIC;
  rcpt RECORD;
BEGIN
  IF NEW.product_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT r.* INTO rcpt FROM public.receipts r WHERE r.id = NEW.receipt_id;

  SELECT id INTO inventory_account FROM public.accounts 
  WHERE account_code = '1200' AND organization_id = rcpt.organization_id LIMIT 1;

  SELECT id INTO cogs_account FROM public.accounts 
  WHERE account_code = '5001' AND organization_id = rcpt.organization_id LIMIT 1;

  SELECT cost_price INTO unit_cost FROM public.inventory_items WHERE id = NEW.product_id;
  amt := COALESCE(unit_cost, 0) * COALESCE(NEW.quantity, 1);

  IF amt > 0 AND inventory_account IS NOT NULL AND cogs_account IS NOT NULL THEN
    INSERT INTO public.account_transactions (account_id, transaction_date, description, debit_amount, credit_amount, reference_type, reference_id, location_id)
    VALUES (cogs_account, COALESCE(rcpt.created_at::date, CURRENT_DATE), 'COGS for product on receipt ' || COALESCE(rcpt.receipt_number, ''), amt, 0, 'receipt_item', NEW.id, rcpt.location_id);

    INSERT INTO public.account_transactions (account_id, transaction_date, description, debit_amount, credit_amount, reference_type, reference_id, location_id)
    VALUES (inventory_account, COALESCE(rcpt.created_at::date, CURRENT_DATE), 'Inventory out for receipt ' || COALESCE(rcpt.receipt_number, ''), 0, amt, 'receipt_item', NEW.id, rcpt.location_id);
  END IF;

  RETURN NEW;
END;
$$;

-- 14) post_expense_to_ledger
CREATE OR REPLACE FUNCTION public.post_expense_to_ledger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  expense_account UUID;
  cash_or_bank UUID;
  amt NUMERIC;
BEGIN
  SELECT id INTO expense_account FROM public.accounts 
  WHERE account_code = '5400' AND organization_id = NEW.organization_id
  LIMIT 1;

  IF NEW.payment_method = 'Cash' OR NEW.payment_method = 'cash' THEN
    SELECT id INTO cash_or_bank FROM public.accounts 
    WHERE account_code = '1001' AND organization_id = NEW.organization_id
    LIMIT 1;
  ELSE
    SELECT id INTO cash_or_bank FROM public.accounts 
    WHERE account_code = '1002' AND organization_id = NEW.organization_id
    LIMIT 1;
  END IF;

  amt := COALESCE(NEW.amount, 0);

  IF NEW.status = 'paid' AND amt > 0 AND expense_account IS NOT NULL AND cash_or_bank IS NOT NULL THEN
    INSERT INTO public.account_transactions (account_id, transaction_date, description, debit_amount, credit_amount, reference_type, reference_id, location_id)
    VALUES (expense_account, NEW.expense_date, 'Expense ' || NEW.expense_number, amt, 0, 'expense', NEW.id, NEW.location_id);

    INSERT INTO public.account_transactions (account_id, transaction_date, description, debit_amount, credit_amount, reference_type, reference_id, location_id)
    VALUES (cash_or_bank, NEW.expense_date, 'Expense ' || NEW.expense_number, 0, amt, 'expense', NEW.id, NEW.location_id);
  END IF;

  RETURN NEW;
END;
$$;

-- 15) post_purchase_to_ledger
CREATE OR REPLACE FUNCTION public.post_purchase_to_ledger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  inventory_account UUID;
  ap_account UUID;
  amt NUMERIC;
BEGIN
  SELECT id INTO inventory_account FROM public.accounts 
  WHERE account_code = '1200' AND organization_id = NEW.organization_id
  LIMIT 1;
  SELECT id INTO ap_account FROM public.accounts 
  WHERE account_code = '2001' AND organization_id = NEW.organization_id
  LIMIT 1;
  amt := COALESCE(NEW.total_amount, 0);
  IF NEW.status = 'received' AND amt > 0 AND inventory_account IS NOT NULL AND ap_account IS NOT NULL THEN
    INSERT INTO public.account_transactions (account_id, transaction_date, description, debit_amount, credit_amount, reference_type, reference_id, location_id)
    VALUES (inventory_account, NEW.purchase_date, 'Purchase ' || NEW.purchase_number, amt, 0, 'purchase', NEW.id, NEW.location_id);
    INSERT INTO public.account_transactions (account_id, transaction_date, description, debit_amount, credit_amount, reference_type, reference_id, location_id)
    VALUES (ap_account, NEW.purchase_date, 'Purchase ' || NEW.purchase_number, 0, amt, 'purchase', NEW.id, NEW.location_id);
  END IF;
  RETURN NEW;
END;
$$;

-- 16) update_purchase_status
CREATE OR REPLACE FUNCTION public.update_purchase_status(p_purchase_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_any_received BOOLEAN;
  v_all_received BOOLEAN;
BEGIN
  SELECT
    BOOL_OR(received_quantity > 0),
    BOOL_AND(received_quantity >= quantity)
  INTO v_any_received, v_all_received
  FROM public.purchase_items WHERE purchase_id = p_purchase_id;

  UPDATE public.purchases
  SET status = CASE WHEN v_all_received THEN 'completed' WHEN v_any_received THEN 'partial' ELSE 'pending' END,
      updated_at = now()
  WHERE id = p_purchase_id;
END;
$$;

-- 17) record_goods_received (variant 1)
CREATE OR REPLACE FUNCTION public.record_goods_received(p_org_id uuid, p_purchase_id uuid, p_location_id uuid, p_received_date date, p_notes text, p_lines jsonb)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_header_id UUID;
  v_item RECORD;
  v_pi RECORD;
  v_new_received NUMERIC;
BEGIN
  PERFORM 1 FROM public.purchases p
  WHERE p.id = p_purchase_id AND p.organization_id = p_org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase not found for organization';
  END IF;

  PERFORM 1 FROM public.business_locations bl WHERE bl.id = p_location_id AND bl.organization_id = p_org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Location does not belong to organization';
  END IF;

  INSERT INTO public.goods_received (organization_id, purchase_id, location_id, received_date, notes, grn_number)
  VALUES (p_org_id, p_purchase_id, p_location_id, p_received_date, p_notes, public.generate_grn_number())
  RETURNING id INTO v_header_id;

  UPDATE public.purchases SET location_id = p_location_id WHERE id = p_purchase_id AND (location_id IS DISTINCT FROM p_location_id OR location_id IS NULL);

  FOR v_item IN SELECT (l->>'purchase_item_id')::uuid AS purchase_item_id, COALESCE((l->>'quantity')::numeric, 0) AS quantity
                FROM jsonb_array_elements(COALESCE(p_lines, '[]'::jsonb)) AS l
  LOOP
    IF v_item.quantity <= 0 THEN CONTINUE; END IF;

    SELECT pi.id, pi.purchase_id, pi.item_id, pi.quantity, COALESCE(pi.received_quantity, 0) AS received_quantity, pi.unit_cost
    INTO v_pi
    FROM public.purchase_items pi
    WHERE pi.id = v_item.purchase_item_id AND pi.purchase_id = p_purchase_id
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Purchase item % not found for this purchase', v_item.purchase_item_id;
    END IF;

    INSERT INTO public.goods_received_items (goods_received_id, purchase_item_id, item_id, quantity, unit_cost)
    VALUES (v_header_id, v_pi.id, v_pi.item_id, GREATEST(0, v_item.quantity), v_pi.unit_cost);

    v_new_received := LEAST(v_pi.quantity, v_pi.received_quantity + v_item.quantity);
    UPDATE public.purchase_items SET received_quantity = v_new_received WHERE id = v_pi.id;
  END LOOP;

  RETURN v_header_id;
END;
$$;

-- 18) record_goods_received (legacy variant 2)
CREATE OR REPLACE FUNCTION public.record_goods_received(p_org_id uuid, p_purchase_id uuid, p_location_id uuid, p_warehouse_id uuid, p_received_date date, p_notes text, p_lines jsonb)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_gr_id UUID;
  v_grn TEXT;
  v_line JSONB;
  v_purchase_item_id UUID;
  v_qty NUMERIC;
  v_item_id UUID;
BEGIN
  v_grn := 'GRN-' || to_char(now(), 'YYYYMMDDHH24MISS');
  INSERT INTO public.goods_received (organization_id, purchase_id, received_date, warehouse_id, location_id, grn_number, notes)
  VALUES (p_org_id, p_purchase_id, p_received_date, p_warehouse_id, p_location_id, v_grn, p_notes)
  RETURNING id INTO v_gr_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(COALESCE(p_lines, '[]'::jsonb)) LOOP
    v_purchase_item_id := (v_line->>'purchase_item_id')::uuid;
    v_qty := COALESCE((v_line->>'quantity')::numeric, 0);
    IF v_qty <= 0 THEN CONTINUE; END IF;

    SELECT pi.item_id INTO v_item_id FROM public.purchase_items pi WHERE pi.id = v_purchase_item_id;

    INSERT INTO public.goods_received_items (goods_received_id, purchase_item_id, quantity)
    VALUES (v_gr_id, v_purchase_item_id, v_qty);

    UPDATE public.purchase_items
    SET received_quantity = LEAST(quantity, received_quantity + v_qty)
    WHERE id = v_purchase_item_id;

    PERFORM 1 FROM public.inventory_levels il WHERE il.item_id = v_item_id AND il.location_id = p_location_id;
    IF NOT FOUND THEN
      INSERT INTO public.inventory_levels (item_id, location_id, quantity)
      VALUES (v_item_id, p_location_id, v_qty);
    ELSE
      UPDATE public.inventory_levels SET quantity = quantity + v_qty WHERE item_id = v_item_id AND location_id = p_location_id;
    END IF;

    PERFORM 1 FROM public.inventory_levels il WHERE il.item_id = v_item_id AND il.warehouse_id = p_warehouse_id;
    IF NOT FOUND THEN
      INSERT INTO public.inventory_levels (item_id, warehouse_id, quantity)
      VALUES (v_item_id, p_warehouse_id, v_qty);
    ELSE
      UPDATE public.inventory_levels SET quantity = quantity + v_qty WHERE item_id = v_item_id AND warehouse_id = p_warehouse_id;
    END IF;
  END LOOP;

  PERFORM public.update_purchase_status(p_purchase_id);
  RETURN v_gr_id;
END;
$$;

-- 19) update_goods_received (location-only)
CREATE OR REPLACE FUNCTION public.update_goods_received(p_org_id uuid, p_goods_received_id uuid, p_location_id uuid, p_received_date date, p_notes text, p_quantities jsonb)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_header RECORD;
  v_existing RECORD;
  v_pi RECORD;
  v_old_qty NUMERIC;
  v_new_qty NUMERIC;
  v_delta NUMERIC;
BEGIN
  SELECT gr.*, p.organization_id AS purchase_org
  INTO v_header
  FROM public.goods_received gr
  JOIN public.purchases p ON p.id = gr.purchase_id
  WHERE gr.id = p_goods_received_id;

  IF v_header.id IS NULL OR v_header.purchase_org <> p_org_id THEN
    RAISE EXCEPTION 'Goods received not found or not in organization';
  END IF;

  UPDATE public.goods_received SET location_id = p_location_id, received_date = p_received_date, notes = p_notes WHERE id = p_goods_received_id;
  UPDATE public.purchases SET location_id = p_location_id WHERE id = v_header.purchase_id AND (location_id IS DISTINCT FROM p_location_id OR location_id IS NULL);

  FOR v_pi IN SELECT pi.id, pi.quantity, COALESCE(pi.received_quantity, 0) AS received_quantity, pi.item_id, pi.unit_cost
              FROM public.purchase_items pi
              WHERE pi.purchase_id = v_header.purchase_id
  LOOP
    SELECT COALESCE(SUM(gri.quantity), 0) AS qty
    INTO v_existing
    FROM public.goods_received_items gri
    WHERE gri.goods_received_id = p_goods_received_id AND gri.purchase_item_id = v_pi.id;

    v_old_qty := COALESCE(v_existing.qty, 0);
    v_new_qty := COALESCE((p_quantities ->> v_pi.id)::numeric, 0);
    v_delta := v_new_qty - v_old_qty;

    IF v_delta <> 0 THEN
      DELETE FROM public.goods_received_items WHERE goods_received_id = p_goods_received_id AND purchase_item_id = v_pi.id;
      IF v_new_qty > 0 THEN
        INSERT INTO public.goods_received_items (goods_received_id, purchase_item_id, item_id, quantity, unit_cost)
        VALUES (p_goods_received_id, v_pi.id, v_pi.item_id, v_new_qty, v_pi.unit_cost);
      END IF;

      UPDATE public.purchase_items
      SET received_quantity = GREATEST(0, LEAST(v_pi.quantity, v_pi.received_quantity + v_delta))
      WHERE id = v_pi.id;
    END IF;
  END LOOP;
END;
$$;

-- 20) update_goods_received (with warehouse)
CREATE OR REPLACE FUNCTION public.update_goods_received(p_org_id uuid, p_goods_received_id uuid, p_location_id uuid, p_warehouse_id uuid, p_received_date date, p_notes text, p_quantities jsonb)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_purchase_id UUID;
  v_old_location_id UUID;
  v_old_warehouse_id UUID;
  r_old RECORD;
  v_item_id UUID;
  v_new_qty NUMERIC;
  v_pi_id UUID;
BEGIN
  -- Load the existing header to know where quantities were previously stored
  SELECT gr.purchase_id, gr.location_id, gr.warehouse_id
  INTO v_purchase_id, v_old_location_id, v_old_warehouse_id
  FROM public.goods_received gr
  WHERE gr.id = p_goods_received_id;

  -- Reverse previous quantities from the original location and warehouse
  FOR r_old IN
    SELECT gri.*, pi.item_id
    FROM public.goods_received_items gri
    JOIN public.purchase_items pi ON pi.id = gri.purchase_item_id
    WHERE gri.goods_received_id = p_goods_received_id
  LOOP
    IF v_old_location_id IS NOT NULL THEN
      UPDATE public.inventory_levels SET quantity = GREATEST(0, quantity - r_old.quantity)
      WHERE item_id = r_old.item_id AND location_id = v_old_location_id;
    END IF;
    IF v_old_warehouse_id IS NOT NULL THEN
      UPDATE public.inventory_levels SET quantity = GREATEST(0, quantity - r_old.quantity)
      WHERE item_id = r_old.item_id AND warehouse_id = v_old_warehouse_id;
    END IF;
  END LOOP;

  -- Update header to new warehouse/location and metadata
  UPDATE public.goods_received
  SET received_date = p_received_date,
      warehouse_id = p_warehouse_id,
      location_id = p_location_id,
      notes = p_notes,
      updated_at = now()
  WHERE id = p_goods_received_id;

  -- Replace items with new quantities snapshot
  DELETE FROM public.goods_received_items WHERE goods_received_id = p_goods_received_id;

  FOR v_pi_id, v_new_qty IN
    SELECT (key)::uuid AS purchase_item_id, (value)::numeric AS quantity
    FROM jsonb_each_text(COALESCE(p_quantities, '{}'::jsonb))
  LOOP
    IF v_new_qty IS NULL OR v_new_qty <= 0 THEN CONTINUE; END IF;
    SELECT pi.item_id INTO v_item_id FROM public.purchase_items pi WHERE pi.id = v_pi_id;

    INSERT INTO public.goods_received_items (goods_received_id, purchase_item_id, quantity)
    VALUES (p_goods_received_id, v_pi_id, v_new_qty);

    -- Apply to new location
    IF p_location_id IS NOT NULL THEN
      PERFORM 1 FROM public.inventory_levels WHERE item_id = v_item_id AND location_id = p_location_id;
      IF NOT FOUND THEN
        INSERT INTO public.inventory_levels (item_id, location_id, quantity)
        VALUES (v_item_id, p_location_id, v_new_qty);
      ELSE
        UPDATE public.inventory_levels SET quantity = quantity + v_new_qty
        WHERE item_id = v_item_id AND location_id = p_location_id;
      END IF;
    END IF;

    -- Apply to new warehouse
    IF p_warehouse_id IS NOT NULL THEN
      PERFORM 1 FROM public.inventory_levels WHERE item_id = v_item_id AND warehouse_id = p_warehouse_id;
      IF NOT FOUND THEN
        INSERT INTO public.inventory_levels (item_id, warehouse_id, quantity)
        VALUES (v_item_id, p_warehouse_id, v_new_qty);
      ELSE
        UPDATE public.inventory_levels SET quantity = quantity + v_new_qty
        WHERE item_id = v_item_id AND warehouse_id = p_warehouse_id;
      END IF;
    END IF;
  END LOOP;

  -- Recompute received quantities per purchase item based on all receipts for this purchase
  UPDATE public.purchase_items pi SET received_quantity = sub.total_received
  FROM (
    SELECT gri.purchase_item_id, SUM(gri.quantity) AS total_received
    FROM public.goods_received_items gri
    JOIN public.goods_received gr ON gr.id = gri.goods_received_id
    WHERE gr.purchase_id = v_purchase_id
    GROUP BY gri.purchase_item_id
  ) sub
  WHERE pi.id = sub.purchase_item_id;

  -- Keep purchase header location in sync with receipt location
  UPDATE public.purchases
  SET location_id = p_location_id
  WHERE id = v_purchase_id AND (location_id IS DISTINCT FROM p_location_id OR location_id IS NULL);

  PERFORM public.update_purchase_status(v_purchase_id);
END;
$$;

-- 21) is_super_admin / grant / revoke
CREATE OR REPLACE FUNCTION public.is_super_admin(uid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_is boolean; BEGIN
  SELECT COALESCE(sa.is_active, false) INTO v_is
  FROM public.super_admins sa
  WHERE sa.user_id = uid
  LIMIT 1;
  RETURN COALESCE(v_is, false);
END; $$;

CREATE OR REPLACE FUNCTION public.grant_super_admin(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.super_admins(user_id, granted_by, is_active)
  VALUES (target_user_id, auth.uid(), true)
  ON CONFLICT (user_id) DO UPDATE SET is_active = true, granted_by = EXCLUDED.granted_by, updated_at = now();
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.revoke_super_admin(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.super_admins SET is_active = false, updated_at = now() WHERE user_id = target_user_id;
  RETURN true;
END; $$;

-- 22) is_date_locked
CREATE OR REPLACE FUNCTION public.is_date_locked(p_org uuid, p_date date)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_locked BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.accounting_periods ap
    WHERE ap.organization_id = p_org
      AND ap.status = 'locked'
      AND p_date BETWEEN ap.period_start AND ap.period_end
  ) INTO v_locked;
  RETURN COALESCE(v_locked, false);
END;
$$;

-- 23) prevent_locked_period_changes
CREATE OR REPLACE FUNCTION public.prevent_locked_period_changes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_org UUID;
  v_date DATE;
  v_row JSONB;
  v_date_text TEXT;
  v_location UUID;
BEGIN
  v_row := to_jsonb(NEW);

  IF TG_TABLE_NAME = 'receipt_payments' THEN
    v_date := COALESCE(NEW.payment_date, CURRENT_DATE);
    SELECT r.organization_id, r.location_id INTO v_org, v_location FROM public.receipts r WHERE r.id = NEW.receipt_id LIMIT 1;
    IF v_org IS NULL AND v_location IS NOT NULL THEN
      SELECT bl.organization_id INTO v_org FROM public.business_locations bl WHERE bl.id = v_location LIMIT 1;
    END IF;
  ELSIF TG_TABLE_NAME = 'purchases' THEN
    v_org := COALESCE((v_row->>'organization_id')::uuid, NULL);
    v_location := COALESCE((v_row->>'location_id')::uuid, NULL);
    v_date_text := COALESCE(v_row->>'purchase_date', v_row->>'created_at');
    v_date := COALESCE(NULLIF(v_date_text, '')::date, CURRENT_DATE);
    IF v_org IS NULL AND v_location IS NOT NULL THEN
      SELECT bl.organization_id INTO v_org FROM public.business_locations bl WHERE bl.id = v_location LIMIT 1;
    END IF;
  ELSIF TG_TABLE_NAME = 'expenses' THEN
    v_org := COALESCE((v_row->>'organization_id')::uuid, NULL);
    v_location := COALESCE((v_row->>'location_id')::uuid, NULL);
    v_date_text := COALESCE(v_row->>'expense_date', v_row->>'created_at');
    v_date := COALESCE(NULLIF(v_date_text, '')::date, CURRENT_DATE);
    IF v_org IS NULL AND v_location IS NOT NULL THEN
      SELECT bl.organization_id INTO v_org FROM public.business_locations bl WHERE bl.id = v_location LIMIT 1;
    END IF;
  ELSIF TG_TABLE_NAME = 'bank_transfers' THEN
    v_org := COALESCE((v_row->>'organization_id')::uuid, NULL);
    v_date_text := COALESCE(v_row->>'transfer_date', v_row->>'created_at');
    v_date := COALESCE(NULLIF(v_date_text, '')::date, CURRENT_DATE);
  ELSIF TG_TABLE_NAME = 'sales' THEN
    v_org := COALESCE((v_row->>'organization_id')::uuid, NULL);
    v_location := COALESCE((v_row->>'location_id')::uuid, NULL);
    v_date_text := COALESCE(v_row->>'sale_date', v_row->>'created_at');
    v_date := COALESCE(NULLIF(v_date_text, '')::date, CURRENT_DATE);
    IF v_org IS NULL AND v_location IS NOT NULL THEN
      SELECT bl.organization_id INTO v_org FROM public.business_locations bl WHERE bl.id = v_location LIMIT 1;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  IF v_org IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.is_date_locked(v_org, v_date) THEN
    RAISE EXCEPTION 'Accounting period is locked for date %', v_date USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

-- 24) update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 25) _lov_refresh_types_marker
CREATE OR REPLACE FUNCTION public._lov_refresh_types_marker()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN true;
END;
$$;

-- 26) prevent_warehouse_delete_if_referenced
CREATE OR REPLACE FUNCTION public.prevent_warehouse_delete_if_referenced()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.inventory_levels WHERE warehouse_id = OLD.id) THEN
    RAISE EXCEPTION 'Cannot delete warehouse with existing inventory levels or transactions referencing it';
  END IF;

  IF EXISTS (SELECT 1 FROM public.goods_received WHERE warehouse_id = OLD.id) THEN
    RAISE EXCEPTION 'Cannot delete warehouse with goods received referencing it';
  END IF;

  IF EXISTS (SELECT 1 FROM public.inventory_adjustments WHERE warehouse_id = OLD.id) THEN
    RAISE EXCEPTION 'Cannot delete warehouse with inventory adjustments referencing it';
  END IF;

  RETURN OLD;
END;
$$;

-- 27) apply_purchase_receipt
CREATE OR REPLACE FUNCTION public.apply_purchase_receipt()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_delta NUMERIC;
  v_location_id UUID;
  v_warehouse_id UUID;
  v_total_qty NUMERIC;
  v_total_received NUMERIC;
  v_status TEXT;
BEGIN
  v_delta := COALESCE(NEW.received_quantity, 0) - COALESCE(OLD.received_quantity, 0);

  BEGIN
    v_warehouse_id := NULLIF(current_setting('app.receiving_warehouse_id', true), '')::uuid;
  EXCEPTION WHEN others THEN
    v_warehouse_id := NULL;
  END;

  IF v_delta <> 0 THEN
    IF v_warehouse_id IS NOT NULL THEN
      INSERT INTO public.inventory_levels (item_id, warehouse_id, quantity)
      VALUES (NEW.item_id, v_warehouse_id, GREATEST(0, v_delta))
      ON CONFLICT (item_id, warehouse_id)
      DO UPDATE SET quantity = GREATEST(0, COALESCE(public.inventory_levels.quantity, 0) + EXCLUDED.quantity);

      IF v_delta < 0 THEN
        UPDATE public.inventory_levels
        SET quantity = GREATEST(0, COALESCE(quantity, 0) + v_delta)
        WHERE item_id = NEW.item_id AND warehouse_id = v_warehouse_id;
      END IF;
    ELSE
      SELECT p.location_id INTO v_location_id
      FROM public.purchases p
      WHERE p.id = NEW.purchase_id;

      IF v_location_id IS NOT NULL THEN
        INSERT INTO public.inventory_levels (item_id, location_id, quantity)
        VALUES (NEW.item_id, v_location_id, GREATEST(0, v_delta))
        ON CONFLICT (item_id, location_id)
        DO UPDATE SET quantity = GREATEST(0, COALESCE(public.inventory_levels.quantity, 0) + EXCLUDED.quantity);

        IF v_delta < 0 THEN
          UPDATE public.inventory_levels
          SET quantity = GREATEST(0, COALESCE(quantity, 0) + v_delta)
          WHERE item_id = NEW.item_id AND location_id = v_location_id;
        END IF;
      END IF;
    END IF;
  END IF;

  SELECT COALESCE(SUM(quantity), 0), COALESCE(SUM(received_quantity), 0)
  INTO v_total_qty, v_total_received
  FROM public.purchase_items
  WHERE purchase_id = NEW.purchase_id;

  IF v_total_received <= 0 THEN
    v_status := 'pending';
  ELSIF v_total_received < v_total_qty THEN
    v_status := 'partial';
  ELSE
    v_status := 'received';
  END IF;

  UPDATE public.purchases
  SET status = v_status
  WHERE id = NEW.purchase_id AND COALESCE(status, '') IS DISTINCT FROM v_status;

  RETURN NEW;
END;
$$;

-- 28) create_goods_received (simple RPC)
CREATE OR REPLACE FUNCTION public.create_goods_received(p_organization_id uuid, p_purchase_id uuid, p_location_id uuid, p_received_date date DEFAULT (now())::date, p_notes text DEFAULT NULL::text, p_items jsonb DEFAULT '[]'::jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.goods_received(organization_id, purchase_id, location_id, received_date, notes)
  VALUES (p_organization_id, p_purchase_id, p_location_id, COALESCE(p_received_date, now()::date), p_notes)
  RETURNING id INTO v_id;

  IF p_items IS NOT NULL THEN
    INSERT INTO public.goods_received_items(goods_received_id, purchase_item_id, quantity)
    SELECT v_id, (it->>'purchase_item_id')::uuid, COALESCE((it->>'quantity')::numeric, 0)
    FROM jsonb_array_elements(p_items) it
    WHERE (it->>'purchase_item_id') IS NOT NULL AND COALESCE((it->>'quantity')::numeric, 0) > 0;
  END IF;

  RETURN v_id;
END;
$$;
