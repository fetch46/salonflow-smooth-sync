# Plan Cards Not Visible - Troubleshooting Guide

If you're not seeing the subscription plan cards during organization setup, follow these steps:

## 🔍 **Quick Diagnosis**

### Step 1: Check Console Logs
1. **Open Browser Developer Tools** (F12)
2. **Go to Console tab**
3. **Look for these messages:**
   - `"Fetching subscription plans..."`
   - `"Plans query result: ..."`
   - `"Plans set in state: ..."`

### Step 2: Check What You See
During organization setup, you should see one of these scenarios:

#### ✅ **Success**: 3 Beautiful Plan Cards
- Starter ($29/month)
- Professional ($59/month) - marked as "Most Popular"
- Enterprise ($99/month)

#### ⚠️ **Loading State**: 
- "Loading subscription plans..."
- "If this persists, check the console for errors or visit /debug/plans"
- **"Use Demo Plans for Testing"** button

#### ❌ **Error State**:
- Error message in console
- Plans count shows 0

## 🚨 **Quick Fixes**

### Fix 1: Use Demo Plans (Immediate Solution)
1. If you see the loading message, click **"Use Demo Plans for Testing"**
2. You'll immediately see 3 plan cards
3. You can complete the setup process
4. Fix the database issue later

### Fix 2: Database Migration
```bash
# Run the subscription plans migration
supabase db push

# Or manually run the SQL
```

### Fix 3: Manual Database Seed
1. Go to **Supabase Dashboard** → **SQL Editor**
2. Copy and paste from `manual_seed_plans.sql`
3. Click **Run**
4. Refresh the organization setup page

### Fix 4: Debug Page
1. Visit: `https://your-app.com/debug/plans`
2. Click **"Fetch Plans"** to see what's happening
3. Use **"Test Insert"** if needed
4. Return to organization setup

## 🔧 **Detailed Troubleshooting**

### Issue 1: "Loading subscription plans..." Forever
**Symptoms:**
- Loading message never disappears
- Console shows fetch attempt but no data

**Causes & Solutions:**
1. **Migration not run**
   ```bash
   supabase db push
   ```

2. **Database table doesn't exist**
   ```sql
   SELECT COUNT(*) FROM subscription_plans;
   ```

3. **RLS blocking access**
   ```sql
   -- Check if you can access the table
   SELECT * FROM subscription_plans;
   ```

4. **Supabase connection issue**
   - Check your environment variables
   - Verify Supabase project URL and anon key

### Issue 2: Console Shows "0 plans found"
**Symptoms:**
- Console: `"Plans query result: { data: [], error: null }"`
- Plans count: 0

**Solutions:**
1. **Seed the database:**
   ```sql
   -- Run this in Supabase SQL Editor
   SELECT COUNT(*) FROM subscription_plans WHERE is_active = true;
   -- If 0, run the manual_seed_plans.sql script
   ```

2. **Check plan status:**
   ```sql
   SELECT name, is_active FROM subscription_plans;
   -- Make sure is_active = true
   ```

### Issue 3: Database Error in Console
**Symptoms:**
- Console shows database error
- Red error message in browser

**Common Errors & Solutions:**

#### "relation 'subscription_plans' does not exist"
```bash
# Table doesn't exist - run migration
supabase db push
```

#### "permission denied for table subscription_plans"
```sql
-- RLS policy issue - run this SQL
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view subscription plans" ON subscription_plans
    FOR SELECT USING (true);
```

#### "Invalid API key"
- Check your `.env.local` file
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

### Issue 4: Plans Load But Cards Don't Render
**Symptoms:**
- Console shows plans loaded successfully
- UI still shows loading or blank

**Solutions:**
1. **Check React errors:**
   - Look for JavaScript errors in console
   - Check for missing UI components

2. **Check plan data structure:**
   ```javascript
   // Run in browser console
   console.log('Plans in state:', plans);
   ```

3. **Verify plan features:**
   ```sql
   -- Make sure features column is valid JSON
   SELECT name, features FROM subscription_plans;
   ```

## 🎯 **Expected Console Output**

When working correctly, you should see:

```
Fetching subscription plans...
Plans query result: { data: [...], error: null }
Plans set in state: [3 plans]
Selected professional plan: [uuid]
Found 3 plan(s): Starter, Professional, Enterprise
```

## 🧪 **Testing Steps**

### Test 1: Mock Data
1. Go to organization setup
2. If loading forever, click "Use Demo Plans for Testing"
3. Should see 3 plan cards immediately

### Test 2: Debug Page
1. Visit `/debug/plans`
2. Click "Fetch Plans"
3. Should see plan data or specific error

### Test 3: Database Direct Query
```sql
-- Run in Supabase SQL Editor
SELECT 
    name,
    slug,
    price_monthly,
    is_active,
    jsonb_pretty(features) as features
FROM subscription_plans 
ORDER BY sort_order;
```

### Test 4: API Test (Browser Console)
```javascript
// Test the Supabase query directly
const { data, error } = await supabase
  .from('subscription_plans')
  .select('*')
  .eq('is_active', true);
  
console.log('Direct query result:', { data, error });
```

## 🎨 **What You Should See**

When working correctly, the organization setup page will show:

### Plan Cards Layout:
```
┌─────────────┬─────────────┬─────────────┐
│   Starter   │Professional │ Enterprise  │
│    $29/mo   │   $59/mo    │   $99/mo    │
│   🚀 Icon   │  ⭐ Most     │   👑 Icon   │
│             │   Popular   │             │
│ • 5 users   │ • 25 users  │ • 100 users │
│ • 1 location│ • 3 locations│ • 10 locations│
│ • Basic     │ • Advanced  │ • Everything│
│   features  │   features  │   + API     │
└─────────────┴─────────────┴─────────────┘
```

### Monthly/Yearly Toggle:
- Toggle between Monthly and Yearly pricing
- Yearly shows "Save 20%" badge
- Pricing updates automatically

### Professional Plan:
- Should have "Most Popular" badge
- Should be pre-selected by default
- Purple gradient styling

## 🆘 **Emergency Fallback**

If nothing else works:

### Option 1: Use Mock Plans
The app now includes demo plans as fallback. Even without a database, you can:
1. Complete organization setup
2. Test the full application
3. Fix database issues later

### Option 2: Skip Plan Selection (Code Modification)
Temporarily modify `OrganizationSetup.tsx`:
```typescript
// Comment out the plan requirement
if (!user /* || !selectedPlan */) {
  toast.error('Please ensure you are logged in');
  return;
}
```

### Option 3: Direct Database Insert
```sql
-- Emergency plan creation
INSERT INTO subscription_plans (name, slug, description, price_monthly, price_yearly, max_users, max_locations, features, is_active, sort_order) VALUES
('Professional', 'professional', 'Standard plan', 5900, 59000, 25, 3, '{"appointments": true, "clients": true, "staff": true}', true, 1);
```

---

## 📞 **Still Need Help?**

If plan cards still aren't visible:

1. **Check the browser network tab** for failed requests
2. **Verify your Supabase project** is active and accessible
3. **Try the debug page** at `/debug/plans` for detailed diagnostics
4. **Use the demo plans** to continue with setup while fixing the database

**Remember**: You can always use the "Use Demo Plans for Testing" button to immediately see the plan cards and complete your setup! 🎉