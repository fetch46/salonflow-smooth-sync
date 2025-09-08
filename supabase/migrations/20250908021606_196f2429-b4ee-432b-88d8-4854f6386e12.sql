-- Enable accountant module for all organizations
INSERT INTO organization_modules (organization_id, module_name, is_enabled, enabled_at, enabled_by)
SELECT 
    o.id as organization_id,
    'accountant' as module_name,
    true as is_enabled,
    now() as enabled_at,
    NULL as enabled_by
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM organization_modules om 
    WHERE om.organization_id = o.id 
    AND om.module_name = 'accountant'
);