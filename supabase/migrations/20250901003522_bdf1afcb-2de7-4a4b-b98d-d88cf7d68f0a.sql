-- Create staff_commissions table to track commission payments
CREATE TABLE IF NOT EXISTS public.staff_commissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id uuid NOT NULL,
    invoice_id uuid NOT NULL,
    invoice_item_id uuid NOT NULL,
    commission_percentage numeric NOT NULL DEFAULT 0,
    commission_amount numeric NOT NULL DEFAULT 0,
    calculation_date timestamp with time zone NOT NULL DEFAULT now(),
    payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'cancelled')),
    payment_date timestamp with time zone NULL,
    notes text NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add RLS policies for staff_commissions
ALTER TABLE public.staff_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for staff_commissions" ON public.staff_commissions
    FOR ALL USING (true) WITH CHECK (true);

-- Create function to calculate and record commissions when invoice status changes to 'sent'
CREATE OR REPLACE FUNCTION public.calculate_invoice_commissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- Only process when status changes to 'sent'
    IF NEW.status = 'sent' AND (OLD.status IS NULL OR OLD.status != 'sent') THEN
        
        -- Insert commission records for all invoice items with staff assigned
        INSERT INTO public.staff_commissions (
            staff_id,
            invoice_id,
            invoice_item_id,
            commission_percentage,
            commission_amount
        )
        SELECT 
            ii.staff_id,
            ii.invoice_id,
            ii.id,
            COALESCE(ii.commission_percentage, s.commission_rate, 0),
            COALESCE(ii.commission_amount, 
                (ii.total_price * COALESCE(ii.commission_percentage, s.commission_rate, 0) / 100.0), 0)
        FROM public.invoice_items ii
        LEFT JOIN public.staff s ON s.id = ii.staff_id
        WHERE ii.invoice_id = NEW.id 
        AND ii.staff_id IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM public.staff_commissions sc 
            WHERE sc.invoice_item_id = ii.id
        );
        
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger for commission calculation
CREATE TRIGGER calculate_commissions_on_invoice_sent
    AFTER UPDATE ON public.invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.calculate_invoice_commissions();

-- Add updated_at trigger for staff_commissions
CREATE TRIGGER update_staff_commissions_updated_at
    BEFORE UPDATE ON public.staff_commissions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();