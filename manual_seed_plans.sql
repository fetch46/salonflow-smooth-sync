-- Manual Subscription Plans Seed Script
-- Run this in Supabase SQL Editor if the migration didn't work

-- First check if plans already exist
SELECT 'Current plans count: ' || COUNT(*) FROM subscription_plans;

-- Delete existing plans (optional - comment out if you want to keep existing)
-- DELETE FROM subscription_plans;

-- Insert the three subscription plans
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
-- Starter Plan
(
    'Starter',
    'starter',
    'Perfect for small salons just getting started',
    2900,  -- $29.00 per month
    29000, -- $290.00 per year (10 months price)
    5,     -- Max 5 users
    1,     -- Max 1 location
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
-- Professional Plan
(
    'Professional',
    'professional',
    'For growing salons with multiple staff members',
    5900,  -- $59.00 per month
    59000, -- $590.00 per year (10 months price)
    25,    -- Max 25 users
    3,     -- Max 3 locations
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
-- Enterprise Plan
(
    'Enterprise',
    'enterprise',
    'For large salon chains with advanced needs',
    9900,  -- $99.00 per month
    99000, -- $990.00 per year (10 months price)
    100,   -- Max 100 users
    10,    -- Max 10 locations
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
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price_monthly = EXCLUDED.price_monthly,
    price_yearly = EXCLUDED.price_yearly,
    max_users = EXCLUDED.max_users,
    max_locations = EXCLUDED.max_locations,
    features = EXCLUDED.features,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();

-- Verify the insertion
SELECT 
    'Plan inserted: ' || name || ' ($' || (price_monthly::float / 100) || '/month)' as result
FROM subscription_plans 
ORDER BY sort_order;

-- Check the final count
SELECT 'Total plans now: ' || COUNT(*) FROM subscription_plans WHERE is_active = true;