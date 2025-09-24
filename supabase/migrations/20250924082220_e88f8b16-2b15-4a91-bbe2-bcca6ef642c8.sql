-- Create mpesa_payments table for tracking Mpesa transactions
CREATE TABLE public.mpesa_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  phone_number TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  account_reference TEXT NOT NULL,
  transaction_desc TEXT,
  merchant_request_id TEXT,
  checkout_request_id TEXT UNIQUE,
  response_code TEXT,
  response_description TEXT,
  customer_message TEXT,
  mpesa_receipt_number TEXT UNIQUE,
  transaction_date TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'cancelled')),
  reference_type TEXT, -- 'invoice', 'receipt', 'job_card', etc.
  reference_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mpesa_payments ENABLE ROW LEVEL SECURITY;

-- Create policies for organization-scoped access
CREATE POLICY "Users can view mpesa payments in their organization" 
ON public.mpesa_payments 
FOR SELECT 
USING (public.is_member_of_organization(organization_id));

CREATE POLICY "Users can create mpesa payments in their organization" 
ON public.mpesa_payments 
FOR INSERT 
WITH CHECK (public.is_member_of_organization(organization_id));

CREATE POLICY "Users can update mpesa payments in their organization" 
ON public.mpesa_payments 
FOR UPDATE 
USING (public.is_member_of_organization(organization_id));

-- Create indexes for performance
CREATE INDEX idx_mpesa_payments_organization_id ON public.mpesa_payments(organization_id);
CREATE INDEX idx_mpesa_payments_checkout_request_id ON public.mpesa_payments(checkout_request_id);
CREATE INDEX idx_mpesa_payments_reference ON public.mpesa_payments(reference_type, reference_id);
CREATE INDEX idx_mpesa_payments_status ON public.mpesa_payments(status);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_mpesa_payments_updated_at
BEFORE UPDATE ON public.mpesa_payments
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();