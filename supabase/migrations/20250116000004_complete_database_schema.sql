-- Complete Database Schema Migration
-- This migration ensures all required tables exist with correct structure and relationships

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create missing tables or update existing ones to match TypeScript types

-- 1. PROFILES TABLE (if not exists)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CLIENTS TABLE (update if exists, create if not)
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    date_of_birth DATE,
    client_status TEXT DEFAULT 'active',
    notes TEXT,
    last_visit_date DATE,
    total_visits INTEGER DEFAULT 0,
    total_spent DECIMAL(10,2) DEFAULT 0,
    preferred_technician_id UUID REFERENCES staff(id),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. STAFF TABLE (update if exists, create if not)
CREATE TABLE IF NOT EXISTS staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    position TEXT,
    hire_date DATE,
    salary DECIMAL(10,2),
    commission_rate DECIMAL(5,2),
    specialties TEXT,
    is_active BOOLEAN DEFAULT true,
    profile_image TEXT,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. SERVICES TABLE (update if exists, create if not)
CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    price DECIMAL(10,2) NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    is_active BOOLEAN DEFAULT true,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. APPOINTMENTS TABLE (update if exists, create if not)
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    client_id UUID REFERENCES clients(id),
    staff_id UUID REFERENCES staff(id),
    service_id UUID REFERENCES services(id),
    duration_minutes INTEGER,
    status TEXT DEFAULT 'scheduled',
    notes TEXT,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. INVENTORY_ITEMS TABLE (update if exists, create if not)
CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    sku TEXT,
    category TEXT,
    type TEXT DEFAULT 'product',
    cost_price DECIMAL(10,2),
    selling_price DECIMAL(10,2),
    current_stock DECIMAL(10,2) DEFAULT 0,
    minimum_stock DECIMAL(10,2) DEFAULT 0,
    unit TEXT,
    is_active BOOLEAN DEFAULT true,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. BUSINESS_LOCATIONS TABLE (ensure exists)
CREATE TABLE IF NOT EXISTS public.business_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  address TEXT,
  phone TEXT,
  manager_id UUID REFERENCES public.staff(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. INVENTORY_LEVELS TABLE (update if exists, create if not)
CREATE TABLE IF NOT EXISTS inventory_levels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES public.business_locations(id) ON DELETE CASCADE,
    quantity DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(item_id, location_id)
);

-- 9. SERVICE_KITS TABLE (update if exists, create if not)
CREATE TABLE IF NOT EXISTS service_kits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    good_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    default_quantity DECIMAL(10,2) DEFAULT 1,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. JOB_CARDS TABLE (update if exists, create if not)
CREATE TABLE IF NOT EXISTS job_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_number TEXT UNIQUE NOT NULL,
    client_id UUID REFERENCES clients(id),
    staff_id UUID REFERENCES staff(id),
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    status TEXT DEFAULT 'in_progress',
    total_amount DECIMAL(10,2) DEFAULT 0,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. JOB_CARD_PRODUCTS TABLE (update if exists, create if not)
CREATE TABLE IF NOT EXISTS job_card_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_card_id UUID NOT NULL REFERENCES job_cards(id) ON DELETE CASCADE,
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
    quantity_used DECIMAL(10,2) NOT NULL,
    unit_cost DECIMAL(10,2) NOT NULL,
    total_cost DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. EXPENSES TABLE (update if exists, create if not)
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expense_number TEXT UNIQUE NOT NULL,
    expense_date DATE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    category TEXT,
    description TEXT,
    supplier_id UUID REFERENCES suppliers(id),
    receipt_url TEXT,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. PURCHASES TABLE (update if exists, create if not)
