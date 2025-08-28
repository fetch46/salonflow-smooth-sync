-- Fix job_card_services table to include commission_amount column if missing
ALTER TABLE job_card_services ADD COLUMN IF NOT EXISTS commission_amount NUMERIC DEFAULT 0;