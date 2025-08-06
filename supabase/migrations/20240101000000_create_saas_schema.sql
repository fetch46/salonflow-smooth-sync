-- SAAS Multi-Tenant Database Schema
-- This migration creates the foundation for a multi-tenant SAAS application

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types for SAAS
CREATE TYPE subscription_status AS ENUM ('trial', 'active', 'past_due', 'canceled', 'incomplete');
CREATE TYPE user_role AS ENUM ('owner', 'admin', 'manager', 'staff', 'viewer');
CREATE TYPE plan_interval AS ENUM ('month', 'year');
CREATE TYPE organization_status AS ENUM ('active', 'suspended', 'deleted');

-- Organizations table (tenants)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    domain TEXT,
    logo_url TEXT,
    status organization_status DEFAULT 'active',
    settings JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscription plans
CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    price_monthly INTEGER NOT NULL, -- in cents
    price_yearly INTEGER NOT NULL, -- in cents
    max_users INTEGER,
    max_locations INTEGER,
    features JSONB DEFAULT '{}', -- feature flags
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization subscriptions
CREATE TABLE organization_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id),
    status subscription_status DEFAULT 'trial',
    interval plan_interval DEFAULT 'month',
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    trial_start TIMESTAMPTZ,
    trial_end TIMESTAMPTZ,
    stripe_subscription_id TEXT,
    stripe_customer_id TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization users (many-to-many with roles)
CREATE TABLE organization_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role DEFAULT 'staff',
    is_active BOOLEAN DEFAULT true,
    invited_by UUID REFERENCES auth.users(id),
    invited_at TIMESTAMPTZ,
    joined_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

-- User invitations
CREATE TABLE user_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role user_role DEFAULT 'staff',
    invited_by UUID NOT NULL REFERENCES auth.users(id),
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Extend existing tables with organization_id for multi-tenancy
ALTER TABLE staff ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE clients ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE services ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE inventory_items ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE service_kits ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE appointments ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE job_cards ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE expenses ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE purchases ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE suppliers ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE accounts ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE sales ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE inventory_adjustments ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Make organization_id NOT NULL for all tenant tables
ALTER TABLE staff ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE clients ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE services ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE inventory_items ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE service_kits ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE appointments ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE job_cards ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE expenses ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE purchases ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE suppliers ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE accounts ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE sales ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE inventory_adjustments ALTER COLUMN organization_id SET NOT NULL;

-- Insert default subscription plans
INSERT INTO subscription_plans (name, slug, description, price_monthly, price_yearly, max_users, max_locations, features) VALUES
('Starter', 'starter', 'Perfect for small salons just getting started', 2900, 29000, 5, 1, '{"appointments": true, "clients": true, "staff": true, "basic_reports": true}'),
('Professional', 'professional', 'For growing salons with multiple staff members', 5900, 59000, 25, 3, '{"appointments": true, "clients": true, "staff": true, "inventory": true, "services": true, "reports": true, "integrations": true}'),
('Enterprise', 'enterprise', 'For large salon chains with advanced needs', 9900, 99000, 100, 10, '{"appointments": true, "clients": true, "staff": true, "inventory": true, "services": true, "advanced_reports": true, "integrations": true, "api_access": true, "white_label": true}');

-- Create indexes for performance
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_status ON organizations(status);
CREATE INDEX idx_organization_subscriptions_org_id ON organization_subscriptions(organization_id);
CREATE INDEX idx_organization_subscriptions_status ON organization_subscriptions(status);
CREATE INDEX idx_organization_users_org_id ON organization_users(organization_id);
CREATE INDEX idx_organization_users_user_id ON organization_users(user_id);
CREATE INDEX idx_user_invitations_org_id ON user_invitations(organization_id);
CREATE INDEX idx_user_invitations_token ON user_invitations(token);
CREATE INDEX idx_user_invitations_email ON user_invitations(email);

-- Add organization_id indexes to all tenant tables
CREATE INDEX idx_staff_organization_id ON staff(organization_id);
CREATE INDEX idx_clients_organization_id ON clients(organization_id);
CREATE INDEX idx_services_organization_id ON services(organization_id);
CREATE INDEX idx_inventory_items_organization_id ON inventory_items(organization_id);
CREATE INDEX idx_service_kits_organization_id ON service_kits(organization_id);
CREATE INDEX idx_appointments_organization_id ON appointments(organization_id);
CREATE INDEX idx_job_cards_organization_id ON job_cards(organization_id);
CREATE INDEX idx_expenses_organization_id ON expenses(organization_id);
CREATE INDEX idx_purchases_organization_id ON purchases(organization_id);
CREATE INDEX idx_suppliers_organization_id ON suppliers(organization_id);
CREATE INDEX idx_accounts_organization_id ON accounts(organization_id);
CREATE INDEX idx_sales_organization_id ON sales(organization_id);
CREATE INDEX idx_inventory_adjustments_organization_id ON inventory_adjustments(organization_id);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_adjustments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies

