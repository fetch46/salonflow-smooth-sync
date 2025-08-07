-- Fix recursive RLS on super_admins and ensure signup profile trigger exists

-- 1) Helper function to check super admin status (avoids recursive RLS)
CREATE OR REPLACE FUNCTION public.is_super_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.super_admins
    WHERE user_id = uid AND is_active = true
  );
$$;

-- 2) Ensure RLS is enabled on super_admins and replace problematic policies
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'super_admins' 
      AND policyname = 'Super admins can manage super admin records'
  ) THEN
    DROP POLICY "Super admins can manage super admin records" ON public.super_admins;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'super_admins' 
      AND policyname = 'Super admins can view all super admin records'
  ) THEN
    DROP POLICY "Super admins can view all super admin records" ON public.super_admins;
  END IF;
END$$;

-- Recreate safe, non-recursive policies
CREATE POLICY "Super admins can SELECT super_admins"
ON public.super_admins
FOR SELECT
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can INSERT super_admins"
ON public.super_admins
FOR INSERT
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can UPDATE super_admins"
ON public.super_admins
FOR UPDATE
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can DELETE super_admins"
ON public.super_admins
FOR DELETE
USING (public.is_super_admin(auth.uid()));

-- 3) Create profiles trigger to populate profiles on signup (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END$$;