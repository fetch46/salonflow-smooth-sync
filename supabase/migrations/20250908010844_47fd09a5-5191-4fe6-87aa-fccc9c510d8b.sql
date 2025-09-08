-- Create triggers to ensure invoice and POS sales are recorded as revenue

-- Function to post invoice to revenue accounts
CREATE OR REPLACE FUNCTION public.post_invoice_to_revenue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  revenue_account UUID;
  ar_account UUID;
  item_record RECORD;
  sales_account UUID;
BEGIN
  -- Only process when status changes to 'sent' or 'paid'
  IF NEW.status IN ('sent', 'paid') AND (OLD.status IS NULL OR OLD.status NOT IN ('sent', 'paid')) THEN
    
    -- Get default revenue account (4001)
    SELECT id INTO revenue_account FROM public.accounts 
    WHERE account_code = '4001' AND organization_id = NEW.organization_id
    LIMIT 1;
    
    -- Get accounts receivable account (1100)
    SELECT id INTO ar_account FROM public.accounts 
    WHERE account_code = '1100' AND organization_id = NEW.organization_id
    LIMIT 1;

    -- For each invoice item, post to appropriate revenue account
    FOR item_record IN 
      SELECT ii.*, s.name as service_name, p.name as product_name
      FROM invoice_items ii
      LEFT JOIN services s ON s.id = ii.service_id
      LEFT JOIN inventory_items p ON p.id = ii.product_id
      WHERE ii.invoice_id = NEW.id
    LOOP
      sales_account := revenue_account; -- Default to main revenue account
      
      -- Try to get specific sales account for the item
      IF item_record.product_id IS NOT NULL THEN
        SELECT iia.sales_account_id INTO sales_account
        FROM inventory_item_accounts iia
        WHERE iia.item_id = item_record.product_id AND iia.sales_account_id IS NOT NULL;
      END IF;
      
      -- Use main revenue account if no specific account found
      IF sales_account IS NULL THEN
        sales_account := revenue_account;
      END IF;
      
      -- Post revenue entry for this item
      IF sales_account IS NOT NULL THEN
        INSERT INTO public.account_transactions (
          account_id, transaction_date, description, 
          debit_amount, credit_amount, reference_type, reference_id, location_id
        ) VALUES (
          sales_account, 
          COALESCE(NEW.issue_date, CURRENT_DATE), 
          'Invoice ' || NEW.invoice_number || ' - ' || COALESCE(item_record.service_name, item_record.product_name, item_record.description),
          0, 
          item_record.total_price,
          'invoice_item', 
          item_record.id, 
          NEW.location_id
        );
      END IF;
    END LOOP;
    
    -- Post accounts receivable entry for total amount
    IF ar_account IS NOT NULL THEN
      INSERT INTO public.account_transactions (
        account_id, transaction_date, description, 
        debit_amount, credit_amount, reference_type, reference_id, location_id
      ) VALUES (
        ar_account, 
        COALESCE(NEW.issue_date, CURRENT_DATE), 
        'Invoice ' || NEW.invoice_number || ' (AR)',
        NEW.total_amount, 
        0,
        'invoice', 
        NEW.id, 
        NEW.location_id
      );
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for invoice revenue posting
DROP TRIGGER IF EXISTS trigger_post_invoice_to_revenue ON public.invoices;
CREATE TRIGGER trigger_post_invoice_to_revenue
  AFTER INSERT OR UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.post_invoice_to_revenue();

-- Function to post receipt (POS sales) to revenue accounts  
CREATE OR REPLACE FUNCTION public.post_receipt_to_revenue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  revenue_account UUID;
  cash_account UUID;
  item_record RECORD;
  sales_account UUID;
BEGIN
  -- Get default revenue account (4001)
  SELECT id INTO revenue_account FROM public.accounts 
  WHERE account_code = '4001' AND organization_id = NEW.organization_id
  LIMIT 1;
  
  -- Get cash account (1001)
  SELECT id INTO cash_account FROM public.accounts 
  WHERE account_code = '1001' AND organization_id = NEW.organization_id
  LIMIT 1;

  -- For each receipt item, post to appropriate revenue account
  FOR item_record IN 
    SELECT ri.*, s.name as service_name, p.name as product_name
    FROM receipt_items ri
    LEFT JOIN services s ON s.id = ri.service_id
    LEFT JOIN inventory_items p ON p.id = ri.product_id
    WHERE ri.receipt_id = NEW.id
  LOOP
    sales_account := revenue_account; -- Default to main revenue account
    
    -- Try to get specific sales account for the item
    IF item_record.product_id IS NOT NULL THEN
      SELECT iia.sales_account_id INTO sales_account
      FROM inventory_item_accounts iia
      WHERE iia.item_id = item_record.product_id AND iia.sales_account_id IS NOT NULL;
    END IF;
    
    -- Use main revenue account if no specific account found
    IF sales_account IS NULL THEN
      sales_account := revenue_account;
    END IF;
    
    -- Post revenue entry for this item
    IF sales_account IS NOT NULL THEN
      INSERT INTO public.account_transactions (
        account_id, transaction_date, description, 
        debit_amount, credit_amount, reference_type, reference_id, location_id
      ) VALUES (
        sales_account, 
        COALESCE(NEW.created_at::date, CURRENT_DATE), 
        'Receipt ' || NEW.receipt_number || ' - ' || COALESCE(item_record.service_name, item_record.product_name, item_record.description),
        0, 
        item_record.total_price,
        'receipt_item', 
        item_record.id, 
        NEW.location_id
      );
    END IF;
  END LOOP;
  
  -- Post cash/payment entry for total amount
  IF cash_account IS NOT NULL THEN
    INSERT INTO public.account_transactions (
      account_id, transaction_date, description, 
      debit_amount, credit_amount, reference_type, reference_id, location_id
    ) VALUES (
      cash_account, 
      COALESCE(NEW.created_at::date, CURRENT_DATE), 
      'Receipt ' || NEW.receipt_number || ' (Cash)',
      NEW.total_amount, 
      0,
      'receipt', 
      NEW.id, 
      NEW.location_id
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for receipt revenue posting
DROP TRIGGER IF EXISTS trigger_post_receipt_to_revenue ON public.receipts;
CREATE TRIGGER trigger_post_receipt_to_revenue
  AFTER INSERT ON public.receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.post_receipt_to_revenue();