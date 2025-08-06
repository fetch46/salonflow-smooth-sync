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

async function setupSubscriptionPlans() {
  console.log('🚀 Setting up subscription plans...');

  try {
    // Check if plans already exist
    const { data: existingPlans, error: checkError } = await supabase
      .from('subscription_plans')
      .select('id, name, slug')
      .eq('is_active', true);

    if (checkError) {
      console.error('❌ Error checking existing plans:', checkError);
      return;
    }

    if (existingPlans && existingPlans.length > 0) {
      console.log(`✅ Found ${existingPlans.length} existing plans:`);
      existingPlans.forEach(plan => {
        console.log(`   - ${plan.name} (${plan.slug})`);
      });
      return;
    }

    // Insert default subscription plans
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

    console.log('📝 Inserting subscription plans...');

    const { data: insertedPlans, error: insertError } = await supabase
      .from('subscription_plans')
      .insert(plans)
      .select('id, name, slug, price_monthly, price_yearly');

    if (insertError) {
      console.error('❌ Error inserting plans:', insertError);
      return;
    }

    console.log('✅ Successfully created subscription plans:');
    insertedPlans.forEach(plan => {
      const monthlyPrice = (plan.price_monthly / 100).toFixed(0);
      const yearlyPrice = (plan.price_yearly / 100).toFixed(0);
      console.log(`   - ${plan.name} (${plan.slug}): $${monthlyPrice}/month, $${yearlyPrice}/year`);
    });

    console.log('\n🎉 Subscription plans setup complete!');
    console.log('You can now create organizations with these plans.');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the setup
setupSubscriptionPlans();