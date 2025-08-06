import { createClient } from '@supabase/supabase-js';

// Use the same configuration as the app
const SUPABASE_URL = "https://eoxeoyyunhsdvjiwkttx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVveGVveXl1bmhzZHZqaXdrdHR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NzI3NDUsImV4cCI6MjA2OTU0ODc0NX0.d3uazVxwI1_kPoF-QAGChcbfKS9PxwB536HrrlCXUrE";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function createSuperAdmin() {
  console.log('🔧 Creating Super Admin Account...');
  console.log('=====================================');

  try {
    // Step 1: Check if super_admins table exists
    console.log('\n📋 Step 1: Checking super_admins table...');
    const { data: superAdmins, error: tableError } = await supabase
      .from('super_admins')
      .select('id')
      .limit(1);

    if (tableError) {
      console.error('❌ Error checking super_admins table:', tableError);
      console.log('Please run the create-super-admin.sql script first!');
      return;
    }

    console.log('✅ super_admins table exists');

    // Step 2: Get current user
    console.log('\n📋 Step 2: Getting current user...');
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.error('❌ Error getting user:', userError);
      console.log('Please log in first!');
      return;
    }

    if (!user) {
      console.log('❌ No user logged in');
      console.log('Please log in to your account first!');
      return;
    }

    console.log(`✅ User found: ${user.email} (${user.id})`);

    // Step 3: Check if user is already a super admin
    console.log('\n📋 Step 3: Checking if user is already super admin...');
    const { data: existingAdmin, error: checkError } = await supabase
      .from('super_admins')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('❌ Error checking super admin status:', checkError);
      return;
    }

    if (existingAdmin) {
      console.log('✅ User is already a super admin!');
      console.log(`   Granted at: ${existingAdmin.granted_at}`);
      console.log(`   Active: ${existingAdmin.is_active}`);
      return;
    }

    // Step 4: Create super admin account
    console.log('\n📋 Step 4: Creating super admin account...');
    const { data: newAdmin, error: createError } = await supabase
      .from('super_admins')
      .insert({
        user_id: user.id,
        granted_by: user.id, // Self-granted
        is_active: true,
        permissions: {
          all_permissions: true,
          can_manage_system: true,
          can_manage_users: true,
          can_manage_organizations: true,
          can_view_analytics: true
        }
      })
      .select()
      .single();

    if (createError) {
      console.error('❌ Error creating super admin:', createError);
      return;
    }

    console.log('✅ Super admin account created successfully!');
    console.log(`   User ID: ${newAdmin.user_id}`);
    console.log(`   Granted at: ${newAdmin.granted_at}`);
    console.log(`   Active: ${newAdmin.is_active}`);

    // Step 5: Test super admin function
    console.log('\n📋 Step 5: Testing super admin function...');
    const { data: isAdmin, error: testError } = await supabase.rpc('is_super_admin', {
      user_uuid: user.id
    });

    if (testError) {
      console.error('❌ Error testing super admin function:', testError);
      console.log('Please ensure the super admin functions are created!');
      return;
    }

    console.log(`✅ Super admin function test: ${isAdmin ? 'PASSED' : 'FAILED'}`);

    // Step 6: Show next steps
    console.log('\n🎉 Super Admin Setup Complete!');
    console.log('=============================');
    console.log(`✅ User: ${user.email}`);
    console.log(`✅ User ID: ${user.id}`);
    console.log(`✅ Super Admin: ${isAdmin ? 'YES' : 'NO'}`);
    console.log(`✅ Granted at: ${newAdmin.granted_at}`);
    
    console.log('\n📋 Next Steps:');
    console.log('1. Log in to your application');
    console.log('2. Navigate to /super-admin to access super admin features');
    console.log('3. You can now manage the entire system');
    console.log('4. You can grant super admin privileges to other users');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the function
createSuperAdmin();