# Subscription Plans Setup & Troubleshooting

If you're seeing "no plans to choose from" during signup, here's how to fix it:

## 🚨 Quick Fix

### Option 1: Run the Migration
```bash
# If using Supabase CLI
supabase db push

# This will run the migration: 20250116000002_seed_subscription_plans.sql
```

### Option 2: Manual SQL Execution
1. Go to your **Supabase Dashboard** → **SQL Editor**
2. Copy and paste the contents of `manual_seed_plans.sql`
3. Click **Run**

### Option 3: Debug Mode
1. Go to: `https://your-app-url.com/debug/plans`
2. Click **"Fetch Plans"** to see what's happening
3. If no plans are found, click **"Test Insert"** to add a test plan
4. Check the console for detailed error messages

## 🔍 Diagnosis Steps

### Step 1: Check if Plans Exist
Run this in Supabase SQL Editor:

```sql
SELECT COUNT(*) as plan_count FROM subscription_plans WHERE is_active = true;
```

**Expected Result:** 3 plans (Starter, Professional, Enterprise)

### Step 2: Check Permissions
Run this to verify table access:

```sql
SELECT * FROM subscription_plans ORDER BY sort_order;
```

**If this fails:** You might have RLS issues

### Step 3: Verify RLS Policies
```sql
SELECT tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'subscription_plans';
```

**Expected:** One policy allowing SELECT for authenticated users

## 🛠️ Common Issues & Solutions

### Issue 1: "No plans found"
**Cause:** Migration not run or data not inserted
**Solution:** Run the migration or manual SQL script

### Issue 2: "Permission denied"
**Cause:** RLS blocking access
**Solution:** Run this SQL:
```sql
-- Enable RLS and create read policy
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view subscription plans" ON subscription_plans
    FOR SELECT
    USING (true);
```

### Issue 3: "Plans loading but not showing"
**Cause:** Frontend filtering or rendering issue
**Solution:** Check browser console for JavaScript errors

### Issue 4: "Old plan data showing"
**Cause:** Cached data or old migration
**Solution:** Clear the table and re-insert:
```sql
DELETE FROM subscription_plans;
-- Then run the manual_seed_plans.sql script
```

## 📊 Expected Plans Data

After setup, you should have these 3 plans:

### 🚀 Starter - $29/month
- **Features:** Appointments, Clients, Staff, Services, Basic Reports
- **Limits:** 5 users, 1 location
- **Target:** Small salons getting started

### 💼 Professional - $59/month  
- **Features:** Everything in Starter + Inventory, Advanced Reports, POS, Accounting
- **Limits:** 25 users, 3 locations
- **Target:** Growing salons with multiple staff

### 👑 Enterprise - $99/month
- **Features:** Everything + API Access, White Label, Priority Support
- **Limits:** 100 users, 10 locations
- **Target:** Large salon chains

## 🔧 Manual Verification

### Frontend Test
1. Go to the signup page
2. Create a new account
3. You should see 3 plan options during organization setup

### Database Test
```sql
-- This should return 3 rows
SELECT 
    name,
    '$' || (price_monthly::float / 100) || '/month' as monthly_price,
    '$' || (price_yearly::float / 100) || '/year' as yearly_price,
    max_users,
    max_locations
FROM subscription_plans 
WHERE is_active = true 
ORDER BY sort_order;
```

### API Test (using browser console)
```javascript
// Run this in browser console on your app
const { data, error } = await window.supabase
  .from('subscription_plans')
  .select('*')
  .eq('is_active', true);

console.log('Plans:', data);
console.log('Error:', error);
```

## 🚀 Advanced Debugging

### Check Full Database State
```sql
-- Table structure
\d subscription_plans

-- All data (including inactive)
SELECT * FROM subscription_plans;

-- RLS status
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'subscription_plans';

-- Policies
SELECT * FROM pg_policies WHERE tablename = 'subscription_plans';
```

### Check Application Logs
1. Open browser Developer Tools
2. Go to Console tab
3. Look for subscription plan related errors
4. Check Network tab for failed API calls

## 📝 Migration Files

The subscription plans are set up in these files:
- `supabase/migrations/20240101000000_create_saas_schema.sql` - Initial schema and data
- `supabase/migrations/20250116000002_seed_subscription_plans.sql` - Updated seed data
- `manual_seed_plans.sql` - Manual backup script

## 🆘 Still Having Issues?

If none of the above works:

1. **Check your Supabase project URL and anon key** in your environment variables
2. **Verify your user is authenticated** (check `supabase.auth.getUser()`)
3. **Check if the `subscription_plans` table exists** at all
4. **Look at Supabase dashboard** → **Table Editor** → **subscription_plans**
5. **Check the browser network tab** for 404 or 403 errors

### Emergency Reset
If all else fails, completely reset the plans:

```sql
-- Drop and recreate table
DROP TABLE IF EXISTS subscription_plans CASCADE;

-- Then re-run the SAAS migration or create the table manually:
CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- Then run manual_seed_plans.sql
```

---

**💡 Pro Tip:** Use the debug page at `/debug/plans` to test the subscription plan loading in real-time!