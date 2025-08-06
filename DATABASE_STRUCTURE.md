# Database Structure Documentation

## Overview

This document describes the complete database structure for the Salon Management System. The database is designed as a multi-tenant SaaS application with comprehensive business management features.

## Database Schema

### Core Tables

#### 1. Organizations (Multi-tenant Foundation)
```sql
organizations
├── id (UUID, Primary Key)
├── name (TEXT, Required)
├── slug (TEXT, Unique, Required)
├── domain (TEXT, Optional)
├── logo_url (TEXT, Optional)
├── status (organization_status enum)
├── settings (JSONB)
├── metadata (JSONB)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)
```

#### 2. Organization Users (User Management)
```sql
organization_users
├── id (UUID, Primary Key)
├── organization_id (UUID, Foreign Key)
├── user_id (UUID, Foreign Key to auth.users)
├── role (user_role enum)
├── is_active (BOOLEAN)
├── invited_by (UUID, Optional)
├── invited_at (TIMESTAMPTZ, Optional)
├── joined_at (TIMESTAMPTZ, Optional)
├── metadata (JSONB)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)
```

#### 3. Subscription Management
```sql
subscription_plans
├── id (UUID, Primary Key)
├── name (TEXT, Required)
├── slug (TEXT, Unique, Required)
├── description (TEXT, Optional)
├── price_monthly (INTEGER, in cents)
├── price_yearly (INTEGER, in cents)
├── max_users (INTEGER, Optional)
├── max_locations (INTEGER, Optional)
├── features (JSONB)
├── is_active (BOOLEAN)
├── sort_order (INTEGER)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)

organization_subscriptions
├── id (UUID, Primary Key)
├── organization_id (UUID, Foreign Key)
├── plan_id (UUID, Foreign Key)
├── status (subscription_status enum)
├── interval (plan_interval enum)
├── current_period_start (TIMESTAMPTZ, Optional)
├── current_period_end (TIMESTAMPTZ, Optional)
├── trial_start (TIMESTAMPTZ, Optional)
├── trial_end (TIMESTAMPTZ, Optional)
├── stripe_subscription_id (TEXT, Optional)
├── stripe_customer_id (TEXT, Optional)
├── metadata (JSONB)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)
```

### Business Management Tables

#### 4. Client Management
```sql
clients
├── id (UUID, Primary Key)
├── full_name (TEXT, Required)
├── email (TEXT, Optional)
├── phone (TEXT, Optional)
├── address (TEXT, Optional)
├── date_of_birth (DATE, Optional)
├── client_status (TEXT, Default: 'active')
├── notes (TEXT, Optional)
├── last_visit_date (DATE, Optional)
├── total_visits (INTEGER, Default: 0)
├── total_spent (DECIMAL(10,2), Default: 0)
├── preferred_technician_id (UUID, Foreign Key to staff)
├── organization_id (UUID, Foreign Key, Required)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)
```

#### 5. Staff Management
```sql
staff
├── id (UUID, Primary Key)
├── full_name (TEXT, Required)
├── email (TEXT, Optional)
├── phone (TEXT, Optional)
├── position (TEXT, Optional)
├── hire_date (DATE, Optional)
├── salary (DECIMAL(10,2), Optional)
├── commission_rate (DECIMAL(5,2), Optional)
├── specialties (TEXT, Optional)
├── is_active (BOOLEAN, Default: true)
├── profile_image (TEXT, Optional)
├── organization_id (UUID, Foreign Key, Required)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)
```

#### 6. Service Management
```sql
services
├── id (UUID, Primary Key)
├── name (TEXT, Required)
├── description (TEXT, Optional)
├── category (TEXT, Optional)
├── price (DECIMAL(10,2), Required)
├── duration_minutes (INTEGER, Default: 60)
├── is_active (BOOLEAN, Default: true)
├── organization_id (UUID, Foreign Key, Required)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)
```

#### 7. Appointment Management
```sql
appointments
├── id (UUID, Primary Key)
├── appointment_date (DATE, Required)
├── appointment_time (TIME, Required)
├── client_id (UUID, Foreign Key to clients)
├── staff_id (UUID, Foreign Key to staff)
├── service_id (UUID, Foreign Key to services)
├── duration_minutes (INTEGER, Optional)
├── status (TEXT, Default: 'scheduled')
├── notes (TEXT, Optional)
├── organization_id (UUID, Foreign Key, Required)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)
```

