-- Add jobcard_reference column to invoices table
-- This allows storing the job card ID reference separately from jobcard_id
-- and ensures proper filtering of job cards by customer

-- Add jobcard_reference column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'invoices' 
        AND column_name = 'jobcard_reference'
    ) THEN
        ALTER TABLE public.invoices ADD COLUMN jobcard_reference UUID;
        
        -- Add foreign key constraint
        ALTER TABLE public.invoices 
        ADD CONSTRAINT fk_invoices_jobcard_reference 
        FOREIGN KEY (jobcard_reference) 
        REFERENCES public.job_cards(id)
        ON DELETE SET NULL;
        
        -- Create index for better performance
        CREATE INDEX idx_invoices_jobcard_reference ON public.invoices(jobcard_reference);
        
        -- Copy existing jobcard_id values to jobcard_reference if needed
        UPDATE public.invoices 
        SET jobcard_reference = jobcard_id 
        WHERE jobcard_id IS NOT NULL AND jobcard_reference IS NULL;
    END IF;
END $$;

-- Add comment to clarify the column purpose
COMMENT ON COLUMN public.invoices.jobcard_reference IS 'Reference to the job card used for this invoice';