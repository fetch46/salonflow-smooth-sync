-- Add commission expense and commission payable accounts to chart of accounts
-- First, get sample organization IDs from existing accounts
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