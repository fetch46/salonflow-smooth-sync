-- Create user_invitations table with proper constraints and RLS
CREATE TABLE IF NOT EXISTS public.user_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'staff',
  invited_by uuid NOT NULL, -- auth user id (references profiles.user_id logically)
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_invitations_org ON public.user_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON public.user_invitations(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_invitations_token_unique ON public.user_invitations(token);

-- Trigger to keep updated_at fresh
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_invitations_updated_at'
  ) THEN
    CREATE TRIGGER update_user_invitations_updated_at
    BEFORE UPDATE ON public.user_invitations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

-- Policies for organization members and admins
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'user_invitations' AND policyname = 'Org members can SELECT their invitations'
  ) THEN
    CREATE POLICY "Org members can SELECT their invitations"
    ON public.user_invitations
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.organization_users ou
        WHERE ou.organization_id = user_invitations.organization_id
          AND ou.user_id = auth.uid()
          AND ou.is_active = true
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'user_invitations' AND policyname = 'Org admins can INSERT invitations'
  ) THEN
    CREATE POLICY "Org admins can INSERT invitations"
    ON public.user_invitations
    FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.organization_users ou
        WHERE ou.organization_id = user_invitations.organization_id
          AND ou.user_id = auth.uid()
          AND ou.role = ANY (ARRAY['owner','admin'])
          AND ou.is_active = true
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'user_invitations' AND policyname = 'Org admins can UPDATE invitations'
  ) THEN
    CREATE POLICY "Org admins can UPDATE invitations"
    ON public.user_invitations
    FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM public.organization_users ou
        WHERE ou.organization_id = user_invitations.organization_id
          AND ou.user_id = auth.uid()
          AND ou.role = ANY (ARRAY['owner','admin'])
          AND ou.is_active = true
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'user_invitations' AND policyname = 'Org admins can DELETE invitations'
  ) THEN
    CREATE POLICY "Org admins can DELETE invitations"
    ON public.user_invitations
    FOR DELETE
    USING (
      EXISTS (
        SELECT 1 FROM public.organization_users ou
        WHERE ou.organization_id = user_invitations.organization_id
          AND ou.user_id = auth.uid()
          AND ou.role = ANY (ARRAY['owner','admin'])
          AND ou.is_active = true
      )
    );
  END IF;
END $$;

-- Super admin full access policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'user_invitations' AND policyname = 'Super admins can SELECT invitations'
  ) THEN
    CREATE POLICY "Super admins can SELECT invitations"
    ON public.user_invitations
    FOR SELECT
    USING (public.is_super_admin(auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'user_invitations' AND policyname = 'Super admins can INSERT invitations'
  ) THEN
    CREATE POLICY "Super admins can INSERT invitations"
    ON public.user_invitations
    FOR INSERT
    WITH CHECK (public.is_super_admin(auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'user_invitations' AND policyname = 'Super admins can UPDATE invitations'
  ) THEN
    CREATE POLICY "Super admins can UPDATE invitations"
    ON public.user_invitations
    FOR UPDATE
    USING (public.is_super_admin(auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'user_invitations' AND policyname = 'Super admins can DELETE invitations'
  ) THEN
    CREATE POLICY "Super admins can DELETE invitations"
    ON public.user_invitations
    FOR DELETE
    USING (public.is_super_admin(auth.uid()));
  END IF;
END $$;

-- Allow super admins to view all organizations (for admin UI dropdowns)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'organizations' AND policyname = 'Super admins can SELECT organizations'
  ) THEN
    CREATE POLICY "Super admins can SELECT organizations"
    ON public.organizations
    FOR SELECT
    USING (public.is_super_admin(auth.uid()));
  END IF;
END $$;

-- Allow super admins to view all profiles (for inviter emails)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Super admins can SELECT profiles'
  ) THEN
    CREATE POLICY "Super admins can SELECT profiles"
    ON public.profiles
    FOR SELECT
    USING (public.is_super_admin(auth.uid()));
  END IF;
END $$;