-- Emergency Subscription Plans Seeding
-- Run this directly in Supabase SQL Editor if plans aren't loading

-- First, ensure the table exists and has proper structure
DO $$
BEGIN
    -- Check if subscription_plans table exists
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'subscription_plans') THEN
        RAISE NOTICE 'Creating subscription_plans table...';
        
        CREATE TABLE subscription_plans (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            slug TEXT UNIQUE NOT NULL,
            description TEXT,
            price_monthly INTEGER NOT NULL,
            price_yearly INTEGER NOT NULL,
            max_users INTEGER,
            max_locations INTEGER,
            features JSONB DEFAULT '{}',
            is_active BOOLEAN DEFAULT true,
            sort_order INTEGER DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
    END IF;
END $$;

-- Enable RLS and create policy
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Everyone can view subscription plans" ON subscription_plans;
DROP POLICY IF EXISTS "Anyone can view subscription plans" ON subscription_plans;
DROP POLICY IF EXISTS "Public can read subscription plans" ON subscription_plans;

-- Create a simple, permissive policy for reading plans
CREATE POLICY "Public read access to subscription plans" ON subscription_plans
    FOR SELECT
    USING (true);

-- Clear existing plans
DELETE FROM subscription_plans;

-- Insert the 3 subscription plans with comprehensive features
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
        "accounting": false,
        "job_cards": true,
        "invoices": true
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
        "job_cards": true,
        "invoices": true,
        "api_access": false,
        "white_label": false,
        "analytics": true,
        "multi_location": true
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
        "job_cards": true,
        "invoices": true,
        "api_access": true,
        "white_label": true,
        "priority_support": true,
        "custom_branding": true,
        "analytics": true,
        "multi_location": true,
        "advanced_permissions": true,
        "data_export": true
    }'::jsonb,
    true,
    3
);

-- Grant access to authenticated and anonymous users
GRANT SELECT ON subscription_plans TO authenticated;
GRANT SELECT ON subscription_plans TO anon;

-- Verify the insertion worked
DO $$
DECLARE
    plan_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO plan_count FROM subscription_plans WHERE is_active = true;
    
    IF plan_count = 3 THEN
        RAISE NOTICE '✅ SUCCESS: Inserted % subscription plans', plan_count;
        
        -- Show the plans that were created
        RAISE NOTICE 'Plans created:';
        FOR plan_record IN 
            SELECT name, '$' || (price_monthly::float / 100)::text || '/month' as price 
            FROM subscription_plans 
            ORDER BY sort_order 
        LOOP
            RAISE NOTICE '  - %: %', plan_record.name, plan_record.price;
        END LOOP;
    ELSE
        RAISE WARNING '❌ ISSUE: Expected 3 plans, but found %', plan_count;
    END IF;
END $$;

-- Test query that the frontend will use
SELECT 
    'Frontend test query results:' as info,
    COUNT(*) as total_plans,
    COUNT(*) FILTER (WHERE is_active = true) as active_plans
FROM subscription_plans;

-- Show actual plan data
SELECT 
    name,
    slug,
    price_monthly,
    price_yearly,
    max_users,
    max_locations,
    is_active,
    sort_order
FROM subscription_plans 
ORDER BY sort_order;