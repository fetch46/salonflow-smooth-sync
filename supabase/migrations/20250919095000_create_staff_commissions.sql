-- Create staff_commissions table to track commissions per job card service line
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.staff_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NULL REFERENCES public.invoices(id) ON DELETE SET NULL,
  job_card_id uuid NULL REFERENCES public.job_cards(id) ON DELETE CASCADE,
  job_card_service_id uuid NULL UNIQUE REFERENCES public.job_card_services(id) ON DELETE CASCADE,
  staff_id uuid NULL REFERENCES public.staff(id) ON DELETE SET NULL,
  service_id uuid NULL REFERENCES public.services(id) ON DELETE SET NULL,
  commission_rate numeric NOT NULL DEFAULT 0, -- percent
  gross_amount numeric NOT NULL DEFAULT 0,
  commission_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_staff_commissions_invoice_id ON public.staff_commissions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_staff_commissions_staff_id ON public.staff_commissions(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_commissions_service_id ON public.staff_commissions(service_id);
CREATE INDEX IF NOT EXISTS idx_staff_commissions_job_card_id ON public.staff_commissions(job_card_id);

-- Note: RLS can be added later to match your org model