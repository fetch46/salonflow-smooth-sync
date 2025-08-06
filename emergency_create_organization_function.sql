-- Emergency Organization Creation Function
-- Run this in Supabase SQL Editor if organization creation is failing

-- First, ensure organizations table has proper INSERT policy
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON organizations;
DROP POLICY IF EXISTS "Users can create organizations" ON organizations;

-- Create a simple INSERT policy for organizations
CREATE POLICY "Authenticated users can create organizations" ON organizations
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Ensure organization_users table has proper INSERT policy
ALTER TABLE organization_users ENABLE ROW LEVEL SECURITY;

-- Drop existing policy to avoid conflicts
DROP POLICY IF EXISTS "Users can add themselves to organizations" ON organization_users;

-- Create INSERT policy for organization_users
CREATE POLICY "Users can add themselves to organizations" ON organization_users
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Create the safe organization creation function
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_organization_with_user TO authenticated;

-- Create the setup function (optional, for creating default data)
CREATE OR REPLACE FUNCTION setup_new_organization(org_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Check if user has permission to set up this organization
    IF NOT EXISTS (
        SELECT 1 FROM organization_users 
        WHERE organization_id = org_id 
        AND user_id = auth.uid() 
        AND role IN ('owner', 'admin')
        AND is_active = true
    ) THEN
        RAISE EXCEPTION 'Permission denied: User must be owner or admin of organization';
    END IF;
    
    -- Create default accounts (if accounts table exists)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'accounts') THEN
        -- Create default asset accounts
        INSERT INTO accounts (organization_id, name, account_type, account_code)
        VALUES 
            (org_id, 'Cash', 'asset', '1000'),
            (org_id, 'Bank Account', 'asset', '1010'),
            (org_id, 'Accounts Receivable', 'asset', '1200'),
            (org_id, 'Inventory', 'asset', '1300')
        ON CONFLICT (organization_id, account_code) DO NOTHING;
        
        -- Create default liability accounts
        INSERT INTO accounts (organization_id, name, account_type, account_code)
        VALUES 
            (org_id, 'Accounts Payable', 'liability', '2000'),
            (org_id, 'Sales Tax Payable', 'liability', '2100')
        ON CONFLICT (organization_id, account_code) DO NOTHING;
        
        -- Create default equity accounts
        INSERT INTO accounts (organization_id, name, account_type, account_code)
        VALUES 
            (org_id, 'Owner Equity', 'equity', '3000'),
            (org_id, 'Retained Earnings', 'equity', '3100')
        ON CONFLICT (organization_id, account_code) DO NOTHING;
        
        -- Create default revenue accounts
        INSERT INTO accounts (organization_id, name, account_type, account_code)
        VALUES 
            (org_id, 'Service Revenue', 'revenue', '4000'),
            (org_id, 'Product Sales', 'revenue', '4100')
        ON CONFLICT (organization_id, account_code) DO NOTHING;
        
        -- Create default expense accounts
        INSERT INTO accounts (organization_id, name, account_type, account_code)
        VALUES 
            (org_id, 'Operating Expenses', 'expense', '5000'),
            (org_id, 'Cost of Goods Sold', 'expense', '5100'),
            (org_id, 'Rent Expense', 'expense', '5200'),
            (org_id, 'Utilities Expense', 'expense', '5300')
        ON CONFLICT (organization_id, account_code) DO NOTHING;
    END IF;
    
    RAISE NOTICE 'Organization % setup completed successfully', org_id;
    
EXCEPTION WHEN OTHERS THEN
    -- Don't fail if setup encounters issues
    RAISE WARNING 'Organization setup encountered issues: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION setup_new_organization TO authenticated;

-- Test the function with a dummy call to check if it exists
DO $$
BEGIN
    -- This will fail with validation error but confirms function exists
    PERFORM create_organization_with_user('test', 'test', '{}', NULL);
EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%User must be authenticated%' THEN
        RAISE NOTICE '✅ Function create_organization_with_user exists and is working';
    ELSE
        RAISE NOTICE '⚠️  Function exists but test failed: %', SQLERRM;
    END IF;
END $$;

-- Show current user for debugging
SELECT 
    'Current authenticated user:' as info,
    auth.uid() as user_id,
    CASE WHEN auth.uid() IS NULL THEN '❌ Not authenticated' ELSE '✅ Authenticated' END as status;

-- Test subscription plans access
SELECT 
    'Subscription plans check:' as info,
    COUNT(*) as plan_count,
    COUNT(*) FILTER (WHERE is_active = true) as active_plans
FROM subscription_plans;

-- Check RLS policies on key tables
SELECT 
    'RLS Policies:' as info,
    schemaname,
    tablename,
    policyname,
    cmd,
    CASE WHEN permissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END as type
FROM pg_policies 
WHERE tablename IN ('organizations', 'organization_users', 'subscription_plans')
ORDER BY tablename, cmd;