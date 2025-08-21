-- Fix security warnings and add missing search_path to functions

-- Update existing functions to have SET search_path
ALTER FUNCTION public.get_next_transaction_number(UUID, TEXT) SET search_path = public;
ALTER FUNCTION public.update_appointment_no_show() SET search_path = public;
ALTER FUNCTION public.ensure_organization_context() SET search_path = public;
ALTER FUNCTION public.schedule_appointment_no_show_update() SET search_path = public;

-- Add triggers and updated_at handlers for new tables
CREATE TRIGGER update_organization_modules_updated_at
    BEFORE UPDATE ON public.organization_modules
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_transaction_number_series_updated_at
    BEFORE UPDATE ON public.transaction_number_series
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_staff_roles_updated_at
    BEFORE UPDATE ON public.staff_roles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_template_settings_updated_at
    BEFORE UPDATE ON public.template_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_warehouses_updated_at
    BEFORE UPDATE ON public.warehouses
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_unearned_revenue_transactions_updated_at
    BEFORE UPDATE ON public.unearned_revenue_transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();