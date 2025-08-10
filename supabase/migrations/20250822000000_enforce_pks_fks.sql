-- Enforce Primary Keys, Foreign Keys, Uniques, and Indexes for core tables
-- This migration is idempotent and safe to re-run

-- Helper: add primary key on id if missing
DO $$
BEGIN
  PERFORM 1 FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  LEFT JOIN pg_constraint c ON c.conrelid = t.oid AND c.contype = 'p'
  WHERE n.nspname = 'public' AND t.relname = 'appointments' AND c.oid IS NULL;
  IF FOUND THEN
    EXECUTE 'ALTER TABLE public.appointments ADD CONSTRAINT appointments_pkey PRIMARY KEY (id)';
  END IF;
END $$;

DO $$
BEGIN
  PERFORM 1 FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  LEFT JOIN pg_constraint c ON c.conrelid = t.oid AND c.contype = 'p'
  WHERE n.nspname = 'public' AND t.relname = 'clients' AND c.oid IS NULL;
  IF FOUND THEN
    EXECUTE 'ALTER TABLE public.clients ADD CONSTRAINT clients_pkey PRIMARY KEY (id)';
  END IF;
END $$;

DO $$
BEGIN
  PERFORM 1 FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  LEFT JOIN pg_constraint c ON c.conrelid = t.oid AND c.contype = 'p'
  WHERE n.nspname = 'public' AND t.relname = 'staff' AND c.oid IS NULL;
  IF FOUND THEN
    EXECUTE 'ALTER TABLE public.staff ADD CONSTRAINT staff_pkey PRIMARY KEY (id)';
  END IF;
END $$;

DO $$
BEGIN
  PERFORM 1 FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  LEFT JOIN pg_constraint c ON c.conrelid = t.oid AND c.contype = 'p'
  WHERE n.nspname = 'public' AND t.relname = 'services' AND c.oid IS NULL;
  IF FOUND THEN
    EXECUTE 'ALTER TABLE public.services ADD CONSTRAINT services_pkey PRIMARY KEY (id)';
  END IF;
END $$;

DO $$
BEGIN
  PERFORM 1 FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  LEFT JOIN pg_constraint c ON c.conrelid = t.oid AND c.contype = 'p'
  WHERE n.nspname = 'public' AND t.relname = 'inventory_items' AND c.oid IS NULL;
  IF FOUND THEN
    EXECUTE 'ALTER TABLE public.inventory_items ADD CONSTRAINT inventory_items_pkey PRIMARY KEY (id)';
  END IF;
END $$;

DO $$
BEGIN
  PERFORM 1 FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  LEFT JOIN pg_constraint c ON c.conrelid = t.oid AND c.contype = 'p'
  WHERE n.nspname = 'public' AND t.relname = 'inventory_levels' AND c.oid IS NULL;
  IF FOUND THEN
    EXECUTE 'ALTER TABLE public.inventory_levels ADD CONSTRAINT inventory_levels_pkey PRIMARY KEY (id)';
  END IF;
END $$;

DO $$
BEGIN
  PERFORM 1 FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  LEFT JOIN pg_constraint c ON c.conrelid = t.oid AND c.contype = 'p'
  WHERE n.nspname = 'public' AND t.relname = 'inventory_adjustments' AND c.oid IS NULL;
  IF FOUND THEN
    EXECUTE 'ALTER TABLE public.inventory_adjustments ADD CONSTRAINT inventory_adjustments_pkey PRIMARY KEY (id)';
  END IF;
END $$;

DO $$
BEGIN
  PERFORM 1 FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  LEFT JOIN pg_constraint c ON c.conrelid = t.oid AND c.contype = 'p'
  WHERE n.nspname = 'public' AND t.relname = 'inventory_adjustment_items' AND c.oid IS NULL;
  IF FOUND THEN
    EXECUTE 'ALTER TABLE public.inventory_adjustment_items ADD CONSTRAINT inventory_adjustment_items_pkey PRIMARY KEY (id)';
  END IF;
END $$;

DO $$
BEGIN
  PERFORM 1 FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  LEFT JOIN pg_constraint c ON c.conrelid = t.oid AND c.contype = 'p'
  WHERE n.nspname = 'public' AND t.relname = 'purchases' AND c.oid IS NULL;
  IF FOUND THEN
    EXECUTE 'ALTER TABLE public.purchases ADD CONSTRAINT purchases_pkey PRIMARY KEY (id)';
  END IF;
