-- Fix organization INSERT policy and other critical RLS issues
-- This migration fixes the chicken-and-egg problem with organization creation

-- First, let's add an INSERT policy for organizations
-- This allows authenticated users to create new organizations
CREATE POLICY "Authenticated users can create organizations" ON organizations
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Add an INSERT policy for organization_users
-- This allows users to add themselves to organizations they create
CREATE POLICY "Users can add themselves to organizations" ON organization_users
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Add an INSERT policy for organization_subscriptions
-- This allows creating subscriptions for organizations the user owns
CREATE POLICY "Users can create subscriptions for their organizations" ON organization_subscriptions
    FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id 
            FROM organization_users 
            WHERE user_id = auth.uid() 
            AND role IN ('owner', 'admin')
            AND is_active = true
        )
    );

-- Add an INSERT policy for user_invitations
-- This allows organization admins to create invitations
CREATE POLICY "Admins can create invitations" ON user_invitations
    FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id 
            FROM organization_users 
            WHERE user_id = auth.uid() 
            AND role IN ('owner', 'admin')
            AND is_active = true
        )
    );

-- Fix subscription_plans table access
-- Make sure subscription_plans is accessible for reading
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view subscription plans" ON subscription_plans
    FOR SELECT
    USING (is_active = true);

-- Create a function to handle organization creation with proper user assignment
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

-- Create a function to safely create initial data for new organizations
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
    INSERT INTO accounts (organization_id, name, account_type, balance)
    VALUES 
        (org_id, 'Cash', 'asset', 0),
        (org_id, 'Sales Revenue', 'revenue', 0),
        (org_id, 'Operating Expenses', 'expense', 0)
    ON CONFLICT DO NOTHING;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION setup_new_organization TO authenticated;

-- Add policies for tables that might be missing them
-- These are essential for the app to function

-- Ensure all tables have basic policies if they don't exist already
DO $$
DECLARE
    table_name TEXT;
    policy_exists BOOLEAN;
BEGIN
    -- List of tables that need basic tenant policies
    FOR table_name IN 
        SELECT unnest(ARRAY[
            'staff', 'clients', 'services', 'inventory_items', 'service_kits',
            'appointments', 'job_cards', 'expenses', 'purchases', 'suppliers',
            'accounts', 'sales', 'inventory_adjustments', 'job_card_products',
            'account_transactions', 'purchase_items', 'inventory_levels', 'storage_locations'
        ])
    LOOP
        -- Check if SELECT policy exists
        SELECT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = table_name AND cmd = 'SELECT'
        ) INTO policy_exists;
        
        IF NOT policy_exists THEN
            EXECUTE format('
                CREATE POLICY "Users can view their organization %I" ON %I
                FOR SELECT
                USING (
                    organization_id IN (
                        SELECT organization_id 
                        FROM organization_users 
                        WHERE user_id = auth.uid() AND is_active = true
                    )
                )', table_name, table_name);
        END IF;
        
        -- Check if INSERT policy exists
        SELECT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = table_name AND cmd = 'INSERT'
        ) INTO policy_exists;
        
        IF NOT policy_exists THEN
            EXECUTE format('
                CREATE POLICY "Users can insert %I for their organization" ON %I
                FOR INSERT
                WITH CHECK (
                    organization_id IN (
                        SELECT organization_id 
                        FROM organization_users 
                        WHERE user_id = auth.uid() 
                        AND role IN (''owner'', ''admin'', ''manager'', ''staff'')
                        AND is_active = true
                    )
                )', table_name, table_name);
        END IF;
        
        -- Check if UPDATE policy exists
        SELECT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = table_name AND cmd = 'UPDATE'
        ) INTO policy_exists;
        
        IF NOT policy_exists THEN
            EXECUTE format('
                CREATE POLICY "Users can update %I for their organization" ON %I
                FOR UPDATE
                USING (
                    organization_id IN (
                        SELECT organization_id 
                        FROM organization_users 
                        WHERE user_id = auth.uid() 
                        AND role IN (''owner'', ''admin'', ''manager'', ''staff'')
                        AND is_active = true
                    )
                )', table_name, table_name);
        END IF;
        
        -- Check if DELETE policy exists
        SELECT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = table_name AND cmd = 'DELETE'
        ) INTO policy_exists;
        
        IF NOT policy_exists THEN
            EXECUTE format('
                CREATE POLICY "Admins can delete %I for their organization" ON %I
                FOR DELETE
                USING (
                    organization_id IN (
                        SELECT organization_id 
                        FROM organization_users 
                        WHERE user_id = auth.uid() 
                        AND role IN (''owner'', ''admin'')
                        AND is_active = true
                    )
                )', table_name, table_name);
        END IF;
    END LOOP;
END $$;

-- Verify the fix
DO $$
BEGIN
    RAISE NOTICE 'Organization RLS policies have been fixed!';
    RAISE NOTICE 'Users can now create organizations and write to the database.';
    RAISE NOTICE 'Use create_organization_with_user() function for safe organization creation.';
END $$;