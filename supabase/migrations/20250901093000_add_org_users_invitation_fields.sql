-- Add invitation-related fields to organization_users and create user_invitations table
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add columns to organization_users if missing
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organization_users'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organization_users' AND column_name = 'invited_by'
    ) THEN
      ALTER TABLE public.organization_users ADD COLUMN invited_by uuid NULL;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organization_users' AND column_name = 'invited_at'
    ) THEN
      ALTER TABLE public.organization_users ADD COLUMN invited_at timestamptz NULL;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organization_users' AND column_name = 'invitation_token'
    ) THEN
      ALTER TABLE public.organization_users ADD COLUMN invitation_token text NULL;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organization_users' AND column_name = 'invitation_sent_at'
    ) THEN
      ALTER TABLE public.organization_users ADD COLUMN invitation_sent_at timestamptz NULL;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organization_users' AND column_name = 'invitation_accepted_at'
    ) THEN
      ALTER TABLE public.organization_users ADD COLUMN invitation_accepted_at timestamptz NULL;
    END IF;
  END IF;
END $$;

-- user_invitations table
CREATE TABLE IF NOT EXISTS public.user_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'staff',
  invited_by uuid NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_user_invitations_org ON public.user_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON public.user_invitations(email);
CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON public.user_invitations(token);

-- RLS permissive for dev/demo
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_invitations' AND policyname = 'Allow all (user_invitations)'
  ) THEN
    CREATE POLICY "Allow all (user_invitations)" ON public.user_invitations
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Super Admins: table and functions to satisfy required functions
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

-- Basic RLS and policies for super_admins
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'super_admins' AND policyname = 'super_admins_allow_all'
  ) THEN
    CREATE POLICY super_admins_allow_all ON public.super_admins FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Helper: updated_at touch trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_super_admins_updated_at') THEN
    CREATE TRIGGER trg_super_admins_updated_at BEFORE UPDATE ON public.super_admins FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- Functions: is_super_admin, grant_super_admin, revoke_super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin(uid uuid)
RETURNS boolean AS $$
DECLARE v_is boolean; BEGIN
  SELECT COALESCE(sa.is_active, false) INTO v_is
  FROM public.super_admins sa
  WHERE sa.user_id = uid
  LIMIT 1;
  RETURN COALESCE(v_is, false);
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.grant_super_admin(target_user_id uuid)
RETURNS boolean AS $$
BEGIN
  INSERT INTO public.super_admins(user_id, granted_by, is_active)
  VALUES (target_user_id, auth.uid(), true)
  ON CONFLICT (user_id) DO UPDATE SET is_active = true, granted_by = EXCLUDED.granted_by, updated_at = now();
  RETURN true;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.revoke_super_admin(target_user_id uuid)
RETURNS boolean AS $$
BEGIN
  UPDATE public.super_admins SET is_active = false, updated_at = now() WHERE user_id = target_user_id;
  RETURN true;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_super_admin(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_super_admin(uuid) TO anon, authenticated;