END $$;

DO $$
BEGIN
  PERFORM 1 FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  LEFT JOIN pg_constraint c ON c.conrelid = t.oid AND c.contype = 'p'
  WHERE n.nspname = 'public' AND t.relname = 'purchase_items' AND c.oid IS NULL;
  IF FOUND THEN
    EXECUTE 'ALTER TABLE public.purchase_items ADD CONSTRAINT purchase_items_pkey PRIMARY KEY (id)';
  END IF;
END $$;

DO $$
BEGIN
  PERFORM 1 FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  LEFT JOIN pg_constraint c ON c.conrelid = t.oid AND c.contype = 'p'
  WHERE n.nspname = 'public' AND t.relname = 'expenses' AND c.oid IS NULL;
  IF FOUND THEN
    EXECUTE 'ALTER TABLE public.expenses ADD CONSTRAINT expenses_pkey PRIMARY KEY (id)';
  END IF;
END $$;

DO $$
BEGIN
  PERFORM 1 FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  LEFT JOIN pg_constraint c ON c.conrelid = t.oid AND c.contype = 'p'
  WHERE n.nspname = 'public' AND t.relname = 'business_locations' AND c.oid IS NULL;
  IF FOUND THEN
    EXECUTE 'ALTER TABLE public.business_locations ADD CONSTRAINT business_locations_pkey PRIMARY KEY (id)';
  END IF;
END $$;

DO $$
BEGIN
  PERFORM 1 FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  LEFT JOIN pg_constraint c ON c.conrelid = t.oid AND c.contype = 'p'
  WHERE n.nspname = 'public' AND t.relname = 'organizations' AND c.oid IS NULL;
  IF FOUND THEN
    EXECUTE 'ALTER TABLE public.organizations ADD CONSTRAINT organizations_pkey PRIMARY KEY (id)';
  END IF;
END $$;

DO $$
BEGIN
  PERFORM 1 FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  LEFT JOIN pg_constraint c ON c.conrelid = t.oid AND c.contype = 'p'
  WHERE n.nspname = 'public' AND t.relname = 'organization_users' AND c.oid IS NULL;
  IF FOUND THEN
    EXECUTE 'ALTER TABLE public.organization_users ADD CONSTRAINT organization_users_pkey PRIMARY KEY (id)';
  END IF;
END $$;

DO $$
BEGIN
  PERFORM 1 FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  LEFT JOIN pg_constraint c ON c.conrelid = t.oid AND c.contype = 'p'
  WHERE n.nspname = 'public' AND t.relname = 'organization_subscriptions' AND c.oid IS NULL;
  IF FOUND THEN
    EXECUTE 'ALTER TABLE public.organization_subscriptions ADD CONSTRAINT organization_subscriptions_pkey PRIMARY KEY (id)';
  END IF;
END $$;

DO $$
BEGIN
  PERFORM 1 FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  LEFT JOIN pg_constraint c ON c.conrelid = t.oid AND c.contype = 'p'
  WHERE n.nspname = 'public' AND t.relname = 'subscription_plans' AND c.oid IS NULL;
  IF FOUND THEN
    EXECUTE 'ALTER TABLE public.subscription_plans ADD CONSTRAINT subscription_plans_pkey PRIMARY KEY (id)';
  END IF;
END $$;

DO $$
BEGIN
  PERFORM 1 FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  LEFT JOIN pg_constraint c ON c.conrelid = t.oid AND c.contype = 'p'
  WHERE n.nspname = 'public' AND t.relname = 'profiles' AND c.oid IS NULL;
  IF FOUND THEN
    EXECUTE 'ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id)';
  END IF;
END $$;

DO $$
BEGIN
  PERFORM 1 FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  LEFT JOIN pg_constraint c ON c.conrelid = t.oid AND c.contype = 'p'
  WHERE n.nspname = 'public' AND t.relname = 'super_admins' AND c.oid IS NULL;
  IF FOUND THEN
    EXECUTE 'ALTER TABLE public.super_admins ADD CONSTRAINT super_admins_pkey PRIMARY KEY (user_id)';
  END IF;
END $$;

