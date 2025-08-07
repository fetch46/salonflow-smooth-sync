import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testOrganizationCreation() {
  console.log('🧪 Testing organization creation function...');
  
  try {
    // Test 1: Check if function exists
    console.log('\n1. Testing if function exists...');
    const { error: funcError } = await supabase.rpc('create_organization_with_user', {
      org_name: 'test-org',
      org_slug: 'test-org',
      org_settings: {},
      plan_id: null
    });
    
    if (funcError && funcError.message.includes('function create_organization_with_user does not exist')) {
      console.error('❌ Function does not exist');
      console.log('Run the emergency script: emergency_create_organization_function.sql');
      return;
    }
    
    console.log('✅ Function exists');
    
    // Test 2: Check authentication
    console.log('\n2. Testing authentication...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('❌ Not authenticated');
      console.log('Please log in first');
      return;
    }
    
    console.log('✅ Authenticated as:', user.email);
    
    // Test 3: Check subscription plans
    console.log('\n3. Testing subscription plans access...');
    const { data: plans, error: plansError } = await supabase
      .from('subscription_plans')
      .select('id, name, slug')
      .eq('is_active', true);
    
    if (plansError) {
      console.error('❌ Cannot access subscription plans:', plansError.message);
      return;
    }
    
    console.log('✅ Found', plans?.length || 0, 'active plans');
    
    // Test 4: Check organizations table access
    console.log('\n4. Testing organizations table access...');
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('id, name')
      .limit(1);
    
    if (orgsError) {
      console.error('❌ Cannot access organizations table:', orgsError.message);
      return;
    }
    
    console.log('✅ Can access organizations table');
    
    console.log('\n✅ All tests passed! Organization creation should work.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testOrganizationCreation();