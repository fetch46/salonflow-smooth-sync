-- Allow super admins to read all organization memberships
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'organization_users' AND policyname = 'Super admins can SELECT organization_users'
  ) THEN
    CREATE POLICY "Super admins can SELECT organization_users"
    ON public.organization_users
    FOR SELECT
    USING (public.is_super_admin(auth.uid()));
  END IF;
END $$;