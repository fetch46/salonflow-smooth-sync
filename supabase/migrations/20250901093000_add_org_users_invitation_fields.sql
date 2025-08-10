-- Add invitation-related fields to organization_users if missing
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'organization_users'
  ) THEN
    -- invited_by (nullable, FK to auth.users.id)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'organization_users' AND column_name = 'invited_by'
    ) THEN
      EXECUTE 'ALTER TABLE public.organization_users ADD COLUMN invited_by uuid NULL';
    END IF;

    -- invited_at (nullable timestamp)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'organization_users' AND column_name = 'invited_at'
    ) THEN
      EXECUTE 'ALTER TABLE public.organization_users ADD COLUMN invited_at timestamptz NULL';
    END IF;

    -- joined_at (nullable timestamp)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'organization_users' AND column_name = 'joined_at'
    ) THEN
      EXECUTE 'ALTER TABLE public.organization_users ADD COLUMN joined_at timestamptz NULL';
    END IF;

    -- metadata (nullable jsonb with default {})
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'organization_users' AND column_name = 'metadata'
    ) THEN
      EXECUTE 'ALTER TABLE public.organization_users ADD COLUMN metadata jsonb NULL DEFAULT ''{}''::jsonb';
    END IF;
  END IF;
END $$;

-- Add foreign key for invited_by if column and users table exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'organization_users' AND column_name = 'invited_by'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'auth' AND table_name = 'users'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organization_users_invited_by_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE public.organization_users ADD CONSTRAINT organization_users_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL';
  END IF;
END $$;