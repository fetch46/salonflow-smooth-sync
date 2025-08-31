-- Add RLS policy for staff_commissions table and fix remaining search path
-- Check if staff_commissions table exists and add appropriate policies

-- Add RLS policies for staff_commissions table
CREATE POLICY "Organization members can view staff commissions" 
ON staff_commissions FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM organization_users ou 
    WHERE ou.organization_id = staff_commissions.organization_id 
    AND ou.user_id = auth.uid() 
    AND ou.is_active = true
  )
);

CREATE POLICY "Organization admins can manage staff commissions" 
ON staff_commissions FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM organization_users ou 
    WHERE ou.organization_id = staff_commissions.organization_id 
    AND ou.user_id = auth.uid() 
    AND ou.is_active = true 
    AND ou.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM organization_users ou 
    WHERE ou.organization_id = staff_commissions.organization_id 
    AND ou.user_id = auth.uid() 
    AND ou.is_active = true 
    AND ou.role IN ('owner', 'admin')
  )
);

-- Fix remaining function search path issues by checking system functions
ALTER FUNCTION touch_updated_at() SET search_path = 'public';
ALTER FUNCTION set_updated_at() SET search_path = 'public';