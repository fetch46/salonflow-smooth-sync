-- Update commission sync function to use job_card_services override when available
CREATE OR REPLACE FUNCTION public.sync_staff_commission_for_receipt_item(p_receipt_item_id UUID)
RETURNS VOID AS $$
DECLARE
  v_item RECORD;
  v_rate NUMERIC(5,2);
  v_gross NUMERIC;
  v_commission NUMERIC;
BEGIN
  -- Load receipt item with joins for rate lookup, including job_card_services override via receipts
  SELECT rci.id,
         rci.receipt_id,
         rci.service_id,
         rci.staff_id,
         rci.quantity,
         rci.unit_price,
         s.commission_percentage AS service_rate,
         st.commission_rate AS staff_rate,
         jcs.commission_percentage AS override_rate
  INTO v_item
  FROM public.receipt_items rci
  LEFT JOIN public.services s ON s.id = rci.service_id
  LEFT JOIN public.staff st ON st.id = rci.staff_id
  LEFT JOIN public.receipts r ON r.id = rci.receipt_id
  LEFT JOIN public.job_card_services jcs ON jcs.job_card_id = r.job_card_id
                                      AND jcs.service_id = rci.service_id
                                      AND (jcs.staff_id IS NULL OR jcs.staff_id = rci.staff_id)
  WHERE rci.id = p_receipt_item_id
  LIMIT 1;

  IF NOT FOUND THEN
    DELETE FROM public.staff_commissions WHERE receipt_item_id = p_receipt_item_id;
    RETURN;
  END IF;

  v_rate := COALESCE(v_item.override_rate, v_item.service_rate, v_item.staff_rate, 0);
  v_gross := COALESCE(v_item.quantity, 1) * COALESCE(v_item.unit_price, 0);
  v_commission := (v_gross * COALESCE(v_rate, 0)) / 100.0;

  IF v_item.staff_id IS NULL OR v_gross <= 0 OR COALESCE(v_rate, 0) <= 0 THEN
    DELETE FROM public.staff_commissions WHERE receipt_item_id = v_item.id;
    RETURN;
  END IF;

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
    p_receipt_item_id,
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