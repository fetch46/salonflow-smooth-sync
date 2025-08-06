-- Add job_number generation function
CREATE OR REPLACE FUNCTION generate_job_number()
RETURNS TEXT AS $$
DECLARE
    next_number INTEGER;
    job_number TEXT;
BEGIN
    -- Get the next number in sequence
    SELECT COALESCE(MAX(CAST(SUBSTRING(job_number FROM 'JC(\d+)') AS INTEGER)), 0) + 1
    INTO next_number
    FROM job_cards
    WHERE job_number ~ '^JC\d+$';
    
    -- Format as JC001, JC002, etc.
    job_number := 'JC' || LPAD(next_number::TEXT, 3, '0');
    
    RETURN job_number;
END;
$$ LANGUAGE plpgsql;

-- Update job_cards table to auto-generate job numbers
ALTER TABLE job_cards ALTER COLUMN job_number SET DEFAULT generate_job_number();

-- Add product quantities used to job cards
CREATE TABLE public.job_card_products (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    job_card_id UUID NOT NULL REFERENCES job_cards(id) ON DELETE CASCADE,
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
    quantity_used DECIMAL NOT NULL DEFAULT 0,
    unit_cost DECIMAL NOT NULL DEFAULT 0,
    total_cost DECIMAL NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on job_card_products
ALTER TABLE public.job_card_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access to job_card_products" 
ON public.job_card_products 
FOR ALL 
USING (true);

-- Add trigger for job_card_products timestamps
CREATE TRIGGER update_job_card_products_updated_at
BEFORE UPDATE ON public.job_card_products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enhance service_kits table to include default quantities
ALTER TABLE service_kits ADD COLUMN IF NOT EXISTS default_quantity DECIMAL DEFAULT 1;

-- Update inventory_items to include cost and selling price
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS cost_price DECIMAL DEFAULT 0;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS selling_price DECIMAL DEFAULT 0;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS category TEXT;

-- Add client preferences and history tracking
ALTER TABLE clients ADD COLUMN IF NOT EXISTS preferred_technician_id UUID REFERENCES staff(id);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_visit_date DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS total_visits INTEGER DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS total_spent DECIMAL DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_status TEXT DEFAULT 'active';

-- Enhance appointments table
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES services(id);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS total_amount DECIMAL DEFAULT 0;