const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://eoxeoyyunhsdvjiwkttx.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVveGVveXl1bmhzZHZqaXdrdHR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mzk3Mjc0NSwiZXhwIjoyMDY5NTQ4NzQ1fQ.YourServiceRoleKeyHere"; // You'll need to get this from Supabase dashboard

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function setupDatabase() {
  console.log('🚀 Setting up database...');
  
  try {
    // Read the emergency scripts
    const fs = require('fs');
    
    // Run emergency seed plans
    console.log('📊 Seeding subscription plans...');
    const plansScript = fs.readFileSync('./emergency_seed_plans.sql', 'utf8');
    const { error: plansError } = await supabase.rpc('exec_sql', { sql: plansScript });
    
    if (plansError) {
      console.error('❌ Error seeding plans:', plansError);
    } else {
      console.log('✅ Subscription plans seeded successfully');
    }
    
    // Run emergency organization function
    console.log('🏢 Setting up organization creation function...');
    const orgScript = fs.readFileSync('./emergency_create_organization_function.sql', 'utf8');
    const { error: orgError } = await supabase.rpc('exec_sql', { sql: orgScript });
    
    if (orgError) {
      console.error('❌ Error setting up organization function:', orgError);
    } else {
      console.log('✅ Organization creation function set up successfully');
    }
    
    console.log('🎉 Database setup completed!');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

setupDatabase();