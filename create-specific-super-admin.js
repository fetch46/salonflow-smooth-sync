import { createClient } from '@supabase/supabase-js';

// Use the same configuration as the app
const SUPABASE_URL = "https://eoxeoyyunhsdvjiwkttx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVveGVveXl1bmhzZHZqaXdrdHR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NzI3NDUsImV4cCI6MjA2OTU0ODc0NX0.d3uazVxwI1_kPoF-QAGChcbfKS9PxwB536HrrlCXUrE";

// Super Admin Credentials
const ADMIN_EMAIL = "hello@stratus.africa";
const ADMIN_PASSWORD = "Noel@2018";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function createSpecificSuperAdmin() {
  console.log('🔧 Creating Specific Super Admin Account...');
  console.log('==========================================');
  console.log(`📧 Email: ${ADMIN_EMAIL}`);
  console.log('🔒 Password: [PROTECTED]');
  console.log('');

  try {
    // Step 1: Try to sign in first
    let user = null;
    let isNewUser = false;

    console.log('🔐 Attempting to sign in with existing credentials...');
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    if (signInError) {
      if (signInError.message.includes('Invalid login credentials')) {
        console.log('👤 User does not exist or password is incorrect. Creating new user...');
        
        // Step 2: Create new user account
        console.log('\n📋 Step 2: Creating user account...');
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: ADMIN_EMAIL,
          password: ADMIN_PASSWORD,
        });

        if (signUpError) {
          console.error('❌ Error creating user account:', signUpError);
          return;
        }

        user = signUpData.user;
        isNewUser = true;
        console.log('✅ New user account created');
        console.log(`   User ID: ${user.id}`);
        console.log(`   Email: ${user.email}`);
        
        if (!signUpData.session) {
          console.log('⚠️  Please check your email to confirm your account if email confirmation is enabled');
          // Try to sign in again after signup
          const { data: autoSignIn, error: autoSignInError } = await supabase.auth.signInWithPassword({
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
          });
          
          if (autoSignIn?.user) {
            user = autoSignIn.user;
            console.log('✅ Automatically signed in after signup');
          }
        }
      } else {
        console.error('❌ Error signing in:', signInError);
        return;
      }
    } else {
      user = signInData.user;
      console.log('✅ Successfully signed in to existing account');
      console.log(`   User ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
    }

    if (!user) {
      console.error('❌ No user found after sign up/sign in process');
      return;
    }

    // Step 3: Use the grant_super_admin function
    console.log('\n📋 Step 3: Creating super admin using grant_super_admin function...');
    const { data: grantResult, error: grantError } = await supabase.rpc('grant_super_admin', {
      target_user_id: user.id
    });

    if (grantError) {
      console.error('❌ Error granting super admin:', grantError);
      console.log('This might be because:');
      console.log('1. The super admin system is not set up yet');
      console.log('2. You need to run the setup-super-admin-system.sql script first');
      console.log('3. Or there are permission issues');
      return;
    }

    console.log('✅ Super admin account created/updated successfully!');

    // Step 4: Verify super admin status
    console.log('\n📋 Step 4: Verifying super admin status...');
    const { data: isAdmin, error: testError } = await supabase.rpc('is_super_admin', {
      user_uuid: user.id
    });

    if (testError) {
      console.error('❌ Error testing super admin function:', testError);
      console.log('Please ensure the super admin functions are created!');
    } else {
      console.log(`✅ Super admin function test: ${isAdmin ? 'PASSED' : 'FAILED'}`);
    }

    // Step 5: Check the super admin record directly
    console.log('\n📋 Step 5: Checking super admin record...');
    const { data: adminRecord, error: recordError } = await supabase
      .from('super_admins')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (recordError) {
      console.error('❌ Error reading super admin record:', recordError);
    } else {
      console.log('✅ Super admin record found:');
      console.log(`   ID: ${adminRecord.id}`);
      console.log(`   User ID: ${adminRecord.user_id}`);
      console.log(`   Granted at: ${adminRecord.granted_at}`);
      console.log(`   Active: ${adminRecord.is_active}`);
      console.log(`   Permissions: ${JSON.stringify(adminRecord.permissions, null, 2)}`);
    }

    // Step 6: Show summary
    console.log('\n🎉 Super Admin Setup Complete!');
    console.log('==============================');
    console.log(`✅ Email: ${user.email}`);
    console.log(`✅ User ID: ${user.id}`);
    console.log(`✅ Account Type: ${isNewUser ? 'NEW USER' : 'EXISTING USER'}`);
    console.log(`✅ Super Admin: ${isAdmin ? 'YES' : 'UNKNOWN'}`);
    
    console.log('\n📋 Login Credentials:');
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
    
    console.log('\n📋 Next Steps:');
    console.log('1. Use the above credentials to log in to your application');
    console.log('2. Navigate to /super-admin to access super admin features');
    console.log('3. You can now manage the entire system');
    console.log('4. You can grant super admin privileges to other users');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the function
createSpecificSuperAdmin();