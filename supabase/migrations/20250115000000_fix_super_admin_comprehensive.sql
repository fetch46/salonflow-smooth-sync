-- Comprehensive Super Admin Fix for andre4094@gmail.com
-- This migration will resolve all super admin access issues

-- 1. Clean up any conflicting super admin function definitions
DROP FUNCTION IF EXISTS public.is_super_admin(uuid);
DROP FUNCTION IF EXISTS is_super_admin(uuid);

-- 2. Create a definitive is_super_admin function
CREATE OR REPLACE FUNCTION public.is_super_admin(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Return true if user exists in super_admins table and is active
    RETURN EXISTS (
        SELECT 1 FROM public.super_admins 
        WHERE user_id = COALESCE(user_uuid, auth.uid()) AND is_active = true
    );
END;
$$;

-- 3. Ensure the super_admins table has proper structure
DO $$
BEGIN
    -- Add any missing columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'super_admins' 
                   AND column_name = 'permissions') THEN
        ALTER TABLE public.super_admins ADD COLUMN permissions JSONB DEFAULT '{"manage_organizations": true, "manage_users": true, "manage_subscriptions": true, "view_analytics": true, "manage_system": true}'::jsonb;
    END IF;
END $$;

-- 4. Clean up RLS policies and recreate them properly
ALTER TABLE public.super_admins DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'super_admins') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.super_admins';
    END LOOP;
END$$;

-- Enable RLS and create new, simple policies
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

-- Allow super admins to manage super admin records
CREATE POLICY "super_admins_select" ON public.super_admins
    FOR SELECT USING (public.is_super_admin());

CREATE POLICY "super_admins_insert" ON public.super_admins
    FOR INSERT WITH CHECK (public.is_super_admin());

CREATE POLICY "super_admins_update" ON public.super_admins
    FOR UPDATE USING (public.is_super_admin());

CREATE POLICY "super_admins_delete" ON public.super_admins
    FOR DELETE USING (public.is_super_admin());

-- 5. Clean up any hardcoded UUID records that might be causing conflicts
DELETE FROM public.super_admins WHERE user_id = '7c858ee2-b224-48fb-8089-5c702284d2b2';

-- 6. Find the actual user ID for andre4094@gmail.com and create/update super admin record
DO $$
DECLARE
    target_email text := 'andre4094@gmail.com';
    target_user_id uuid;
BEGIN
    -- First try to find in auth.users directly
    SELECT id INTO target_user_id FROM auth.users WHERE email = target_email;
    
    -- If not found in auth.users, try profiles table
    IF target_user_id IS NULL THEN
        SELECT user_id INTO target_user_id FROM public.profiles WHERE email = target_email;
    END IF;
    
    -- If user is found, ensure they have super admin privileges
    IF target_user_id IS NOT NULL THEN
        -- First ensure the user has a profile record
        INSERT INTO public.profiles (user_id, email, full_name, created_at, updated_at)
        VALUES (target_user_id, target_email, 'Super Admin', now(), now())
        ON CONFLICT (user_id) DO UPDATE SET
            email = EXCLUDED.email,
            updated_at = now();
        
        -- Create or update super admin record
        INSERT INTO public.super_admins (
            user_id, 
            granted_by, 
            granted_at, 
            is_active, 
            permissions,
            created_at,
            updated_at
        ) VALUES (
            target_user_id,
            target_user_id, -- Self-granted for first super admin
            now(),
            true,
            '{"all_permissions": true, "manage_organizations": true, "manage_users": true, "manage_subscriptions": true, "view_analytics": true, "manage_system": true}'::jsonb,
            now(),
            now()
        ) ON CONFLICT (user_id) DO UPDATE SET
            is_active = true,
            granted_at = now(),
            updated_at = now(),
            permissions = EXCLUDED.permissions;
        
        RAISE NOTICE 'Super admin privileges granted to user: % (ID: %)', target_email, target_user_id;
    ELSE
        RAISE NOTICE 'User % not found in auth.users or profiles. User must sign up first.', target_email;
    END IF;
END $$;

-- 7. Create helper functions for super admin management
CREATE OR REPLACE FUNCTION public.grant_super_admin(target_user_id UUID)
RETURNS BOOLEAN 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
BEGIN
    -- Check if the caller is a super admin
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Only super admins can grant super admin access';
    END IF;
    
    -- Insert or update the super admin record
    INSERT INTO public.super_admins (user_id, granted_by, is_active, permissions)
    VALUES (target_user_id, auth.uid(), true, '{"all_permissions": true, "manage_organizations": true, "manage_users": true, "manage_subscriptions": true, "view_analytics": true, "manage_system": true}'::jsonb)
    ON CONFLICT (user_id) DO UPDATE SET
        is_active = true,
        granted_by = auth.uid(),
        granted_at = now(),
        updated_at = now(),
        permissions = EXCLUDED.permissions;
    
    RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_super_admin(target_user_id UUID)
RETURNS BOOLEAN 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
BEGIN
    -- Check if the caller is a super admin
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Only super admins can revoke super admin access';
    END IF;
    
    -- Don't allow revoking your own access if you're the last super admin
    IF target_user_id = auth.uid() AND (
        SELECT COUNT(*) FROM public.super_admins WHERE is_active = true
    ) <= 1 THEN
        RAISE EXCEPTION 'Cannot revoke super admin access - you are the last super admin';
    END IF;
    
    -- Revoke super admin access
    UPDATE public.super_admins 
    SET is_active = false, updated_at = now()
    WHERE user_id = target_user_id;
    
    RETURN true;
END;
$$;

-- 8. Grant execute permissions on the functions
GRANT EXECUTE ON FUNCTION public.is_super_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_super_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_super_admin(UUID) TO authenticated;

-- 9. Ensure profiles table policies allow super admin access
DO $$
BEGIN
    -- Check if profiles table needs super admin access policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'profiles' 
        AND policyname = 'super_admins_full_access'
    ) THEN
        CREATE POLICY "super_admins_full_access" ON public.profiles
            FOR ALL USING (public.is_super_admin());
    END IF;
END $$;

-- 10. Final verification query
DO $$
DECLARE
    target_email text := 'andre4094@gmail.com';
    user_count integer;
    admin_count integer;
BEGIN
    SELECT COUNT(*) INTO user_count FROM auth.users WHERE email = target_email;
    SELECT COUNT(*) INTO admin_count FROM public.super_admins sa 
    JOIN auth.users u ON sa.user_id = u.id 
    WHERE u.email = target_email AND sa.is_active = true;
    
    RAISE NOTICE 'Verification Results:';
    RAISE NOTICE '- User records for %: %', target_email, user_count;
    RAISE NOTICE '- Active super admin records: %', admin_count;
    
    IF admin_count > 0 THEN
        RAISE NOTICE '✅ SUCCESS: Super admin setup is complete for %', target_email;
    ELSE
        RAISE NOTICE '❌ ISSUE: Super admin setup may need manual intervention';
    END IF;
END $$;