-- Organizations: Users can only see organizations they belong to
CREATE POLICY "Users can view their organizations" ON organizations
    FOR SELECT
    USING (
        id IN (
            SELECT organization_id 
            FROM organization_users 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Organization admins can update their organization" ON organizations
    FOR UPDATE
    USING (
        id IN (
            SELECT organization_id 
            FROM organization_users 
            WHERE user_id = auth.uid() 
            AND role IN ('owner', 'admin') 
            AND is_active = true
        )
    );

-- Organization subscriptions: Users can view their organization's subscription
CREATE POLICY "Users can view their organization subscription" ON organization_subscriptions
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id 
            FROM organization_users 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- Organization users: Users can view users in their organization
CREATE POLICY "Users can view organization members" ON organization_users
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id 
            FROM organization_users 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- Generic tenant data policy template
CREATE OR REPLACE FUNCTION create_tenant_policy(table_name text)
RETURNS void AS $$
BEGIN
    -- Policy for SELECT
    EXECUTE format('
        CREATE POLICY "Users can view their organization data" ON %I
        FOR SELECT
        USING (
            organization_id IN (
                SELECT organization_id 
                FROM organization_users 
                WHERE user_id = auth.uid() AND is_active = true
            )
        )', table_name);
    
    -- Policy for INSERT
    EXECUTE format('
        CREATE POLICY "Users can insert data for their organization" ON %I
        FOR INSERT
        WITH CHECK (
            organization_id IN (
                SELECT organization_id 
                FROM organization_users 
                WHERE user_id = auth.uid() 
                AND role IN (''owner'', ''admin'', ''manager'', ''staff'')
                AND is_active = true
            )
        )', table_name);
    
    -- Policy for UPDATE
    EXECUTE format('
        CREATE POLICY "Users can update their organization data" ON %I
        FOR UPDATE
        USING (
            organization_id IN (
                SELECT organization_id 
                FROM organization_users 
                WHERE user_id = auth.uid() 
                AND role IN (''owner'', ''admin'', ''manager'', ''staff'')
                AND is_active = true
            )
        )', table_name);
    
    -- Policy for DELETE (restricted to admins)
    EXECUTE format('
        CREATE POLICY "Admins can delete their organization data" ON %I
        FOR DELETE
        USING (
            organization_id IN (
                SELECT organization_id 
                FROM organization_users 
                WHERE user_id = auth.uid() 
                AND role IN (''owner'', ''admin'')
                AND is_active = true
            )
        )', table_name);
END;
$$ LANGUAGE plpgsql;

-- Apply tenant policies to all tables
SELECT create_tenant_policy('staff');
SELECT create_tenant_policy('clients');
SELECT create_tenant_policy('services');
SELECT create_tenant_policy('inventory_items');
SELECT create_tenant_policy('service_kits');
SELECT create_tenant_policy('appointments');
SELECT create_tenant_policy('job_cards');
SELECT create_tenant_policy('expenses');
SELECT create_tenant_policy('purchases');
SELECT create_tenant_policy('suppliers');
SELECT create_tenant_policy('accounts');
SELECT create_tenant_policy('sales');
SELECT create_tenant_policy('inventory_adjustments');

-- Create helper functions

-- Function to get current user's organization
CREATE OR REPLACE FUNCTION get_current_user_organization()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT organization_id 
        FROM organization_users 
        WHERE user_id = auth.uid() 
        AND is_active = true 
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has specific role
CREATE OR REPLACE FUNCTION user_has_role(required_role user_role)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM organization_users 
        WHERE user_id = auth.uid() 
        AND role = required_role 
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has minimum role level
CREATE OR REPLACE FUNCTION user_has_min_role(min_role user_role)
RETURNS BOOLEAN AS $$
DECLARE
    user_role_level INTEGER;
    min_role_level INTEGER;
BEGIN
    -- Define role hierarchy levels
    user_role_level := CASE (
        SELECT role 
        FROM organization_users 
        WHERE user_id = auth.uid() 
        AND is_active = true 
        LIMIT 1
    )
        WHEN 'owner' THEN 5
        WHEN 'admin' THEN 4
        WHEN 'manager' THEN 3
        WHEN 'staff' THEN 2
        WHEN 'viewer' THEN 1
        ELSE 0
    END;
    
    min_role_level := CASE min_role
        WHEN 'owner' THEN 5
        WHEN 'admin' THEN 4
        WHEN 'manager' THEN 3
        WHEN 'staff' THEN 2
        WHEN 'viewer' THEN 1
        ELSE 0
    END;
    
    RETURN user_role_level >= min_role_level;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organizations_updated_at 
    BEFORE UPDATE ON organizations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscription_plans_updated_at 
    BEFORE UPDATE ON subscription_plans 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organization_subscriptions_updated_at 
    BEFORE UPDATE ON organization_subscriptions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organization_users_updated_at 
    BEFORE UPDATE ON organization_users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Drop the helper function (no longer needed after setup)
DROP FUNCTION create_tenant_policy(text);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON subscription_plans TO authenticated;
GRANT ALL ON organizations TO authenticated;
GRANT ALL ON organization_subscriptions TO authenticated;
GRANT ALL ON organization_users TO authenticated;
GRANT ALL ON user_invitations TO authenticated;