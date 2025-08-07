// Browser-compatible script to set up subscription plans
// Run this in the browser console on your app

const SUPABASE_URL = "https://eoxeoyyunhsdvjiwkttx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVveGVveXl1bmhzZHZqaXdrdHR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NzI3NDUsImV4cCI6MjA2OTU0ODc0NX0.d3uazVxwI1_kPoF-QAGChcbfKS9PxwB536HrrlCXUrE";

// Create Supabase client
const { createClient } = window.supabase || require('@supabase/supabase-js');
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function setupSubscriptionPlans() {
  console.log('🚀 Setting up subscription plans...');
  
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

    console.log('🎉 Subscription plans setup completed!');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

// Run the setup
setupSubscriptionPlans();