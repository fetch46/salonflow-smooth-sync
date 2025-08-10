-- Legacy storage locations migration retained for history; superseded by business_locations
-- The following block is no longer applied in modern setups.
-- CREATE TABLE public.storage_locations (
--   id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
--   name TEXT NOT NULL,
--   description TEXT,
--   is_active BOOLEAN DEFAULT true,
--   created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
--   updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
-- );

-- The rest of this file created sample data for legacy storage locations; left as comments.

/*
-- Create inventory items table
CREATE TABLE public.inventory_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('good', 'service')),
  sku TEXT UNIQUE,
  unit TEXT, -- unit of measurement (piece, liter, kg, etc.)
  reorder_point INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create inventory levels table (for goods only)
CREATE TABLE public.inventory_levels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.business_locations(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(item_id, location_id)
);

-- Create service kits table (relationship between services and goods)
CREATE TABLE public.service_kits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  good_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(service_id, good_id)
);

-- Enable RLS on all tables
ALTER TABLE public.storage_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_kits ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (public access for now)
CREATE POLICY "Public access to storage_locations" ON public.storage_locations FOR ALL USING (true);
CREATE POLICY "Public access to inventory_items" ON public.inventory_items FOR ALL USING (true);
CREATE POLICY "Public access to inventory_levels" ON public.inventory_levels FOR ALL USING (true);
CREATE POLICY "Public access to service_kits" ON public.service_kits FOR ALL USING (true);

-- Create triggers for updated_at
CREATE TRIGGER update_storage_locations_updated_at
  BEFORE UPDATE ON public.storage_locations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_inventory_items_updated_at
  BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_inventory_levels_updated_at
  BEFORE UPDATE ON public.inventory_levels
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_service_kits_updated_at
  BEFORE UPDATE ON public.service_kits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample storage locations
INSERT INTO public.storage_locations (name, description) VALUES
  ('Main Storage', 'Primary storage area'),
  ('Reception Area', 'Front desk storage'),
  ('Treatment Room 1', 'Storage in treatment room 1'),
  ('Treatment Room 2', 'Storage in treatment room 2');

-- Insert sample inventory items
INSERT INTO public.inventory_items (name, description, type, sku, unit, reorder_point) VALUES
  ('Shampoo Bottle', 'Professional shampoo 500ml', 'good', 'SH001', 'bottle', 5),
  ('Conditioner Bottle', 'Professional conditioner 500ml', 'good', 'CD001', 'bottle', 3),
  ('Hair Dye - Black', 'Professional hair dye - black color', 'good', 'HD001', 'tube', 2),
  ('Hair Dye - Brown', 'Professional hair dye - brown color', 'good', 'HD002', 'tube', 2),
  ('Towels', 'Professional salon towels', 'good', 'TW001', 'piece', 10),
  ('Complete Hair Treatment', 'Full service including wash, cut, and style', 'service', 'SV001', 'service', 0),
  ('Hair Coloring Service', 'Professional hair coloring service', 'service', 'SV002', 'service', 0);

-- Insert sample inventory levels
INSERT INTO public.inventory_levels (item_id, location_id, quantity) VALUES
  ((SELECT id FROM public.inventory_items WHERE sku = 'SH001'), (SELECT id FROM public.storage_locations WHERE name = 'Main Storage'), 15),
  ((SELECT id FROM public.inventory_items WHERE sku = 'CD001'), (SELECT id FROM public.storage_locations WHERE name = 'Main Storage'), 8),
  ((SELECT id FROM public.inventory_items WHERE sku = 'HD001'), (SELECT id FROM public.storage_locations WHERE name = 'Main Storage'), 5),
  ((SELECT id FROM public.inventory_items WHERE sku = 'HD002'), (SELECT id FROM public.storage_locations WHERE name = 'Main Storage'), 4),
  ((SELECT id FROM public.inventory_items WHERE sku = 'TW001'), (SELECT id FROM public.storage_locations WHERE name = 'Treatment Room 1'), 20),
  ((SELECT id FROM public.inventory_items WHERE sku = 'TW001'), (SELECT id FROM public.storage_locations WHERE name = 'Treatment Room 2'), 15);

-- Insert sample service kits
INSERT INTO public.service_kits (service_id, good_id, quantity) VALUES
  ((SELECT id FROM public.inventory_items WHERE sku = 'SV001'), (SELECT id FROM public.inventory_items WHERE sku = 'SH001'), 1),
  ((SELECT id FROM public.inventory_items WHERE sku = 'SV001'), (SELECT id FROM public.inventory_items WHERE sku = 'CD001'), 1),
  ((SELECT id FROM public.inventory_items WHERE sku = 'SV001'), (SELECT id FROM public.inventory_items WHERE sku = 'TW001'), 2),
  ((SELECT id FROM public.inventory_items WHERE sku = 'SV002'), (SELECT id FROM public.inventory_items WHERE sku = 'HD001'), 1),
  ((SELECT id FROM public.inventory_items WHERE sku = 'SV002'), (SELECT id FROM public.inventory_items WHERE sku = 'TW001'), 1);
*/