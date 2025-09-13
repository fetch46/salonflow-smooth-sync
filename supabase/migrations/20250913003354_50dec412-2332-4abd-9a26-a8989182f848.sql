-- Add customer details columns to invoice_payments table for better tracking
ALTER TABLE public.invoice_payments 
ADD COLUMN IF NOT EXISTS customer_id UUID,
ADD COLUMN IF NOT EXISTS customer_name TEXT,
ADD COLUMN IF NOT EXISTS customer_email TEXT,
ADD COLUMN IF NOT EXISTS customer_phone TEXT;

-- Add index for better performance on customer lookups
CREATE INDEX IF NOT EXISTS idx_invoice_payments_customer_id ON public.invoice_payments(customer_id);