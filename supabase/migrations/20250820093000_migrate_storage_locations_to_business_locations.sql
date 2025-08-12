-- Provide compatibility for legacy references to storage_locations by mapping to business_locations
CREATE OR REPLACE VIEW public.storage_locations AS
SELECT
  bl.id,
  bl.name,
  bl.is_active,
  bl.organization_id,
  bl.created_at,
  bl.updated_at
FROM public.business_locations bl;