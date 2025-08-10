-- Add notes column to staff if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'staff' AND column_name = 'notes'
  ) THEN
    ALTER TABLE staff ADD COLUMN notes TEXT;
    COMMENT ON COLUMN staff.notes IS 'Internal notes about the staff member';
  END IF;
END $$;