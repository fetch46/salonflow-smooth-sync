-- Create journal_entries table for tracking journal entry headers
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  entry_date DATE NOT NULL,
  memo TEXT,
  total_debit NUMERIC NOT NULL DEFAULT 0,
  total_credit NUMERIC NOT NULL DEFAULT 0,
  reference_type TEXT DEFAULT 'manual_journal',
  reference_id TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

-- Create policy for organization members
CREATE POLICY "Organization members can manage journal entries" 
ON public.journal_entries 
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

-- Add journal_entry_id to account_transactions to link to journal headers
ALTER TABLE public.account_transactions 
ADD COLUMN IF NOT EXISTS journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_account_transactions_journal_entry_id 
ON public.account_transactions(journal_entry_id);

-- Create updated_at trigger for journal_entries
CREATE TRIGGER update_journal_entries_updated_at
BEFORE UPDATE ON public.journal_entries
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();