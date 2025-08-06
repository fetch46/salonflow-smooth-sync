-- Fix Organization Creation - Complete Database Setup
-- Run this in Supabase SQL Editor to fix organization creation issues

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. CREATE REQUIRED TABLES
-- ============================================================================

-- Create subscription_plans table if it doesn't exist
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    price_monthly INTEGER NOT NULL,
    price_yearly INTEGER NOT NULL,
    max_users INTEGER,
    max_locations INTEGER,
    features JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create organizations table if it doesn't exist
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    domain TEXT,
    logo_url TEXT,
    status TEXT DEFAULT 'active',
    settings JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create organization_users table if it doesn't exist
CREATE TABLE IF NOT EXISTS organization_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

-- Create organization_subscriptions table if it doesn't exist
CREATE TABLE IF NOT EXISTS organization_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES subscription_plans(id),
    status TEXT DEFAULT 'trial',
    interval TEXT DEFAULT 'month',
    trial_start TIMESTAMPTZ,
    trial_end TIMESTAMPTZ,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_subscriptions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. CREATE RLS POLICIES
-- ============================================================================

-- Subscription plans - public read access
DROP POLICY IF EXISTS "Public read access to subscription plans" ON subscription_plans;
CREATE POLICY "Public read access to subscription plans" ON subscription_plans
    FOR SELECT
    USING (true);

-- Organizations - authenticated users can create and read their own
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON organizations;
CREATE POLICY "Authenticated users can create organizations" ON organizations
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can read their organizations" ON organizations;
CREATE POLICY "Users can read their organizations" ON organizations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM organization_users 
            WHERE organization_id = organizations.id 
            AND user_id = auth.uid() 
            AND is_active = true
        )
    );

-- Organization users - users can manage their own relationships
DROP POLICY IF EXISTS "Users can add themselves to organizations" ON organization_users;
CREATE POLICY "Users can add themselves to organizations" ON organization_users
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can read their organization memberships" ON organization_users;
CREATE POLICY "Users can read their organization memberships" ON organization_users
    FOR SELECT
    USING (user_id = auth.uid());

-- Organization subscriptions - users can read their organization's subscriptions
DROP POLICY IF EXISTS "Users can read their organization subscriptions" ON organization_subscriptions;
CREATE POLICY "Users can read their organization subscriptions" ON organization_subscriptions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM organization_users 
            WHERE organization_id = organization_subscriptions.organization_id 
            AND user_id = auth.uid() 
            AND is_active = true
        )
    );

DROP POLICY IF EXISTS "Users can create subscriptions for their organizations" ON organization_subscriptions;
CREATE POLICY "Users can create subscriptions for their organizations" ON organization_subscriptions
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM organization_users 
            WHERE organization_id = organization_subscriptions.organization_id 
            AND user_id = auth.uid() 
            AND role IN ('owner', 'admin')
            AND is_active = true
        )
    );

-- ============================================================================
-- 4. GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT ON subscription_plans TO authenticated;
GRANT SELECT ON subscription_plans TO anon;
GRANT ALL ON organizations TO authenticated;
GRANT ALL ON organization_users TO authenticated;
GRANT ALL ON organization_subscriptions TO authenticated;

-- ============================================================================
-- 5. CREATE DATABASE FUNCTIONS
-- ============================================================================

-- Create the organization creation function
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
    -- Get the current authenticated user
    user_id := auth.uid();
    
    -- Check if user is authenticated
    IF user_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated to create an organization';
    END IF;
    
    -- Validate required parameters
    IF org_name IS NULL OR trim(org_name) = '' THEN
        RAISE EXCEPTION 'Organization name is required';
    END IF;
    
    IF org_slug IS NULL OR trim(org_slug) = '' THEN
        RAISE EXCEPTION 'Organization slug is required';
    END IF;
    
    -- Create the organization
    INSERT INTO organizations (name, slug, settings)
    VALUES (org_name, org_slug, COALESCE(org_settings, '{}'))
    RETURNING id INTO new_org_id;
    
    -- Add the user as the owner
    INSERT INTO organization_users (organization_id, user_id, role, is_active)
    VALUES (new_org_id, user_id, 'owner', true);
    
    -- Create subscription if plan_id is provided
    IF plan_id IS NOT NULL THEN
        -- Check if the plan exists
        IF EXISTS (SELECT 1 FROM subscription_plans WHERE id = plan_id AND is_active = true) THEN
            INSERT INTO organization_subscriptions (
                organization_id, 
                plan_id, 
                status, 
                interval
            )
            VALUES (new_org_id, plan_id, 'trial', 'month');
        ELSE
            RAISE WARNING 'Plan ID % not found or not active, skipping subscription creation', plan_id;
        END IF;
    END IF;
    
    -- Return the new organization ID
    RETURN new_org_id;
    
