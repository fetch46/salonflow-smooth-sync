-- Fix job_number ambiguous reference by creating a proper function for job number generation
-- Drop the existing function first
DROP FUNCTION IF EXISTS public.generate_job_number();

-- Create new function with organization context
CREATE OR REPLACE FUNCTION public.generate_job_number(p_organization_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    next_number INTEGER;
    job_number TEXT;
BEGIN
    SELECT COALESCE(MAX(CAST(SUBSTRING(job_number FROM 'JC(\d+)') AS INTEGER)), 0) + 1
    INTO next_number
    FROM public.job_cards
    WHERE organization_id = p_organization_id
      AND job_number ~ '^JC\d+$';
    job_number := 'JC' || LPAD(next_number::TEXT, 3, '0');
    RETURN job_number;
END;
$$;

-- Update the job_cards table trigger to use organization-specific generation
DROP TRIGGER IF EXISTS set_job_number ON public.job_cards;

CREATE OR REPLACE FUNCTION public.set_job_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    IF NEW.job_number IS NULL OR NEW.job_number = '' THEN
        NEW.job_number := public.generate_job_number(NEW.organization_id);
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER set_job_number
    BEFORE INSERT ON public.job_cards
    FOR EACH ROW
    EXECUTE FUNCTION public.set_job_number();

-- Create subscription_plan_modules table to link modules to plans
CREATE TABLE IF NOT EXISTS public.subscription_plan_modules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
    module_name text NOT NULL,
    is_enabled boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(plan_id, module_name)
);

-- Enable RLS on subscription_plan_modules
ALTER TABLE public.subscription_plan_modules ENABLE ROW LEVEL SECURITY;

-- Create policies for subscription_plan_modules
CREATE POLICY "Super admins can manage subscription plan modules"
ON public.subscription_plan_modules
FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- Add module configuration to existing subscription plans
INSERT INTO public.subscription_plan_modules (plan_id, module_name, is_enabled)
SELECT sp.id, module_name, true
FROM public.subscription_plans sp
CROSS JOIN (
    VALUES 
    ('appointments'),
    ('clients'), 
    ('invoices'),
    ('payments'),
    ('jobcards'),
    ('suppliers'),
    ('purchases'),
    ('goods_received'),
    ('expenses'),
    ('products'),
    ('adjustments'),
    ('transfers'),
    ('banking'),
    ('reports'),
    ('settings')
) AS modules(module_name)
ON CONFLICT (plan_id, module_name) DO NOTHING;

-- Update organization_modules to remove direct module control
-- Organizations now get modules only through their subscription plan
ALTER TABLE public.organization_modules 
ADD COLUMN IF NOT EXISTS controlled_by_plan boolean DEFAULT true;

-- Remove individual module toggle policies for organizations
DROP POLICY IF EXISTS "org_admins_can_manage_modules" ON public.organization_modules;

-- Create new policies that prevent direct module management
CREATE POLICY "org_members_can_view_modules"
ON public.organization_modules
FOR SELECT
USING (organization_id IN (
    SELECT organization_id
    FROM organization_users
    WHERE user_id = auth.uid() AND is_active = true
));

-- Only super admins can manage organization modules now (through subscription plans)
CREATE POLICY "only_super_admins_can_manage_org_modules"
ON public.organization_modules
FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- Create a function to sync organization modules with subscription plan modules
CREATE OR REPLACE FUNCTION public.sync_organization_modules_with_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    org_id uuid;
    plan_id uuid;
BEGIN
    -- Get organization and plan from subscription
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        org_id := NEW.organization_id;
        plan_id := NEW.plan_id;
    ELSE
        org_id := OLD.organization_id;
        plan_id := OLD.plan_id;
    END IF;

    -- Clear existing modules for this organization
    DELETE FROM public.organization_modules 
    WHERE organization_id = org_id;

    -- Insert modules from the subscription plan
    INSERT INTO public.organization_modules (organization_id, module_name, is_enabled, controlled_by_plan)
    SELECT org_id, spm.module_name, spm.is_enabled, true
    FROM public.subscription_plan_modules spm
    WHERE spm.plan_id = plan_id AND spm.is_enabled = true;

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger to sync modules when subscription changes
DROP TRIGGER IF EXISTS sync_modules_on_subscription_change ON public.organization_subscriptions;
CREATE TRIGGER sync_modules_on_subscription_change
    AFTER INSERT OR UPDATE OF plan_id ON public.organization_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_organization_modules_with_plan();