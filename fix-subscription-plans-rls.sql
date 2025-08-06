-- Fix Subscription Plans RLS Policies
-- Run this in Supabase SQL Editor to ensure subscription plans are accessible

-- 1. Check current RLS status
SELECT 
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'subscription_plans';

-- 2. Check existing policies
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'subscription_plans';

-- 3. Drop existing policies if they're too restrictive
DROP POLICY IF EXISTS "Enable read access for all users" ON subscription_plans;
DROP POLICY IF EXISTS "Allow authenticated users to read subscription plans" ON subscription_plans;
DROP POLICY IF EXISTS "Allow public access to active subscription plans" ON subscription_plans;

-- 4. Create a simple policy that allows authenticated users to read plans
CREATE POLICY "Allow authenticated users to read subscription plans" ON subscription_plans
    FOR SELECT USING (auth.role() = 'authenticated');

-- 5. Alternative: Create a policy that allows public access to active plans
-- (Uncomment if you want plans to be visible without authentication)
/*
CREATE POLICY "Allow public access to active subscription plans" ON subscription_plans
    FOR SELECT USING (is_active = true);
*/

-- 6. Verify the policy was created
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'subscription_plans';

-- 7. Test the policy by checking if plans are accessible
SELECT 
    name,
    slug,
    price_monthly,
    is_active
FROM subscription_plans 
WHERE is_active = true
ORDER BY sort_order;