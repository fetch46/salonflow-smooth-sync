-- Seed sample subscription plans if they don't exist
DO $$
BEGIN
  -- Starter Plan
  IF NOT EXISTS (
    SELECT 1 FROM public.subscription_plans WHERE slug = 'starter'
  ) THEN
    INSERT INTO public.subscription_plans (
      name, slug, description, price_monthly, price_yearly, max_users, max_locations, features, is_active, sort_order
    ) VALUES (
      'Starter',
      'starter',
      'Perfect for small salons just getting started',
      2900,
      29000,
      5,
      1,
      '{
        "appointments": true,
        "clients": true,
        "staff": true,
        "services": true,
        "basic_reports": true,
        "inventory": false
      }'::jsonb,
      true,
      1
    );
  END IF;

  -- Professional Plan
  IF NOT EXISTS (
    SELECT 1 FROM public.subscription_plans WHERE slug = 'professional'
  ) THEN
    INSERT INTO public.subscription_plans (
      name, slug, description, price_monthly, price_yearly, max_users, max_locations, features, is_active, sort_order
    ) VALUES (
      'Professional',
      'professional',
      'For growing salons with multiple staff members',
      5900,
      59000,
      25,
      3,
      '{
        "appointments": true,
        "clients": true,
        "staff": true,
        "services": true,
        "inventory": true,
        "basic_reports": true,
        "advanced_reports": true,
        "pos": true,
        "accounting": true
      }'::jsonb,
      true,
      2
    );
  END IF;

  -- Enterprise Plan
  IF NOT EXISTS (
    SELECT 1 FROM public.subscription_plans WHERE slug = 'enterprise'
  ) THEN
    INSERT INTO public.subscription_plans (
      name, slug, description, price_monthly, price_yearly, max_users, max_locations, features, is_active, sort_order
    ) VALUES (
      'Enterprise',
      'enterprise',
      'For large salon chains with advanced needs',
      9900,
      99000,
      100,
      10,
      '{
        "appointments": true,
        "clients": true,
        "staff": true,
        "services": true,
        "inventory": true,
        "basic_reports": true,
        "advanced_reports": true,
        "pos": true,
        "accounting": true,
        "api_access": true,
        "white_label": true
      }'::jsonb,
      true,
      3
    );
  END IF;
END $$;