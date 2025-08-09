-- Allow super admins to add users to any organization
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'organization_users' AND policyname = 'Super admins can INSERT organization_users'
  ) THEN
    CREATE POLICY "Super admins can INSERT organization_users"
    ON public.organization_users
    FOR INSERT
    WITH CHECK (public.is_super_admin(auth.uid()));
  END IF;
END $$;