DO $$
BEGIN
  PERFORM 1 FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  LEFT JOIN pg_constraint c ON c.conrelid = t.oid AND c.contype = 'p'
  WHERE n.nspname = 'public' AND t.relname = 'job_cards' AND c.oid IS NULL;
  IF FOUND THEN
    EXECUTE 'ALTER TABLE public.job_cards ADD CONSTRAINT job_cards_pkey PRIMARY KEY (id)';
  END IF;
END $$;

DO $$
BEGIN
  PERFORM 1 FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  LEFT JOIN pg_constraint c ON c.conrelid = t.oid AND c.contype = 'p'
  WHERE n.nspname = 'public' AND t.relname = 'job_card_services' AND c.oid IS NULL;
  IF FOUND THEN
    EXECUTE 'ALTER TABLE public.job_card_services ADD CONSTRAINT job_card_services_pkey PRIMARY KEY (id)';
  END IF;
END $$;

DO $$
BEGIN
  PERFORM 1 FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  LEFT JOIN pg_constraint c ON c.conrelid = t.oid AND c.contype = 'p'
  WHERE n.nspname = 'public' AND t.relname = 'job_card_products' AND c.oid IS NULL;
  IF FOUND THEN
    EXECUTE 'ALTER TABLE public.job_card_products ADD CONSTRAINT job_card_products_pkey PRIMARY KEY (id)';
  END IF;
END $$;

-- invoices
DO $$
BEGIN
  PERFORM 1 FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  LEFT JOIN pg_constraint c ON c.conrelid = t.oid AND c.contype = 'p'
  WHERE n.nspname = 'public' AND t.relname = 'invoices' AND c.oid IS NULL;
  IF FOUND THEN
    EXECUTE 'ALTER TABLE public.invoices ADD CONSTRAINT invoices_pkey PRIMARY KEY (id)';
  END IF;
END $$;

DO $$
BEGIN
  PERFORM 1 FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  LEFT JOIN pg_constraint c ON c.conrelid = t.oid AND c.contype = 'p'
  WHERE n.nspname = 'public' AND t.relname = 'invoice_items' AND c.oid IS NULL;
  IF FOUND THEN
    EXECUTE 'ALTER TABLE public.invoice_items ADD CONSTRAINT invoice_items_pkey PRIMARY KEY (id)';
  END IF;
END $$;

-- receipts
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='receipts') THEN
    PERFORM 1 FROM pg_class t
    JOIN pg_namespace n ON n.oid = t.relnamespace
    LEFT JOIN pg_constraint c ON c.conrelid = t.oid AND c.contype = 'p'
    WHERE n.nspname = 'public' AND t.relname = 'receipts' AND c.oid IS NULL;
    IF FOUND THEN
      EXECUTE 'ALTER TABLE public.receipts ADD CONSTRAINT receipts_pkey PRIMARY KEY (id)';
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='receipt_items') THEN
    PERFORM 1 FROM pg_class t
    JOIN pg_namespace n ON n.oid = t.relnamespace
    LEFT JOIN pg_constraint c ON c.conrelid = t.oid AND c.contype = 'p'
    WHERE n.nspname = 'public' AND t.relname = 'receipt_items' AND c.oid IS NULL;
    IF FOUND THEN
      EXECUTE 'ALTER TABLE public.receipt_items ADD CONSTRAINT receipt_items_pkey PRIMARY KEY (id)';
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='receipt_payments') THEN
    PERFORM 1 FROM pg_class t
    JOIN pg_namespace n ON n.oid = t.relnamespace
    LEFT JOIN pg_constraint c ON c.conrelid = t.oid AND c.contype = 'p'
    WHERE n.nspname = 'public' AND t.relname = 'receipt_payments' AND c.oid IS NULL;
    IF FOUND THEN
      EXECUTE 'ALTER TABLE public.receipt_payments ADD CONSTRAINT receipt_payments_pkey PRIMARY KEY (id)';
    END IF;
  END IF;
END $$;

-- accounts and transactions
DO $$
BEGIN
  PERFORM 1 FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  LEFT JOIN pg_constraint c ON c.conrelid = t.oid AND c.contype = 'p'
  WHERE n.nspname = 'public' AND t.relname = 'accounts' AND c.oid IS NULL;
  IF FOUND THEN
    EXECUTE 'ALTER TABLE public.accounts ADD CONSTRAINT accounts_pkey PRIMARY KEY (id)';
  END IF;
END $$;

