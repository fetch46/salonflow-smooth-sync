-- Fix search path security warnings for existing functions
ALTER FUNCTION public.user_has_organization(uuid) SET search_path = '';
ALTER FUNCTION public.get_user_organization_count(uuid) SET search_path = '';
ALTER FUNCTION public.generate_job_number() SET search_path = '';
ALTER FUNCTION public.create_organization_with_user(text, text, jsonb, uuid) SET search_path = '';
ALTER FUNCTION public.setup_new_organization(uuid) SET search_path = '';