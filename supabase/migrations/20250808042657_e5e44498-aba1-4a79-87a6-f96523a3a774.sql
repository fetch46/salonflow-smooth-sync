-- Create first super admin for user andre4094@gmail.com
-- This is needed to bootstrap the super admin system

INSERT INTO public.super_admins (
  user_id,
  granted_by,
  is_active,
  granted_at
) VALUES (
  '7c858ee2-b224-48fb-8089-5c702284d2b2',
  NULL, -- System granted
  true,
  now()
) ON CONFLICT (user_id) DO UPDATE SET
  is_active = true,
  granted_at = now(),
  updated_at = now();