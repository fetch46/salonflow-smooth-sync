-- Create First Super Admin Account
-- Run this AFTER creating a user account and getting their user_id

-- IMPORTANT: Replace 'YOUR_USER_ID_HERE' with the actual user ID
-- You can find your user ID by:
-- 1. Going to Supabase Dashboard > Authentication > Users
-- 2. Finding your email address
-- 3. Copying the user ID

-- Option 1: Create super admin for a specific user (replace with actual user_id)
INSERT INTO super_admins (user_id, granted_by, is_active, permissions)
VALUES (
    'YOUR_USER_ID_HERE', -- Replace with actual user ID
    'YOUR_USER_ID_HERE', -- Same user ID (self-granted)
    true,
    '{"all_permissions": true, "can_manage_system": true, "can_manage_users": true}'
)
ON CONFLICT (user_id) 
DO UPDATE SET 
    is_active = true,
    granted_by = 'YOUR_USER_ID_HERE',
    updated_at = NOW();

-- Option 2: Create super admin for the first user in the system
-- (Uncomment the lines below if you want to automatically grant to the first user)
/*
INSERT INTO super_admins (user_id, granted_by, is_active, permissions)
SELECT 
    u.id,
    u.id,
    true,
    '{"all_permissions": true, "can_manage_system": true, "can_manage_users": true}'
FROM auth.users u
WHERE u.id = (
    SELECT id FROM auth.users 
    ORDER BY created_at ASC 
    LIMIT 1
)
ON CONFLICT (user_id) 
DO UPDATE SET 
    is_active = true,
    granted_by = EXCLUDED.user_id,
    updated_at = NOW();
*/

-- Verify the super admin was created
SELECT 
    'Super Admin Created' as status,
    sa.user_id,
    u.email,
    sa.granted_at,
    sa.is_active
FROM super_admins sa
JOIN auth.users u ON sa.user_id = u.id
WHERE sa.is_active = true;