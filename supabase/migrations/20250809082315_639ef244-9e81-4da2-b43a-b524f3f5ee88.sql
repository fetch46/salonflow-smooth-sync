-- Super admins full access to organization_subscriptions
DO $$
BEGIN
  -- SELECT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'organization_subscriptions' AND policyname = 'Super admins can SELECT organization_subscriptions'
  ) THEN
    CREATE POLICY "Super admins can SELECT organization_subscriptions"
    ON public.organization_subscriptions
    FOR SELECT
    USING (public.is_super_admin(auth.uid()));
  END IF;

  -- INSERT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'organization_subscriptions' AND policyname = 'Super admins can INSERT organization_subscriptions'
  ) THEN
    CREATE POLICY "Super admins can INSERT organization_subscriptions"
    ON public.organization_subscriptions
    FOR INSERT
    WITH CHECK (public.is_super_admin(auth.uid()));
  END IF;

  -- UPDATE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'organization_subscriptions' AND policyname = 'Super admins can UPDATE organization_subscriptions'
  ) THEN
    CREATE POLICY "Super admins can UPDATE organization_subscriptions"
    ON public.organization_subscriptions
    FOR UPDATE
    USING (public.is_super_admin(auth.uid()))
    WITH CHECK (public.is_super_admin(auth.uid()));
  END IF;

  -- DELETE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'organization_subscriptions' AND policyname = 'Super admins can DELETE organization_subscriptions'
  ) THEN
    CREATE POLICY "Super admins can DELETE organization_subscriptions"
    ON public.organization_subscriptions
    FOR DELETE
    USING (public.is_super_admin(auth.uid()));
  END IF;
END $$;