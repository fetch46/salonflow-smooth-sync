-- Posting triggers for Expenses and Purchases

-- Expenses: On insert/update to status 'paid', post to ledger
CREATE OR REPLACE FUNCTION public.post_expense_to_ledger()
RETURNS TRIGGER AS $$
DECLARE
  expense_account UUID;
  cash_or_bank UUID;
  amt NUMERIC;
BEGIN
  -- Map simple default expense account (Supplies Expense 5400)
  SELECT id INTO expense_account FROM public.accounts 
  WHERE account_code = '5400' AND organization_id = NEW.organization_id
  LIMIT 1;

  IF NEW.payment_method = 'Cash' OR NEW.payment_method = 'cash' THEN
    SELECT id INTO cash_or_bank FROM public.accounts 
    WHERE account_code = '1001' AND organization_id = NEW.organization_id
    LIMIT 1; -- Cash
  ELSE
    SELECT id INTO cash_or_bank FROM public.accounts 
    WHERE account_code = '1002' AND organization_id = NEW.organization_id
    LIMIT 1; -- Bank
  END IF;

  amt := COALESCE(NEW.amount, 0);

  IF NEW.status = 'paid' AND amt > 0 AND expense_account IS NOT NULL AND cash_or_bank IS NOT NULL THEN
    -- Debit Expense
    INSERT INTO public.account_transactions (account_id, transaction_date, description, debit_amount, credit_amount, reference_type, reference_id)
    VALUES (expense_account, NEW.expense_date, 'Expense ' || NEW.expense_number, amt, 0, 'expense', NEW.id);

    -- Credit Cash/Bank
    INSERT INTO public.account_transactions (account_id, transaction_date, description, debit_amount, credit_amount, reference_type, reference_id)
    VALUES (cash_or_bank, NEW.expense_date, 'Expense ' || NEW.expense_number, 0, amt, 'expense', NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_post_expense_to_ledger_ins ON public.expenses;
CREATE TRIGGER trg_post_expense_to_ledger_ins
AFTER INSERT ON public.expenses
FOR EACH ROW
EXECUTE FUNCTION public.post_expense_to_ledger();

DROP TRIGGER IF EXISTS trg_post_expense_to_ledger_upd ON public.expenses;
CREATE TRIGGER trg_post_expense_to_ledger_upd
AFTER UPDATE OF status, amount, payment_method ON public.expenses
FOR EACH ROW
WHEN (NEW.status = 'paid')
EXECUTE FUNCTION public.post_expense_to_ledger();

-- Purchases: On status 'received', post Inventory and AP
CREATE OR REPLACE FUNCTION public.post_purchase_to_ledger()
RETURNS TRIGGER AS $$
DECLARE
  inventory_account UUID;
  ap_account UUID;
  amt NUMERIC;
BEGIN
  SELECT id INTO inventory_account FROM public.accounts 
  WHERE account_code = '1200' AND organization_id = NEW.organization_id
  LIMIT 1; -- Inventory
  SELECT id INTO ap_account FROM public.accounts 
  WHERE account_code = '2001' AND organization_id = NEW.organization_id
  LIMIT 1; -- Accounts Payable
  amt := COALESCE(NEW.total_amount, 0);
  IF NEW.status = 'received' AND amt > 0 AND inventory_account IS NOT NULL AND ap_account IS NOT NULL THEN
    -- Debit Inventory
    INSERT INTO public.account_transactions (account_id, transaction_date, description, debit_amount, credit_amount, reference_type, reference_id)
    VALUES (inventory_account, NEW.purchase_date, 'Purchase ' || NEW.purchase_number, amt, 0, 'purchase', NEW.id);
    -- Credit Accounts Payable
    INSERT INTO public.account_transactions (account_id, transaction_date, description, debit_amount, credit_amount, reference_type, reference_id)
    VALUES (ap_account, NEW.purchase_date, 'Purchase ' || NEW.purchase_number, 0, amt, 'purchase', NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_post_purchase_to_ledger_ins ON public.purchases;
CREATE TRIGGER trg_post_purchase_to_ledger_ins
AFTER INSERT ON public.purchases
FOR EACH ROW
EXECUTE FUNCTION public.post_purchase_to_ledger();

DROP TRIGGER IF EXISTS trg_post_purchase_to_ledger_upd ON public.purchases;
CREATE TRIGGER trg_post_purchase_to_ledger_upd
AFTER UPDATE OF status, total_amount ON public.purchases
FOR EACH ROW
WHEN (NEW.status = 'received')
EXECUTE FUNCTION public.post_purchase_to_ledger();