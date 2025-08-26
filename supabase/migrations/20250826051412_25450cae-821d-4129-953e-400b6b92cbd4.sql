-- Ensure organizations table has country_id and currency_id columns
DO $$ 
BEGIN
    -- Add country_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organizations' 
        AND column_name = 'country_id' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.organizations 
        ADD COLUMN country_id UUID REFERENCES public.countries(id);
    END IF;
    
    -- Add currency_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organizations' 
        AND column_name = 'currency_id' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.organizations 
        ADD COLUMN currency_id UUID REFERENCES public.currencies(id);
    END IF;
END $$;