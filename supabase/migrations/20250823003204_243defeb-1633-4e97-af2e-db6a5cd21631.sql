-- Update organization_modules to remove direct module control
ALTER TABLE public.organization_modules 
ADD COLUMN IF NOT EXISTS controlled_by_plan boolean DEFAULT true;

-- Remove individual module toggle policies for organizations
DROP POLICY IF EXISTS "org_admins_can_manage_modules" ON public.organization_modules;

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