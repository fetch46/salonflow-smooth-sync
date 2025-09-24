-- Fix database function security issues by only updating search_path without dropping
-- This addresses the mutable search path security warnings without breaking dependencies

-- Update existing functions to add search_path without changing signatures
CREATE OR REPLACE FUNCTION public.is_super_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  RETURN public.is_super_admin(auth.uid()::uuid);
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_member_of_organization(org_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.is_admin_of_organization(org_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.user_has_organization(user_uuid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 
    FROM public.organization_users 
    WHERE user_id = user_uuid 
      AND is_active = true
  );
$function$;

CREATE OR REPLACE FUNCTION public.get_user_organization_count(user_uuid uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public
AS $function$
  SELECT COUNT(*)::integer
  FROM public.organization_users 
  WHERE user_id = user_uuid 
    AND is_active = true;
$function$;