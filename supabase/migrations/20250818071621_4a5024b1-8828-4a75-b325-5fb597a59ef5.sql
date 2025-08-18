
-- Create system_settings table for global platform configuration
CREATE TABLE IF NOT EXISTS public.system_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  maintenance_mode boolean NOT NULL DEFAULT false,
  support_email text NOT NULL DEFAULT 'support@example.com',
  default_plan_slug text NOT NULL DEFAULT 'starter',
  features jsonb NOT NULL DEFAULT '{"allow_signups": true, "allow_public_booking": true}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  regional_formats_enabled boolean NOT NULL DEFAULT false,
  app_name text DEFAULT 'AURA OS',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add Row Level Security
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Only super admins can manage system settings
CREATE POLICY "Super admins can SELECT system_settings" 
  ON public.system_settings 
  FOR SELECT 
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can INSERT system_settings" 
  ON public.system_settings 
  FOR INSERT 
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can UPDATE system_settings" 
  ON public.system_settings 
  FOR UPDATE 
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can DELETE system_settings" 
  ON public.system_settings 
  FOR DELETE 
  USING (is_super_admin(auth.uid()));

-- Insert default system settings if none exist
INSERT INTO public.system_settings (
  maintenance_mode,
  support_email, 
  default_plan_slug,
  features,
  metadata,
  regional_formats_enabled,
  app_name
) 
SELECT 
  false,
  'support@example.com',
  'starter',
  '{"allow_signups": true, "allow_public_booking": true}'::jsonb,
  '{}'::jsonb,
  false,
  'AURA OS'
WHERE NOT EXISTS (SELECT 1 FROM public.system_settings);

-- Add trigger to update updated_at column
CREATE OR REPLACE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