EXCEPTION WHEN OTHERS THEN
    -- Log the error and re-raise
    RAISE EXCEPTION 'Failed to create organization: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the organization setup function
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
    
    -- Create default accounts if accounts table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'accounts') THEN
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
        ON CONFLICT (account_code) DO NOTHING;
    END IF;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_organization_with_user TO authenticated;
GRANT EXECUTE ON FUNCTION setup_new_organization TO authenticated;

-- ============================================================================
-- 6. INSERT DEFAULT SUBSCRIPTION PLANS
-- ============================================================================

-- Clear existing plans and insert fresh ones
DELETE FROM subscription_plans;

INSERT INTO subscription_plans (
    name, 
    slug, 
    description, 
    price_monthly, 
    price_yearly, 
    max_users, 
    max_locations, 
    features, 
    is_active,
    sort_order
) VALUES
(
    'Starter',
    'starter',
    'Perfect for small salons just getting started',
    2900,  -- $29.00
    29000, -- $290.00
    5,
    1,
    '{
        "appointments": true,
        "clients": true,
        "staff": true,
        "services": true,
        "basic_reports": true,
        "inventory": false,
        "advanced_reports": false,
        "integrations": false,
        "api_access": false,
        "white_label": false,
        "pos": false,
        "accounting": false,
        "job_cards": true,
        "invoices": true
    }'::jsonb,
    true,
    1
),
(
    'Professional',
    'professional',
    'For growing salons with multiple staff members',
    5900,  -- $59.00
    59000, -- $590.00
    25,
    3,
    '{
        "appointments": true,
        "clients": true,
        "staff": true,
        "services": true,
        "inventory": true,
        "basic_reports": true,
        "advanced_reports": true,
        "integrations": true,
        "pos": true,
        "accounting": true,
        "job_cards": true,
        "invoices": true,
        "api_access": false,
        "white_label": false,
        "analytics": true,
        "multi_location": true
    }'::jsonb,
    true,
    2
),
(
    'Enterprise',
    'enterprise',
    'For large salon chains with advanced needs',
    9900,  -- $99.00
    99000, -- $990.00
    100,
    10,
    '{
        "appointments": true,
        "clients": true,
        "staff": true,
        "services": true,
        "inventory": true,
        "basic_reports": true,
        "advanced_reports": true,
        "integrations": true,
        "pos": true,
        "accounting": true,
        "job_cards": true,
        "invoices": true,
        "api_access": true,
        "white_label": true,
        "priority_support": true,
        "custom_branding": true,
        "analytics": true,
        "multi_location": true,
        "advanced_permissions": true,
        "data_export": true
    }'::jsonb,
    true,
    3
);

-- ============================================================================
-- 7. VERIFICATION AND TESTING
-- ============================================================================

-- Test that everything is working
DO $$
DECLARE
    plan_count INTEGER;
    table_count INTEGER;
BEGIN
    -- Check subscription plans
    SELECT COUNT(*) INTO plan_count FROM subscription_plans WHERE is_active = true;
    
    -- Check tables exist
    SELECT COUNT(*) INTO table_count FROM information_schema.tables 
    WHERE table_name IN ('subscription_plans', 'organizations', 'organization_users', 'organization_subscriptions')
    AND table_schema = 'public';
    
    RAISE NOTICE '✅ Database setup complete!';
    RAISE NOTICE '   - Subscription plans: %', plan_count;
    RAISE NOTICE '   - Required tables: %/4', table_count;
    
    IF plan_count = 3 AND table_count = 4 THEN
        RAISE NOTICE '🎉 Organization creation should now work!';
    ELSE
        RAISE WARNING '⚠️  Some components may be missing';
    END IF;
END $$;

-- Show current setup status
SELECT 
    'Setup Status' as info,
    (SELECT COUNT(*) FROM subscription_plans WHERE is_active = true) as active_plans,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN ('organizations', 'organization_users', 'organization_subscriptions')) as required_tables,
    (SELECT COUNT(*) FROM pg_proc WHERE proname = 'create_organization_with_user') as org_function_exists;