DO $$
BEGIN
  PERFORM 1 FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  LEFT JOIN pg_constraint c ON c.conrelid = t.oid AND c.contype = 'p'
  WHERE n.nspname = 'public' AND t.relname = 'account_transactions' AND c.oid IS NULL;
  IF FOUND THEN
    EXECUTE 'ALTER TABLE public.account_transactions ADD CONSTRAINT account_transactions_pkey PRIMARY KEY (id)';
  END IF;
END $$;

-- inventory_item_accounts
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='inventory_item_accounts') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname='public' AND t.relname='inventory_item_accounts' AND c.contype='p'
    ) THEN
      EXECUTE 'ALTER TABLE public.inventory_item_accounts ADD CONSTRAINT inventory_item_accounts_pkey PRIMARY KEY (item_id)';
    END IF;
  END IF;
END $$;

-- Unique constraints
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='organization_users')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='organization_users_org_user_unique') THEN
    EXECUTE 'ALTER TABLE public.organization_users ADD CONSTRAINT organization_users_org_user_unique UNIQUE (organization_id, user_id)';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='subscription_plans')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='subscription_plans_slug_key') THEN
    EXECUTE 'ALTER TABLE public.subscription_plans ADD CONSTRAINT subscription_plans_slug_key UNIQUE (slug)';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='accounts')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='accounts_org_code_unique') THEN
    EXECUTE 'ALTER TABLE public.accounts ADD CONSTRAINT accounts_org_code_unique UNIQUE (organization_id, account_code)';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='super_admins')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='super_admins_user_id_key') THEN
    EXECUTE 'ALTER TABLE public.super_admins ADD CONSTRAINT super_admins_user_id_key UNIQUE (user_id)';
  END IF;
END $$;

-- Foreign keys and indexes
-- appointments
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='appointments' AND column_name='client_id'
  ) AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='appointments_client_id_fkey') THEN
    EXECUTE 'ALTER TABLE public.appointments ADD CONSTRAINT appointments_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='appointments' AND column_name='service_id'
  ) AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='appointments_service_id_fkey') THEN
    EXECUTE 'ALTER TABLE public.appointments ADD CONSTRAINT appointments_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='appointments' AND column_name='staff_id'
  ) AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='appointments_staff_id_fkey') THEN
    EXECUTE 'ALTER TABLE public.appointments ADD CONSTRAINT appointments_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE SET NULL';
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_appointments_client_id ON public.appointments(client_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_appointments_service_id ON public.appointments(service_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_appointments_staff_id ON public.appointments(staff_id)';
END $$;

-- clients
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clients' AND column_name='preferred_technician_id'
  ) AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='clients_preferred_technician_id_fkey') THEN
    EXECUTE 'ALTER TABLE public.clients ADD CONSTRAINT clients_preferred_technician_id_fkey FOREIGN KEY (preferred_technician_id) REFERENCES public.staff(id) ON DELETE SET NULL';
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_clients_preferred_technician_id ON public.clients(preferred_technician_id)';
END $$;

