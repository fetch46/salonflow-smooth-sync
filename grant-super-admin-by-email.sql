-- Grant Super Admin by email
-- Usage: Open in Supabase SQL Editor, replace the email if needed, and run.

DO $$
DECLARE
    target_email TEXT := 'hello@stratus.africa';
    target_id UUID;
BEGIN
    SELECT id INTO target_id
    FROM auth.users
    WHERE email = target_email;

    IF target_id IS NULL THEN
        RAISE EXCEPTION 'User % not found in auth.users. Create the account first.', target_email;
    END IF;

    INSERT INTO super_admins (user_id, granted_by, is_active, permissions)
    VALUES (
        target_id,
        target_id,
        true,
        '{"all_permissions": true, "can_manage_system": true, "can_manage_users": true, "can_manage_organizations": true, "can_view_analytics": true}'
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
        is_active = true,
        granted_by = EXCLUDED.user_id,
        updated_at = now();

    RAISE NOTICE 'Super admin granted to %', target_email;
END $$;