-- Compatibility migration: add zero-arg is_super_admin wrapper and safely clean orphaned hardcoded UUID
-- This migration is intentionally conservative and idempotent: it only creates a wrapper function if missing
-- and deletes the hardcoded super_admins row only if the corresponding auth.users row does not exist.

BEGIN;

-- 1) Create zero-argument compatibility wrapper for is_super_admin() if it doesn't exist.
--    Many policies and code paths call is_super_admin() with no args; the canonical function
--    accepts a uuid argument. This wrapper forwards to the uuid variant using auth.uid().
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'is_super_admin' AND pg_get_function_identity_arguments(p.oid) = ''
  ) THEN
    CREATE OR REPLACE FUNCTION public.is_super_admin()
    RETURNS boolean
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
      RETURN public.is_super_admin(auth.uid()::uuid);
    END;
    $$;
  END IF;
END$$;

-- Grant execute to anon & authenticated so policies and client RPCs can call it where expected.
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO anon, authenticated;

-- 2) Safely remove an often-hardcoded-orphaned super_admins entry
--    Only delete the record if the referenced user does NOT exist in auth.users to avoid accidentally
--    removing a legitimate super admin in other environments.
DO $$
DECLARE
  v_bad uuid := '7c858ee2-b224-48fb-8089-5c702284d2b2'::uuid;
  v_count int;
BEGIN
  SELECT COUNT(1) INTO v_count FROM auth.users WHERE id = v_bad;
  IF v_count = 0 THEN
    DELETE FROM public.super_admins WHERE user_id = v_bad;
    RAISE NOTICE 'Deleted orphaned super_admins record for %', v_bad;
  ELSE
    RAISE NOTICE 'User % exists in auth.users; skipping delete', v_bad;
  END IF;
END$$;

COMMIT;