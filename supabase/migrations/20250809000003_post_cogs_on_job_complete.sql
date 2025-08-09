-- Post COGS on job card completion
CREATE OR REPLACE FUNCTION public.post_jobcard_cogs()
RETURNS TRIGGER AS $$
DECLARE
  cogs_account UUID;
  inventory_account UUID;
  total_cost NUMERIC;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    SELECT id INTO cogs_account FROM public.accounts WHERE account_code = '5001' LIMIT 1;
    SELECT id INTO inventory_account FROM public.accounts WHERE account_code = '1200' LIMIT 1;

    SELECT COALESCE(SUM(total_cost),0) INTO total_cost FROM public.job_card_products WHERE job_card_id = NEW.id;

    IF total_cost > 0 AND cogs_account IS NOT NULL AND inventory_account IS NOT NULL THEN
      -- Debit COGS
      INSERT INTO public.account_transactions (account_id, transaction_date, description, debit_amount, credit_amount, reference_type, reference_id)
      VALUES (cogs_account, CURRENT_DATE, 'COGS for Job ' || NEW.job_number, total_cost, 0, 'job_card', NEW.id);
      -- Credit Inventory
      INSERT INTO public.account_transactions (account_id, transaction_date, description, debit_amount, credit_amount, reference_type, reference_id)
      VALUES (inventory_account, CURRENT_DATE, 'COGS for Job ' || NEW.job_number, 0, total_cost, 'job_card', NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_post_jobcard_cogs ON public.job_cards;
CREATE TRIGGER trg_post_jobcard_cogs
AFTER UPDATE OF status ON public.job_cards
FOR EACH ROW
EXECUTE FUNCTION public.post_jobcard_cogs();