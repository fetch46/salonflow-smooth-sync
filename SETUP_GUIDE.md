# 🚀 Salon Management System - Setup Guide

This guide will help you set up the subscription demo plans and make the organization setup work properly.

## 📋 Prerequisites

- Node.js installed (v18 or higher)
- Access to your Supabase project
- Modern web browser

## 🎯 Quick Setup (5 minutes)

### Step 1: Start the Development Server

```bash
# Install dependencies (if not already done)
npm install

# Start the development server
npm run dev
```

The server will start on `http://localhost:8080`

### Step 2: Set up Subscription Plans

1. **Open the setup page**: Navigate to `http://localhost:8080/setup.html`
2. **Click "Set up Subscription Plans"** to create the default plans
3. **Verify the plans were created** - you should see 3 plans: Starter, Professional, Enterprise

### Step 3: Test Organization Creation

1. **Click "Test Organization Creation"** to verify the database functions are working
2. **If functions are missing**, follow the manual database setup below

### Step 4: Complete Setup

1. **Click "Run Complete Setup"** to verify everything is working
2. **Click "Open Application"** to go to the main app
3. **Navigate to `/setup`** to create your first organization

## 🛠️ Manual Database Setup (If Needed)

If the automatic setup doesn't work, you may need to manually set up the database:

### Option 1: Using Supabase Dashboard

1. **Go to your Supabase Dashboard**
2. **Navigate to SQL Editor**
3. **Run the emergency scripts**:

```sql
-- First, run the subscription plans script
-- Copy and paste the contents of emergency_seed_plans.sql

-- Then, run the organization function script
-- Copy and paste the contents of emergency_create_organization_function.sql
```

### Option 2: Using Supabase CLI

```bash
# Install Supabase CLI (if not already installed)
npm install -g @supabase/cli

# Link to your project
supabase link --project-ref eoxeoyyunhsdvjiwkttx

# Push the migrations
supabase db push
```

## 📊 Subscription Plans Overview

The system includes 3 subscription plans:

### 🚀 Starter Plan - $29/month
- **Perfect for**: Small salons just getting started
- **Users**: Up to 5
- **Locations**: 1
- **Features**:
  - Appointments management
  - Client management
  - Staff management
  - Services management
  - Basic reports
  - Job cards
  - Invoices

### 💼 Professional Plan - $59/month
- **Perfect for**: Growing salons with multiple staff
- **Users**: Up to 25
- **Locations**: 3
- **Features**: Everything in Starter +
  - Inventory management
  - Advanced reports
  - POS system
  - Accounting
  - Analytics
  - Multi-location support

### 👑 Enterprise Plan - $99/month
- **Perfect for**: Large salon chains
- **Users**: Up to 100
- **Locations**: 10
- **Features**: Everything in Professional +
  - API access
  - White label options
  - Priority support
  - Custom branding
  - Advanced permissions
  - Data export

## 🏢 Organization Setup Process

### How It Works

1. **User Registration**: Users sign up for an account
2. **Organization Creation**: Users create their salon organization
3. **Plan Selection**: Users choose a subscription plan
4. **Trial Period**: 14-day free trial starts automatically
5. **Dashboard Access**: Users can start using the system

### Organization Creation Flow

```
Register → Login → Setup Organization → Select Plan → Create → Dashboard
```

### Database Tables Involved

- `subscription_plans` - Available subscription plans
- `organizations` - Organization details
- `organization_users` - User-organization relationships
- `organization_subscriptions` - Active subscriptions

## 🔧 Troubleshooting

### Issue: "No subscription plans available"

**Solution**:
1. Run the setup script: `http://localhost:8080/setup.html`
2. Click "Set up Subscription Plans"
3. Verify plans exist in the database

### Issue: "Failed to create organization"

**Solution**:
1. Check if the `create_organization_with_user` function exists
2. Run the emergency organization function script
3. Verify RLS policies are set up correctly

### Issue: "Permission denied"

**Solution**:
1. Ensure user is authenticated
2. Check RLS policies on tables
3. Verify user has proper permissions

### Issue: "Database connection failed"

**Solution**:
1. Check Supabase project status
2. Verify environment variables
3. Ensure network connectivity

## 🧪 Testing the Setup

### Test Subscription Plans

1. **Navigate to** `/debug/plans` or `/test-plans`
2. **Verify** 3 plans are displayed
3. **Check** plan features and pricing

### Test Organization Creation

1. **Navigate to** `/setup`
2. **Fill in** organization details
3. **Select** a subscription plan
4. **Create** the organization
5. **Verify** redirect to dashboard

### Test Database Functions

```javascript
// Run in browser console
const { data, error } = await supabase
  .from('subscription_plans')
  .select('*')
  .eq('is_active', true);

console.log('Plans:', data);
console.log('Error:', error);
```

## 📁 File Structure

```
├── setup.html                    # Setup page for subscription plans
├── setup-complete.js             # Complete setup script
├── setup-plans-browser.js        # Browser-compatible setup script
├── emergency_seed_plans.sql      # Emergency subscription plans SQL
├── emergency_create_organization_function.sql  # Emergency org function SQL
├── src/pages/
│   ├── OrganizationSetup.tsx     # Organization setup component
│   └── TestPlans.tsx            # Test plans page
└── supabase/migrations/          # Database migrations
```

## 🎉 Success Indicators

After successful setup, you should see:

✅ **3 subscription plans** available during organization setup
✅ **Organization creation** works without errors
✅ **User is redirected** to dashboard after setup
✅ **Trial subscription** is created automatically
✅ **All database tables** are accessible

## 🆘 Getting Help

If you encounter issues:

1. **Check the console** for error messages
2. **Use the setup page** at `http://localhost:8080/setup.html`
3. **Review the troubleshooting** section above
4. **Check the documentation** files in the project

## 🚀 Next Steps

Once setup is complete:

1. **Create your first organization**
2. **Add staff members**
3. **Set up services and inventory**
4. **Start managing appointments**
5. **Explore all features**

---

**🎯 Goal**: Get your salon management system up and running with subscription plans and organization setup working perfectly!