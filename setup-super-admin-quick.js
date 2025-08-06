import { createClient } from '@supabase/supabase-js';

// Use the same configuration as the app
const SUPABASE_URL = "https://eoxeoyyunhsdvjiwkttx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVveGVveXl1bmhzZHZqaXdrdHR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NzI3NDUsImV4cCI6MjA2OTU0ODc0NX0.d3uazVxwI1_kPoF-QAGChcbfKS9PxwB536HrrlCXUrE";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function quickSuperAdminSetup() {
  console.log('🚀 Quick Super Admin Setup');
  console.log('==========================');

  try {
    // Step 1: Check if user is logged in
    console.log('\n📋 Step 1: Checking authentication...');
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.log('❌ Please log in to your application first!');
      console.log('1. Go to: http://localhost:5173');
      console.log('2. Register or log in with your email');
      console.log('3. Run this script again');
      return;
    }

    console.log(`✅ Logged in as: ${user.email}`);

    // Step 2: Check if super admin system exists
    console.log('\n📋 Step 2: Checking super admin system...');
    const { data: superAdmins, error: tableError } = await supabase
      .from('super_admins')
      .select('id')
      .limit(1);

    if (tableError) {
      console.log('❌ Super admin system not set up!');
      console.log('Please run the create-super-admin.sql script first.');
      console.log('1. Go to Supabase Dashboard > SQL Editor');
      console.log('2. Copy and paste create-super-admin.sql');
      console.log('3. Run the script');
      console.log('4. Run this script again');
      return;
    }

    console.log('✅ Super admin system exists');

    // Step 3: Check if user is already super admin
    console.log('\n📋 Step 3: Checking super admin status...');
    const { data: existingAdmin, error: checkError } = await supabase
      .from('super_admins')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (existingAdmin) {
      console.log('✅ You are already a super admin!');
      console.log(`   Granted at: ${existingAdmin.granted_at}`);
      console.log('   You can access /super-admin in your application');
      return;
    }

    // Step 4: Create super admin account
    console.log('\n📋 Step 4: Creating super admin account...');
    const { data: newAdmin, error: createError } = await supabase
      .from('super_admins')
      .insert({
        user_id: user.id,
        granted_by: user.id,
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

    console.log('✅ Super admin account created!');

    // Step 5: Test super admin function
    console.log('\n📋 Step 5: Testing super admin function...');
    const { data: isAdmin, error: testError } = await supabase.rpc('is_super_admin', {
      user_uuid: user.id
    });

    if (testError) {
      console.log('⚠️  Super admin function test failed, but account was created');
      console.log('   You may need to refresh your application');
    } else {
      console.log(`✅ Super admin function test: ${isAdmin ? 'PASSED' : 'FAILED'}`);
    }

    // Success message
    console.log('\n🎉 Super Admin Setup Complete!');
    console.log('=============================');
    console.log(`✅ User: ${user.email}`);
    console.log(`✅ Super Admin: YES`);
    console.log(`✅ Granted at: ${newAdmin.granted_at}`);
    
    console.log('\n📋 Next Steps:');
    console.log('1. Go to your application: http://localhost:5173');
    console.log('2. Navigate to: /super-admin');
    console.log('3. You now have full system access!');
    console.log('4. You can grant super admin to other users');

  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

// Run the setup
quickSuperAdminSetup();