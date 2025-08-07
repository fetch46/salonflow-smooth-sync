import { createClient } from '@supabase/supabase-js';

// Use the same configuration as the app
const SUPABASE_URL = "https://eoxeoyyunhsdvjiwkttx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVveGVveXl1bmhzZHZqaXdrdHR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NzI3NDUsImV4cCI6MjA2OTU0ODc0NX0.d3uazVxwI1_kPoF-QAGChcbfKS9PxwB536HrrlCXUrE";

const EMAIL = process.env.SUPER_ADMIN_EMAIL || "hello@stratus.africa";
const PASSWORD = process.env.SUPER_ADMIN_PASSWORD || "Noel@2018";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function createAuthUser() {
  console.log('🔧 Creating auth user in Supabase...');
  console.log('===================================');

  try {
    // Try to sign up the user
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: EMAIL,
      password: PASSWORD,
    });

    if (signUpError) {
      // If user already exists, try to sign in to verify credentials
      if (signUpError.message && signUpError.message.toLowerCase().includes('user already registered')) {
        console.log('ℹ️  User already exists, attempting sign-in to verify credentials...');
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: EMAIL,
          password: PASSWORD,
        });
        if (signInError) {
          console.error('❌ Sign-in failed. The user exists but the provided password may be incorrect.');
          console.error(signInError);
          process.exit(1);
        }
        console.log('✅ Sign-in successful');
        console.log(`✅ User ID: ${signInData.user?.id}`);
        console.log('\nNext step: Grant Super Admin using SQL (see grant-super-admin-by-email.sql)');
        return;
      }
      console.error('❌ Sign-up failed:', signUpError);
      process.exit(1);
    }

    console.log('✅ Sign-up successful');
    console.log(`✅ User ID: ${signUpData.user?.id}`);
    console.log('\nNote: If your project requires email confirmation, please confirm the email to fully activate the account.');
    console.log('Next step: Grant Super Admin using SQL (see grant-super-admin-by-email.sql)');
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

createAuthUser();