-- inventory_levels
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory_levels' AND column_name='item_id'
  ) AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='inventory_levels_item_id_fkey') THEN
    EXECUTE 'ALTER TABLE public.inventory_levels ADD CONSTRAINT inventory_levels_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventory_items(id) ON DELETE CASCADE';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory_levels' AND column_name='location_id'
  ) AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='inventory_levels_location_id_fkey') THEN
    EXECUTE 'ALTER TABLE public.inventory_levels ADD CONSTRAINT inventory_levels_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.business_locations(id) ON DELETE CASCADE';
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_inventory_levels_item_id ON public.inventory_levels(item_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_inventory_levels_location_id ON public.inventory_levels(location_id)';
END $$;

-- inventory_adjustment_items
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='inventory_adjustment_items_adjustment_id_fkey') THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory_adjustment_items' AND column_name='adjustment_id'
    ) THEN
      EXECUTE 'ALTER TABLE public.inventory_adjustment_items ADD CONSTRAINT inventory_adjustment_items_adjustment_id_fkey FOREIGN KEY (adjustment_id) REFERENCES public.inventory_adjustments(id) ON DELETE CASCADE';
    END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='inventory_adjustment_items_item_id_fkey') THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory_adjustment_items' AND column_name='item_id'
    ) THEN
      EXECUTE 'ALTER TABLE public.inventory_adjustment_items ADD CONSTRAINT inventory_adjustment_items_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventory_items(id)';
    END IF;
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_inventory_adjustment_items_adjustment_id ON public.inventory_adjustment_items(adjustment_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_inventory_adjustment_items_item_id ON public.inventory_adjustment_items(item_id)';
END $$;

-- purchases and purchase_items
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='purchases' AND column_name='location_id'
  ) AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='purchases_location_id_fkey') THEN
    EXECUTE 'ALTER TABLE public.purchases ADD CONSTRAINT purchases_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.business_locations(id) ON DELETE SET NULL';
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_purchases_location_id ON public.purchases(location_id)';

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='purchase_items_purchase_id_fkey') THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='purchase_items' AND column_name='purchase_id'
    ) THEN
      EXECUTE 'ALTER TABLE public.purchase_items ADD CONSTRAINT purchase_items_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES public.purchases(id) ON DELETE CASCADE';
    END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='purchase_items_item_id_fkey') THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='purchase_items' AND column_name='item_id'
    ) THEN
      EXECUTE 'ALTER TABLE public.purchase_items ADD CONSTRAINT purchase_items_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventory_items(id)';
    END IF;
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON public.purchase_items(purchase_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_purchase_items_item_id ON public.purchase_items(item_id)';
END $$;

-- expenses
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='expenses' AND column_name='location_id'
  ) AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='expenses_location_id_fkey') THEN
    EXECUTE 'ALTER TABLE public.expenses ADD CONSTRAINT expenses_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.business_locations(id) ON DELETE SET NULL';
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_expenses_location_id ON public.expenses(location_id)';
END $$;

-- business_locations
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='business_locations_organization_id_fkey') THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='business_locations' AND column_name='organization_id'
    ) THEN
      EXECUTE 'ALTER TABLE public.business_locations ADD CONSTRAINT business_locations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE';
    END IF;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='business_locations' AND column_name='manager_id'
  ) AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='business_locations_manager_id_fkey') THEN
    EXECUTE 'ALTER TABLE public.business_locations ADD CONSTRAINT business_locations_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.staff(id) ON DELETE SET NULL';
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_business_locations_organization_id ON public.business_locations(organization_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_business_locations_manager_id ON public.business_locations(manager_id)';
END $$;

-- organizations
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='organizations' AND column_name='currency_id'
  ) AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='organizations_currency_id_fkey') THEN
    EXECUTE 'ALTER TABLE public.organizations ADD CONSTRAINT organizations_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.currencies(id) ON DELETE SET NULL';
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_organizations_currency_id ON public.organizations(currency_id)';
END $$;

-- organization_users
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='organization_users_organization_id_fkey') THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='organization_users' AND column_name='organization_id'
    ) THEN
      EXECUTE 'ALTER TABLE public.organization_users ADD CONSTRAINT organization_users_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE';
    END IF;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='auth' AND table_name='users'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='organization_users' AND column_name='user_id'
  ) AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='organization_users_user_id_fkey') THEN
    EXECUTE 'ALTER TABLE public.organization_users ADD CONSTRAINT organization_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE';
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_organization_users_organization_id ON public.organization_users(organization_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_organization_users_user_id ON public.organization_users(user_id)';
END $$;

-- organization_subscriptions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='organization_subscriptions_organization_id_fkey') THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='organization_subscriptions' AND column_name='organization_id'
    ) THEN
      EXECUTE 'ALTER TABLE public.organization_subscriptions ADD CONSTRAINT organization_subscriptions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE';
    END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='organization_subscriptions_plan_id_fkey') THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='organization_subscriptions' AND column_name='plan_id'
    ) THEN
      EXECUTE 'ALTER TABLE public.organization_subscriptions ADD CONSTRAINT organization_subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(id) ON DELETE SET NULL';
    END IF;
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_organization_subscriptions_organization_id ON public.organization_subscriptions(organization_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_organization_subscriptions_plan_id ON public.organization_subscriptions(plan_id)';
END $$;

-- profiles
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='auth' AND table_name='users'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='user_id'
  ) AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='profiles_user_id_fkey') THEN
    EXECUTE 'ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE';
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id)';
END $$;

