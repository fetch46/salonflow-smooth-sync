-- Create tax_rates table
CREATE TABLE public.tax_rates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  name text NOT NULL,
  rate numeric NOT NULL DEFAULT 0 CHECK (rate >= 0 AND rate <= 100),
  description text,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_org_tax_name UNIQUE (organization_id, name),
  CONSTRAINT only_one_default_per_org UNIQUE (organization_id, is_default) DEFERRABLE INITIALLY DEFERRED
);

-- Enable Row Level Security
ALTER TABLE public.tax_rates ENABLE ROW LEVEL SECURITY;

-- Create policies for tax_rates
CREATE POLICY "Organization members can view tax rates" 
ON public.tax_rates 
FOR SELECT 
USING (organization_id IN (
  SELECT organization_id 
  FROM organization_users 
  WHERE user_id = auth.uid() AND is_active = true
));

CREATE POLICY "Organization members can create tax rates" 
ON public.tax_rates 
FOR INSERT 
WITH CHECK (organization_id IN (
  SELECT organization_id 
  FROM organization_users 
  WHERE user_id = auth.uid() AND is_active = true
));

CREATE POLICY "Organization members can update tax rates" 
ON public.tax_rates 
FOR UPDATE 
USING (organization_id IN (
  SELECT organization_id 
  FROM organization_users 
  WHERE user_id = auth.uid() AND is_active = true
));

CREATE POLICY "Organization members can delete tax rates" 
ON public.tax_rates 
FOR DELETE 
USING (organization_id IN (
  SELECT organization_id 
  FROM organization_users 
  WHERE user_id = auth.uid() AND is_active = true
));

-- Create trigger for updated_at
CREATE TRIGGER update_tax_rates_updated_at
BEFORE UPDATE ON public.tax_rates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();