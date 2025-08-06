const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   VITE_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupDatabaseFunctions() {
  console.log('🚀 Setting up database functions...');

  try {
    // Test if the function already exists
    console.log('🔍 Testing if create_organization_with_user function exists...');
    
    try {
      const { error: testError } = await supabase.rpc('create_organization_with_user', {
        org_name: 'test',
        org_slug: 'test-slug',
        org_settings: {},
        plan_id: null
      });
      
      // If we get here, the function exists (even if it fails due to validation)
      if (testError && !testError.message.includes('function create_organization_with_user does not exist')) {
        console.log('✅ create_organization_with_user function exists');
        return;
      }
    } catch (error) {
      // Function doesn't exist, we need to create it
    }

    console.log('📝 Creating database functions...');

    // Create the organization creation function
    const createOrgFunction = `
      CREATE OR REPLACE FUNCTION create_organization_with_user(
        org_name TEXT,
        org_slug TEXT,
        org_settings JSONB DEFAULT '{}',
        plan_id UUID DEFAULT NULL
      )
      RETURNS UUID AS $$
      DECLARE
        new_org_id UUID;
        user_id UUID;
      BEGIN
        -- Get the current user
        user_id := auth.uid();
        
        IF user_id IS NULL THEN
          RAISE EXCEPTION 'User must be authenticated';
        END IF;
        
        -- Create the organization
        INSERT INTO organizations (name, slug, settings)
        VALUES (org_name, org_slug, org_settings)
        RETURNING id INTO new_org_id;
        
        -- Add the user as owner
        INSERT INTO organization_users (organization_id, user_id, role, is_active)
        VALUES (new_org_id, user_id, 'owner', true);
        
        -- Create a subscription if plan_id is provided
        IF plan_id IS NOT NULL THEN
          INSERT INTO organization_subscriptions (organization_id, plan_id, status, interval)
          VALUES (new_org_id, plan_id, 'trial', 'month');
        END IF;
        
        RETURN new_org_id;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;

    // Create the organization setup function
    const setupOrgFunction = `
      CREATE OR REPLACE FUNCTION setup_new_organization(org_id UUID)
      RETURNS BOOLEAN AS $$
      DECLARE
        user_id UUID;
      BEGIN
        user_id := auth.uid();
        
        IF user_id IS NULL THEN
          RAISE EXCEPTION 'User must be authenticated';
        END IF;
        
        -- Verify user is owner of this organization
        IF NOT EXISTS (
          SELECT 1 FROM organization_users 
          WHERE organization_id = org_id 
          AND user_id = user_id 
          AND role = 'owner' 
          AND is_active = true
        ) THEN
          RAISE EXCEPTION 'User must be owner of organization';
        END IF;
        
        -- Create default accounts
        INSERT INTO accounts (organization_id, account_code, account_name, account_type, normal_balance, description, balance, is_active) VALUES 
          (org_id, '1001', 'Cash', 'Asset', 'debit', 'Cash on hand and in registers', 0, true),
          (org_id, '1002', 'Bank Account', 'Asset', 'debit', 'Primary business bank account', 0, true),
          (org_id, '1100', 'Accounts Receivable', 'Asset', 'debit', 'Money owed by customers', 0, true),
          (org_id, '1200', 'Inventory', 'Asset', 'debit', 'Hair products and supplies inventory', 0, true),
          (org_id, '1500', 'Equipment', 'Asset', 'debit', 'Salon equipment and fixtures', 0, true),
          (org_id, '2001', 'Accounts Payable', 'Liability', 'credit', 'Money owed to suppliers', 0, true),
          (org_id, '2100', 'Sales Tax Payable', 'Liability', 'credit', 'Sales tax collected from customers', 0, true),
          (org_id, '3001', 'Owner Equity', 'Equity', 'credit', 'Owner investment in business', 0, true),
          (org_id, '3002', 'Retained Earnings', 'Equity', 'credit', 'Accumulated business profits', 0, true),
          (org_id, '4001', 'Hair Services Revenue', 'Income', 'credit', 'Revenue from hair styling services', 0, true),
          (org_id, '4002', 'Product Sales Revenue', 'Income', 'credit', 'Revenue from product sales', 0, true),
          (org_id, '5001', 'Cost of Goods Sold', 'Expense', 'debit', 'Direct cost of products sold', 0, true),
          (org_id, '5100', 'Staff Wages', 'Expense', 'debit', 'Salaries and wages for staff', 0, true),
          (org_id, '5200', 'Rent Expense', 'Expense', 'debit', 'Monthly rent for salon space', 0, true),
          (org_id, '5300', 'Utilities Expense', 'Expense', 'debit', 'Electricity, water, internet', 0, true),
          (org_id, '5400', 'Supplies Expense', 'Expense', 'debit', 'General salon supplies', 0, true),
          (org_id, '5500', 'Marketing Expense', 'Expense', 'debit', 'Advertising and promotion costs', 0, true)
        ON CONFLICT (account_code) DO NOTHING;
        
        RETURN true;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;

    // Execute the function creation
    const { error: createOrgError } = await supabase.rpc('exec_sql', { sql: createOrgFunction });
    if (createOrgError) {
      console.error('❌ Error creating create_organization_with_user function:', createOrgError);
      console.log('Note: You may need to create this function manually in your Supabase dashboard');
      return;
    }

    const { error: setupOrgError } = await supabase.rpc('exec_sql', { sql: setupOrgFunction });
    if (setupOrgError) {
      console.error('❌ Error creating setup_new_organization function:', setupOrgError);
      console.log('Note: You may need to create this function manually in your Supabase dashboard');
      return;
    }

    console.log('✅ Database functions created successfully!');
    console.log('   - create_organization_with_user');
    console.log('   - setup_new_organization');

  } catch (error) {
    console.error('❌ Error setting up database functions:', error);
    console.log('\n📋 Manual Setup Instructions:');
    console.log('1. Go to your Supabase dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Run the SQL from setup_database.sql');
  }
}

// Run the setup
setupDatabaseFunctions();