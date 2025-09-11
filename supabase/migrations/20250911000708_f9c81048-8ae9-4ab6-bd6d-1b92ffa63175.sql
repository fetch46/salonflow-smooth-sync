-- Add commission expense and commission payable accounts to chart of accounts
INSERT INTO public.accounts (organization_id, account_code, account_name, account_type, account_subtype, normal_balance, description, is_active)
SELECT 
    o.id as organization_id,
    '5101' as account_code,
    'Commission Expense' as account_name,
    'Expense' as account_type,
    'Expense' as account_subtype,
    'debit' as normal_balance,
    'Commission expenses paid to staff' as description,
    true as is_active
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM accounts a 
    WHERE a.organization_id = o.id AND a.account_code = '5101'
);

INSERT INTO public.accounts (organization_id, account_code, account_name, account_type, account_subtype, normal_balance, description, is_active)
SELECT 
    o.id as organization_id,
    '2102' as account_code,
    'Commission Payable' as account_name,
    'Liability' as account_type,
    'Current Liability' as account_subtype,
    'credit' as normal_balance,
    'Commission owed to staff' as description,
    true as is_active
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM accounts a 
    WHERE a.organization_id = o.id AND a.account_code = '2102'
);

-- Create staff commission tracking table
CREATE TABLE IF NOT EXISTS public.staff_commissions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL,
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
CREATE POLICY "org_members_can_manage_staff_commissions" 
ON public.staff_commissions 
FOR ALL 
USING (organization_id IN (
    SELECT organization_id 
    FROM organization_users 
    WHERE user_id = auth.uid() AND is_active = true
))
WITH CHECK (organization_id IN (
    SELECT organization_id 
    FROM organization_users 
    WHERE user_id = auth.uid() AND is_active = true
));

-- Create function to post commission accounting entries
CREATE OR REPLACE FUNCTION public.post_commission_to_ledger()
RETURNS TRIGGER AS $$
DECLARE
    commission_expense_account UUID;
    commission_payable_account UUID;
    org_id UUID;
BEGIN
    -- Get organization from staff or invoice
    IF NEW.staff_id IS NOT NULL THEN
        SELECT s.organization_id INTO org_id 
        FROM staff s WHERE s.id = NEW.staff_id;
    ELSIF NEW.invoice_id IS NOT NULL THEN
        SELECT i.organization_id INTO org_id 
        FROM invoices i WHERE i.id = NEW.invoice_id;
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
CREATE TRIGGER post_commission_ledger_trigger
    AFTER INSERT ON public.staff_commissions
    FOR EACH ROW
    EXECUTE FUNCTION public.post_commission_to_ledger();

-- Create function to handle commission payment
CREATE OR REPLACE FUNCTION public.pay_staff_commission(
    p_commission_id UUID,
    p_payment_date DATE DEFAULT CURRENT_DATE,
    p_bank_account_id UUID DEFAULT NULL,
    p_payment_reference TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    commission_record RECORD;
    commission_payable_account UUID;
    bank_account UUID;
    org_id UUID;
BEGIN
    -- Get commission record
    SELECT * INTO commission_record 
    FROM public.staff_commissions 
    WHERE id = p_commission_id AND status = 'accrued';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Commission not found or already paid';
    END IF;
    
    -- Get organization
    SELECT s.organization_id INTO org_id 
    FROM staff s WHERE s.id = commission_record.staff_id;
    
    -- Get commission payable account (2102)
    SELECT id INTO commission_payable_account 
    FROM public.accounts 
    WHERE account_code = '2102' AND organization_id = org_id
    LIMIT 1;
    
    -- Get bank account (default to 1002 if not specified)
    IF p_bank_account_id IS NOT NULL THEN
        bank_account := p_bank_account_id;
    ELSE
        SELECT id INTO bank_account 
        FROM public.accounts 
        WHERE account_code = '1002' AND organization_id = org_id
        LIMIT 1;
    END IF;
    
    IF commission_payable_account IS NULL OR bank_account IS NULL THEN
        RAISE EXCEPTION 'Required accounts not found';
    END IF;
    
    -- Step 2: Dr Commission Payable, Cr Bank Account
    INSERT INTO public.account_transactions (
        account_id, transaction_date, description, 
        debit_amount, credit_amount, reference_type, reference_id
    ) VALUES (
        commission_payable_account, 
        p_payment_date,
        'Commission paid - Staff: ' || COALESCE((SELECT full_name FROM staff WHERE id = commission_record.staff_id), 'Unknown'),
        commission_record.commission_amount, 
        0, 
        'commission_payment', 
        p_commission_id::text
    );
    
    INSERT INTO public.account_transactions (
        account_id, transaction_date, description, 
        debit_amount, credit_amount, reference_type, reference_id
    ) VALUES (
        bank_account, 
        p_payment_date,
        'Commission paid - Staff: ' || COALESCE((SELECT full_name FROM staff WHERE id = commission_record.staff_id), 'Unknown'),
        0, 
        commission_record.commission_amount, 
        'commission_payment', 
        p_commission_id::text
    );
    
    -- Update commission status
    UPDATE public.staff_commissions 
    SET status = 'paid',
        paid_date = p_payment_date,
        payment_reference = p_payment_reference,
        updated_at = now()
    WHERE id = p_commission_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;