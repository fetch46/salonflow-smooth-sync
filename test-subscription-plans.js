import { createClient } from '@supabase/supabase-js';

// Use the same configuration as the app
const SUPABASE_URL = "https://eoxeoyyunhsdvjiwkttx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVveGVveXl1bmhzZHZqaXdrdHR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NzI3NDUsImV4cCI6MjA2OTU0ODc0NX0.d3uazVxwI1_kPoF-QAGChcbfKS9PxwB536HrrlCXUrE";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function testSubscriptionPlans() {
  console.log('🔍 Testing Subscription Plans Issue');
  console.log('====================================');

  try {
    // Step 1: Check authentication
    console.log('\n📋 Step 1: Checking authentication...');
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.error('❌ Auth error:', userError);
      console.log('💡 Solution: User needs to be logged in to access subscription plans');
      return;
    }

    if (!user) {
      console.log('❌ No user logged in');
      console.log('💡 Solution: User needs to be logged in to access subscription plans');
      return;
    }

    console.log(`✅ User authenticated: ${user.email} (${user.id})`);

    // Step 2: Test subscription plans query
    console.log('\n📋 Step 2: Testing subscription plans query...');
    const { data: plans, error: plansError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    if (plansError) {
      console.error('❌ Plans query error:', plansError);
      console.log('💡 Possible solutions:');
      console.log('   - Check if subscription_plans table exists');
      console.log('   - Check if RLS policies allow access');
      console.log('   - Check if user has proper permissions');
      return;
    }

    if (!plans || plans.length === 0) {
      console.log('⚠️ No subscription plans found');
      console.log('💡 Solution: Run the subscription plans setup script');
      console.log('   - Go to Supabase Dashboard > SQL Editor');
      console.log('   - Run the insert-default-data.sql script');
      return;
    }

    console.log(`✅ Found ${plans.length} subscription plans:`);
    plans.forEach((plan, index) => {
      console.log(`   ${index + 1}. ${plan.name} (${plan.slug}) - $${(plan.price_monthly / 100).toFixed(2)}/month`);
    });

    // Step 3: Test RLS policies
    console.log('\n📋 Step 3: Testing RLS policies...');
    const { data: rlsTest, error: rlsError } = await supabase
      .from('subscription_plans')
      .select('count')
      .limit(1);

    if (rlsError) {
      console.error('❌ RLS policy error:', rlsError);
      console.log('💡 Solution: Check RLS policies for subscription_plans table');
    } else {
      console.log('✅ RLS policies allow access to subscription_plans');
    }

    // Step 4: Test specific plan selection
    console.log('\n📋 Step 4: Testing plan selection...');
    const professionalPlan = plans.find(plan => plan.slug === 'professional');
    if (professionalPlan) {
      console.log(`✅ Professional plan found: ${professionalPlan.id}`);
    } else {
      console.log('⚠️ Professional plan not found, available slugs:', plans.map(p => p.slug));
    }

    // Step 5: Test plan features
    console.log('\n📋 Step 5: Testing plan features...');
    plans.forEach(plan => {
      const features = plan.features;
      if (features && typeof features === 'object') {
        console.log(`✅ ${plan.name}: Features object is valid`);
      } else {
        console.log(`⚠️ ${plan.name}: Features may be invalid - ${typeof features}`);
      }
    });

    // Step 6: Summary and recommendations
    console.log('\n🎯 Summary:');
    console.log('===========');
    console.log(`✅ Authentication: ${user.email}`);
    console.log(`✅ Plans found: ${plans.length}`);
    console.log(`✅ Professional plan: ${professionalPlan ? 'Found' : 'Not found'}`);
    console.log(`✅ RLS access: ${rlsError ? 'Failed' : 'Working'}`);

    console.log('\n💡 If plans are not showing in the frontend:');
    console.log('1. Check browser console for JavaScript errors');
    console.log('2. Verify the user is logged in when accessing /setup');
    console.log('3. Check if the fetchPlans function is being called');
    console.log('4. Visit /debug/plans-new to test plans loading');
    console.log('5. Check network tab for failed API requests');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the test
testSubscriptionPlans();