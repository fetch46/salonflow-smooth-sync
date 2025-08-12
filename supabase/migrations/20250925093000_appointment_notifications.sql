-- Add notification tracking columns to appointments
ALTER TABLE IF EXISTS public.appointments
  ADD COLUMN IF NOT EXISTS confirmation_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmation_whatsapp_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_whatsapp_sent_at timestamptz;