### Inventory Management

#### 8. Inventory Items
```sql
inventory_items
├── id (UUID, Primary Key)
├── name (TEXT, Required)
├── description (TEXT, Optional)
├── sku (TEXT, Optional)
├── category (TEXT, Optional)
├── type (TEXT, Default: 'product')
├── cost_price (DECIMAL(10,2), Optional)
├── selling_price (DECIMAL(10,2), Optional)
├── current_stock (DECIMAL(10,2), Default: 0)
├── minimum_stock (DECIMAL(10,2), Default: 0)
├── unit (TEXT, Optional)
├── is_active (BOOLEAN, Default: true)
├── organization_id (UUID, Foreign Key, Required)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)
```

#### 9. Storage Locations
```sql
storage_locations
├── id (UUID, Primary Key)
├── name (TEXT, Required)
├── description (TEXT, Optional)
├── is_active (BOOLEAN, Default: true)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)
```

#### 10. Inventory Levels
```sql
inventory_levels
├── id (UUID, Primary Key)
├── item_id (UUID, Foreign Key to inventory_items)
├── location_id (UUID, Foreign Key to storage_locations)
├── quantity (DECIMAL(10,2), Default: 0)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)
```

#### 11. Service Kits
```sql
service_kits
├── id (UUID, Primary Key)
├── service_id (UUID, Foreign Key to services)
├── good_id (UUID, Foreign Key to inventory_items)
├── default_quantity (DECIMAL(10,2), Default: 1)
├── organization_id (UUID, Foreign Key, Required)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)
```

### Financial Management

#### 12. Accounting System
```sql
accounts
├── id (UUID, Primary Key)
├── account_code (TEXT, Unique, Required)
├── account_name (TEXT, Required)
├── account_type (TEXT, Required)
├── normal_balance (TEXT, Required)
├── description (TEXT, Optional)
├── balance (DECIMAL(10,2), Default: 0)
├── is_active (BOOLEAN, Default: true)
├── parent_account_id (UUID, Foreign Key to accounts)
├── organization_id (UUID, Foreign Key, Required)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)

account_transactions
├── id (UUID, Primary Key)
├── account_id (UUID, Foreign Key to accounts)
├── transaction_date (DATE, Required)
├── description (TEXT, Required)
├── debit_amount (DECIMAL(10,2), Default: 0)
├── credit_amount (DECIMAL(10,2), Default: 0)
├── reference_type (TEXT, Optional)
├── reference_id (UUID, Optional)
└── created_at (TIMESTAMPTZ)
```

#### 13. Sales Management
```sql
sales
├── id (UUID, Primary Key)
├── sale_number (TEXT, Unique, Required)
├── sale_date (DATE, Required)
├── customer_id (UUID, Foreign Key to clients)
├── staff_id (UUID, Foreign Key to staff)
├── subtotal (DECIMAL(10,2), Default: 0)
├── tax_amount (DECIMAL(10,2), Default: 0)
├── discount_amount (DECIMAL(10,2), Default: 0)
├── total_amount (DECIMAL(10,2), Default: 0)
├── payment_method (TEXT, Optional)
├── organization_id (UUID, Foreign Key, Required)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)

sale_items
├── id (UUID, Primary Key)
├── sale_id (UUID, Foreign Key to sales)
├── product_id (UUID, Foreign Key to inventory_items)
├── quantity (DECIMAL(10,2), Default: 1)
├── unit_price (DECIMAL(10,2), Required)
├── discount_amount (DECIMAL(10,2), Default: 0)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)
```

