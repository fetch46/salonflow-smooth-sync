-- Phase 1: Add missing columns to staff_commissions table
ALTER TABLE public.staff_commissions 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'accrued' CHECK (status IN ('accrued', 'paid')),
ADD COLUMN IF NOT EXISTS accrued_date date DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS paid_date date,
ADD COLUMN IF NOT EXISTS commission_percentage numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS invoice_item_id uuid,
ADD COLUMN IF NOT EXISTS payment_reference text;

-- Add foreign key constraint for invoice_item_id
ALTER TABLE public.staff_commissions 
ADD CONSTRAINT fk_staff_commissions_invoice_item 
FOREIGN KEY (invoice_item_id) REFERENCES public.invoice_items(id) ON DELETE CASCADE;

-- Add missing accounts for commission tracking if they don't exist
INSERT INTO public.accounts (organization_id, account_code, account_name, account_type, account_subtype, normal_balance, description, is_active)
SELECT DISTINCT 
    o.id as organization_id,
    '5101',
    'Commission Expense',
    'Expense',
    'Expense',
    'debit',
    'Staff commission expenses',
    true
FROM public.organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM public.accounts a 
    WHERE a.organization_id = o.id AND a.account_code = '5101'
);

INSERT INTO public.accounts (organization_id, account_code, account_name, account_type, account_subtype, normal_balance, description, is_active)
SELECT DISTINCT 
    o.id as organization_id,
    '2102',
    'Commission Payable',
    'Liability',
    'Current Liability',
    'credit',
    'Outstanding commission payments owed to staff',
    true
FROM public.organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM public.accounts a 
    WHERE a.organization_id = o.id AND a.account_code = '2102'
);

-- Remove the old trigger that fires on invoice 'sent' status
DROP TRIGGER IF EXISTS calculate_commission_trigger ON public.invoices;

-- Create new trigger that fires when invoice payments are made
CREATE OR REPLACE FUNCTION public.calculate_invoice_payment_commissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    -- Calculate commissions for the invoice when payment is made
    INSERT INTO public.staff_commissions (
        staff_id,
        invoice_id,
        invoice_item_id,
        commission_percentage,
        commission_amount,
        status,
        accrued_date
    )
    SELECT 
        ii.staff_id,
        ii.invoice_id,
        ii.id,
        COALESCE(ii.commission_percentage, s.commission_rate, 0),
        ROUND((ii.total_price * COALESCE(ii.commission_percentage, s.commission_rate, 0) / 100.0) * 
              (NEW.amount / i.total_amount), 2) as commission_amount,
        'accrued',
        NEW.payment_date::date
    FROM public.invoice_items ii
    LEFT JOIN public.staff s ON s.id = ii.staff_id
    JOIN public.invoices i ON i.id = ii.invoice_id
    WHERE ii.invoice_id = NEW.invoice_id 
    AND ii.staff_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM public.staff_commissions sc 
        WHERE sc.invoice_item_id = ii.id
    );
    
    RETURN NEW;
END;
$function$;

-- Create trigger on invoice_payments
CREATE TRIGGER calculate_payment_commission_trigger
    AFTER INSERT ON public.invoice_payments
    FOR EACH ROW
    EXECUTE FUNCTION public.calculate_invoice_payment_commissions();