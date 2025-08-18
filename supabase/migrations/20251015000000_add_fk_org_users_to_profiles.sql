-- Add FK so PostgREST can embed profiles from organization_users
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organization_users'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    -- Ensure the referenced unique constraint on profiles.user_id exists
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND constraint_type = 'UNIQUE'
        AND constraint_name = 'profiles_user_id_key'
    ) THEN
      ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
    END IF;

    -- Add FK from organization_users.user_id -> profiles.user_id if missing
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints tc
      WHERE tc.table_schema = 'public'
        AND tc.table_name = 'organization_users'
        AND tc.constraint_name = 'organization_users_user_id_profiles_fkey'
    ) THEN
      ALTER TABLE public.organization_users
        ADD CONSTRAINT organization_users_user_id_profiles_fkey
        FOREIGN KEY (user_id)
        REFERENCES public.profiles(user_id)
        ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

