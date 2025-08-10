import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   VITE_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  console.log('\n📋 Please set up your environment variables:');
  console.log('1. Copy .env.example to .env');
  console.log('2. Add your Supabase URL and service role key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupApplication() {
  console.log('🚀 Setting up Salon Management System...');
  console.log('=====================================');

  try {
    // Step 1: Check if subscription plans exist
    console.log('\n📋 Step 1: Checking subscription plans...');
    const { data: existingPlans, error: checkError } = await supabase
      .from('subscription_plans')
      .select('id, name, slug')
      .eq('is_active', true);

    if (checkError) {
      console.error('❌ Error checking plans:', checkError);
      console.log('This might mean the database tables are not set up yet.');
      console.log('Please run the database migrations first.');
      return;
    }

    if (existingPlans && existingPlans.length > 0) {
      console.log(`✅ Found ${existingPlans.length} subscription plans:`);
      existingPlans.forEach(plan => {
        console.log(`   - ${plan.name} (${plan.slug})`);
      });
    } else {
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
            inventory: false
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
            pos: true,
            accounting: true
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
            pos: true,
            accounting: true,
            api_access: true,
            white_label: true
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
    }

    // Step 2: Check if database functions exist
    console.log('\n📋 Step 2: Checking database functions...');
    
    try {
      const { error: testError } = await supabase.rpc('create_organization_with_user', {
        org_name: 'test',
        org_slug: 'test-slug',
        org_settings: {},
        plan_id: null
      });
      
      if (testError && testError.message.includes('function create_organization_with_user does not exist')) {
        console.log('⚠️  Database functions not found.');
        console.log('You need to set up the database functions manually:');
        console.log('1. Go to your Supabase dashboard');
        console.log('2. Navigate to SQL Editor');
        console.log('3. Run the SQL from setup_database.sql');
        console.log('4. Or run the complete migration: 20250116000004_complete_database_schema.sql');
      } else {
        console.log('✅ Database functions are available');
      }
    } catch (error) {
      console.log('⚠️  Could not test database functions');
    }

    // Step 3: Check if business locations exist
console.log('\n📋 Step 3: Checking business locations...');
const { data: locations, error: locationsError } = await supabase
  .from('business_locations')
  .select('id, name')
  .limit(5);

if (locationsError) {
  console.log('⚠️  Could not check business locations:', locationsError.message);
} else if (locations && locations.length > 0) {
  console.log(`✅ Found ${locations.length} business locations`);
} else {
  console.log('⚠️  No business locations found');
  console.log('Default locations will be created when needed');
}

    console.log('\n🎉 Setup check complete!');
    console.log('\n📋 Next steps:');
    console.log('1. Start the development server: npm run dev');
    console.log('2. Navigate to /setup to create your first organization');
    console.log('3. Complete the onboarding process');
    
    if (existingPlans && existingPlans.length > 0) {
      console.log('\n✅ Your application is ready to use!');
    } else {
      console.log('\n⚠️  Please ensure database migrations are run for full functionality');
    }

  } catch (error) {
    console.error('❌ Setup failed:', error);
    console.log('\n📋 Troubleshooting:');
    console.log('1. Check your environment variables');
    console.log('2. Ensure your Supabase project is set up');
    console.log('3. Run database migrations if needed');
  }
}

// Run the setup
setupApplication();