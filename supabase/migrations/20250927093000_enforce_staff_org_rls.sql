-- Enforce per-organization scoping for staff and organization user visibility
-- Safe/idempotent migration

-- 1) Tighten staff RLS and drop permissive policies
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- Drop any permissive policies if they exist
DROP POLICY IF EXISTS "allow_all_staff" ON public.staff;

-- Create strict org-scoped policies for staff
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='staff' AND policyname='staff_select_by_org'
	) THEN
		CREATE POLICY staff_select_by_org ON public.staff
			FOR SELECT USING (
				organization_id IN (
					SELECT organization_id FROM public.organization_users
					WHERE user_id = auth.uid() AND is_active = true
				)
			);
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='staff' AND policyname='staff_insert_by_org'
	) THEN
		CREATE POLICY staff_insert_by_org ON public.staff
			FOR INSERT WITH CHECK (
				organization_id IN (
					SELECT organization_id FROM public.organization_users
					WHERE user_id = auth.uid() AND is_active = true
				)
			);
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='staff' AND policyname='staff_update_by_org'
	) THEN
		CREATE POLICY staff_update_by_org ON public.staff
			FOR UPDATE USING (
				organization_id IN (
					SELECT organization_id FROM public.organization_users
					WHERE user_id = auth.uid() AND role IN ('owner','admin','manager','staff') AND is_active = true
				)
			) WITH CHECK (
				organization_id IN (
					SELECT organization_id FROM public.organization_users
					WHERE user_id = auth.uid() AND role IN ('owner','admin','manager','staff') AND is_active = true
				)
			);
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='staff' AND policyname='staff_delete_by_admin'
	) THEN
		CREATE POLICY staff_delete_by_admin ON public.staff
			FOR DELETE USING (
				organization_id IN (
					SELECT organization_id FROM public.organization_users
					WHERE user_id = auth.uid() AND role IN ('owner','admin') AND is_active = true
				)
			);
	END IF;
END $$;

-- Ensure organization_id is enforced (will no-op if already enforced)
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM information_schema.table_constraints 
		WHERE table_schema='public' AND table_name='staff' 
		AND constraint_type='FOREIGN KEY' AND constraint_name='staff_organization_id_fkey'
	) THEN
		ALTER TABLE public.staff
			ADD CONSTRAINT staff_organization_id_fkey FOREIGN KEY (organization_id)
			REFERENCES public.organizations(id) ON DELETE CASCADE;
	END IF;

	-- Attempt to set NOT NULL if possible (will fail if nulls exist; catch and ignore)
	BEGIN
		ALTER TABLE public.staff ALTER COLUMN organization_id SET NOT NULL;
	EXCEPTION WHEN others THEN
		-- Ignore if already set or data prevents; earlier migrations should have set this
		NULL;
	END;
END $$;


-- 2) Tighten staff_default_locations RLS
ALTER TABLE public.staff_default_locations ENABLE ROW LEVEL SECURITY;

-- Drop permissive policy
DROP POLICY IF EXISTS "allow_all_staff_default_locations" ON public.staff_default_locations;

