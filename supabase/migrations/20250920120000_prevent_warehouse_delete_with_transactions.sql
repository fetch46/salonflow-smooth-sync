-- Prevent deleting warehouses that have related transactions
CREATE OR REPLACE FUNCTION public.prevent_warehouse_delete_if_referenced()
RETURNS trigger AS $$
BEGIN
  -- Block deletion if any transaction-like records reference this warehouse
  IF EXISTS (SELECT 1 FROM public.inventory_levels WHERE warehouse_id = OLD.id) THEN
    RAISE EXCEPTION 'Cannot delete warehouse with existing inventory levels or transactions referencing it';
  END IF;

  IF EXISTS (SELECT 1 FROM public.goods_received WHERE warehouse_id = OLD.id) THEN
    RAISE EXCEPTION 'Cannot delete warehouse with goods received referencing it';
  END IF;

  IF EXISTS (SELECT 1 FROM public.inventory_adjustments WHERE warehouse_id = OLD.id) THEN
    RAISE EXCEPTION 'Cannot delete warehouse with inventory adjustments referencing it';
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS trg_prevent_warehouse_delete ON public.warehouses;
CREATE TRIGGER trg_prevent_warehouse_delete
BEFORE DELETE ON public.warehouses
FOR EACH ROW
EXECUTE FUNCTION public.prevent_warehouse_delete_if_referenced();