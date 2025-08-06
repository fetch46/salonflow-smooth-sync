# 🚀 SAAS Super Admin Setup Guide

## 🎯 **What is a Super Admin?**

A Super Admin is a system-level administrator who can:
- ✅ Manage all organizations in the system
- ✅ Grant/revoke super admin privileges
- ✅ View system-wide analytics
- ✅ Manage subscription plans
- ✅ Access system settings
- ✅ Monitor all users and organizations

## 📋 **Prerequisites**

Before creating a Super Admin, ensure you have:

1. ✅ **Database infrastructure set up** (run the database setup scripts)
2. ✅ **User account created** (register/login to the application)
3. ✅ **Super admin system installed** (run the super admin SQL script)

## 🚀 **Step-by-Step Setup**

### **Step 1: Set Up Super Admin Infrastructure**

1. **Go to Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Select your project: `eoxeoyyunhsdvjiwkttx`

2. **Run the Super Admin Setup Script**
   - Navigate to SQL Editor
   - Copy and paste the contents of `create-super-admin.sql`
   - Click "Run"

3. **Verify Setup**
   ```sql
   -- Run this to verify the setup
   SELECT 
       'Super Admin System' as component,
       COUNT(*) as count
   FROM information_schema.tables 
   WHERE table_name = 'super_admins'
   
   UNION ALL
   
   SELECT 
       'Super Admin Functions' as component,
       COUNT(*) as count
   FROM pg_proc 
   WHERE proname IN ('is_super_admin', 'grant_super_admin', 'revoke_super_admin');
   ```

### **Step 2: Create Your Super Admin Account**

#### **Option A: Using the Node.js Script (Recommended)**

1. **Log in to your application first**
   - Go to your app: `http://localhost:5173`
   - Register or log in with your email

2. **Run the Super Admin Creation Script**
   ```bash
   node create-super-admin.js
   ```

3. **Follow the prompts**
   - The script will automatically detect your user account
   - It will create the super admin privileges
   - It will verify everything is working

#### **Option B: Manual SQL Method**

1. **Find Your User ID**
   - Go to Supabase Dashboard > Authentication > Users
   - Find your email address
   - Copy the user ID (UUID format)

2. **Run the Manual SQL Script**
   - Open `create-first-super-admin.sql`
   - Replace `YOUR_USER_ID_HERE` with your actual user ID
   - Run the script in Supabase SQL Editor

### **Step 3: Verify Super Admin Access**

1. **Test in the Application**
   - Log in to your application
   - Navigate to `/super-admin`
   - You should see the super admin dashboard

2. **Test Super Admin Functions**
   ```sql
   -- Test if you're a super admin
   SELECT is_super_admin();
   
   -- List all super admins
   SELECT 
       sa.user_id,
       u.email,
       sa.granted_at,
       sa.is_active
   FROM super_admins sa
   JOIN auth.users u ON sa.user_id = u.id
   WHERE sa.is_active = true;
   ```

## 🔧 **Super Admin Functions**

### **Available Functions:**

1. **`is_super_admin(user_uuid)`**
   - Checks if a user is a super admin
   - Returns: `true` or `false`

2. **`grant_super_admin(target_user_id)`**
   - Grants super admin privileges to another user
   - Only super admins can use this function

3. **`revoke_super_admin(target_user_id)`**
   - Revokes super admin privileges from a user
   - Only super admins can use this function
   - Cannot revoke your own privileges

### **Usage Examples:**

```sql
-- Check if current user is super admin
SELECT is_super_admin();

-- Check if specific user is super admin
SELECT is_super_admin('user-uuid-here');

-- Grant super admin to another user
SELECT grant_super_admin('target-user-uuid');

-- Revoke super admin from a user
SELECT revoke_super_admin('target-user-uuid');
```

## 🎯 **Super Admin Dashboard Features**

Once you're a super admin, you can access:

### **System Management:**
- 📊 **System Analytics** - View overall system usage
- 👥 **User Management** - Manage all users across organizations
- 🏢 **Organization Management** - View and manage all organizations
- 💳 **Subscription Management** - Manage subscription plans and billing

### **Super Admin Actions:**
- 🔐 **Grant Super Admin** - Make other users super admins
- 🚫 **Revoke Super Admin** - Remove super admin privileges
- 📈 **System Reports** - Generate system-wide reports
- ⚙️ **System Settings** - Configure global system settings

## 🔒 **Security Features**

### **Row Level Security (RLS):**
- Only super admins can access super admin records
- Super admin functions are protected
- Cannot grant super admin without being one

### **Permission System:**
- Granular permissions for different super admin actions
- Audit trail of who granted/revoked privileges
- Timestamp tracking for all actions

## 🚨 **Troubleshooting**

### **Common Issues:**

1. **"Super admin table doesn't exist"**
   - Run the `create-super-admin.sql` script first

2. **"User not found"**
   - Make sure you're logged in to the application
   - Check that your user account exists in Supabase

3. **"Permission denied"**
   - Ensure you're a super admin before granting privileges
   - Check that the super admin functions are created

4. **"Cannot access super admin dashboard"**
   - Verify you're logged in
   - Check that your super admin status is active
   - Clear browser cache and try again

### **Verification Commands:**

```sql
-- Check if super admin system is set up
SELECT COUNT(*) FROM super_admins;

-- Check if functions exist
SELECT proname FROM pg_proc 
WHERE proname IN ('is_super_admin', 'grant_super_admin', 'revoke_super_admin');

-- Check your super admin status
SELECT is_super_admin();
```

## 📋 **Next Steps After Setup**

1. **Explore the Super Admin Dashboard**
   - Navigate to `/super-admin` in your application
   - Familiarize yourself with the features

2. **Set Up Additional Super Admins**
   - Grant super admin privileges to trusted team members
   - Use the dashboard or SQL functions

3. **Configure System Settings**
   - Set up global system configurations
   - Configure subscription plans
   - Set up monitoring and alerts

4. **Monitor System Usage**
   - Track organization growth
   - Monitor user activity
   - Generate system reports

## 🎉 **Success Indicators**

You'll know the setup is successful when:

- ✅ You can access `/super-admin` in your application
- ✅ The super admin dashboard loads without errors
- ✅ You can see system-wide data and analytics
- ✅ The `is_super_admin()` function returns `true`
- ✅ You can grant super admin privileges to other users

---

**🎯 You're now ready to manage your SAAS platform as a Super Admin!**