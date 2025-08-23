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