-- Manual Super Admin Creation Script
-- Run this directly in Supabase SQL Editor to create super admin account
-- This bypasses email confirmation requirements

-- First, create the super_admins table if it doesn't exist
CREATE TABLE IF NOT EXISTS super_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    granted_by UUID REFERENCES auth.users(id),
    is_active BOOLEAN DEFAULT true,
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;

-- Create permissive policy for initial setup
DROP POLICY IF EXISTS "Allow all for authenticated users" ON super_admins;
CREATE POLICY "Allow all for authenticated users" ON super_admins
    FOR ALL TO authenticated 
    USING (true) 
    WITH CHECK (true);

-- Grant permissions
GRANT ALL ON super_admins TO authenticated;
GRANT ALL ON super_admins TO anon;

-- Step 1: Find or create the user
-- Check if user exists first
DO $$ 
DECLARE
    target_user_id UUID;
    user_exists BOOLEAN := FALSE;
BEGIN
    -- Check if user already exists
    SELECT id INTO target_user_id 
    FROM auth.users 
    WHERE email = 'hello@stratus.africa'
    LIMIT 1;
    
    IF target_user_id IS NOT NULL THEN
        user_exists := TRUE;
        RAISE NOTICE 'User found with ID: %', target_user_id;
    ELSE
        RAISE NOTICE 'User not found. Please create user account first.';
        RAISE NOTICE 'You can create the user by:';
        RAISE NOTICE '1. Running the Node.js script: node create-first-super-admin-direct.js';
        RAISE NOTICE '2. Or manually signing up in your application';
        RAISE NOTICE '3. Then running this SQL script again';
        RETURN;
    END IF;
    
    -- If user exists, confirm their email (bypass confirmation)
    IF user_exists THEN
        UPDATE auth.users 
        SET 
            email_confirmed_at = NOW(),
            updated_at = NOW()
        WHERE id = target_user_id 
        AND email_confirmed_at IS NULL;
        
        IF FOUND THEN
            RAISE NOTICE 'Email confirmed for user: %', target_user_id;
        ELSE
            RAISE NOTICE 'Email was already confirmed for user: %', target_user_id;
        END IF;
    END IF;
    
    -- Create or update super admin record
    INSERT INTO super_admins (user_id, granted_by, is_active, permissions)
    VALUES (
        target_user_id,
        target_user_id, -- Self-granted
        true,
        '{
            "all_permissions": true,
            "can_manage_system": true,
            "can_manage_users": true,
            "can_manage_organizations": true,
            "can_view_analytics": true,
            "can_manage_super_admins": true
        }'::jsonb
    )
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        is_active = true,
        granted_by = target_user_id,
        updated_at = NOW(),
        permissions = '{
            "all_permissions": true,
            "can_manage_system": true,
            "can_manage_users": true,
            "can_manage_organizations": true,
            "can_view_analytics": true,
            "can_manage_super_admins": true
        }'::jsonb;
    
    RAISE NOTICE 'Super admin created/updated successfully!';
    RAISE NOTICE 'User ID: %', target_user_id;
    RAISE NOTICE 'Email: hello@stratus.africa';
    RAISE NOTICE 'Password: Noel@2018';
    RAISE NOTICE '';
    RAISE NOTICE 'You can now log in to your application with these credentials.';
END $$;

-- Create the is_super_admin function if it doesn't exist
CREATE OR REPLACE FUNCTION is_super_admin(user_uuid UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
    target_user UUID;
BEGIN
    -- If no user specified, use current user
    IF user_uuid IS NULL THEN
        target_user := auth.uid();
    ELSE
        target_user := user_uuid;
    END IF;
    
    -- Check if user is a super admin
    RETURN EXISTS (
        SELECT 1 FROM super_admins 
        WHERE user_id = target_user 
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_super_admin TO authenticated;
GRANT EXECUTE ON FUNCTION is_super_admin TO anon;

-- Verify the super admin was created
SELECT 
    'Super Admin Status' as status,
    u.email,
    u.id as user_id,
    u.email_confirmed_at IS NOT NULL as email_confirmed,
    sa.granted_at,
    sa.is_active,
    sa.permissions
FROM auth.users u
LEFT JOIN super_admins sa ON u.id = sa.user_id
WHERE u.email = 'hello@stratus.africa';

-- Show summary
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM super_admins sa
            JOIN auth.users u ON sa.user_id = u.id
            WHERE u.email = 'hello@stratus.africa' 
            AND sa.is_active = true
        ) THEN '✅ Super Admin Account Created Successfully!'
        ELSE '❌ Super Admin Account Creation Failed'
    END as result;