CREATE TABLE IF NOT EXISTS purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_number TEXT UNIQUE NOT NULL,
    purchase_date DATE NOT NULL,
    supplier_id UUID REFERENCES suppliers(id),
    total_amount DECIMAL(10,2) NOT NULL,
    status TEXT DEFAULT 'pending',
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. PURCHASE_ITEMS TABLE (update if exists, create if not)
CREATE TABLE IF NOT EXISTS purchase_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES inventory_items(id),
    quantity DECIMAL(10,2) NOT NULL,
    received_quantity DECIMAL(10,2) DEFAULT 0,
    unit_cost DECIMAL(10,2) NOT NULL,
    total_cost DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. SUPPLIERS TABLE (update if exists, create if not)
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    contact_name TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    payment_terms TEXT,
    supplier_type TEXT,
    rating INTEGER DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. ACCOUNTS TABLE (update if exists, create if not)
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_code TEXT UNIQUE NOT NULL,
    account_name TEXT NOT NULL,
    account_type TEXT NOT NULL,
    normal_balance TEXT NOT NULL,
    description TEXT,
    balance DECIMAL(10,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    parent_account_id UUID REFERENCES accounts(id),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 17. ACCOUNT_TRANSACTIONS TABLE (update if exists, create if not)
CREATE TABLE IF NOT EXISTS account_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    transaction_date DATE NOT NULL,
    description TEXT NOT NULL,
    debit_amount DECIMAL(10,2) DEFAULT 0,
    credit_amount DECIMAL(10,2) DEFAULT 0,
    reference_type TEXT,
    reference_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 18. SALES TABLE (update if exists, create if not)
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_number TEXT UNIQUE NOT NULL,
    sale_date DATE NOT NULL,
    customer_id UUID REFERENCES clients(id),
    staff_id UUID REFERENCES staff(id),
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    payment_method TEXT,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 19. SALE_ITEMS TABLE (update if exists, create if not)
CREATE TABLE IF NOT EXISTS sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES inventory_items(id),
    quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 20. INVOICES TABLE (update if exists, create if not)
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number TEXT UNIQUE NOT NULL,
    customer_id UUID REFERENCES clients(id),
    customer_name TEXT NOT NULL,
    customer_email TEXT,
    customer_phone TEXT,
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
    due_date DATE,
    payment_method TEXT,
    notes TEXT,
    jobcard_id UUID REFERENCES job_cards(id),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 21. INVOICE_ITEMS TABLE (update if exists, create if not)
CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id),
    product_id UUID REFERENCES inventory_items(id),
    description TEXT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    discount_percentage DECIMAL(5,2) DEFAULT 0,
    staff_id UUID REFERENCES staff(id),
    commission_percentage DECIMAL(5,2) DEFAULT 0,
    total_price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 21b. APPOINTMENT_SERVICES TABLE (update if exists, create if not)
CREATE TABLE IF NOT EXISTS appointment_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id),
    staff_id UUID REFERENCES staff(id),
    duration_minutes INTEGER,
    price DECIMAL(10,2),
    notes TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 22. INVENTORY_ADJUSTMENTS TABLE (update if exists, create if not)
CREATE TABLE IF NOT EXISTS inventory_adjustments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    adjustment_number TEXT UNIQUE NOT NULL,
    adjustment_date DATE NOT NULL,
    adjustment_type TEXT NOT NULL,
    adjustment_reason TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    notes TEXT,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 23. INVENTORY_ADJUSTMENT_ITEMS TABLE (update if exists, create if not)
CREATE TABLE IF NOT EXISTS inventory_adjustment_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    adjustment_id UUID NOT NULL REFERENCES inventory_adjustments(id) ON DELETE CASCADE,
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
    quantity_adjusted DECIMAL(10,2) NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns to existing tables if they don't exist
