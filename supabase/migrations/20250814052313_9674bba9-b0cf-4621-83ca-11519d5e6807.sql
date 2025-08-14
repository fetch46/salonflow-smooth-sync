-- Fix database schema issues for invoice_items and services relationship
-- Add missing service_id column to invoice_items if it doesn't exist
DO $$ 
BEGIN
    -- Add service_id column to invoice_items if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoice_items' AND column_name = 'service_id') THEN
        ALTER TABLE public.invoice_items ADD COLUMN service_id UUID;
    END IF;
    
    -- Add product_id column to invoice_items if missing  
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoice_items' AND column_name = 'product_id') THEN
        ALTER TABLE public.invoice_items ADD COLUMN product_id UUID;
    END IF;
    
    -- Add staff_id column to invoice_items if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoice_items' AND column_name = 'staff_id') THEN
        ALTER TABLE public.invoice_items ADD COLUMN staff_id UUID;
    END IF;
    
    -- Add commission_percentage column to invoice_items if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoice_items' AND column_name = 'commission_percentage') THEN
        ALTER TABLE public.invoice_items ADD COLUMN commission_percentage NUMERIC DEFAULT 0;
    END IF;
    
    -- Add commission_amount column to invoice_items if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoice_items' AND column_name = 'commission_amount') THEN
        ALTER TABLE public.invoice_items ADD COLUMN commission_amount NUMERIC DEFAULT 0;
    END IF;
    
    -- Add discount_percentage column to invoice_items if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoice_items' AND column_name = 'discount_percentage') THEN
        ALTER TABLE public.invoice_items ADD COLUMN discount_percentage NUMERIC DEFAULT 0;
    END IF;
END $$;

-- Create services table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID,
    name TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER DEFAULT 60,
    price NUMERIC DEFAULT 0,
    category TEXT,
    is_active BOOLEAN DEFAULT true,
    commission_percentage NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    location_id UUID
);

-- Create staff table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    specialties TEXT[],
    is_active BOOLEAN DEFAULT true,
    commission_rate NUMERIC DEFAULT 0,
    hire_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create staff_default_locations table for location assignments
CREATE TABLE IF NOT EXISTS public.staff_default_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL,
    location_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(staff_id)
);

-- Create service_kits table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.service_kits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL,
    good_id UUID NOT NULL,
    default_quantity NUMERIC DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add missing organization_id to expenses if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'organization_id') THEN
        ALTER TABLE public.expenses ADD COLUMN organization_id UUID;
    END IF;
END $$;

-- Enable RLS on all tables
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_default_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_kits ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for services
DO $$
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Public access to services" ON public.services;
    DROP POLICY IF EXISTS "allow_all_services" ON public.services;
    
    -- Create new policy
    CREATE POLICY "allow_all_services" ON public.services FOR ALL USING (true) WITH CHECK (true);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Create RLS policies for staff
DO $$
BEGIN
    DROP POLICY IF EXISTS "Public access to staff" ON public.staff;
    DROP POLICY IF EXISTS "allow_all_staff" ON public.staff;
    
    CREATE POLICY "allow_all_staff" ON public.staff FOR ALL USING (true) WITH CHECK (true);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Create RLS policies for staff_default_locations
DO $$
BEGIN
    DROP POLICY IF EXISTS "allow_all_staff_default_locations" ON public.staff_default_locations;
    
    CREATE POLICY "allow_all_staff_default_locations" ON public.staff_default_locations FOR ALL USING (true) WITH CHECK (true);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Create RLS policies for service_kits  
DO $$
BEGIN
    DROP POLICY IF EXISTS "allow_all_service_kits" ON public.service_kits;
    
    CREATE POLICY "allow_all_service_kits" ON public.service_kits FOR ALL USING (true) WITH CHECK (true);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Add updated_at trigger for services
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path TO 'public';

-- Create triggers if they don't exist
DO $$
BEGIN
    DROP TRIGGER IF EXISTS update_services_updated_at ON public.services;
    CREATE TRIGGER update_services_updated_at 
        BEFORE UPDATE ON public.services
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
        
    DROP TRIGGER IF EXISTS update_staff_updated_at ON public.staff;
    CREATE TRIGGER update_staff_updated_at 
        BEFORE UPDATE ON public.staff
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
        
    DROP TRIGGER IF EXISTS update_service_kits_updated_at ON public.service_kits;
    CREATE TRIGGER update_service_kits_updated_at 
        BEFORE UPDATE ON public.service_kits
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;