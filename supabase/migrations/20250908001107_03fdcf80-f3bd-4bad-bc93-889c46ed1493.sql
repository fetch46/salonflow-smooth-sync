-- Add income account to services table
ALTER TABLE public.services 
ADD COLUMN income_account_id UUID REFERENCES public.accounts(id);

-- Add index for better performance
CREATE INDEX idx_services_income_account ON public.services(income_account_id);

-- Add comment for clarity
COMMENT ON COLUMN public.services.income_account_id IS 'Account used for revenue booking when this service is sold';