DO $$
BEGIN
    -- Add organization_id to tables that might not have it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'organization_id') THEN
        ALTER TABLE clients ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'organization_id') THEN
        ALTER TABLE staff ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'organization_id') THEN
        ALTER TABLE services ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'organization_id') THEN
        ALTER TABLE appointments ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_items' AND column_name = 'organization_id') THEN
        ALTER TABLE inventory_items ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_kits' AND column_name = 'organization_id') THEN
        ALTER TABLE service_kits ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_cards' AND column_name = 'organization_id') THEN
        ALTER TABLE job_cards ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'organization_id') THEN
        ALTER TABLE expenses ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchases' AND column_name = 'organization_id') THEN
        ALTER TABLE purchases ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'organization_id') THEN
        ALTER TABLE suppliers ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'organization_id') THEN
        ALTER TABLE accounts ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'organization_id') THEN
        ALTER TABLE sales ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'organization_id') THEN
        ALTER TABLE invoices ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_adjustments' AND column_name = 'organization_id') THEN
        ALTER TABLE inventory_adjustments ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    END IF;
    
    -- Add missing columns to accounts table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'normal_balance') THEN
        ALTER TABLE accounts ADD COLUMN normal_balance TEXT NOT NULL DEFAULT 'debit';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'balance') THEN
        ALTER TABLE accounts ADD COLUMN balance DECIMAL(10,2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'is_active') THEN
        ALTER TABLE accounts ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
    
    -- Add missing columns to suppliers table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'contact_email') THEN
        ALTER TABLE suppliers ADD COLUMN contact_email TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'contact_name') THEN
        ALTER TABLE suppliers ADD COLUMN contact_name TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'contact_phone') THEN
        ALTER TABLE suppliers ADD COLUMN contact_phone TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'payment_terms') THEN
        ALTER TABLE suppliers ADD COLUMN payment_terms TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'supplier_type') THEN
        ALTER TABLE suppliers ADD COLUMN supplier_type TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'rating') THEN
        ALTER TABLE suppliers ADD COLUMN rating INTEGER DEFAULT 5 CHECK (rating >= 1 AND rating <= 5);
    END IF;
    
    -- Add missing columns to sales table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'sale_date') THEN
        ALTER TABLE sales ADD COLUMN sale_date DATE NOT NULL DEFAULT CURRENT_DATE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'staff_id') THEN
        ALTER TABLE sales ADD COLUMN staff_id UUID REFERENCES staff(id);
    END IF;
    
    -- Add missing columns to sale_items table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sale_items' AND column_name = 'discount_amount') THEN
        ALTER TABLE sale_items ADD COLUMN discount_amount DECIMAL(10,2) DEFAULT 0;
    END IF;
    
    -- Add missing columns to inventory_adjustment_items table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_adjustment_items' AND column_name = 'inventory_item_id') THEN
        ALTER TABLE inventory_adjustment_items ADD COLUMN inventory_item_id UUID REFERENCES inventory_items(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_adjustment_items' AND column_name = 'quantity_adjusted') THEN
        ALTER TABLE inventory_adjustment_items ADD COLUMN quantity_adjusted DECIMAL(10,2) NOT NULL DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_adjustment_items' AND column_name = 'reason') THEN
        ALTER TABLE inventory_adjustment_items ADD COLUMN reason TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_adjustment_items' AND column_name = 'updated_at') THEN
        ALTER TABLE inventory_adjustment_items ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
    
    -- Add missing columns to job_card_products table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_card_products' AND column_name = 'updated_at') THEN
        ALTER TABLE job_card_products ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
    
    -- Add missing columns to purchase_items table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_items' AND column_name = 'updated_at') THEN
        ALTER TABLE purchase_items ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
    
    -- Add missing columns to sale_items table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sale_items' AND column_name = 'updated_at') THEN
        ALTER TABLE sale_items ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
    
END $$;

-- Make organization_id NOT NULL for all tenant tables
ALTER TABLE clients ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE staff ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE services ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE appointments ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE inventory_items ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE service_kits ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE job_cards ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE expenses ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE purchases ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE suppliers ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE accounts ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE sales ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE invoices ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE inventory_adjustments ALTER COLUMN organization_id SET NOT NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_clients_organization_id ON clients(organization_id);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
CREATE INDEX IF NOT EXISTS idx_staff_organization_id ON staff(organization_id);
CREATE INDEX IF NOT EXISTS idx_staff_email ON staff(email);
CREATE INDEX IF NOT EXISTS idx_services_organization_id ON services(organization_id);
CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);
CREATE INDEX IF NOT EXISTS idx_appointments_organization_id ON appointments(organization_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_client_id ON appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_staff_id ON appointments(staff_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_organization_id ON inventory_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_sku ON inventory_items(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON inventory_items(category);
-- Indexes for appointment_services
CREATE INDEX IF NOT EXISTS idx_appointment_services_appointment_id ON appointment_services(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_services_service_id ON appointment_services(service_id);
CREATE INDEX IF NOT EXISTS idx_appointment_services_staff_id ON appointment_services(staff_id);
-- storage_locations index no longer needed; business_locations managed separately
CREATE INDEX IF NOT EXISTS idx_inventory_levels_item_location ON inventory_levels(item_id, location_id);
CREATE INDEX IF NOT EXISTS idx_service_kits_organization_id ON service_kits(organization_id);
CREATE INDEX IF NOT EXISTS idx_service_kits_service_id ON service_kits(service_id);
CREATE INDEX IF NOT EXISTS idx_job_cards_organization_id ON job_cards(organization_id);
CREATE INDEX IF NOT EXISTS idx_job_cards_job_number ON job_cards(job_number);
CREATE INDEX IF NOT EXISTS idx_job_cards_client_id ON job_cards(client_id);
CREATE INDEX IF NOT EXISTS idx_job_cards_staff_id ON job_cards(staff_id);
CREATE INDEX IF NOT EXISTS idx_job_card_products_job_card_id ON job_card_products(job_card_id);
CREATE INDEX IF NOT EXISTS idx_expenses_organization_id ON expenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_number ON expenses(expense_number);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_purchases_organization_id ON purchases(organization_id);
CREATE INDEX IF NOT EXISTS idx_purchases_purchase_number ON purchases(purchase_number);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchase_date);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_organization_id ON suppliers(organization_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
CREATE INDEX IF NOT EXISTS idx_accounts_organization_id ON accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_accounts_code ON accounts(account_code);
CREATE INDEX IF NOT EXISTS idx_account_transactions_account_id ON account_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_account_transactions_date ON account_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_sales_organization_id ON sales(organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_sale_number ON sales(sale_number);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_invoices_organization_id ON invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_organization_id ON inventory_adjustments(organization_id);
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_number ON inventory_adjustments(adjustment_number);
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_date ON inventory_adjustments(adjustment_date);
CREATE INDEX IF NOT EXISTS idx_inventory_adjustment_items_adjustment_id ON inventory_adjustment_items(adjustment_id);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_card_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_adjustment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_services ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for all tables
-- Generic function to create tenant-based policies
CREATE OR REPLACE FUNCTION create_tenant_policy(table_name text)
RETURNS void AS $$
BEGIN
    -- Policy for SELECT
    EXECUTE format('
        CREATE POLICY "Users can view their organization data" ON %I
        FOR SELECT
        USING (
            organization_id IN (
                SELECT organization_id 
                FROM organization_users 
                WHERE user_id = auth.uid() AND is_active = true
            )
        )', table_name);
    
    -- Policy for INSERT
    EXECUTE format('
        CREATE POLICY "Users can insert data for their organization" ON %I
        FOR INSERT
        WITH CHECK (
            organization_id IN (
                SELECT organization_id 
                FROM organization_users 
                WHERE user_id = auth.uid() 
                AND role IN (''owner'', ''admin'', ''manager'', ''staff'')
                AND is_active = true
            )
        )', table_name);
    
    -- Policy for UPDATE
    EXECUTE format('
        CREATE POLICY "Users can update their organization data" ON %I
        FOR UPDATE
        USING (
            organization_id IN (
                SELECT organization_id 
                FROM organization_users 
                WHERE user_id = auth.uid() 
                AND role IN (''owner'', ''admin'', ''manager'', ''staff'')
                AND is_active = true
            )
        )', table_name);
    
    -- Policy for DELETE (restricted to admins)
    EXECUTE format('
        CREATE POLICY "Admins can delete their organization data" ON %I
        FOR DELETE
        USING (
            organization_id IN (
                SELECT organization_id 
                FROM organization_users 
                WHERE user_id = auth.uid() 
                AND role IN (''owner'', ''admin'')
                AND is_active = true
            )
        )', table_name);
END;
$$ LANGUAGE plpgsql;

-- Apply tenant policies to all tables
SELECT create_tenant_policy('clients');
SELECT create_tenant_policy('staff');
SELECT create_tenant_policy('services');
SELECT create_tenant_policy('appointments');
SELECT create_tenant_policy('inventory_items');
SELECT create_tenant_policy('service_kits');
SELECT create_tenant_policy('job_cards');
SELECT create_tenant_policy('expenses');
SELECT create_tenant_policy('purchases');
SELECT create_tenant_policy('suppliers');
SELECT create_tenant_policy('accounts');
SELECT create_tenant_policy('sales');
SELECT create_tenant_policy('invoices');
SELECT create_tenant_policy('inventory_adjustments');

-- Special policies for tables without organization_id
-- Profiles policy
CREATE POLICY "Users can view their own profile" ON profiles
    FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Users can insert their own profile" ON profiles
    FOR INSERT WITH CHECK (id = auth.uid());

-- Storage locations policy (global, but organization-scoped)
CREATE POLICY "Users can view storage locations" ON storage_locations
    FOR SELECT USING (true);

CREATE POLICY "Users can manage storage locations" ON storage_locations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM organization_users 
            WHERE user_id = auth.uid() 
            AND role IN ('owner', 'admin', 'manager', 'staff')
            AND is_active = true
        )
    );

-- Policies for junction tables
CREATE POLICY "Users can view inventory levels" ON inventory_levels
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM organization_users 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Users can manage inventory levels" ON inventory_levels
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM organization_users 
            WHERE user_id = auth.uid() 
            AND role IN ('owner', 'admin', 'manager', 'staff')
            AND is_active = true
        )
    );

-- Policies for item tables
CREATE POLICY "Users can view job card products" ON job_card_products
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM organization_users 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Users can manage job card products" ON job_card_products
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM organization_users 
            WHERE user_id = auth.uid() 
            AND role IN ('owner', 'admin', 'manager', 'staff')
            AND is_active = true
        )
    );

CREATE POLICY "Users can view appointment services" ON appointment_services
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM organization_users 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Users can manage appointment services" ON appointment_services
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM organization_users 
            WHERE user_id = auth.uid() 
            AND role IN ('owner', 'admin', 'manager', 'staff')
            AND is_active = true
        )
    );

CREATE POLICY "Users can view purchase items" ON purchase_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM organization_users 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Users can manage purchase items" ON purchase_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM organization_users 
            WHERE user_id = auth.uid() 
            AND role IN ('owner', 'admin', 'manager', 'staff')
            AND is_active = true
        )
    );

