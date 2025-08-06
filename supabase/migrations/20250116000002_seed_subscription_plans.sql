-- Ensure subscription plans are properly seeded
-- This migration will insert the plans if they don't exist

-- First, let's make sure the subscription_plans table allows public reads
-- (it should already be accessible, but let's be explicit)
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow all authenticated users to read subscription plans
CREATE POLICY "Anyone can view subscription plans" ON subscription_plans
    FOR SELECT
    USING (true);

-- Delete existing plans to avoid conflicts (in case they exist with different data)
DELETE FROM subscription_plans;

-- Insert the subscription plans
INSERT INTO subscription_plans (
    name, 
    slug, 
    description, 
    price_monthly, 
    price_yearly, 
    max_users, 
    max_locations, 
    features, 
    is_active,
    sort_order
) VALUES
(
    'Starter',
    'starter',
    'Perfect for small salons just getting started',
    2900,  -- $29.00
    29000, -- $290.00 (10 months price for yearly)
    5,
    1,
    '{
        "appointments": true,
        "clients": true,
        "staff": true,
        "services": true,
        "basic_reports": true,
        "inventory": false,
        "advanced_reports": false,
        "integrations": false,
        "api_access": false,
        "white_label": false,
        "pos": false,
        "accounting": false
    }'::jsonb,
    true,
    1
),
(
    'Professional',
    'professional',
    'For growing salons with multiple staff members',
    5900,  -- $59.00
    59000, -- $590.00 (10 months price for yearly)
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
        "integrations": true,
        "pos": true,
        "accounting": true,
        "api_access": false,
        "white_label": false
    }'::jsonb,
    true,
    2
),
(
    'Enterprise',
    'enterprise',
    'For large salon chains with advanced needs',
    9900,  -- $99.00
    99000, -- $990.00 (10 months price for yearly)
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
        "integrations": true,
        "pos": true,
        "accounting": true,
        "api_access": true,
        "white_label": true,
        "priority_support": true,
        "custom_branding": true
    }'::jsonb,
    true,
    3
);

-- Verify the data was inserted
DO $$
BEGIN
    IF (SELECT COUNT(*) FROM subscription_plans) = 3 THEN
        RAISE NOTICE 'Successfully inserted 3 subscription plans';
    ELSE
        RAISE NOTICE 'Warning: Expected 3 subscription plans, found %', (SELECT COUNT(*) FROM subscription_plans);
    END IF;
END $$;