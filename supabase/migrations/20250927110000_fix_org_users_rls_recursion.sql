-- Fix recursive RLS on public.organization_users by using SECURITY DEFINER helper functions

-- 1) Helper functions that bypass RLS on organization_users
CREATE OR REPLACE FUNCTION public.is_member_of_organization(org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
	user_uuid uuid := auth.uid();
	v_exists boolean;
BEGIN
	IF user_uuid IS NULL THEN
		RETURN false;
	END IF;

	SELECT EXISTS (
		SELECT 1
		FROM public.organization_users ou
		WHERE ou.organization_id = org_id
			AND ou.user_id = user_uuid
			AND ou.is_active = true
	) INTO v_exists;

	RETURN COALESCE(v_exists, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin_of_organization(org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
	user_uuid uuid := auth.uid();
	v_exists boolean;
BEGIN
	IF user_uuid IS NULL THEN
		RETURN false;
	END IF;

	SELECT EXISTS (
		SELECT 1
		FROM public.organization_users ou
		WHERE ou.organization_id = org_id
			AND ou.user_id = user_uuid
			AND ou.is_active = true
			AND ou.role IN ('owner','admin')
	) INTO v_exists;

	RETURN COALESCE(v_exists, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_member_of_organization(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_of_organization(uuid) TO anon, authenticated;

-- 2) Ensure RLS is enabled on organization_users
ALTER TABLE public.organization_users ENABLE ROW LEVEL SECURITY;

-- 3) Replace recursive policies with function-based policies
DROP POLICY IF EXISTS org_users_select_by_org ON public.organization_users;
DROP POLICY IF EXISTS org_users_insert_by_admin ON public.organization_users;
DROP POLICY IF EXISTS org_users_update_by_admin ON public.organization_users;
DROP POLICY IF EXISTS org_users_delete_by_admin ON public.organization_users;

CREATE POLICY org_users_select_by_org ON public.organization_users
	FOR SELECT USING (
		public.is_member_of_organization(organization_id)
	);

CREATE POLICY org_users_insert_by_admin ON public.organization_users
	FOR INSERT WITH CHECK (
		public.is_admin_of_organization(organization_id)
	);

CREATE POLICY org_users_update_by_admin ON public.organization_users
	FOR UPDATE USING (
		public.is_admin_of_organization(organization_id)
	) WITH CHECK (
		public.is_admin_of_organization(organization_id)
	);

CREATE POLICY org_users_delete_by_admin ON public.organization_users
	FOR DELETE USING (
		public.is_admin_of_organization(organization_id)
	);