#### 14. Invoice Management
```sql
invoices
├── id (UUID, Primary Key)
├── invoice_number (TEXT, Unique, Required)
├── customer_id (UUID, Foreign Key to clients)
├── customer_name (TEXT, Required)
├── customer_email (TEXT, Optional)
├── customer_phone (TEXT, Optional)
├── subtotal (DECIMAL(10,2), Default: 0)
├── tax_amount (DECIMAL(10,2), Default: 0)
├── discount_amount (DECIMAL(10,2), Default: 0)
├── total_amount (DECIMAL(10,2), Default: 0)
├── status (TEXT, Default: 'draft')
├── due_date (DATE, Optional)
├── payment_method (TEXT, Optional)
├── notes (TEXT, Optional)
├── jobcard_id (UUID, Foreign Key to job_cards)
├── organization_id (UUID, Foreign Key, Required)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)

invoice_items
├── id (UUID, Primary Key)
├── invoice_id (UUID, Foreign Key to invoices)
├── service_id (UUID, Foreign Key to services)
├── product_id (UUID, Foreign Key to inventory_items)
├── description (TEXT, Required)
├── quantity (DECIMAL(10,2), Default: 1)
├── unit_price (DECIMAL(10,2), Required)
├── discount_percentage (DECIMAL(5,2), Default: 0)
├── staff_id (UUID, Foreign Key to staff)
├── commission_percentage (DECIMAL(5,2), Default: 0)
├── total_price (DECIMAL(10,2), Required)
└── created_at (TIMESTAMPTZ)
```

#### 15. Expense Management
```sql
expenses
├── id (UUID, Primary Key)
├── expense_number (TEXT, Unique, Required)
├── expense_date (DATE, Required)
├── amount (DECIMAL(10,2), Required)
├── category (TEXT, Optional)
├── description (TEXT, Optional)
├── supplier_id (UUID, Foreign Key to suppliers)
├── receipt_url (TEXT, Optional)
├── organization_id (UUID, Foreign Key, Required)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)
```

#### 16. Purchase Management
```sql
purchases
├── id (UUID, Primary Key)
├── purchase_number (TEXT, Unique, Required)
├── purchase_date (DATE, Required)
├── supplier_id (UUID, Foreign Key to suppliers)
├── total_amount (DECIMAL(10,2), Required)
├── status (TEXT, Default: 'pending')
├── organization_id (UUID, Foreign Key, Required)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)

purchase_items
├── id (UUID, Primary Key)
├── purchase_id (UUID, Foreign Key to purchases)
├── item_id (UUID, Foreign Key to inventory_items)
├── quantity (DECIMAL(10,2), Required)
├── received_quantity (DECIMAL(10,2), Default: 0)
├── unit_cost (DECIMAL(10,2), Required)
├── total_cost (DECIMAL(10,2), Required)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)
```

#### 17. Supplier Management
```sql
suppliers
├── id (UUID, Primary Key)
├── name (TEXT, Required)
├── contact_name (TEXT, Optional)
├── contact_email (TEXT, Optional)
├── contact_phone (TEXT, Optional)
├── payment_terms (TEXT, Optional)
├── supplier_type (TEXT, Optional)
├── rating (INTEGER, Default: 5)
├── organization_id (UUID, Foreign Key, Required)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)
```

### Operations Management

#### 18. Job Cards
```sql
job_cards
├── id (UUID, Primary Key)
├── job_number (TEXT, Unique, Required)
├── client_id (UUID, Foreign Key to clients)
├── staff_id (UUID, Foreign Key to staff)
├── start_time (TIMESTAMPTZ, Optional)
├── end_time (TIMESTAMPTZ, Optional)
├── status (TEXT, Default: 'in_progress')
├── total_amount (DECIMAL(10,2), Default: 0)
├── organization_id (UUID, Foreign Key, Required)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)

job_card_products
├── id (UUID, Primary Key)
├── job_card_id (UUID, Foreign Key to job_cards)
├── inventory_item_id (UUID, Foreign Key to inventory_items)
├── quantity_used (DECIMAL(10,2), Required)
├── unit_cost (DECIMAL(10,2), Required)
├── total_cost (DECIMAL(10,2), Required)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)
```

#### 19. Inventory Adjustments
```sql
inventory_adjustments
├── id (UUID, Primary Key)
├── adjustment_number (TEXT, Unique, Required)
├── adjustment_date (DATE, Required)
├── adjustment_type (TEXT, Required)
├── adjustment_reason (TEXT, Optional)
├── status (TEXT, Default: 'pending')
├── notes (TEXT, Optional)
├── organization_id (UUID, Foreign Key, Required)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)

inventory_adjustment_items
├── id (UUID, Primary Key)
├── adjustment_id (UUID, Foreign Key to inventory_adjustments)
├── inventory_item_id (UUID, Foreign Key to inventory_items)
├── quantity_adjusted (DECIMAL(10,2), Required)
├── reason (TEXT, Optional)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)
```

### System Tables

