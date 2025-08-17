-- Enforce per-organization uniqueness for Inventory and Service items

-- 1) De-duplicate existing Services by (organization_id, name)
WITH svc_dups AS (
  SELECT id, organization_id, name,
         ROW_NUMBER() OVER (PARTITION BY organization_id, name ORDER BY created_at, id) AS rn
  FROM public.services
)
UPDATE public.services s
SET name = s.name || ' (' || svc_dups.rn || ')'
FROM svc_dups
WHERE s.id = svc_dups.id AND svc_dups.rn > 1;

-- 2) De-duplicate existing SKUs per organization in inventory_items
WITH sku_dups AS (
  SELECT id, organization_id, sku,
         ROW_NUMBER() OVER (PARTITION BY organization_id, sku ORDER BY created_at, id) AS rn
  FROM public.inventory_items
  WHERE sku IS NOT NULL
)
UPDATE public.inventory_items ii
SET sku = ii.sku || '-' || sku_dups.rn
FROM sku_dups
WHERE ii.id = sku_dups.id AND sku_dups.rn > 1;

-- 3) De-duplicate inventory item names per organization (goods only)
WITH inv_name_dups AS (
  SELECT id, organization_id, name,
         ROW_NUMBER() OVER (PARTITION BY organization_id, name ORDER BY created_at, id) AS rn
  FROM public.inventory_items
  WHERE type = 'good'
)
UPDATE public.inventory_items ii
SET name = ii.name || ' (' || inv_name_dups.rn || ')'
FROM inv_name_dups
WHERE ii.id = inv_name_dups.id AND inv_name_dups.rn > 1;

-- 4) Drop any global unique constraint on inventory_items.sku (if present)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.inventory_items'::regclass
      AND contype = 'u'
      AND conname = 'inventory_items_sku_key'
  ) THEN
    ALTER TABLE public.inventory_items DROP CONSTRAINT inventory_items_sku_key;
  END IF;
END $$;

-- 5) Create unique indexes per organization
CREATE UNIQUE INDEX IF NOT EXISTS ux_services_org_name
  ON public.services(organization_id, name);

CREATE UNIQUE INDEX IF NOT EXISTS ux_inventory_items_org_sku
  ON public.inventory_items(organization_id, sku)
  WHERE sku IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_inventory_items_org_name_goods
  ON public.inventory_items(organization_id, name)
  WHERE type = 'good';