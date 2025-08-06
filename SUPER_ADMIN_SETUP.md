# Super Admin Setup Guide

This guide explains how to set up and access the Super Admin functionality in your SAAS salon management platform.

## 🔧 Initial Setup

### 1. Update Your Email in Migration

Before running the migration, you **MUST** update the migration file with your email address:

1. Open `supabase/migrations/20250116000001_add_super_admin.sql`
2. Find this line (around line 119):
   ```sql
   first_admin_email TEXT := 'admin@yourdomain.com'; -- CHANGE THIS TO YOUR EMAIL
   ```
3. Replace `'admin@yourdomain.com'` with your actual email address:
   ```sql
   first_admin_email TEXT := 'your-actual-email@example.com';
   ```

### 2. Run the Migration

Apply the migration to create the super admin tables and functions:

```bash
# If using Supabase CLI
supabase db push

# Or if using direct SQL execution in Supabase Dashboard
# Copy and paste the migration content into the SQL editor
```

### 3. Verify Setup

After running the migration:

1. Check your Supabase logs - you should see a message like:
   ```
   NOTICE: Super admin access granted to your-email@example.com
   ```
   
2. If the user with your email doesn't exist yet, create an account first, then run this SQL manually:
   ```sql
   -- Replace 'your-email@example.com' with your actual email
   DO $$
   DECLARE
       admin_user_id UUID;
   BEGIN
       SELECT id INTO admin_user_id 
       FROM auth.users 
       WHERE email = 'your-email@example.com';
       
       IF admin_user_id IS NOT NULL THEN
           INSERT INTO super_admins (user_id, granted_by)
           VALUES (admin_user_id, admin_user_id)
           ON CONFLICT (user_id) DO UPDATE SET
               is_active = true,
               updated_at = now();
           
           RAISE NOTICE 'Super admin access granted!';
       ELSE
           RAISE NOTICE 'User not found. Please create an account first.';
       END IF;
   END $$;
   ```

## 🚀 Accessing Super Admin

### Method 1: Direct URL

Navigate directly to: `https://your-app-domain.com/super-admin`

### Method 2: Sidebar Navigation

If you're a super admin, you'll see a new "System Admin" section in the sidebar with a "Super Admin" menu item marked with a crown icon.

### Method 3: Manual Grant (for additional admins)

1. **Log in as an existing super admin**
2. **Go to Super Admin Dashboard** (`/super-admin`)
3. **Click the "Super Admins" tab**
4. **Click "Grant Super Admin" button**
5. **Enter the email address** of the user you want to make a super admin
6. **Click "Grant Access"**

## 🛡️ Super Admin Features

### Dashboard Overview
- **Total Organizations**: View all tenant organizations
- **Active Subscriptions**: Monitor paying customers
- **Revenue Tracking**: (Coming soon - requires billing integration)
- **User Statistics**: Platform-wide user counts

### Organizations Management
- **View all organizations** and their details
- **Monitor subscription status** for each tenant
- **Search and filter** organizations
- **Organization actions** (edit/delete - coming soon)

### Super Admin Management
- **Grant super admin access** to other users
- **Revoke super admin access** (cannot revoke your own if you're the last admin)
- **View admin activity** and permissions
- **Audit trail** of who granted/revoked access

### System Settings
- Platform-wide configuration options (coming soon)

## 🔐 Security Features

### Access Control
- **Database-level security**: Super admin status is enforced at the database level with RLS policies
- **Function-based permissions**: Super admin functions can only be called by existing super admins
- **Self-protection**: Cannot revoke your own access if you're the last super admin

### Audit Trail
- **Who granted access**: Track which super admin granted access to others
- **Timestamps**: Full audit trail with creation and update timestamps
- **Active status**: Ability to deactivate without deleting records

## 🛠️ Database Schema

### Tables Created

1. **`super_admins`**
   - Tracks system-wide administrators
   - Includes permissions, audit trail, and active status

2. **Views**
   - **`super_admin_users`**: Easy view of super admins with user details

### Functions Created

1. **`is_super_admin(user_uuid)`**: Check if a user is a super admin
2. **`grant_super_admin(target_user_id)`**: Grant super admin access
3. **`revoke_super_admin(target_user_id)`**: Revoke super admin access

### Enums Updated

- **`user_role`**: Added `'super_admin'` value

## 🚨 Troubleshooting

### "Access Denied" Error

**Problem**: You see "Access Denied" when visiting `/super-admin`

**Solutions**:
1. Verify your user account exists and you're logged in
2. Check if you're in the `super_admins` table:
   ```sql
   SELECT * FROM super_admins WHERE user_id = 'your-user-id';
   ```
3. Manually grant yourself access using the SQL from step 3 above

### "User not found" When Granting Access

**Problem**: Getting "User not found" when trying to grant super admin access

**Solutions**:
1. Ensure the user has created an account and verified their email
2. Check the exact email address (case-sensitive)
3. Verify the user exists:
   ```sql
   SELECT id, email FROM auth.users WHERE email = 'target-email@example.com';
   ```

### Functions Not Working

**Problem**: Super admin functions return errors

**Solutions**:
1. Verify the migration ran successfully
2. Check if the functions exist:
   ```sql
   SELECT routine_name FROM information_schema.routines 
   WHERE routine_name IN ('is_super_admin', 'grant_super_admin', 'revoke_super_admin');
   ```
3. Re-run the migration if functions are missing

## 📝 Best Practices

### Security
1. **Limit super admins**: Only grant access to trusted administrators
2. **Regular audits**: Periodically review who has super admin access
3. **Use strong passwords**: Ensure super admin accounts have strong authentication
4. **Monitor activity**: Keep track of super admin actions

### Operational
1. **Documentation**: Keep a record of who has super admin access and why
2. **Backup access**: Always have at least 2 super admins to prevent lockout
3. **Regular reviews**: Periodically review and clean up inactive admins

## 🔄 Migration Rollback

If you need to remove super admin functionality:

```sql
-- Remove super admin functions
DROP FUNCTION IF EXISTS is_super_admin(UUID);
DROP FUNCTION IF EXISTS grant_super_admin(UUID);
DROP FUNCTION IF EXISTS revoke_super_admin(UUID);

-- Remove super admin table
DROP TABLE IF EXISTS super_admins CASCADE;

-- Remove super_admin from user_role enum (be careful - this affects existing data)
-- This requires recreating the enum, which can be complex in production
```

## 📞 Support

If you encounter any issues with super admin setup:

1. Check the troubleshooting section above
2. Review Supabase logs for error messages
3. Verify your database migration completed successfully
4. Test with a simple super admin check query:
   ```sql
   SELECT is_super_admin('your-user-id');
   ```

---

**🎉 Congratulations!** You now have full super admin access to manage your SAAS platform. Use this power responsibly! 👑