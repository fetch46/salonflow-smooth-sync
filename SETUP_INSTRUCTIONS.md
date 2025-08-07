# 🚀 Subscription Plans & Organization Setup Guide

## Quick Start (2 Minutes)

### ✅ What's Already Working
- **Subscription Plans**: 3 plans are set up (Starter $29/month, Professional $59/month, Enterprise $99/month)
- **Database Functions**: Organization creation function is working
- **RLS Policies**: Row Level Security is properly configured
- **Authentication**: User authentication is working

### 🎯 Test the Setup

1. **Go to the Organization Setup page** (`/setup`)
2. **Click "🔍 Test DB"** button - should show all green checkmarks ✅
3. **Fill in organization details** and select a plan
4. **Click "Start Free Trial"** - should create organization and redirect to dashboard

### 🐛 If Something's Not Working

#### Problem: "No subscription plans available"
**Solution**: Click "🔄 Reload Plans" or "📋 Load Demo Plans" button on the setup page

#### Problem: Organization creation fails
**Solution**: 
1. Click "🔍 Test DB" to see specific error
2. If RPC function missing, run `emergency_create_organization_function.sql` in Supabase SQL Editor
3. If authentication issues, log out and back in

#### Problem: Database connection issues
**Solution**: Check environment variables in `.env.local`

## 📋 What's Been Set Up

### Subscription Plans
- **Starter Plan**: $29/month, 5 users, 1 location
  - Features: Appointments, Clients, Staff, Services, Basic Reports
- **Professional Plan**: $59/month, 25 users, 3 locations  
  - Features: Everything in Starter + Inventory, Advanced Reports, POS, Accounting
- **Enterprise Plan**: $99/month, 100 users, 10 locations
  - Features: Everything + API Access, White Label, Priority Support

### Database Functions
- `create_organization_with_user()` - Safely creates organizations with proper permissions
- `setup_new_organization()` - Sets up default accounts and data

### Security & Permissions
- Row Level Security (RLS) enabled on all tables
- Users can only access their own organizations
- Proper authentication checks on all operations

## 🔧 Manual Database Setup (If Needed)

### Option 1: Supabase Dashboard (Recommended)
1. Go to **Supabase Dashboard** → **SQL Editor**
2. Run `emergency_seed_plans.sql` (for subscription plans)
3. Run `emergency_create_organization_function.sql` (for organization creation)

### Option 2: Using Supabase CLI
```bash
supabase db push
```

### Option 3: Verify Setup
Run the test script:
```bash
node test-organization-creation.js
```

## 🎉 Features Available

### For Users
- **14-day free trial** on any plan
- **Monthly or yearly billing** (20% savings on yearly)
- **Upgrade/downgrade anytime** during trial
- **No credit card required** for trial

### For Developers
- **Database testing tools** built into the UI
- **Detailed error messages** with troubleshooting tips
- **Demo plans** for testing without database
- **Console logging** for debugging

### For Organizations
- **Multi-tenant architecture** with proper data isolation
- **Role-based permissions** (Owner, Admin, User)
- **Default accounting structure** automatically created
- **Subscription management** with trial tracking

## 🛠️ Troubleshooting Tools

### Built-in Debug Tools
- **🔍 Test DB**: Comprehensive database connectivity test
- **📋 Load Demo Plans**: Use demo data for testing
- **🔄 Reload Plans**: Refresh plans from database

### Console Debugging
- Open browser Developer Tools → Console
- All errors include specific troubleshooting tips
- Database test results are logged with details

### Manual Testing
- Visit `/debug/plans` for subscription plan testing
- Use test script: `node test-organization-creation.js`
- Check Supabase Dashboard → Table Editor

## 📞 Support

### Database Issues
- Check the emergency SQL scripts are run
- Verify environment variables
- Ensure Supabase project is active

### Authentication Issues  
- Log out and back in
- Check user session validity
- Verify email confirmation

### Plan Loading Issues
- Use "Load Demo Plans" for testing
- Check subscription_plans table in Supabase
- Verify RLS policies allow reading

---

## ✅ Success Checklist

After setup, you should have:
- ✅ 3 subscription plans visible on setup page
- ✅ Organization creation works without errors  
- ✅ Users can complete full signup flow
- ✅ New organizations have 14-day trial
- ✅ Database test shows all green checkmarks
- ✅ Users redirect to dashboard after setup

**Everything should work out of the box! 🚀**