-- super_admins
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='auth' AND table_name='users'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='super_admins' AND column_name='user_id'
  ) AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='super_admins_user_id_fkey') THEN
    EXECUTE 'ALTER TABLE public.super_admins ADD CONSTRAINT super_admins_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='super_admins' AND column_name='granted_by'
  ) AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='super_admins_granted_by_fkey') THEN
    EXECUTE 'ALTER TABLE public.super_admins ADD CONSTRAINT super_admins_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES auth.users(id) ON DELETE SET NULL';
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_super_admins_user_id ON public.super_admins(user_id)';
END $$;

-- job_cards and related
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='job_cards' AND column_name='appointment_id'
  ) AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='job_cards_appointment_id_fkey') THEN
    EXECUTE 'ALTER TABLE public.job_cards ADD CONSTRAINT job_cards_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='job_cards' AND column_name='client_id'
  ) AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='job_cards_client_id_fkey') THEN
    EXECUTE 'ALTER TABLE public.job_cards ADD CONSTRAINT job_cards_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='job_cards' AND column_name='staff_id'
  ) AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='job_cards_staff_id_fkey') THEN
    EXECUTE 'ALTER TABLE public.job_cards ADD CONSTRAINT job_cards_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE SET NULL';
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_job_cards_appointment_id ON public.job_cards(appointment_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_job_cards_client_id ON public.job_cards(client_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_job_cards_staff_id ON public.job_cards(staff_id)';
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='job_card_services_job_card_id_fkey') THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='job_card_services' AND column_name='job_card_id'
    ) THEN
      EXECUTE 'ALTER TABLE public.job_card_services ADD CONSTRAINT job_card_services_job_card_id_fkey FOREIGN KEY (job_card_id) REFERENCES public.job_cards(id) ON DELETE CASCADE';
    END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='job_card_services_service_id_fkey') THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='job_card_services' AND column_name='service_id'
    ) THEN
      EXECUTE 'ALTER TABLE public.job_card_services ADD CONSTRAINT job_card_services_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id)';
    END IF;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='job_card_services' AND column_name='staff_id'
  ) AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='job_card_services_staff_id_fkey') THEN
    EXECUTE 'ALTER TABLE public.job_card_services ADD CONSTRAINT job_card_services_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE SET NULL';
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_job_card_services_job_card_id ON public.job_card_services(job_card_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_job_card_services_service_id ON public.job_card_services(service_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_job_card_services_staff_id ON public.job_card_services(staff_id)';
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='job_card_products_job_card_id_fkey') THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='job_card_products' AND column_name='job_card_id'
    ) THEN
      EXECUTE 'ALTER TABLE public.job_card_products ADD CONSTRAINT job_card_products_job_card_id_fkey FOREIGN KEY (job_card_id) REFERENCES public.job_cards(id) ON DELETE CASCADE';
    END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='job_card_products_inventory_item_id_fkey') THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='job_card_products' AND column_name='inventory_item_id'
    ) THEN
      EXECUTE 'ALTER TABLE public.job_card_products ADD CONSTRAINT job_card_products_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id)';
    END IF;
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_job_card_products_job_card_id ON public.job_card_products(job_card_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_job_card_products_inventory_item_id ON public.job_card_products(inventory_item_id)';
END $$;

-- invoices
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='invoice_items_invoice_id_fkey') THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='invoice_items' AND column_name='invoice_id'
    ) THEN
      EXECUTE 'ALTER TABLE public.invoice_items ADD CONSTRAINT invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE';
    END IF;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='invoices' AND column_name='client_id'
  ) AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='invoices_client_id_fkey') THEN
    EXECUTE 'ALTER TABLE public.invoices ADD CONSTRAINT invoices_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL';
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON public.invoices(client_id)';
END $$;

