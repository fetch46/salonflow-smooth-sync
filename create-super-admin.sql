-- Create Super Admin System
-- Run this in Supabase SQL Editor

-- 1. Create super_admins table if it doesn't exist
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

-- 2. Enable RLS on super_admins table
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS policies for super_admins
CREATE POLICY "Super admins can manage super admin records" ON super_admins
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM super_admins 
            WHERE user_id = auth.uid() 
            AND is_active = true
        )
    );

-- 4. Grant permissions
GRANT ALL ON super_admins TO authenticated;

-- 5. Create super admin functions
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

-- 6. Create function to grant super admin
CREATE OR REPLACE FUNCTION grant_super_admin(target_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_user_id UUID;
BEGIN
    current_user_id := auth.uid();
    
    -- Check if current user is super admin
    IF NOT is_super_admin(current_user_id) THEN
        RAISE EXCEPTION 'Only super admins can grant super admin privileges';
    END IF;
    
    -- Grant super admin to target user
    INSERT INTO super_admins (user_id, granted_by)
    VALUES (target_user_id, current_user_id)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        is_active = true,
        granted_by = current_user_id,
        updated_at = NOW();
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Create function to revoke super admin
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

-- 8. Grant execute permissions
GRANT EXECUTE ON FUNCTION is_super_admin TO authenticated;
GRANT EXECUTE ON FUNCTION grant_super_admin TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_super_admin TO authenticated;

-- 9. Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_super_admins_updated_at 
    BEFORE UPDATE ON super_admins 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();