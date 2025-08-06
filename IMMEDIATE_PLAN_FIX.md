# 🚨 IMMEDIATE FIX: Plan Cards Not Showing

## Step-by-Step Instructions

### Step 1: Test the Debug Pages
Visit these URLs to isolate the issue:

1. **`/test/plans`** - New comprehensive test page
2. **`/debug/plans`** - Original debug component  
3. **`/setup`** - Organization setup page

### Step 2: Check What You See

#### At `/test/plans`:
- **Expected**: Should show plan cards immediately (uses mock data fallback)
- **Look for**: Debug info showing user email, plans count, loading status
- **Action**: Click "Load Mock Plans" if no cards appear

#### At `/debug/plans`:
- **Expected**: Shows technical debugging info
- **Look for**: Raw API responses, error messages
- **Action**: Click "Fetch Plans" and "Test Insert"

#### At `/setup`:
- **Expected**: Yellow debug box with buttons
- **Look for**: "Debug: Plans: X, User: email, Selected: plan-id"
- **Action**: Click "Load Mock Plans" button

### Step 3: Immediate Solutions

#### Solution A: Use Mock Plans (Works Immediately)
1. **Go to organization setup** (`/setup`)
2. **Look for yellow debug box** at the top
3. **Click "Load Mock Plans"** button
4. **Should see 3 plan cards appear** instantly
5. **Complete your organization setup**

#### Solution B: Database Fix
1. **Go to Supabase Dashboard** → **SQL Editor**
2. **Copy this SQL and run it:**

```sql
-- Quick plan insertion
INSERT INTO subscription_plans (name, slug, description, price_monthly, price_yearly, max_users, max_locations, features, is_active, sort_order) VALUES
('Starter', 'starter', 'Perfect for small salons', 2900, 29000, 5, 1, '{"appointments": true, "clients": true, "staff": true}', true, 1),
('Professional', 'professional', 'For growing salons', 5900, 59000, 25, 3, '{"appointments": true, "clients": true, "staff": true, "inventory": true}', true, 2),
('Enterprise', 'enterprise', 'For large salon chains', 9900, 99000, 100, 10, '{"appointments": true, "clients": true, "staff": true, "inventory": true, "api_access": true}', true, 3)
ON CONFLICT (slug) DO NOTHING;
```

3. **Refresh the setup page**

#### Solution C: Check Console
1. **Press F12** to open Developer Tools
2. **Go to Console tab**
3. **Look for these messages:**
   - `"Fetching subscription plans..."`
   - `"Plans query result: ..."`
   - `"Plans set in state: ..."`

4. **If you see errors**, take a screenshot and check common issues below

### Step 4: Common Issues & Quick Fixes

#### Issue: "No user logged in"
**Fix**: 
1. Go to `/login`
2. Create account or sign in
3. Return to `/setup`

#### Issue: "Plans: 0" in debug box
**Fix**: 
1. Click "Load Mock Plans" button
2. Or run the SQL from Solution B above

#### Issue: Console shows database errors
**Fix**:
1. Check your Supabase project is active
2. Verify environment variables in `.env.local`
3. Run migration: `supabase db push`

#### Issue: Page doesn't load at all
**Fix**:
1. Check browser console for JavaScript errors
2. Try `/test/plans` instead
3. Clear browser cache and reload

### Step 5: Verify Fix Works

After applying any fix, you should see:

```
┌─────────────┬─────────────┬─────────────┐
│  🚀 Starter  │⭐Professional│ 👑 Enterprise│
│   $29/mo    │   $59/mo    │   $99/mo    │
│  5 users    │  25 users   │  100 users  │
│  1 location │  3 locations│ 10 locations│
└─────────────┴─────────────┴─────────────┘
```

- **Professional should be pre-selected** (purple border)
- **Monthly/Yearly toggle** should work
- **Feature lists** should show with checkmarks

### Step 6: Complete Setup

Once you see the plan cards:
1. **Select your preferred plan**
2. **Toggle Monthly/Yearly** as desired
3. **Fill in organization details**
4. **Click "Create Organization"**
5. **You'll be taken to the main dashboard**

---

## 🆘 Emergency Contacts

### If Nothing Works:

1. **Bypass plan selection temporarily:**
   - Comment out line 206-208 in `src/pages/OrganizationSetup.tsx`
   - Change `if (!user || !selectedPlan)` to `if (!user)`
   - Complete setup without plan selection

2. **Use different browser:**
   - Try Chrome, Firefox, or Safari
   - Disable browser extensions
   - Try incognito/private mode

3. **Check network:**
   - Ensure internet connection
   - Check if Supabase is accessible
   - Try mobile hotspot

### Error Messages & Solutions:

| Error | Solution |
|-------|----------|
| "Failed to load subscription plans" | Use mock plans button |
| "Permission denied" | Run RLS policy SQL |
| "Table doesn't exist" | Run migration or manual SQL |
| "Invalid API key" | Check environment variables |
| Blank page | Check console for JS errors |

---

## ✅ Success Indicators

You'll know it's working when:
- ✅ Yellow debug box shows "Plans: 3"
- ✅ Three colorful plan cards are visible
- ✅ Professional plan has "Most Popular" badge
- ✅ Clicking cards selects them (purple border)
- ✅ No console errors about plans

---

**🎯 Bottom Line**: Use the "Load Mock Plans" button for immediate success, then fix the database later!