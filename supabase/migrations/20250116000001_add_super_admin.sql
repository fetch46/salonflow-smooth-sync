-- Add super admin functionality to the SAAS platform

-- First, add super_admin to the user_role enum
ALTER TYPE user_role ADD VALUE 'super_admin';

-- Create a super_admins table to track system-wide administrators
CREATE TABLE IF NOT EXISTS super_admins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    granted_by UUID REFERENCES auth.users(id),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    is_active BOOLEAN DEFAULT true,
    permissions JSONB DEFAULT '{"manage_organizations": true, "manage_users": true, "manage_subscriptions": true, "view_analytics": true, "manage_system": true}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user_id)
);

-- Enable RLS on super_admins table
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for super_admins table
-- Only super admins can view and manage super admin records
CREATE POLICY "Super admins can view super admin records" ON super_admins
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM super_admins sa 
            WHERE sa.user_id = auth.uid() AND sa.is_active = true
        )
    );

CREATE POLICY "Super admins can insert super admin records" ON super_admins
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM super_admins sa 
            WHERE sa.user_id = auth.uid() AND sa.is_active = true
        )
    );

CREATE POLICY "Super admins can update super admin records" ON super_admins
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM super_admins sa 
            WHERE sa.user_id = auth.uid() AND sa.is_active = true
        )
    );

CREATE POLICY "Super admins can delete super admin records" ON super_admins
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM super_admins sa 
            WHERE sa.user_id = auth.uid() AND sa.is_active = true
        )
    );

-- Create a function to check if a user is a super admin
CREATE OR REPLACE FUNCTION is_super_admin(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM super_admins 
        WHERE user_id = user_uuid AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to grant super admin access (can only be called by existing super admins)
CREATE OR REPLACE FUNCTION grant_super_admin(target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if the caller is a super admin
    IF NOT is_super_admin() THEN
        RAISE EXCEPTION 'Only super admins can grant super admin access';
    END IF;
    
    -- Insert the new super admin record
    INSERT INTO super_admins (user_id, granted_by)
    VALUES (target_user_id, auth.uid())
    ON CONFLICT (user_id) DO UPDATE SET
        is_active = true,
        granted_by = auth.uid(),
        granted_at = now(),
        updated_at = now();
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to revoke super admin access
CREATE OR REPLACE FUNCTION revoke_super_admin(target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if the caller is a super admin
    IF NOT is_super_admin() THEN
        RAISE EXCEPTION 'Only super admins can revoke super admin access';
    END IF;
    
    -- Don't allow revoking your own access if you're the last super admin
    IF target_user_id = auth.uid() AND (
        SELECT COUNT(*) FROM super_admins WHERE is_active = true
    ) <= 1 THEN
        RAISE EXCEPTION 'Cannot revoke super admin access - you are the last super admin';
    END IF;
    
    -- Revoke super admin access
    UPDATE super_admins 
    SET is_active = false, updated_at = now()
    WHERE user_id = target_user_id;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create updated_at trigger for super_admins
CREATE TRIGGER update_super_admins_updated_at
    BEFORE UPDATE ON super_admins
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_super_admins_user_id ON super_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_super_admins_active ON super_admins(is_active);

-- Insert the first super admin (you'll need to replace this email with your actual email)
-- This creates the initial super admin that can then grant access to others
DO $$
DECLARE
    first_admin_email TEXT := 'admin@yourdomain.com'; -- CHANGE THIS TO YOUR EMAIL
    first_admin_id UUID;
BEGIN
    -- Find the user ID for the admin email
    SELECT id INTO first_admin_id 
    FROM auth.users 
    WHERE email = first_admin_email;
    
    -- If user exists, make them a super admin
    IF first_admin_id IS NOT NULL THEN
        INSERT INTO super_admins (user_id, granted_by, permissions)
        VALUES (first_admin_id, first_admin_id, '{"manage_organizations": true, "manage_users": true, "manage_subscriptions": true, "view_analytics": true, "manage_system": true}'::jsonb)
        ON CONFLICT (user_id) DO UPDATE SET
            is_active = true,
            updated_at = now();
        
        RAISE NOTICE 'Super admin access granted to %', first_admin_email;
    ELSE
        RAISE NOTICE 'User with email % not found. Super admin will need to be granted manually.', first_admin_email;
    END IF;
END $$;

-- Create a view for easier super admin management
CREATE OR REPLACE VIEW super_admin_users AS
SELECT 
    sa.id,
    sa.user_id,
    u.email,
    u.created_at as user_created_at,
    sa.granted_by,
    gb.email as granted_by_email,
    sa.granted_at,
    sa.is_active,
    sa.permissions,
    sa.created_at,
    sa.updated_at
FROM super_admins sa
JOIN auth.users u ON sa.user_id = u.id
LEFT JOIN auth.users gb ON sa.granted_by = gb.id
ORDER BY sa.created_at DESC;

-- Grant access to the view for super admins
CREATE POLICY "Super admins can view super admin users" ON super_admin_users
    FOR SELECT USING (is_super_admin());