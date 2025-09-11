-- Add commission accounts to existing organizations
INSERT INTO public.accounts (organization_id, account_code, account_name, account_type, account_subtype, normal_balance, description, is_active)
SELECT DISTINCT 
    a.organization_id,
    '5101' as account_code,
    'Commission Expense' as account_name,
    'Expense' as account_type,
    'Expense' as account_subtype,
    'debit' as normal_balance,
    'Commission expenses paid to staff' as description,
    true as is_active
FROM accounts a
WHERE NOT EXISTS (
    SELECT 1 FROM accounts a2 
    WHERE a2.organization_id = a.organization_id AND a2.account_code = '5101'
);

INSERT INTO public.accounts (organization_id, account_code, account_name, account_type, account_subtype, normal_balance, description, is_active)
SELECT DISTINCT 
    a.organization_id,
    '2102' as account_code,
    'Commission Payable' as account_name,
    'Liability' as account_type,
    'Current Liability' as account_subtype,
    'credit' as normal_balance,
    'Commission owed to staff' as description,
    true as is_active
FROM accounts a
WHERE NOT EXISTS (
    SELECT 1 FROM accounts a2 
    WHERE a2.organization_id = a.organization_id AND a2.account_code = '2102'
);

-- Create function to handle commission payment with proper search path
CREATE OR REPLACE FUNCTION public.pay_staff_commission(
    p_commission_id UUID,
    p_payment_date DATE DEFAULT CURRENT_DATE,
    p_bank_account_id UUID DEFAULT NULL,
    p_payment_reference TEXT DEFAULT NULL
)
RETURNS BOOLEAN 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    commission_record RECORD;
    commission_payable_account UUID;
    bank_account UUID;
    org_id UUID;
BEGIN
    -- Get commission record
    SELECT * INTO commission_record 
    FROM staff_commissions 
    WHERE id = p_commission_id AND status = 'accrued';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Commission not found or already paid';
    END IF;
    
    -- Get organization
    SELECT s.organization_id INTO org_id 
    FROM staff s WHERE s.id = commission_record.staff_id;
    
    -- Get commission payable account (2102)
    SELECT id INTO commission_payable_account 
    FROM accounts 
    WHERE account_code = '2102' AND organization_id = org_id
    LIMIT 1;
    
    -- Get bank account (default to 1002 if not specified)
    IF p_bank_account_id IS NOT NULL THEN
        bank_account := p_bank_account_id;
    ELSE
        SELECT id INTO bank_account 
        FROM accounts 
        WHERE account_code = '1002' AND organization_id = org_id
        LIMIT 1;
    END IF;
    
    IF commission_payable_account IS NULL OR bank_account IS NULL THEN
        RAISE EXCEPTION 'Required accounts not found';
    END IF;
    
    -- Step 2: Dr Commission Payable, Cr Bank Account
    INSERT INTO account_transactions (
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
    
    INSERT INTO account_transactions (
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
    UPDATE staff_commissions 
    SET status = 'paid',
        paid_date = p_payment_date,
        payment_reference = p_payment_reference,
        updated_at = now()
    WHERE id = p_commission_id;
    
    RETURN TRUE;
END;
$$;