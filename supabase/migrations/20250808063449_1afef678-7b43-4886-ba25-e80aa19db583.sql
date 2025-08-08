-- Allow super admins to manage subscription plans
-- INSERT policy
CREATE POLICY "Super admins can INSERT subscription_plans"
ON public.subscription_plans
FOR INSERT
WITH CHECK (is_super_admin(auth.uid()));

-- UPDATE policy
CREATE POLICY "Super admins can UPDATE subscription_plans"
ON public.subscription_plans
FOR UPDATE
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- DELETE policy
CREATE POLICY "Super admins can DELETE subscription_plans"
ON public.subscription_plans
FOR DELETE
USING (is_super_admin(auth.uid()));