#### 20. User Profiles
```sql
profiles
├── id (UUID, Primary Key, References auth.users)
├── email (TEXT, Optional)
├── full_name (TEXT, Optional)
├── avatar_url (TEXT, Optional)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)
```

#### 21. User Invitations
```sql
user_invitations
├── id (UUID, Primary Key)
├── organization_id (UUID, Foreign Key to organizations)
├── email (TEXT, Required)
├── role (user_role enum, Default: 'staff')
├── invited_by (UUID, Foreign Key to auth.users, Required)
├── token (TEXT, Unique, Required)
├── expires_at (TIMESTAMPTZ, Required)
├── accepted_at (TIMESTAMPTZ, Optional)
└── created_at (TIMESTAMPTZ)
```

#### 22. Super Admin Management
```sql
super_admins
├── id (UUID, Primary Key)
├── user_id (UUID, Foreign Key to auth.users, Required)
├── granted_by (UUID, Foreign Key to auth.users, Optional)
├── granted_at (TIMESTAMPTZ, Required)
├── is_active (BOOLEAN, Default: true)
├── permissions (JSONB)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)
```

## Enums

### User Roles
```sql
user_role = 'owner' | 'admin' | 'manager' | 'staff' | 'viewer' | 'super_admin'
```

### Subscription Status
```sql
subscription_status = 'trial' | 'active' | 'past_due' | 'canceled' | 'incomplete'
```

### Plan Interval
```sql
plan_interval = 'month' | 'year'
```

### Organization Status
```sql
organization_status = 'active' | 'suspended' | 'deleted'
```

## Key Functions

### 1. Organization Management
- `create_organization_with_user(org_name, org_slug, org_settings, plan_id)` - Creates organization and assigns user as owner
- `setup_new_organization(org_id)` - Sets up default accounts for new organization

### 2. User Management
- `get_current_user_organization()` - Returns current user's organization ID
- `user_has_role(required_role)` - Checks if user has specific role
- `user_has_min_role(min_role)` - Checks if user has minimum role level

### 3. Super Admin Functions
- `is_super_admin(user_uuid)` - Checks if user is super admin
- `grant_super_admin(target_user_id)` - Grants super admin privileges
- `revoke_super_admin(target_user_id)` - Revokes super admin privileges

## Row Level Security (RLS)

All tables have RLS enabled with tenant-based policies:

1. **Organization-scoped tables**: Users can only access data from their organizations
2. **Role-based access**: Different operations require different role levels
3. **Owner/Admin restrictions**: Delete operations restricted to owners/admins
4. **Profile access**: Users can only access their own profile

## Indexes

Comprehensive indexing strategy for performance:

1. **Primary keys**: All tables have UUID primary keys
2. **Foreign keys**: Indexed for join performance
3. **Organization filtering**: Indexed organization_id columns
4. **Search fields**: Indexed email, phone, name fields
5. **Date fields**: Indexed for time-based queries
6. **Status fields**: Indexed for filtering

## Triggers

### Updated At Triggers
All tables with `updated_at` columns have triggers to automatically update timestamps on record modification.

## Permissions

### Authenticated Users
- Full CRUD access to their organization's data
- Role-based restrictions on operations
- Profile management

### Super Admins
- Access to all organizations
- System-wide management capabilities
- User privilege management

## Data Integrity

### Constraints
- Foreign key constraints ensure referential integrity
- Unique constraints prevent duplicate data
- Check constraints validate data ranges
- NOT NULL constraints ensure required data

### Cascading
- Organization deletion cascades to all related data
- Parent record deletion cascades to child records where appropriate

## Multi-tenancy

The database is designed for multi-tenant SaaS with:

1. **Organization isolation**: All business data is organization-scoped
2. **User management**: Users can belong to multiple organizations
3. **Role-based access**: Different roles within each organization
4. **Subscription management**: Plan-based feature access
5. **Data segregation**: Complete data isolation between tenants

## Setup Instructions

1. Run the complete schema migration: `20250116000004_complete_database_schema.sql`
2. Execute the setup script: `setup_database.sql`
3. Verify all tables, functions, and policies are created
4. Test organization creation and user assignment

## Maintenance

### Regular Tasks
- Monitor index performance
- Review RLS policies
- Update subscription plans
- Backup organization data
- Clean up expired invitations

### Performance Optimization
- Monitor query performance
- Add indexes as needed
- Partition large tables if necessary
- Optimize RLS policies