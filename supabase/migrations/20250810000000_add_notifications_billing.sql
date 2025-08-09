-- Notifications and Billing Support
-- 1) Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS: users can see and update their own notifications
DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
CREATE POLICY notifications_update_own ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS notifications_insert_own ON public.notifications;
CREATE POLICY notifications_insert_own ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 2) Billing history table
CREATE TABLE IF NOT EXISTS public.billing_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  description text NOT NULL,
  amount numeric(10,2) NOT NULL,
  currency_code text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'paid',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_history ENABLE ROW LEVEL SECURITY;

-- RLS: org members can read their org's billing, owners/admin can insert/manage
DROP POLICY IF EXISTS billing_history_select_org ON public.billing_history;
CREATE POLICY billing_history_select_org ON public.billing_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.organization_users ou
      WHERE ou.organization_id = billing_history.organization_id
        AND ou.user_id = auth.uid()
        AND ou.is_active = true
    )
  );

DROP POLICY IF EXISTS billing_history_insert_owner_admin ON public.billing_history;
CREATE POLICY billing_history_insert_owner_admin ON public.billing_history
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_users ou
      WHERE ou.organization_id = billing_history.organization_id
        AND ou.user_id = auth.uid()
        AND ou.is_active = true
        AND ou.role IN ('owner','admin')
    )
  );

-- 3) Organization payment methods
CREATE TABLE IF NOT EXISTS public.organization_payment_methods (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'manual',
  brand text,
  last4 text,
  exp_month smallint,
  exp_year smallint,
  is_default boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organization_payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_methods_select_org ON public.organization_payment_methods;
CREATE POLICY payment_methods_select_org ON public.organization_payment_methods
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.organization_users ou
      WHERE ou.organization_id = organization_payment_methods.organization_id
        AND ou.user_id = auth.uid()
        AND ou.is_active = true
    )
  );

DROP POLICY IF EXISTS payment_methods_upsert_owner_admin ON public.organization_payment_methods;
CREATE POLICY payment_methods_upsert_owner_admin ON public.organization_payment_methods
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.organization_users ou
      WHERE ou.organization_id = organization_payment_methods.organization_id
        AND ou.user_id = auth.uid()
        AND ou.is_active = true
        AND ou.role IN ('owner','admin')
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_users ou
      WHERE ou.organization_id = organization_payment_methods.organization_id
        AND ou.user_id = auth.uid()
        AND ou.is_active = true
        AND ou.role IN ('owner','admin')
    )
  );

-- 4) RPC: mark all notifications as read for current user (optional org scope)
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(org_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notifications
  SET is_read = true
  WHERE user_id = auth.uid()
    AND (org_id IS NULL OR organization_id = org_id);
END;
$$;

-- Grant execute to authenticated
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read(uuid) TO authenticated;