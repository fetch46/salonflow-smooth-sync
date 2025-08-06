# 🚨 DATABASE WRITE ISSUES - COMPLETE FIX

## The Problem

The app is unable to write to the database due to **Row Level Security (RLS) policies** that are missing or incorrectly configured. This creates a "chicken-and-egg" problem where:

1. **Users can't create organizations** because they're not in `organization_users` yet
2. **Users can't join organizations** because the organization doesn't exist yet  
3. **RLS policies block all writes** because users don't have permission

## 🔧 Complete Solution

### Step 1: Run the Database Fix Migration

```bash
# Apply the RLS fix migration
supabase db push

# This will run: 20250116000003_fix_organization_insert.sql
```

**OR** manually run the SQL in Supabase Dashboard:

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Copy the entire contents of `supabase/migrations/20250116000003_fix_organization_insert.sql`
3. Click **Run**

### Step 2: Test the Fix

Visit: `https://your-app.com/debug/database`

1. **Click "Run Full Test Suite"**
2. **Check that all tests pass**
3. **Verify organization creation works**

Expected results:
- ✅ User Authentication: PASS
- ✅ Read Subscription Plans: PASS  
- ✅ Safe Organization Creation: PASS
- ✅ Create Client: PASS
- ✅ Create Staff: PASS

### Step 3: Test Organization Setup

1. **Go to** `/setup`
2. **Click "Load Mock Plans"** (if needed)
3. **Fill in organization details**
4. **Click "Create Organization"**
5. **Should successfully create and redirect to dashboard**

## 🛠️ What the Fix Does

### 1. Adds Missing INSERT Policies

```sql
-- Allow authenticated users to create organizations
CREATE POLICY "Authenticated users can create organizations" ON organizations
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Allow users to add themselves to organizations  
CREATE POLICY "Users can add themselves to organizations" ON organization_users
    FOR INSERT WITH CHECK (user_id = auth.uid());
```

### 2. Creates Safe Functions

**`create_organization_with_user()`** - Safely creates organization + assigns user as owner:
```sql
SELECT create_organization_with_user(
    'My Salon', 
    'my-salon-slug', 
    '{"description": "A great salon"}',
    'plan-uuid'  -- optional
);
```

**`setup_new_organization()`** - Creates initial data for new organizations

### 3. Fixes All Table Policies

Automatically adds missing RLS policies for all tables:
- ✅ SELECT policies (view your organization's data)
- ✅ INSERT policies (create data for your organization)  
- ✅ UPDATE policies (edit your organization's data)
- ✅ DELETE policies (admins can delete data)

### 4. Makes Subscription Plans Readable

```sql
-- Everyone can view active subscription plans
CREATE POLICY "Everyone can view subscription plans" ON subscription_plans
    FOR SELECT USING (is_active = true);
```

## 🧪 Testing & Verification

### Quick Test (2 minutes)

1. **Visit** `/debug/database`
2. **Click "Run Full Test Suite"**
3. **All tests should pass**

### Manual Test (5 minutes)

1. **Create new account** (if needed)
2. **Go to organization setup** (`/setup`)
3. **Load mock plans** (button)
4. **Fill form and submit**
5. **Should redirect to dashboard**

### Database Verification

Run this in Supabase SQL Editor:
```sql
-- Check if policies exist
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename IN ('organizations', 'organization_users')
ORDER BY tablename, cmd;

-- Should show INSERT policies for both tables
```

## 📊 Before vs After

### BEFORE (Broken)
```
❌ User tries to create organization
❌ RLS blocks: "User not in organization_users"  
❌ Can't join organization_users without organization
❌ COMPLETE DEADLOCK
```

### AFTER (Fixed)  
```
✅ User creates organization (new INSERT policy allows it)
✅ Function automatically adds user as owner
✅ User can now read/write their organization's data
✅ Full CRUD operations work
```

## 🚨 Emergency Fixes

### If Migration Fails

**Option 1: Manual SQL**
```sql
-- Minimal fix - add these policies manually
CREATE POLICY "auth_insert_orgs" ON organizations
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "auth_insert_org_users" ON organization_users  
    FOR INSERT WITH CHECK (user_id = auth.uid());
```

**Option 2: Disable RLS Temporarily**
```sql
-- ONLY for testing - NOT for production
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE organization_users DISABLE ROW LEVEL SECURITY;
```

**Option 3: Use Service Role**
- Update your app to use service role key for organization creation
- Switch back to anon key after creation

### If Tests Still Fail

1. **Check authentication** - make sure user is logged in
2. **Verify Supabase connection** - check environment variables
3. **Check browser console** for detailed error messages
4. **Try different browser** or incognito mode

## 🎯 Expected Behavior After Fix

### Organization Setup Page
- ✅ Loads subscription plans successfully
- ✅ User can fill out organization form  
- ✅ "Create Organization" button works
- ✅ Successfully redirects to dashboard
- ✅ User sees their new organization in context

### Throughout the App
- ✅ Can create clients, staff, services
- ✅ Can create appointments and job cards
- ✅ Can add inventory items and suppliers
- ✅ All CRUD operations work normally
- ✅ Multi-tenant data isolation works correctly

### Database Level
- ✅ RLS policies protect data between organizations
- ✅ Users can only see their organization's data
- ✅ Owners and admins have appropriate permissions
- ✅ Data security is maintained

## 📞 Support & Debugging

### Debug Pages Available:
- **`/debug/database`** - Comprehensive database testing
- **`/debug/plans`** - Subscription plans debugging  
- **`/test/plans`** - Plans UI testing

### Common Error Messages:

| Error | Cause | Solution |
|-------|-------|----------|
| "new row violates row-level security" | Missing INSERT policy | Run the migration |
| "permission denied for table" | No RLS policy | Add appropriate policy |
| "function does not exist" | Function not created | Run full migration |
| "relation does not exist" | Table missing | Run SAAS schema migration first |

### SQL Queries for Debugging:

```sql
-- Check what policies exist
SELECT * FROM pg_policies WHERE tablename = 'organizations';

-- Check if functions exist  
SELECT routine_name FROM information_schema.routines 
WHERE routine_name LIKE '%organization%';

-- Test if current user can insert
SELECT auth.uid(); -- Should return your user ID

-- Test organization creation
SELECT create_organization_with_user(
    'Test Org', 'test-org-' || extract(epoch from now()), '{}'
);
```

---

## ✅ Success Checklist

After applying the fix, verify these work:

- ☐ Database test suite passes (all green)
- ☐ Organization setup completes successfully  
- ☐ Can create clients in the new organization
- ☐ Can create staff members
- ☐ Can add services and inventory
- ☐ Dashboard loads with organization context
- ☐ All CRUD operations work throughout the app

**🎉 Once all items are checked, your database write issues are completely resolved!**