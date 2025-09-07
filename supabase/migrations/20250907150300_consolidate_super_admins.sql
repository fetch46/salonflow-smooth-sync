-- Consolidated super-admin migration: canonical functions, 0-arg wrapper, grant/revoke helpers, RLS policies, and safe orphan cleanup
-- Idempotent and conservative: uses CREATE OR REPLACE, CREATE TABLE IF NOT EXISTS, DROP POLICY IF EXISTS + CREATE POLICY, and guarded DELETE. Avoids top-level transactions and DO blocks to be compatible with common migration runners.

-- 1) Ensure super_admins table exists
CREATE TABLE IF NOT EXISTS public.super_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL,
  granted_by uuid NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  permissions jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Canonical function: is_super_admin(uuid)
CREATE OR REPLACE FUNCTION public.is_super_admin(uid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is boolean := false;
BEGIN
  SELECT COALESCE(sa.is_active, false) INTO v_is
  FROM public.super_admins sa
  WHERE sa.user_id = uid
  LIMIT 1;
  RETURN COALESCE(v_is, false);
END;
$$;

-- 3) Zero-arg compatibility wrapper (for policies and older code paths)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN public.is_super_admin(auth.uid()::uuid);
END;
$$;

-- Grant execute so callers (policies, RPCs, clients) can call these functions
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO anon, authenticated;

-- 4) Helper functions to grant/revoke super admin status
CREATE OR REPLACE FUNCTION public.grant_super_admin(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.super_admins (user_id, granted_by, granted_at, is_active, permissions, created_at, updated_at)
  VALUES (target_user_id, auth.uid(), now(), true, '{"all_permissions": true}'::jsonb, now(), now())
  ON CONFLICT (user_id) DO UPDATE SET
    is_active = true,
    granted_by = EXCLUDED.granted_by,
    granted_at = now(),
    permissions = EXCLUDED.permissions,
    updated_at = now();
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_super_admin(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.super_admins
  SET is_active = false,
      updated_at = now()
  WHERE user_id = target_user_id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_super_admin(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_super_admin(uuid) TO anon, authenticated;

-- 5) Enable RLS and create idempotent policies
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS super_admins_allow_all ON public.super_admins;
CREATE POLICY super_admins_allow_all ON public.super_admins
  FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()::uuid))
  WITH CHECK (public.is_super_admin(auth.uid()::uuid));

-- 6) Safe cleanup of a commonly hardcoded/orphaned super_admins entry
--    Only delete if the referenced auth user does not exist to avoid removing valid entries.
DELETE FROM public.super_admins
WHERE user_id = '7c858ee2-b224-48fb-8089-5c702284d2b2'::uuid
  AND NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id = '7c858ee2-b224-48fb-8089-5c702284d2b2'::uuid
  );

-- End of migration
