-- Fix 1: Add missing commission_percentage column to appointment_services
ALTER TABLE public.appointment_services 
ADD COLUMN IF NOT EXISTS commission_percentage numeric DEFAULT 0;

-- Fix 2: Create trigger to update accounts when payments are deleted
CREATE OR REPLACE FUNCTION public.handle_payment_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- When receipt_payments are deleted, reverse the accounting
  IF TG_TABLE_NAME = 'receipt_payments' THEN
    -- Reverse the cash/bank and AR entries
    DELETE FROM public.account_transactions 
    WHERE reference_type = 'receipt_payment' AND reference_id = OLD.id::text;
    
    -- Update receipt amount_paid
    UPDATE public.receipts 
    SET amount_paid = COALESCE(amount_paid, 0) - OLD.amount,
        status = CASE 
          WHEN COALESCE(amount_paid, 0) - OLD.amount <= 0 THEN 'draft'
          WHEN COALESCE(amount_paid, 0) - OLD.amount < total_amount THEN 'partial'
          ELSE status
        END
    WHERE id = OLD.receipt_id;
  END IF;

  -- When invoice_payments are deleted, reverse the accounting  
  IF TG_TABLE_NAME = 'invoice_payments' THEN
    -- Reverse the cash/bank and AR entries
    DELETE FROM public.account_transactions 
    WHERE reference_type = 'invoice_payment' AND reference_id = OLD.id::text;
  END IF;

  -- When purchase_payments are deleted, reverse the accounting
  IF TG_TABLE_NAME = 'purchase_payments' THEN
    -- Reverse the AP and cash/bank entries
    DELETE FROM public.account_transactions 
    WHERE reference_type = 'purchase_payment' AND reference_id = OLD.id::text;
  END IF;

  RETURN OLD;
END;
$$;

-- Create triggers for payment deletion cleanup
DROP TRIGGER IF EXISTS receipt_payment_deletion_trigger ON public.receipt_payments;
CREATE TRIGGER receipt_payment_deletion_trigger
  BEFORE DELETE ON public.receipt_payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_payment_deletion();

DROP TRIGGER IF EXISTS invoice_payment_deletion_trigger ON public.invoice_payments;  
CREATE TRIGGER invoice_payment_deletion_trigger
  BEFORE DELETE ON public.invoice_payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_payment_deletion();

DROP TRIGGER IF EXISTS purchase_payment_deletion_trigger ON public.purchase_payments;
CREATE TRIGGER purchase_payment_deletion_trigger  
  BEFORE DELETE ON public.purchase_payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_payment_deletion();