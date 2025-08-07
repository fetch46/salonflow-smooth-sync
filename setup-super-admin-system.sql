-- Setup Super Admin System (Fixed Version)
-- Run this in Supabase SQL Editor

-- 1. Drop existing policies that might cause recursion
DROP POLICY IF EXISTS "Super admins can manage super admin records" ON super_admins;

-- 2. Create super_admins table if it doesn't exist
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

-- 3. Enable RLS on super_admins table
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;

-- 4. Create non-recursive RLS policies for super_admins
-- Allow service role and bypass RLS for initial setup
CREATE POLICY "Allow service role full access" ON super_admins
    FOR ALL TO service_role
    USING (true);

-- Allow authenticated users to read their own super admin status
CREATE POLICY "Users can read own super admin status" ON super_admins
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Allow inserts during initial setup (this will be restricted later)
CREATE POLICY "Allow initial super admin creation" ON super_admins
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- 5. Grant permissions
GRANT ALL ON super_admins TO authenticated;
GRANT ALL ON super_admins TO service_role;

-- 6. Create super admin functions
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

-- 7. Create function to grant super admin (only after at least one super admin exists)
CREATE OR REPLACE FUNCTION grant_super_admin(target_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_user_id UUID;
    admin_count INTEGER;
BEGIN
    current_user_id := auth.uid();
    
    -- Count existing super admins
    SELECT COUNT(*) INTO admin_count FROM super_admins WHERE is_active = true;
    
    -- If no super admins exist, allow the first one to be created
    IF admin_count = 0 THEN
        INSERT INTO super_admins (user_id, granted_by, permissions)
        VALUES (target_user_id, current_user_id, '{"all_permissions": true, "can_manage_system": true, "can_manage_users": true, "can_manage_organizations": true, "can_view_analytics": true, "can_manage_super_admins": true}')
        ON CONFLICT (user_id) 
        DO UPDATE SET 
            is_active = true,
            granted_by = current_user_id,
            updated_at = NOW();
        RETURN true;
    END IF;
    
    -- Check if current user is super admin
    IF NOT is_super_admin(current_user_id) THEN
        RAISE EXCEPTION 'Only super admins can grant super admin privileges';
    END IF;
    
    -- Grant super admin to target user
    INSERT INTO super_admins (user_id, granted_by, permissions)
    VALUES (target_user_id, current_user_id, '{"all_permissions": true, "can_manage_system": true, "can_manage_users": true, "can_manage_organizations": true, "can_view_analytics": true, "can_manage_super_admins": true}')
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        is_active = true,
        granted_by = current_user_id,
        updated_at = NOW();
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Create function to revoke super admin
CREATE OR REPLACE FUNCTION revoke_super_admin(target_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_user_id UUID;
BEGIN
    current_user_id := auth.uid();
    
    -- Check if current user is super admin
    IF NOT is_super_admin(current_user_id) THEN
        RAISE EXCEPTION 'Only super admins can revoke super admin privileges';
    END IF;
    
    -- Prevent self-revocation
    IF target_user_id = current_user_id THEN
        RAISE EXCEPTION 'Cannot revoke your own super admin privileges';
    END IF;
    
    -- Revoke super admin from target user
    UPDATE super_admins 
    SET is_active = false, updated_at = NOW()
    WHERE user_id = target_user_id;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Grant execute permissions
GRANT EXECUTE ON FUNCTION is_super_admin TO authenticated;
GRANT EXECUTE ON FUNCTION is_super_admin TO anon;
GRANT EXECUTE ON FUNCTION grant_super_admin TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_super_admin TO authenticated;

-- 10. Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_super_admins_updated_at ON super_admins;
CREATE TRIGGER update_super_admins_updated_at 
    BEFORE UPDATE ON super_admins 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Success message
SELECT 'Super Admin system setup complete! You can now create super admin accounts.' as message;