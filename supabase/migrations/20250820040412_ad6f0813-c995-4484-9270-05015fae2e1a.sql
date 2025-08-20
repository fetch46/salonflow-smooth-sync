-- =====================================================
-- COMPREHENSIVE ORGANIZATION-SCOPED REFACTOR
-- =====================================================

-- 1. Create organization_modules table for subscription-based module toggling
CREATE TABLE IF NOT EXISTS public.organization_modules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  module_name TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  enabled_at TIMESTAMP WITH TIME ZONE,
  enabled_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, module_name)
);

-- 2. Create transaction_number_series table for auto-numbering
CREATE TABLE IF NOT EXISTS public.transaction_number_series (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL,
  prefix TEXT,
  current_number INTEGER NOT NULL DEFAULT 0,
  padding_length INTEGER NOT NULL DEFAULT 3,
  suffix TEXT,
  format_template TEXT NOT NULL DEFAULT '{prefix}{number}{suffix}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, transaction_type)
);

-- 3. Create staff_roles table for organization-specific roles
CREATE TABLE IF NOT EXISTS public.staff_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  role_description TEXT,
  permissions JSONB NOT NULL DEFAULT '{}',
  is_system_role BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, role_name)
);

-- 4. Create template_settings table for invoice and email templates
CREATE TABLE IF NOT EXISTS public.template_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  template_type TEXT NOT NULL, -- 'invoice_80mm', 'invoice_a4', 'email_booking_confirmation', etc.
  template_name TEXT NOT NULL,
  template_content JSONB NOT NULL DEFAULT '{}',
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, template_type, template_name)
);

-- 5. Create warehouses table for inventory transfers
CREATE TABLE IF NOT EXISTS public.warehouses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  warehouse_code TEXT NOT NULL,
  warehouse_name TEXT NOT NULL,
  description TEXT,
  address TEXT,
  manager_id UUID,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, warehouse_code)
);

-- 6. Update inventory_levels to support warehouse_id properly (if not exists)
ALTER TABLE public.inventory_levels 
ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES public.warehouses(id);

-- 7. Create unearned_revenue_transactions for booking fees
CREATE TABLE IF NOT EXISTS public.unearned_revenue_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id),
  job_card_id UUID REFERENCES public.job_cards(id),
  amount NUMERIC NOT NULL DEFAULT 0,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'unearned', -- 'unearned', 'earned', 'refunded'
  earned_date DATE,
  reference_type TEXT,
  reference_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 8. Add organization_id to key tables if missing (for data isolation)
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

-- 9. Update job_cards to include job_card_number if not exists  
ALTER TABLE public.job_cards ADD COLUMN IF NOT EXISTS job_card_number TEXT;

-- 10. Enable RLS on all new tables
ALTER TABLE public.organization_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_number_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unearned_revenue_transactions ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Organization modules policies
CREATE POLICY "org_members_can_view_modules" ON public.organization_modules
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_users 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "org_admins_can_manage_modules" ON public.organization_modules
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_users 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
    )
  );

-- Transaction number series policies
CREATE POLICY "org_members_can_view_number_series" ON public.transaction_number_series
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_users 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "org_admins_can_manage_number_series" ON public.transaction_number_series
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_users 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
    )
  );

-- Staff roles policies
CREATE POLICY "org_members_can_view_staff_roles" ON public.staff_roles
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_users 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "org_admins_can_manage_staff_roles" ON public.staff_roles
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_users 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
    )
  );

-- Template settings policies
CREATE POLICY "org_members_can_view_templates" ON public.template_settings
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_users 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "org_admins_can_manage_templates" ON public.template_settings
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_users 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
    )
  );

-- Warehouses policies
CREATE POLICY "org_members_can_view_warehouses" ON public.warehouses
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_users 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "org_admins_can_manage_warehouses" ON public.warehouses
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_users 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
    )
  );

