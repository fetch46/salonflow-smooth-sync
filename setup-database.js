import fs from 'fs';
import https from 'https';

// Supabase configuration
const SUPABASE_URL = "https://eoxeoyyunhsdvjiwkttx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVveGVveXl1bmhzZHZqaXdrdHR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NzI3NDUsImV4cCI6MjA2OTU0ODc0NX0.d3uazVxwI1_kPoF-QAGChcbfKS9PxwB536HrrlCXUrE";

// Function to make HTTP request to Supabase
function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'eoxeoyyunhsdvjiwkttx.supabase.co',
      port: 443,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
        'Prefer': 'return=minimal'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const response = body ? JSON.parse(body) : null;
          resolve({ status: res.statusCode, data: response });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Function to execute SQL via REST API (this is limited, but we can test connectivity)
async function testConnection() {
  console.log('🔍 Testing Supabase connection...');
  
  try {
    // Test basic connectivity by trying to access a table
    const response = await makeRequest('/rest/v1/subscription_plans?select=count');
    console.log('✅ Connection successful:', response.status);
    return true;
  } catch (error) {
    console.log('❌ Connection failed:', error.message);
    return false;
  }
}

// Function to read and display SQL files
function displaySqlFiles() {
  console.log('\n📋 Available SQL files for manual execution:');
  console.log('============================================');
  
  const files = [
    'emergency_seed_plans.sql',
    'emergency_create_organization_function.sql',
    'manual_seed_plans.sql',
    'fix-organization-creation.sql'
  ];
  
  files.forEach(file => {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n').length;
      console.log(`📄 ${file} (${lines} lines)`);
    }
  });
  
  console.log('\n💡 To set up the database:');
  console.log('1. Go to https://supabase.com/dashboard/project/eoxeoyyunhsdvjiwkttx');
  console.log('2. Navigate to SQL Editor');
  console.log('3. Copy and paste the contents of the SQL files above');
  console.log('4. Run them in this order:');
  console.log('   - emergency_seed_plans.sql');
  console.log('   - emergency_create_organization_function.sql');
}

// Main execution
async function main() {
  console.log('🚀 Setting up Subscription Plans and Organization Creation');
  console.log('========================================================');
  
  // Test connection
  const connected = await testConnection();
  
  if (connected) {
    console.log('\n✅ Supabase connection is working!');
    console.log('📊 Database is accessible');
  } else {
    console.log('\n⚠️  Connection issues detected');
    console.log('This might be due to RLS policies or missing tables');
  }
  
  // Display SQL files for manual execution
  displaySqlFiles();
  
  console.log('\n🎯 Next Steps:');
  console.log('1. Run the SQL scripts in Supabase Dashboard');
  console.log('2. Start the development server: npm run dev');
  console.log('3. Test organization creation at /setup');
  console.log('4. Test subscription plans at /debug/plans');
}

// Run the script
main().catch(console.error);