CREATE POLICY "Users can view sale items" ON sale_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM organization_users 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Users can manage sale items" ON sale_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM organization_users 
            WHERE user_id = auth.uid() 
            AND role IN ('owner', 'admin', 'manager', 'staff')
            AND is_active = true
        )
    );

CREATE POLICY "Users can view invoice items" ON invoice_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM organization_users 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Users can manage invoice items" ON invoice_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM organization_users 
            WHERE user_id = auth.uid() 
            AND role IN ('owner', 'admin', 'manager', 'staff')
            AND is_active = true
        )
    );

CREATE POLICY "Users can view inventory adjustment items" ON inventory_adjustment_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM organization_users 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Users can manage inventory adjustment items" ON inventory_adjustment_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM organization_users 
            WHERE user_id = auth.uid() 
            AND role IN ('owner', 'admin', 'manager', 'staff')
            AND is_active = true
        )
    );

-- Policies for account transactions
CREATE POLICY "Users can view account transactions" ON account_transactions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM organization_users 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Users can manage account transactions" ON account_transactions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM organization_users 
            WHERE user_id = auth.uid() 
            AND role IN ('owner', 'admin', 'manager')
            AND is_active = true
        )
    );

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for all tables with updated_at columns
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON staff FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_inventory_items_updated_at BEFORE UPDATE ON inventory_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_storage_locations_updated_at BEFORE UPDATE ON storage_locations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_inventory_levels_updated_at BEFORE UPDATE ON inventory_levels FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_service_kits_updated_at BEFORE UPDATE ON service_kits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_job_cards_updated_at BEFORE UPDATE ON job_cards FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_job_card_products_updated_at BEFORE UPDATE ON job_card_products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_purchases_updated_at BEFORE UPDATE ON purchases FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_purchase_items_updated_at BEFORE UPDATE ON purchase_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON sales FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sale_items_updated_at BEFORE UPDATE ON sale_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_inventory_adjustments_updated_at BEFORE UPDATE ON inventory_adjustments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_inventory_adjustment_items_updated_at BEFORE UPDATE ON inventory_adjustment_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Drop the helper function (no longer needed after setup)
DROP FUNCTION create_tenant_policy(text);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON profiles TO authenticated;
GRANT ALL ON clients TO authenticated;
GRANT ALL ON staff TO authenticated;
GRANT ALL ON services TO authenticated;
GRANT ALL ON appointments TO authenticated;
GRANT ALL ON inventory_items TO authenticated;
GRANT ALL ON storage_locations TO authenticated;
GRANT ALL ON inventory_levels TO authenticated;
GRANT ALL ON service_kits TO authenticated;
GRANT ALL ON job_cards TO authenticated;
GRANT ALL ON job_card_products TO authenticated;
GRANT ALL ON expenses TO authenticated;
GRANT ALL ON purchases TO authenticated;
GRANT ALL ON purchase_items TO authenticated;
GRANT ALL ON suppliers TO authenticated;
GRANT ALL ON accounts TO authenticated;
GRANT ALL ON account_transactions TO authenticated;
GRANT ALL ON sales TO authenticated;
GRANT ALL ON sale_items TO authenticated;
GRANT ALL ON invoices TO authenticated;
GRANT ALL ON invoice_items TO authenticated;
GRANT ALL ON inventory_adjustments TO authenticated;
GRANT ALL ON inventory_adjustment_items TO authenticated;

-- Insert default storage locations
INSERT INTO storage_locations (name, description) VALUES
('Main Storage', 'Primary storage area'),
('Back Room', 'Secondary storage area'),
('Front Desk', 'Front desk storage'),
('Treatment Room 1', 'Storage in treatment room 1'),
('Treatment Room 2', 'Storage in treatment room 2')
ON CONFLICT (name) DO NOTHING;

-- Insert default accounts for new organizations
-- This will be handled by the setup_new_organization function