-- Unearned revenue policies
CREATE POLICY "org_members_can_view_unearned_revenue" ON public.unearned_revenue_transactions
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_users 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "org_users_can_manage_unearned_revenue" ON public.unearned_revenue_transactions
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_users 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to get next transaction number
CREATE OR REPLACE FUNCTION public.get_next_transaction_number(
  p_organization_id UUID,
  p_transaction_type TEXT
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_series RECORD;
  v_next_number INTEGER;
  v_formatted_number TEXT;
BEGIN
  -- Get or create the series
  SELECT * INTO v_series
  FROM public.transaction_number_series
  WHERE organization_id = p_organization_id 
    AND transaction_type = p_transaction_type
    AND is_active = true;
  
  IF NOT FOUND THEN
    -- Create default series
    INSERT INTO public.transaction_number_series (
      organization_id, 
      transaction_type, 
      prefix, 
      current_number, 
      padding_length,
      format_template
    ) VALUES (
      p_organization_id, 
      p_transaction_type, 
      UPPER(LEFT(p_transaction_type, 2)) || '-',
      0,
      4,
      '{prefix}{number}'
    ) RETURNING * INTO v_series;
  END IF;
  
  -- Increment and get next number
  UPDATE public.transaction_number_series
  SET current_number = current_number + 1,
      updated_at = now()
  WHERE id = v_series.id
  RETURNING current_number INTO v_next_number;
  
  -- Format the number
  v_formatted_number := COALESCE(v_series.prefix, '') || 
                       LPAD(v_next_number::TEXT, v_series.padding_length, '0') ||
                       COALESCE(v_series.suffix, '');
  
  RETURN v_formatted_number;
END;
$$;

-- Function to automatically change appointment status to no-show
CREATE OR REPLACE FUNCTION public.update_appointment_no_show()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Update appointments to no-show if time has passed and status is still scheduled
  UPDATE public.appointments
  SET status = 'no_show',
      updated_at = now()
  WHERE appointment_date < CURRENT_DATE
    OR (appointment_date = CURRENT_DATE AND appointment_time < CURRENT_TIME)
    AND status = 'scheduled';
  
  RETURN NULL;
END;
$$;

-- Function to handle organization data isolation
CREATE OR REPLACE FUNCTION public.ensure_organization_context()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  -- Get user's primary organization
  SELECT organization_id INTO v_org_id
  FROM public.organization_users
  WHERE user_id = auth.uid() 
    AND is_active = true
  LIMIT 1;
  
  -- Set organization_id if not provided
  IF NEW.organization_id IS NULL AND v_org_id IS NOT NULL THEN
    NEW.organization_id := v_org_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger for appointment no-show updates (runs periodically)
CREATE OR REPLACE FUNCTION public.schedule_appointment_no_show_update()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.update_appointment_no_show();
END;
$$;

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_organization_modules_org_id ON public.organization_modules(organization_id);
CREATE INDEX IF NOT EXISTS idx_transaction_number_series_org_type ON public.transaction_number_series(organization_id, transaction_type);
CREATE INDEX IF NOT EXISTS idx_staff_roles_org_id ON public.staff_roles(organization_id);
CREATE INDEX IF NOT EXISTS idx_template_settings_org_type ON public.template_settings(organization_id, template_type);
CREATE INDEX IF NOT EXISTS idx_warehouses_org_id ON public.warehouses(organization_id);
CREATE INDEX IF NOT EXISTS idx_unearned_revenue_org_id ON public.unearned_revenue_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status_date ON public.appointments(status, appointment_date);

-- =====================================================
-- INSERT DEFAULT SYSTEM ROLES
-- =====================================================

-- This will be populated by the application for each organization
-- Default roles: administrator (system-defined), accountant, manager, staff

-- =====================================================
-- INSERT DEFAULT MODULES
-- =====================================================

-- This will be populated based on subscription plans
-- Modules: appointments, sales, pos, job_cards, purchases, services, inventory, accountant