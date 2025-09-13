const { createClient } = require('@supabase/supabase-js');

// You'll need to replace these with your actual values
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

async function testInvoiceCreation() {
  console.log('Testing invoice creation diagnostics...\n');
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  try {
    // Step 1: Check authentication
    console.log('1. Checking authentication...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('❌ Not authenticated:', authError);
      return;
    }
    console.log('✅ Authenticated as:', user.email);
    console.log('   User ID:', user.id);
    
    // Step 2: Check organization membership
    console.log('\n2. Checking organization membership...');
    const { data: orgUsers, error: orgError } = await supabase
      .from('organization_users')
      .select('*, organizations(*)')
      .eq('user_id', user.id)
      .eq('is_active', true);
      
    if (orgError) {
      console.error('❌ Error fetching organizations:', orgError);
      return;
    }
    
    if (!orgUsers || orgUsers.length === 0) {
      console.error('❌ No active organization memberships found');
      return;
    }
    
    console.log('✅ Found', orgUsers.length, 'organization membership(s):');
    orgUsers.forEach(ou => {
      console.log(`   - ${ou.organizations?.name} (ID: ${ou.organization_id})`);
      console.log(`     Role: ${ou.role}, Active: ${ou.is_active}`);
    });
    
    // Step 3: Test with first organization
    const testOrg = orgUsers[0];
    const testOrgId = testOrg.organization_id;
    console.log(`\n3. Testing invoice creation with organization: ${testOrg.organizations?.name}`);
    
    // Step 4: Create a minimal test invoice
    const testInvoice = {
      invoice_number: `TEST-${Date.now()}`,
      customer_name: 'Test Customer',
      subtotal: 100,
      tax_amount: 0,
      total_amount: 100,
      status: 'draft',
      organization_id: testOrgId
    };
    
    console.log('\n4. Attempting to create invoice with payload:');
    console.log(JSON.stringify(testInvoice, null, 2));
    
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert([testInvoice])
      .select('id')
      .single();
      
    if (invoiceError) {
      console.error('\n❌ Invoice creation failed:', invoiceError);
      console.error('   Error code:', invoiceError.code);
      console.error('   Error message:', invoiceError.message);
      console.error('   Error details:', invoiceError.details);
      console.error('   Error hint:', invoiceError.hint);
      
      // Check if it's an RLS error
      if (invoiceError.code === '42501') {
        console.error('\n⚠️  This appears to be a Row Level Security (RLS) policy violation.');
        console.error('   The user may not have permission to insert into the invoices table.');
      }
      
      return;
    }
    
    console.log('\n✅ Invoice created successfully!');
    console.log('   Invoice ID:', invoice?.id);
    
    // Step 5: Clean up test invoice
    if (invoice?.id) {
      console.log('\n5. Cleaning up test invoice...');
      const { error: deleteError } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoice.id);
        
      if (deleteError) {
        console.error('❌ Failed to delete test invoice:', deleteError);
      } else {
        console.log('✅ Test invoice deleted');
      }
    }
    
  } catch (error) {
    console.error('\n❌ Unexpected error:', error);
  }
}

// Run the test
testInvoiceCreation().then(() => {
  console.log('\nDiagnostics complete.');
}).catch(error => {
  console.error('Fatal error:', error);
});