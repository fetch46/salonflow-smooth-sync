-- Grant super admin to a user by email (idempotent)
DO $$
DECLARE
  target_email text := 'andre4094@gmail.com';
  uid uuid;
BEGIN
  -- Fetch the user's UUID from auth.users
  SELECT id INTO uid FROM auth.users WHERE email = target_email;

  IF uid IS NULL THEN
    RAISE EXCEPTION 'User with email % not found in auth.users. Please ensure the user has signed up/logged in at least once.', target_email;
  END IF;

  -- If a record exists, activate it; otherwise insert a new one
  UPDATE public.super_admins 
    SET is_active = true, updated_at = now()
    WHERE user_id = uid;

  IF NOT FOUND THEN
    INSERT INTO public.super_admins (user_id, granted_by, is_active)
    VALUES (uid, uid, true);
  END IF;
END $$;