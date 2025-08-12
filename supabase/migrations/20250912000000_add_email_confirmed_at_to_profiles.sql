-- Add email_confirmed_at to profiles and ensure user_id exists

-- Add email_confirmed_at column
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'email_confirmed_at'
    ) THEN
      ALTER TABLE public.profiles ADD COLUMN email_confirmed_at timestamptz NULL;
    END IF;

    -- Ensure user_id column compatible with application code
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'user_id'
    ) THEN
      ALTER TABLE public.profiles ADD COLUMN user_id uuid;
      -- Backfill user_id from id when shapes match
      UPDATE public.profiles SET user_id = id WHERE user_id IS NULL;

      -- Add unique and FK if not present
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE table_schema = 'public' AND table_name = 'profiles' AND constraint_name = 'profiles_user_id_key'
        ) THEN
          ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints tc
          WHERE tc.table_schema = 'public' AND tc.table_name = 'profiles' AND tc.constraint_name = 'profiles_user_id_fkey'
        ) THEN
          ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
        END IF;
      END $$;
    END IF;
  END IF;
END $$;