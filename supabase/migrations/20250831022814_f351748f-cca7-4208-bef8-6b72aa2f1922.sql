-- Fix staff_commissions RLS policies based on actual table structure
-- Since staff_commissions doesn't have organization_id, we need to link through staff table

DROP POLICY IF EXISTS "Organization members can view staff commissions" ON staff_commissions;
DROP POLICY IF EXISTS "Organization admins can manage staff commissions" ON staff_commissions;

-- Create policies that link through staff table to get organization context
CREATE POLICY "Staff can view their own commissions" 
ON staff_commissions FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM staff s 
    JOIN organization_users ou ON ou.organization_id = s.organization_id
    WHERE s.id = staff_commissions.staff_id 
    AND ou.user_id = auth.uid() 
    AND ou.is_active = true
  )
);

CREATE POLICY "Organization admins can manage staff commissions" 
ON staff_commissions FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM staff s 
    JOIN organization_users ou ON ou.organization_id = s.organization_id
    WHERE s.id = staff_commissions.staff_id 
    AND ou.user_id = auth.uid() 
    AND ou.is_active = true 
    AND ou.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM staff s 
    JOIN organization_users ou ON ou.organization_id = s.organization_id
    WHERE s.id = staff_commissions.staff_id 
    AND ou.user_id = auth.uid() 
    AND ou.is_active = true 
    AND ou.role IN ('owner', 'admin')
  )
);