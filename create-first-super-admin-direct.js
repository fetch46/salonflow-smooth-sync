import { createClient } from '@supabase/supabase-js';

// Use the same configuration as the app
const SUPABASE_URL = "https://eoxeoyyunhsdvjiwkttx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVveGVveXl1bmhzZHZqaXdrdHR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NzI3NDUsImV4cCI6MjA2OTU0ODc0NX0.d3uazVxwI1_kPoF-QAGChcbfKS9PxwB536HrrlCXUrE";

// Super Admin Credentials
const ADMIN_EMAIL = "hello@stratus.africa";
const ADMIN_PASSWORD = "Noel@2018";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function createFirstSuperAdminDirect() {
  console.log('🔧 Creating First Super Admin Account (Direct Method)...');
  console.log('====================================================');
  console.log(`📧 Email: ${ADMIN_EMAIL}`);
  console.log('🔒 Password: [PROTECTED]');
  console.log('');

  try {
    // Step 1: Create user account or sign in
    let user = null;
    let isNewUser = false;

    console.log('🔐 Attempting to sign in with existing credentials...');
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    if (signInError) {
      if (signInError.message.includes('Invalid login credentials')) {
        console.log('👤 User does not exist. Creating new user...');
        
        console.log('\n📋 Step 1: Creating user account...');
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
        
        console.log('\n📧 Email Confirmation Required:');
        console.log('   A confirmation email has been sent to:', ADMIN_EMAIL);
        console.log('   Please check your email and click the confirmation link.');
        console.log('   After confirming, run this script again.');
        return;
        
      } else if (signInError.message.includes('Email not confirmed')) {
        console.log('📧 Email confirmation required for existing user');
        console.log('   Please check your email for a confirmation link');
        console.log('   If you need a new confirmation email:');
        console.log('   1. Go to your Supabase Dashboard');
        console.log('   2. Navigate to Authentication > Users');
        console.log(`   3. Find user: ${ADMIN_EMAIL}`);
        console.log('   4. Click "Send confirmation email"');
        console.log('   5. After confirming, run this script again');
        return;
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

    // Step 2: Check if user is already a super admin
    console.log('\n📋 Step 2: Checking existing super admin status...');
    const { data: existingAdmin, error: checkError } = await supabase
      .from('super_admins')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (existingAdmin) {
      console.log('✅ User is already a super admin!');
      console.log(`   Granted at: ${existingAdmin.granted_at}`);
      console.log(`   Active: ${existingAdmin.is_active}`);
      console.log(`   Permissions: ${JSON.stringify(existingAdmin.permissions, null, 2)}`);
      
      // Still show the final summary
      console.log('\n🎉 Super Admin Already Exists!');
      console.log('==============================');
      console.log(`✅ Email: ${user.email}`);
      console.log(`✅ User ID: ${user.id}`);
      console.log(`✅ Super Admin: YES`);
      
      console.log('\n📋 Login Credentials:');
      console.log(`   Email: ${ADMIN_EMAIL}`);
      console.log(`   Password: ${ADMIN_PASSWORD}`);
      
      return;
    }

    if (checkError && checkError.code !== 'PGRST116') {
      console.log('⚠️  Could not check super admin status, table may not exist yet');
      console.log('   Proceeding with creation...');
    }

    // Step 3: Direct insert into super_admins table
    console.log('\n📋 Step 3: Creating super admin record directly...');
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
          can_view_analytics: true,
          can_manage_super_admins: true
        }
      })
      .select()
      .single();

    if (createError) {
      console.error('❌ Error creating super admin record:', createError);
      
      if (createError.code === '42P01') {
        console.log('\n❗ Super admins table does not exist!');
        console.log('   Please run the following SQL in your Supabase SQL Editor:');
        console.log('');
        console.log('   CREATE TABLE IF NOT EXISTS super_admins (');
        console.log('       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),');
        console.log('       user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,');
        console.log('       granted_at TIMESTAMPTZ DEFAULT NOW(),');
        console.log('       granted_by UUID REFERENCES auth.users(id),');
        console.log('       is_active BOOLEAN DEFAULT true,');
        console.log('       permissions JSONB DEFAULT \'{}\',');
        console.log('       created_at TIMESTAMPTZ DEFAULT NOW(),');
        console.log('       updated_at TIMESTAMPTZ DEFAULT NOW(),');
        console.log('       UNIQUE(user_id)');
        console.log('   );');
        console.log('');
        console.log('   ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;');
        console.log('');
        console.log('   CREATE POLICY "Allow all for authenticated users" ON super_admins');
        console.log('       FOR ALL TO authenticated USING (true) WITH CHECK (true);');
        console.log('');
        console.log('   GRANT ALL ON super_admins TO authenticated;');
        console.log('');
        console.log('   Then run this script again.');
        return;
      }
      
      console.log('\nTrying alternative approach with upsert...');
      
      // Try with upsert
      const { data: upsertAdmin, error: upsertError } = await supabase
        .from('super_admins')
        .upsert({
          user_id: user.id,
          granted_by: user.id,
          is_active: true,
          permissions: {
            all_permissions: true,
            can_manage_system: true,
            can_manage_users: true,
            can_manage_organizations: true,
            can_view_analytics: true,
            can_manage_super_admins: true
          }
        }, { onConflict: 'user_id' })
        .select()
        .single();

      if (upsertError) {
        console.error('❌ Error with upsert approach:', upsertError);
        return;
      }

      newAdmin = upsertAdmin;
      console.log('✅ Super admin created with upsert method');
    } else {
      console.log('✅ Super admin record created successfully!');
    }

    console.log(`   User ID: ${newAdmin.user_id}`);
    console.log(`   Granted at: ${newAdmin.granted_at}`);
    console.log(`   Active: ${newAdmin.is_active}`);
    console.log(`   Permissions: ${JSON.stringify(newAdmin.permissions, null, 2)}`);

    // Step 4: Verify with the is_super_admin function
    console.log('\n📋 Step 4: Verifying super admin status...');
    const { data: isAdmin, error: testError } = await supabase.rpc('is_super_admin', {
      user_uuid: user.id
    });

    if (testError) {
      console.log('⚠️  Super admin function test failed (function may not exist yet)');
      console.log('   The super admin record was created successfully though');
    } else {
      console.log(`✅ Super admin function test: ${isAdmin ? 'PASSED' : 'FAILED'}`);
    }

    // Step 5: Show final summary
    console.log('\n🎉 First Super Admin Created Successfully!');
    console.log('=========================================');
    console.log(`✅ Email: ${user.email}`);
    console.log(`✅ User ID: ${user.id}`);
    console.log(`✅ Account Type: ${isNewUser ? 'NEW USER' : 'EXISTING USER'}`);
    console.log(`✅ Super Admin: YES`);
    console.log(`✅ Granted at: ${newAdmin.granted_at}`);
    console.log(`✅ Active: ${newAdmin.is_active}`);
    
    console.log('\n📋 Login Credentials:');
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
    
    console.log('\n📋 Next Steps:');
    console.log('1. Use the above credentials to log in to your application');
    console.log('2. Navigate to /super-admin to access super admin features');
    console.log('3. You can now manage the entire system');
    console.log('4. You can grant super admin privileges to other users');
    console.log('\n📋 Additional Setup (Optional):');
    console.log('1. Run setup-super-admin-system.sql in Supabase SQL Editor for enhanced functionality');
    console.log('2. This will enable proper RLS policies and helper functions');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the function
createFirstSuperAdminDirect();