-- receipts
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='receipts' AND column_name='customer_id'
  ) AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='receipts_customer_id_fkey') THEN
    EXECUTE 'ALTER TABLE public.receipts ADD CONSTRAINT receipts_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.clients(id) ON DELETE SET NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='receipts' AND column_name='job_card_id'
  ) AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='receipts_job_card_id_fkey') THEN
    EXECUTE 'ALTER TABLE public.receipts ADD CONSTRAINT receipts_job_card_id_fkey FOREIGN KEY (job_card_id) REFERENCES public.job_cards(id) ON DELETE SET NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='receipts' AND column_name='location_id'
  ) AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='receipts_location_id_fkey') THEN
    EXECUTE 'ALTER TABLE public.receipts ADD CONSTRAINT receipts_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.business_locations(id) ON DELETE SET NULL';
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_receipts_customer_id ON public.receipts(customer_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_receipts_job_card_id ON public.receipts(job_card_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_receipts_location_id ON public.receipts(location_id)';
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='receipt_items' AND column_name='receipt_id'
  ) AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='receipt_items_receipt_id_fkey') THEN
    EXECUTE 'ALTER TABLE public.receipt_items ADD CONSTRAINT receipt_items_receipt_id_fkey FOREIGN KEY (receipt_id) REFERENCES public.receipts(id) ON DELETE CASCADE';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='receipt_items' AND column_name='service_id'
  ) AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='receipt_items_service_id_fkey') THEN
    EXECUTE 'ALTER TABLE public.receipt_items ADD CONSTRAINT receipt_items_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='receipt_items' AND column_name='product_id'
  ) AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='receipt_items_product_id_fkey') THEN
    EXECUTE 'ALTER TABLE public.receipt_items ADD CONSTRAINT receipt_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.inventory_items(id) ON DELETE SET NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='receipt_items' AND column_name='staff_id'
  ) AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='receipt_items_staff_id_fkey') THEN
    EXECUTE 'ALTER TABLE public.receipt_items ADD CONSTRAINT receipt_items_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE SET NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='receipt_items' AND column_name='location_id'
  ) AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='receipt_items_location_id_fkey') THEN
    EXECUTE 'ALTER TABLE public.receipt_items ADD CONSTRAINT receipt_items_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.business_locations(id) ON DELETE SET NULL';
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt_id ON public.receipt_items(receipt_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_receipt_items_service_id ON public.receipt_items(service_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_receipt_items_product_id ON public.receipt_items(product_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_receipt_items_staff_id ON public.receipt_items(staff_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_receipt_items_location_id ON public.receipt_items(location_id)';
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='receipt_payments' AND column_name='receipt_id'
  ) AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='receipt_payments_receipt_id_fkey') THEN
    EXECUTE 'ALTER TABLE public.receipt_payments ADD CONSTRAINT receipt_payments_receipt_id_fkey FOREIGN KEY (receipt_id) REFERENCES public.receipts(id) ON DELETE CASCADE';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='receipt_payments' AND column_name='location_id'
  ) AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='receipt_payments_location_id_fkey') THEN
    EXECUTE 'ALTER TABLE public.receipt_payments ADD CONSTRAINT receipt_payments_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.business_locations(id) ON DELETE SET NULL';
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_receipt_payments_receipt_id ON public.receipt_payments(receipt_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_receipt_payments_location_id ON public.receipt_payments(location_id)';
END $$;

-- accounts and transactions
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='accounts' AND column_name='organization_id'
  ) AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='accounts_organization_id_fkey') THEN
    EXECUTE 'ALTER TABLE public.accounts ADD CONSTRAINT accounts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE';
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_accounts_organization_id ON public.accounts(organization_id)';
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='account_transactions_account_id_fkey') THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='account_transactions' AND column_name='account_id'
    ) THEN
      EXECUTE 'ALTER TABLE public.account_transactions ADD CONSTRAINT account_transactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id)';
    END IF;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='account_transactions' AND column_name='location_id'
  ) AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='account_transactions_location_id_fkey') THEN
    EXECUTE 'ALTER TABLE public.account_transactions ADD CONSTRAINT account_transactions_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.business_locations(id) ON DELETE SET NULL';
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_account_transactions_account_id ON public.account_transactions(account_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_account_transactions_location_id ON public.account_transactions(location_id)';
END $$;

-- inventory_item_accounts
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='inventory_item_accounts_item_id_fkey') THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory_item_accounts' AND column_name='item_id'
    ) THEN
      EXECUTE 'ALTER TABLE public.inventory_item_accounts ADD CONSTRAINT inventory_item_accounts_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventory_items(id) ON DELETE CASCADE';
    END IF;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory_item_accounts' AND column_name='sales_account_id'
  ) AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='inventory_item_accounts_sales_account_id_fkey') THEN
    EXECUTE 'ALTER TABLE public.inventory_item_accounts ADD CONSTRAINT inventory_item_accounts_sales_account_id_fkey FOREIGN KEY (sales_account_id) REFERENCES public.accounts(id) ON DELETE SET NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory_item_accounts' AND column_name='purchase_account_id'
  ) AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='inventory_item_accounts_purchase_account_id_fkey') THEN
    EXECUTE 'ALTER TABLE public.inventory_item_accounts ADD CONSTRAINT inventory_item_accounts_purchase_account_id_fkey FOREIGN KEY (purchase_account_id) REFERENCES public.accounts(id) ON DELETE SET NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory_item_accounts' AND column_name='inventory_account_id'
  ) AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='inventory_item_accounts_inventory_account_id_fkey') THEN
    EXECUTE 'ALTER TABLE public.inventory_item_accounts ADD CONSTRAINT inventory_item_accounts_inventory_account_id_fkey FOREIGN KEY (inventory_account_id) REFERENCES public.accounts(id) ON DELETE SET NULL';
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_inventory_item_accounts_item_id ON public.inventory_item_accounts(item_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_inventory_item_accounts_sales_account_id ON public.inventory_item_accounts(sales_account_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_inventory_item_accounts_purchase_account_id ON public.inventory_item_accounts(purchase_account_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_inventory_item_accounts_inventory_account_id ON public.inventory_item_accounts(inventory_account_id)';
END $$;

-- receipts payments may rely on accounts later; adjust as needed in future migrations

-- sales and sale_items
DO $$ BEGIN
  -- sales PK
  PERFORM 1 FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  LEFT JOIN pg_constraint c ON c.conrelid = t.oid AND c.contype = 'p'
  WHERE n.nspname = 'public' AND t.relname = 'sales' AND c.oid IS NULL;
  IF FOUND THEN
    EXECUTE 'ALTER TABLE public.sales ADD CONSTRAINT sales_pkey PRIMARY KEY (id)';
  END IF;

  -- sale_items PK
  PERFORM 1 FROM pg_class t2
  JOIN pg_namespace n2 ON n2.oid = t2.relnamespace
  LEFT JOIN pg_constraint c2 ON c2.conrelid = t2.oid AND c2.contype = 'p'
  WHERE n2.nspname = 'public' AND t2.relname = 'sale_items' AND c2.oid IS NULL;
  IF FOUND THEN
    EXECUTE 'ALTER TABLE public.sale_items ADD CONSTRAINT sale_items_pkey PRIMARY KEY (id)';
  END IF;

  -- FKs
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sale_items' AND column_name='sale_id'
  ) AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='sale_items_sale_id_fkey') THEN
    EXECUTE 'ALTER TABLE public.sale_items ADD CONSTRAINT sale_items_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sale_items' AND column_name='product_id'
  ) AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='sale_items_product_id_fkey') THEN
    EXECUTE 'ALTER TABLE public.sale_items ADD CONSTRAINT sale_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.inventory_items(id) ON DELETE SET NULL';
  END IF;

  -- Indexes
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items(sale_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON public.sale_items(product_id)';
END $$;

-- suppliers
DO $$ BEGIN
  PERFORM 1 FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  LEFT JOIN pg_constraint c ON c.conrelid = t.oid AND c.contype = 'p'
  WHERE n.nspname = 'public' AND t.relname = 'suppliers' AND c.oid IS NULL;
  IF FOUND THEN
    EXECUTE 'ALTER TABLE public.suppliers ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id)';
  END IF;
END $$;

-- user_invitations
DO $$ BEGIN
  PERFORM 1 FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  LEFT JOIN pg_constraint c ON c.conrelid = t.oid AND c.contype = 'p'
  WHERE n.nspname = 'public' AND t.relname = 'user_invitations' AND c.oid IS NULL;
  IF FOUND THEN
    EXECUTE 'ALTER TABLE public.user_invitations ADD CONSTRAINT user_invitations_pkey PRIMARY KEY (id)';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='user_invitations_organization_id_fkey') THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_invitations' AND column_name='organization_id'
    ) THEN
      EXECUTE 'ALTER TABLE public.user_invitations ADD CONSTRAINT user_invitations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE';
    END IF;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_invitations' AND column_name='invited_by'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='auth' AND table_name='users'
  ) AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='user_invitations_invited_by_fkey') THEN
    EXECUTE 'ALTER TABLE public.user_invitations ADD CONSTRAINT user_invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL';
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_invitations_organization_id ON public.user_invitations(organization_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON public.user_invitations(token)';
END $$;

-- Done