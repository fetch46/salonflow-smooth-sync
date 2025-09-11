-- Create staff commission tracking table
CREATE TABLE IF NOT EXISTS public.staff_commissions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    staff_id UUID NOT NULL,
    invoice_id UUID,
    invoice_item_id UUID,
    job_card_id UUID,
    service_id UUID,
    commission_percentage NUMERIC NOT NULL DEFAULT 0,
    commission_amount NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'accrued', -- 'accrued', 'paid'
    accrued_date DATE NOT NULL DEFAULT CURRENT_DATE,
    paid_date DATE,
    payment_reference TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on staff_commissions
ALTER TABLE public.staff_commissions ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for staff_commissions
CREATE POLICY "public_access_staff_commissions" 
ON public.staff_commissions 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create function to post commission accounting entries
CREATE OR REPLACE FUNCTION public.post_commission_to_ledger()
RETURNS TRIGGER AS $$
DECLARE
    commission_expense_account UUID;
    commission_payable_account UUID;
    org_id UUID;
BEGIN
    -- Get organization from staff
    IF NEW.staff_id IS NOT NULL THEN
        SELECT s.organization_id INTO org_id 
        FROM staff s WHERE s.id = NEW.staff_id;
    ELSIF NEW.job_card_id IS NOT NULL THEN
        SELECT jc.organization_id INTO org_id 
        FROM job_cards jc WHERE jc.id = NEW.job_card_id;
    END IF;
    
    IF org_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Get commission expense account (5101)
    SELECT id INTO commission_expense_account 
    FROM public.accounts 
    WHERE account_code = '5101' AND organization_id = org_id
    LIMIT 1;
    
    -- Get commission payable account (2102)  
    SELECT id INTO commission_payable_account 
    FROM public.accounts 
    WHERE account_code = '2102' AND organization_id = org_id
    LIMIT 1;
    
    -- Only post if status is 'accrued' and both accounts exist
    IF NEW.status = 'accrued' AND NEW.commission_amount > 0 AND 
       commission_expense_account IS NOT NULL AND commission_payable_account IS NOT NULL THEN
       
        -- Step 1: Dr Commission Expense, Cr Commission Payable
        INSERT INTO public.account_transactions (
            account_id, transaction_date, description, 
            debit_amount, credit_amount, reference_type, reference_id
        ) VALUES (
            commission_expense_account, 
            COALESCE(NEW.accrued_date, CURRENT_DATE),
            'Commission accrued - Staff: ' || COALESCE((SELECT full_name FROM staff WHERE id = NEW.staff_id), 'Unknown'),
            NEW.commission_amount, 
            0, 
            'staff_commission', 
            NEW.id::text
        );
        
        INSERT INTO public.account_transactions (
            account_id, transaction_date, description, 
            debit_amount, credit_amount, reference_type, reference_id
        ) VALUES (
            commission_payable_account, 
            COALESCE(NEW.accrued_date, CURRENT_DATE),
            'Commission payable - Staff: ' || COALESCE((SELECT full_name FROM staff WHERE id = NEW.staff_id), 'Unknown'),
            0, 
            NEW.commission_amount, 
            'staff_commission', 
            NEW.id::text
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for commission accounting
DROP TRIGGER IF EXISTS post_commission_ledger_trigger ON public.staff_commissions;
CREATE TRIGGER post_commission_ledger_trigger
    AFTER INSERT ON public.staff_commissions
    FOR EACH ROW
    EXECUTE FUNCTION public.post_commission_to_ledger();