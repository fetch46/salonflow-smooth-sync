-- Add email_confirmed_at column to profiles to persist email confirmation status
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS email_confirmed_at TIMESTAMPTZ;

-- Optional: backfill from auth if desired (no-op without access to auth schema here)
-- UPDATE public.profiles p
-- SET email_confirmed_at = u.email_confirmed_at
-- FROM auth.users u
-- WHERE u.id = p.user_id AND p.email_confirmed_at IS NULL AND u.email_confirmed_at IS NOT NULL;