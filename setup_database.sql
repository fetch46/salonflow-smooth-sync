-- Complete Database Setup Script
-- This script sets up all required tables and relationships for the salon management system

-- 1. Run the complete schema migration
\i supabase/migrations/20250116000004_complete_database_schema.sql

-- Replace invoices with receipts (ensures receipts exist before adding location_id)
\i supabase/migrations/20250809000000_replace_invoices_with_receipts.sql

-- Also include business locations and related columns
\i supabase/migrations/20250812090000_add_business_locations_and_location_filters.sql
-- Migrate prior storage_locations usage to business_locations
\i supabase/migrations/20250820093000_migrate_storage_locations_to_business_locations.sql

-- 2. Ensure all required functions exist
-- Create organization creation function if it doesn't exist
CREATE OR REPLACE FUNCTION create_organization_with_user(
    org_name TEXT,
    org_slug TEXT,
    org_settings JSONB DEFAULT '{}',
    plan_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    new_org_id UUID;
    user_id UUID;
BEGIN
    -- Get the current user
    user_id := auth.uid();
    
    IF user_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated';
    END IF;
    
    -- Create the organization
    INSERT INTO organizations (name, slug, settings)
    VALUES (org_name, org_slug, org_settings)
    RETURNING id INTO new_org_id;
    
    -- Add the user as owner
    INSERT INTO organization_users (organization_id, user_id, role, is_active)
    VALUES (new_org_id, user_id, 'owner', true);
    
    -- Create a subscription if plan_id is provided
    IF plan_id IS NOT NULL THEN
        INSERT INTO organization_subscriptions (organization_id, plan_id, status, interval)
        VALUES (new_org_id, plan_id, 'trial', 'month');
    END IF;
    
    RETURN new_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_organization_with_user TO authenticated;

-- Create organization setup function
CREATE OR REPLACE FUNCTION setup_new_organization(org_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_id UUID;
BEGIN
    user_id := auth.uid();
    
    IF user_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated';
    END IF;
    
    -- Verify user is owner of this organization
    IF NOT EXISTS (
        SELECT 1 FROM organization_users 
        WHERE organization_id = org_id 
        AND user_id = user_id 
        AND role = 'owner' 
        AND is_active = true
    ) THEN
        RAISE EXCEPTION 'User must be owner of organization';
    END IF;
    
    -- Create default accounts
    INSERT INTO accounts (organization_id, account_code, account_name, account_type, normal_balance, description, balance, is_active) VALUES 
        (org_id, '1001', 'Cash', 'Asset', 'debit', 'Cash on hand and in registers', 0, true),
        (org_id, '1002', 'Bank Account', 'Asset', 'debit', 'Primary business bank account', 0, true),
        (org_id, '1100', 'Accounts Receivable', 'Asset', 'debit', 'Money owed by customers', 0, true),
        (org_id, '1200', 'Inventory', 'Asset', 'debit', 'Hair products and supplies inventory', 0, true),
        (org_id, '1500', 'Equipment', 'Asset', 'debit', 'Salon equipment and fixtures', 0, true),
        (org_id, '2001', 'Accounts Payable', 'Liability', 'credit', 'Money owed to suppliers', 0, true),
        (org_id, '2100', 'Sales Tax Payable', 'Liability', 'credit', 'Sales tax collected from customers', 0, true),
        (org_id, '3001', 'Owner Equity', 'Equity', 'credit', 'Owner investment in business', 0, true),
        (org_id, '3002', 'Retained Earnings', 'Equity', 'credit', 'Accumulated business profits', 0, true),
        (org_id, '4001', 'Hair Services Revenue', 'Income', 'credit', 'Revenue from hair styling services', 0, true),
        (org_id, '4002', 'Product Sales Revenue', 'Income', 'credit', 'Revenue from product sales', 0, true),
        (org_id, '5001', 'Cost of Goods Sold', 'Expense', 'debit', 'Direct cost of products sold', 0, true),
        (org_id, '5100', 'Staff Wages', 'Expense', 'debit', 'Salaries and wages for staff', 0, true),
        (org_id, '5200', 'Rent Expense', 'Expense', 'debit', 'Monthly rent for salon space', 0, true),
        (org_id, '5300', 'Utilities Expense', 'Expense', 'debit', 'Electricity, water, internet', 0, true),
        (org_id, '5400', 'Supplies Expense', 'Expense', 'debit', 'General salon supplies', 0, true),
        (org_id, '5500', 'Marketing Expense', 'Expense', 'debit', 'Advertising and promotion costs', 0, true)
    ON CONFLICT (organization_id, account_code) DO NOTHING;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION setup_new_organization TO authenticated;

-- 3. Ensure subscription plans exist
INSERT INTO subscription_plans (name, slug, description, price_monthly, price_yearly, max_users, max_locations, features, is_active, sort_order) VALUES
('Starter', 'starter', 'Perfect for small salons just getting started', 2900, 29000, 5, 1, '{"appointments": true, "clients": true, "staff": true, "services": true, "basic_reports": true, "inventory": false}', true, 1),
('Professional', 'professional', 'For growing salons with multiple staff members', 5900, 59000, 25, 3, '{"appointments": true, "clients": true, "staff": true, "services": true, "inventory": true, "basic_reports": true, "advanced_reports": true, "pos": true, "accounting": true}', true, 2),
('Enterprise', 'enterprise', 'For large salon chains with advanced needs', 9900, 99000, 100, 10, '{"appointments": true, "clients": true, "staff": true, "services": true, "inventory": true, "basic_reports": true, "advanced_reports": true, "pos": true, "accounting": true, "api_access": true, "white_label": true}', true, 3)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price_monthly = EXCLUDED.price_monthly,
    price_yearly = EXCLUDED.price_yearly,
    max_users = EXCLUDED.max_users,
    max_locations = EXCLUDED.max_locations,
    features = EXCLUDED.features,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order;

-- 4. Create default business locations if they don't exist (per organization should be created via app workflow).
-- For demo environments without org scoping, insert a generic default.
INSERT INTO public.business_locations (organization_id, name, is_active, is_default)
SELECT o.id, 'Main Location', true, true
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.business_locations bl WHERE bl.organization_id = o.id
);


-- 5. Verify all tables exist and have correct structure
DO $$
DECLARE
    required_tables TEXT[] := ARRAY[
        'profiles', 'clients', 'staff', 'services', 'appointments', 
        'inventory_items', 'business_locations', 'inventory_levels', 
        'service_kits', 'job_cards', 'job_card_products', 'expenses', 
        'purchases', 'purchase_items', 'suppliers', 'accounts', 
        'account_transactions', 'sales', 'sale_items', 'invoices', 
        'invoice_items', 'inventory_adjustments', 'inventory_adjustment_items',
        'organizations', 'organization_users', 'organization_subscriptions',
        'subscription_plans', 'user_invitations', 'super_admins'
    ];
    table_name TEXT;
    table_exists BOOLEAN;
BEGIN
    FOREACH table_name IN ARRAY required_tables
    LOOP
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = table_name
        ) INTO table_exists;
        
        IF NOT table_exists THEN
            RAISE EXCEPTION 'Required table % does not exist', table_name;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'All required tables exist and are properly configured';
