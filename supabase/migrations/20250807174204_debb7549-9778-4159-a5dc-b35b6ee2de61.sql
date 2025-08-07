-- Create inventory adjustments table
CREATE TABLE public.inventory_adjustments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  adjustment_number TEXT NOT NULL UNIQUE,
  adjustment_date DATE NOT NULL,
  adjustment_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  total_items INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create inventory adjustment items table
CREATE TABLE public.inventory_adjustment_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  adjustment_id UUID NOT NULL REFERENCES public.inventory_adjustments(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  current_quantity INTEGER NOT NULL,
  adjusted_quantity INTEGER NOT NULL,
  difference INTEGER NOT NULL,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create suppliers table
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT,
  website TEXT,
  tax_id TEXT,
  payment_terms TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create super admins table
CREATE TABLE public.super_admins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_adjustment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

-- RLS policies for inventory_adjustments
CREATE POLICY "Public access to inventory_adjustments" 
ON public.inventory_adjustments 
FOR ALL 
USING (true);

-- RLS policies for inventory_adjustment_items
CREATE POLICY "Public access to inventory_adjustment_items" 
ON public.inventory_adjustment_items 
FOR ALL 
USING (true);

-- RLS policies for suppliers
CREATE POLICY "Public access to suppliers" 
ON public.suppliers 
FOR ALL 
USING (true);

-- RLS policies for super_admins (more restrictive)
CREATE POLICY "Super admins can view all super admin records" 
ON public.super_admins 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.super_admins sa 
    WHERE sa.user_id = auth.uid() AND sa.is_active = true
  )
);

CREATE POLICY "Super admins can manage super admin records" 
ON public.super_admins 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.super_admins sa 
    WHERE sa.user_id = auth.uid() AND sa.is_active = true
  )
);

-- Create functions for super admin management
CREATE OR REPLACE FUNCTION public.grant_super_admin(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Check if the current user is a super admin
  IF NOT EXISTS (
    SELECT 1 FROM public.super_admins 
    WHERE user_id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Only super admins can grant super admin privileges';
  END IF;
  
  -- Insert or update super admin record
  INSERT INTO public.super_admins (user_id, granted_by, is_active)
  VALUES (target_user_id, auth.uid(), true)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    is_active = true,
    granted_by = auth.uid(),
    granted_at = now(),
    updated_at = now();
    
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_super_admin(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Check if the current user is a super admin
  IF NOT EXISTS (
    SELECT 1 FROM public.super_admins 
    WHERE user_id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Only super admins can revoke super admin privileges';
  END IF;
  
  -- Don't allow revoking your own access
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot revoke your own super admin privileges';
  END IF;
  
  -- Update super admin record to inactive
  UPDATE public.super_admins 
  SET is_active = false, updated_at = now()
  WHERE user_id = target_user_id;
    
  RETURN true;
END;
$$;

-- Create triggers for updated_at columns
CREATE TRIGGER update_inventory_adjustments_updated_at
BEFORE UPDATE ON public.inventory_adjustments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_inventory_adjustment_items_updated_at
BEFORE UPDATE ON public.inventory_adjustment_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_suppliers_updated_at
BEFORE UPDATE ON public.suppliers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_super_admins_updated_at
BEFORE UPDATE ON public.super_admins
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();