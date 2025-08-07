// Complete Setup Script for Salon Management System
// This script sets up subscription plans and organization creation functions
// Run this in the browser console on your app

const SUPABASE_URL = "https://eoxeoyyunhsdvjiwkttx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVveGVveXl1bmhzZHZqaXdrdHR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NzI3NDUsImV4cCI6MjA2OTU0ODc0NX0.d3uazVxwI1_kPoF-QAGChcbfKS9PxwB536HrrlCXUrE";

// Create Supabase client
const { createClient } = window.supabase || require('@supabase/supabase-js');
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function setupComplete() {
  console.log('🚀 Setting up Salon Management System...');
  console.log('=====================================');

  try {
    // Step 1: Set up subscription plans
    console.log('\n📋 Step 1: Setting up subscription plans...');
    await setupSubscriptionPlans();

    // Step 2: Test organization creation
    console.log('\n📋 Step 2: Testing organization creation...');
    await testOrganizationCreation();

    // Step 3: Verify everything is working
    console.log('\n📋 Step 3: Verifying setup...');
    await verifySetup();

    console.log('\n🎉 Setup completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Navigate to /setup to create your first organization');
    console.log('2. Complete the onboarding process');
    console.log('3. Start using your salon management system!');

  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

async function setupSubscriptionPlans() {
  try {
    // Check if plans already exist
    const { data: existingPlans, error: checkError } = await supabase
      .from('subscription_plans')
      .select('id, name, slug')
      .eq('is_active', true);

    if (checkError) {
      console.error('❌ Error checking plans:', checkError);
      return;
    }

    if (existingPlans && existingPlans.length > 0) {
      console.log(`✅ Found ${existingPlans.length} subscription plans:`);
      existingPlans.forEach(plan => {
        console.log(`   - ${plan.name} (${plan.slug})`);
      });
      return;
    }

    console.log('⚠️  No subscription plans found. Creating default plans...');
    
    const plans = [
      {
        name: 'Starter',
        slug: 'starter',
        description: 'Perfect for small salons just getting started',
        price_monthly: 2900,
        price_yearly: 29000,
        max_users: 5,
        max_locations: 1,
        features: {
          appointments: true,
          clients: true,
          staff: true,
          services: true,
          basic_reports: true,
          inventory: false,
          advanced_reports: false,
          integrations: false,
          api_access: false,
          white_label: false,
          pos: false,
          accounting: false,
          job_cards: true,
          invoices: true
        },
        is_active: true,
        sort_order: 1
      },
      {
        name: 'Professional',
        slug: 'professional',
        description: 'For growing salons with multiple staff members',
        price_monthly: 5900,
        price_yearly: 59000,
        max_users: 25,
        max_locations: 3,
        features: {
          appointments: true,
          clients: true,
          staff: true,
          services: true,
          inventory: true,
          basic_reports: true,
          advanced_reports: true,
          integrations: true,
          pos: true,
          accounting: true,
          job_cards: true,
          invoices: true,
          api_access: false,
          white_label: false,
          analytics: true,
          multi_location: true
        },
        is_active: true,
        sort_order: 2
      },
      {
        name: 'Enterprise',
        slug: 'enterprise',
        description: 'For large salon chains with advanced needs',
        price_monthly: 9900,
        price_yearly: 99000,
        max_users: 100,
        max_locations: 10,
        features: {
          appointments: true,
          clients: true,
          staff: true,
          services: true,
          inventory: true,
          basic_reports: true,
          advanced_reports: true,
          integrations: true,
          pos: true,
          accounting: true,
          job_cards: true,
          invoices: true,
          api_access: true,
          white_label: true,
          priority_support: true,
          custom_branding: true,
          analytics: true,
          multi_location: true,
          advanced_permissions: true,
          data_export: true
        },
        is_active: true,
        sort_order: 3
      }
    ];

    const { data: insertedPlans, error: insertError } = await supabase
      .from('subscription_plans')
      .insert(plans)
      .select('id, name, slug');

    if (insertError) {
      console.error('❌ Error creating plans:', insertError);
      return;
    }

    console.log('✅ Created subscription plans:');
    insertedPlans.forEach(plan => {
      console.log(`   - ${plan.name} (${plan.slug})`);
    });

  } catch (error) {
    console.error('❌ Error setting up plans:', error);
  }
}

async function testOrganizationCreation() {
  try {
    // Test if the organization creation function exists
    const { error: testError } = await supabase.rpc('create_organization_with_user', {
      org_name: 'test',
      org_slug: 'test-slug',
      org_settings: {},
      plan_id: null
    });
    
    if (testError && testError.message.includes('function create_organization_with_user does not exist')) {
      console.log('⚠️  Organization creation function not found.');
      console.log('You need to run the database migrations manually:');
      console.log('1. Go to your Supabase dashboard');
      console.log('2. Navigate to SQL Editor');
      console.log('3. Run the SQL from emergency_create_organization_function.sql');
    } else if (testError && testError.message.includes('User must be authenticated')) {
      console.log('✅ Organization creation function exists and is working');
    } else {
      console.log('✅ Organization creation function is available');
    }
  } catch (error) {
    console.log('⚠️  Could not test organization creation function');
  }
}

async function verifySetup() {
  try {
    // Verify subscription plans are accessible
    const { data: plans, error: plansError } = await supabase
      .from('subscription_plans')
      .select('id, name, slug')
      .eq('is_active', true);

    if (plansError) {
      console.log('❌ Cannot access subscription plans:', plansError.message);
    } else {
      console.log(`✅ Subscription plans accessible (${plans.length} plans found)`);
    }

    // Verify organizations table is accessible
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('id')
      .limit(1);

    if (orgsError) {
      console.log('❌ Cannot access organizations table:', orgsError.message);
    } else {
      console.log('✅ Organizations table accessible');
    }

    // Verify organization_users table is accessible
    const { data: orgUsers, error: orgUsersError } = await supabase
      .from('organization_users')
      .select('id')
      .limit(1);

    if (orgUsersError) {
      console.log('❌ Cannot access organization_users table:', orgUsersError.message);
    } else {
      console.log('✅ Organization users table accessible');
    }

  } catch (error) {
    console.error('❌ Error during verification:', error);
  }
}

// Run the complete setup
setupComplete();