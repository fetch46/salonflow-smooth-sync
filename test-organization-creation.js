import { createClient } from '@supabase/supabase-js';

// Use the same configuration as the app
const SUPABASE_URL = "https://eoxeoyyunhsdvjiwkttx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVveGVveXl1bmhzZHZqaXdrdHR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NzI3NDUsImV4cCI6MjA2OTU0ODc0NX0.d3uazVxwI1_kPoF-QAGChcbfKS9PxwB536HrrlCXUrE";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function testOrganizationCreation() {
  console.log('🔍 Testing Organization Creation...');
  console.log('=====================================');

  try {
    // Step 1: Check if subscription plans exist
    console.log('\n📋 Step 1: Checking subscription plans...');
    const { data: plans, error: plansError } = await supabase
      .from('subscription_plans')
      .select('id, name, slug, is_active')
      .eq('is_active', true);

    if (plansError) {
      console.error('❌ Error checking plans:', plansError);
      console.log('This suggests the subscription_plans table might not exist or have RLS issues.');
    } else if (plans && plans.length > 0) {
      console.log(`✅ Found ${plans.length} subscription plans:`);
      plans.forEach(plan => {
        console.log(`   - ${plan.name} (${plan.slug}) - ID: ${plan.id}`);
      });
    } else {
      console.log('⚠️  No subscription plans found');
    }

    // Step 2: Check if organizations table exists
    console.log('\n📋 Step 2: Checking organizations table...');
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('id, name, slug')
      .limit(1);

    if (orgsError) {
      console.error('❌ Error checking organizations:', orgsError);
      console.log('This suggests the organizations table might not exist or have RLS issues.');
    } else {
      console.log(`✅ Organizations table accessible. Found ${orgs?.length || 0} organizations.`);
    }

    // Step 3: Check if database functions exist
    console.log('\n📋 Step 3: Testing database functions...');
    
    try {
      const { error: funcError } = await supabase.rpc('create_organization_with_user', {
        org_name: 'test-org',
        org_slug: 'test-org-slug',
        org_settings: {},
        plan_id: null
      });
      
      if (funcError) {
        if (funcError.message.includes('function create_organization_with_user does not exist')) {
          console.log('❌ create_organization_with_user function does not exist');
          console.log('This function is required for organization creation.');
        } else {
          console.log('⚠️  Function exists but failed:', funcError.message);
          console.log('This might be due to authentication or validation issues.');
        }
      } else {
        console.log('✅ create_organization_with_user function works');
      }
    } catch (error) {
      console.log('❌ Could not test function:', error.message);
    }

    // Step 4: Check authentication state
    console.log('\n📋 Step 4: Checking authentication...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error('❌ Auth error:', authError);
    } else if (user) {
      console.log(`✅ User authenticated: ${user.email} (${user.id})`);
    } else {
      console.log('⚠️  No user authenticated');
      console.log('Organization creation requires authentication.');
    }

    // Step 5: Check if we can read organization_users
    console.log('\n📋 Step 5: Checking organization_users table...');
    const { data: orgUsers, error: orgUsersError } = await supabase
      .from('organization_users')
      .select('organization_id, user_id, role')
      .limit(1);

    if (orgUsersError) {
      console.error('❌ Error checking organization_users:', orgUsersError);
    } else {
      console.log(`✅ organization_users table accessible. Found ${orgUsers?.length || 0} records.`);
    }

    // Step 6: Check if we can read organization_subscriptions
    console.log('\n📋 Step 6: Checking organization_subscriptions table...');
    const { data: subscriptions, error: subsError } = await supabase
      .from('organization_subscriptions')
      .select('organization_id, plan_id, status')
      .limit(1);

    if (subsError) {
      console.error('❌ Error checking organization_subscriptions:', subsError);
    } else {
      console.log(`✅ organization_subscriptions table accessible. Found ${subscriptions?.length || 0} records.`);
    }

    console.log('\n🎯 Summary:');
    console.log('===========');
    
    if (plans && plans.length > 0) {
      console.log('✅ Subscription plans: Available');
    } else {
      console.log('❌ Subscription plans: Missing');
    }
    
    if (!orgsError) {
      console.log('✅ Organizations table: Accessible');
    } else {
      console.log('❌ Organizations table: Not accessible');
    }
    
    if (user) {
      console.log('✅ Authentication: User logged in');
    } else {
      console.log('❌ Authentication: No user logged in');
    }

    console.log('\n📋 Next Steps:');
    if (!plans || plans.length === 0) {
      console.log('1. Set up subscription plans in the database');
    }
    if (orgsError) {
      console.log('2. Ensure organizations table exists and RLS is configured');
    }
    if (!user) {
      console.log('3. Log in to create an organization');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testOrganizationCreation();