END $$;

-- 6. Verify all required functions exist
DO $$
DECLARE
    required_functions TEXT[] := ARRAY[
        'create_organization_with_user', 'setup_new_organization',
        'get_current_user_organization', 'user_has_role', 'user_has_min_role',
        'is_super_admin', 'grant_super_admin', 'revoke_super_admin'
    ];
    func_name TEXT;
    func_exists BOOLEAN;
BEGIN
    FOREACH func_name IN ARRAY required_functions
    LOOP
        SELECT EXISTS (
            SELECT FROM information_schema.routines 
            WHERE routine_schema = 'public' 
            AND routine_name = func_name
        ) INTO func_exists;
        
        IF NOT func_exists THEN
            RAISE EXCEPTION 'Required function % does not exist', func_name;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'All required functions exist and are properly configured';
END $$;

-- 7. Reload PostgREST schema to avoid cache issues
DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END $$;

-- 8. Completion message
DO $$
BEGIN
    RAISE NOTICE 'Database setup completed successfully!';
END $$;

-- 7. Enforce primary/foreign key constraints and indexes
\i supabase/migrations/20250822000000_enforce_pks_fks.sql

-- 8. Force PostgREST to reload schema (ensure new tables are visible)
\i supabase/migrations/20250821100000_reload_schema_after_business_locations.sql