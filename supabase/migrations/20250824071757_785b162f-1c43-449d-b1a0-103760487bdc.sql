-- Create missing tables and fix type issues

-- Create missing billing_history table
CREATE TABLE IF NOT EXISTS public.billing_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  subscription_id uuid,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending',
  invoice_url text,
  paid_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create missing invoice_payments table
CREATE TABLE IF NOT EXISTS public.invoice_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'cash',
  payment_date timestamp with time zone NOT NULL DEFAULT now(),
  reference text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create missing receipts table
CREATE TABLE IF NOT EXISTS public.receipts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  location_id uuid,
  client_id uuid,
  receipt_number text NOT NULL,
  subtotal numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  payment_method text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create missing receipt_items table
CREATE TABLE IF NOT EXISTS public.receipt_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_id uuid NOT NULL,
  product_id uuid,
  service_id uuid,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total_price numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create missing receipt_payments table  
CREATE TABLE IF NOT EXISTS public.receipt_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  location_id uuid,
  amount numeric NOT NULL DEFAULT 0,
  method text NOT NULL DEFAULT 'cash',
  payment_date timestamp with time zone NOT NULL DEFAULT now(),
  reference text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create missing purchase_payments table
CREATE TABLE IF NOT EXISTS public.purchase_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  purchase_id uuid NOT NULL,
  account_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  reference text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.billing_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_payments ENABLE ROW LEVEL SECURITY;

-- Create basic policies for all tables (public access for now)
CREATE POLICY "Public access to billing_history" ON public.billing_history FOR ALL USING (true);
CREATE POLICY "Public access to invoice_payments" ON public.invoice_payments FOR ALL USING (true);
CREATE POLICY "Public access to receipts" ON public.receipts FOR ALL USING (true);
CREATE POLICY "Public access to receipt_items" ON public.receipt_items FOR ALL USING (true);
CREATE POLICY "Public access to receipt_payments" ON public.receipt_payments FOR ALL USING (true);
CREATE POLICY "Public access to purchase_payments" ON public.purchase_payments FOR ALL USING (true);