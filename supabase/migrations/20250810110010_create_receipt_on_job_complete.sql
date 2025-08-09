-- Auto-create Receipt (and items) when a Job Card is marked completed

CREATE OR REPLACE FUNCTION public.create_receipt_on_job_complete()
RETURNS TRIGGER AS $$
DECLARE
  existing_receipt_id UUID;
  new_receipt_id UUID;
  rcpt_number TEXT;
  v_org UUID;
BEGIN
  -- Only act when status transitions to completed
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    -- Skip if a receipt already exists for this job card
    SELECT id INTO existing_receipt_id FROM public.receipts WHERE job_card_id = NEW.id LIMIT 1;
    IF existing_receipt_id IS NOT NULL THEN
      RETURN NEW;
    END IF;

    -- Determine organization from job card
    v_org := NEW.organization_id;

    -- Generate a unique human-friendly receipt number RCT-YYMMDD-XXXXXX
    rcpt_number := 'RCT-' || to_char(now(),'YYMMDD') || '-' || substring(gen_random_uuid()::text from 1 for 6);

    -- Create the receipt header, defaulting status to 'open'
    INSERT INTO public.receipts (
      receipt_number,
      customer_id,
      job_card_id,
      subtotal,
      tax_amount,
      discount_amount,
      total_amount,
      status,
      notes,
      organization_id
    ) VALUES (
      rcpt_number,
      NEW.client_id,
      NEW.id,
      COALESCE(NEW.total_amount, 0),
      0,
      0,
      COALESCE(NEW.total_amount, 0),
      'open',
      'Auto-generated for Job ' || NEW.job_number,
      v_org
    ) RETURNING id INTO new_receipt_id;

    -- Create receipt items from job_card_services to allocate staff commissions per service
    INSERT INTO public.receipt_items (
      receipt_id,
      service_id,
      product_id,
      description,
      quantity,
      unit_price,
      total_price,
      staff_id,
      organization_id
    )
    SELECT
      new_receipt_id,
      jcs.service_id,
      NULL::uuid,
      COALESCE(s.name, 'Service'),
      COALESCE(jcs.quantity, 1),
      COALESCE(jcs.unit_price, 0),
      COALESCE(jcs.quantity, 1) * COALESCE(jcs.unit_price, 0),
      jcs.staff_id,
      v_org
    FROM public.job_card_services jcs
    LEFT JOIN public.services s ON s.id = jcs.service_id
    WHERE jcs.job_card_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_create_receipt_on_job_complete ON public.job_cards;
CREATE TRIGGER trg_create_receipt_on_job_complete
AFTER UPDATE OF status ON public.job_cards
FOR EACH ROW
EXECUTE FUNCTION public.create_receipt_on_job_complete();