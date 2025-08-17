-- Service Categories per Organization
-- Creates `service_categories` table and enforces per-org uniqueness

-- 1) Table
CREATE TABLE IF NOT EXISTS public.service_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (organization_id, name)
);

-- 2) Indexes
CREATE INDEX IF NOT EXISTS idx_service_categories_org ON public.service_categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_service_categories_name ON public.service_categories(name);

-- 2b) Seed from existing services (distinct names per org)
INSERT INTO public.service_categories (organization_id, name, description, is_active)
SELECT DISTINCT s.organization_id, s.category, NULL, true
FROM public.services s
WHERE s.category IS NOT NULL AND s.category <> ''
ON CONFLICT (organization_id, name) DO NOTHING;

-- 3) RLS
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;

-- SELECT policy
DROP POLICY IF EXISTS "Users can view service categories" ON public.service_categories;
CREATE POLICY "Users can view service categories" ON public.service_categories
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_users
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- INSERT policy
DROP POLICY IF EXISTS "Users can insert service categories" ON public.service_categories;
CREATE POLICY "Users can insert service categories" ON public.service_categories
    FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM public.organization_users
            WHERE user_id = auth.uid() AND role IN ('owner','admin','manager','staff') AND is_active = true
        )
    );

-- UPDATE policy
DROP POLICY IF EXISTS "Users can update service categories" ON public.service_categories;
CREATE POLICY "Users can update service categories" ON public.service_categories
    FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_users
            WHERE user_id = auth.uid() AND role IN ('owner','admin','manager','staff') AND is_active = true
        )
    );

-- DELETE policy
DROP POLICY IF EXISTS "Admins can delete service categories" ON public.service_categories;
CREATE POLICY "Admins can delete service categories" ON public.service_categories
    FOR DELETE
    USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_users
            WHERE user_id = auth.uid() AND role IN ('owner','admin') AND is_active = true
        )
    );

-- 4) updated_at trigger
DROP TRIGGER IF EXISTS update_service_categories_updated_at ON public.service_categories;
CREATE TRIGGER update_service_categories_updated_at
    BEFORE UPDATE ON public.service_categories
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Grants
GRANT ALL ON public.service_categories TO authenticated;