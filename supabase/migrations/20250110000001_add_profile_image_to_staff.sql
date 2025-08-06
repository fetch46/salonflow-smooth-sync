-- Add profile_image column to staff table
ALTER TABLE staff ADD COLUMN profile_image TEXT;

-- Add comment for the new column
COMMENT ON COLUMN staff.profile_image IS 'URL or path to the staff member profile image';

-- Update the updated_at column when profile_image changes
CREATE OR REPLACE FUNCTION update_staff_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_staff_updated_at_trigger'
    ) THEN
        CREATE TRIGGER update_staff_updated_at_trigger
            BEFORE UPDATE ON staff
            FOR EACH ROW
            EXECUTE FUNCTION update_staff_updated_at();
    END IF;
END $$;