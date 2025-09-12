-- Add the missing duration_minutes column to appointment_services table
ALTER TABLE public.appointment_services 
ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 60;