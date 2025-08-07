-- Fix organization creation functions to use proper schema and avoid timeouts

-- 1) Recreate create_organization_with_user with proper search_path and qualified tables
CREATE OR REPLACE FUNCTION public.create_organization_with_user(
  org_name text,
  org_slug text,
  org_settings jsonb DEFAULT '{}'::jsonb,
  plan_id uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id uuid;
  uid uuid;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  INSERT INTO public.organizations (name, slug, settings)
  VALUES (org_name, org_slug, COALESCE(org_settings, '{}'::jsonb))
  RETURNING id INTO new_org_id;

  INSERT INTO public.organization_users (organization_id, user_id, role, is_active)
  VALUES (new_org_id, uid, 'owner', true);

  IF plan_id IS NOT NULL THEN
    INSERT INTO public.organization_subscriptions (organization_id, plan_id, status, interval)
    VALUES (new_org_id, plan_id, 'trial', 'month');
  END IF;

  RETURN new_org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_organization_with_user(text, text, jsonb, uuid) TO authenticated;

-- 2) Recreate setup_new_organization with proper search_path
CREATE OR REPLACE FUNCTION public.setup_new_organization(org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_users 
    WHERE organization_id = org_id AND user_id = auth.uid() AND role = 'owner' AND is_active = true
  ) THEN
    RAISE EXCEPTION 'User must be owner of organization';
  END IF;

  -- Placeholder (idempotent) for future default data setup
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.setup_new_organization(uuid) TO authenticated;