-- Policies scoped via the staff's organization
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='staff_default_locations' AND policyname='sdl_select_by_org'
	) THEN
		CREATE POLICY sdl_select_by_org ON public.staff_default_locations
			FOR SELECT USING (
				EXISTS (
					SELECT 1 FROM public.staff s
					JOIN public.organization_users ou ON ou.organization_id = s.organization_id
					WHERE s.id = staff_default_locations.staff_id
						AND ou.user_id = auth.uid()
						AND ou.is_active = true
				)
			);
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='staff_default_locations' AND policyname='sdl_insert_by_org'
	) THEN
		CREATE POLICY sdl_insert_by_org ON public.staff_default_locations
			FOR INSERT WITH CHECK (
				EXISTS (
					SELECT 1 FROM public.staff s
					JOIN public.organization_users ou ON ou.organization_id = s.organization_id
					WHERE s.id = staff_default_locations.staff_id
						AND ou.user_id = auth.uid()
						AND ou.is_active = true
				)
			);
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='staff_default_locations' AND policyname='sdl_update_by_org'
	) THEN
		CREATE POLICY sdl_update_by_org ON public.staff_default_locations
			FOR UPDATE USING (
				EXISTS (
					SELECT 1 FROM public.staff s
					JOIN public.organization_users ou ON ou.organization_id = s.organization_id
					WHERE s.id = staff_default_locations.staff_id
						AND ou.user_id = auth.uid()
						AND ou.is_active = true
				)
			) WITH CHECK (
				EXISTS (
					SELECT 1 FROM public.staff s
					JOIN public.organization_users ou ON ou.organization_id = s.organization_id
					WHERE s.id = staff_default_locations.staff_id
						AND ou.user_id = auth.uid()
						AND ou.is_active = true
				)
			);
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='staff_default_locations' AND policyname='sdl_delete_by_admin'
	) THEN
		CREATE POLICY sdl_delete_by_admin ON public.staff_default_locations
			FOR DELETE USING (
				EXISTS (
					SELECT 1 FROM public.staff s
					JOIN public.organization_users ou ON ou.organization_id = s.organization_id
					WHERE s.id = staff_default_locations.staff_id
						AND ou.user_id = auth.uid()
						AND ou.role IN ('owner','admin')
						AND ou.is_active = true
				)
			);
	END IF;
END $$;


-- 3) Enable and enforce organization_users RLS so users are not visible across organizations
ALTER TABLE public.organization_users ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
	-- SELECT: allow seeing members only of orgs the user belongs to
	IF NOT EXISTS (
		SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='organization_users' AND policyname='org_users_select_by_org'
	) THEN
		CREATE POLICY org_users_select_by_org ON public.organization_users
			FOR SELECT USING (
				organization_id IN (
					SELECT organization_id FROM public.organization_users
					WHERE user_id = auth.uid() AND is_active = true
				)
			);
	END IF;

	-- INSERT: owners/admins can add members to their org
	IF NOT EXISTS (
		SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='organization_users' AND policyname='org_users_insert_by_admin'
	) THEN
		CREATE POLICY org_users_insert_by_admin ON public.organization_users
			FOR INSERT WITH CHECK (
				EXISTS (
					SELECT 1 FROM public.organization_users ou
					WHERE ou.organization_id = organization_users.organization_id
						AND ou.user_id = auth.uid()
						AND ou.role IN ('owner','admin')
						AND ou.is_active = true
				)
			);
	END IF;

	-- UPDATE: owners/admins can update members within their org
	IF NOT EXISTS (
		SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='organization_users' AND policyname='org_users_update_by_admin'
	) THEN
		CREATE POLICY org_users_update_by_admin ON public.organization_users
			FOR UPDATE USING (
				EXISTS (
					SELECT 1 FROM public.organization_users ou
					WHERE ou.organization_id = organization_users.organization_id
						AND ou.user_id = auth.uid()
						AND ou.role IN ('owner','admin')
						AND ou.is_active = true
				)
			) WITH CHECK (
				EXISTS (
					SELECT 1 FROM public.organization_users ou
					WHERE ou.organization_id = organization_users.organization_id
						AND ou.user_id = auth.uid()
						AND ou.role IN ('owner','admin')
						AND ou.is_active = true
				)
			);
	END IF;

	-- DELETE: owners/admins only
	IF NOT EXISTS (
		SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='organization_users' AND policyname='org_users_delete_by_admin'
	) THEN
		CREATE POLICY org_users_delete_by_admin ON public.organization_users
			FOR DELETE USING (
				EXISTS (
					SELECT 1 FROM public.organization_users ou
					WHERE ou.organization_id = organization_users.organization_id
						AND ou.user_id = auth.uid()
						AND ou.role IN ('owner','admin')
						AND ou.is_active = true
				)
			);
	END IF;
END $$;