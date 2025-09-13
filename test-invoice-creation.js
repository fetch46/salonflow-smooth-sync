// Test script to verify invoice creation works properly
// Run this in the browser console while logged in

async function testInvoiceCreation() {
  // Get the current user and organization
  const { data: userData } = await window.supabase.auth.getUser();
  console.log('Current User:', userData.user?.email);
  
  // Get organization
  const { data: orgUsers } = await window.supabase
    .from('organization_users')
    .select('organization_id, organizations(*)')
    .eq('user_id', userData.user?.id)
    .eq('is_active', true)
    .single();
    
  console.log('Organization:', orgUsers?.organizations);
  
  const organizationId = orgUsers?.organization_id;
  
  if (!organizationId) {
    console.error('No organization found for user');
    return;
  }
  
  // Test invoice creation directly
  const testInvoice = {
    invoice_number: `TEST-${Date.now()}`,
    customer_name: 'Test Customer',
    subtotal: 100,
    tax_amount: 10,
    discount_amount: 0,
    total_amount: 110,
    status: 'draft',
    organization_id: organizationId
  };
  
  console.log('Attempting to create invoice:', testInvoice);
  
  const { data, error } = await window.supabase
    .from('invoices')
    .insert([testInvoice])
    .select();
    
  if (error) {
    console.error('Invoice creation failed:', error);
    console.error('Error details:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code
    });
  } else {
    console.log('Invoice created successfully:', data);
    
    // Clean up test invoice
    if (data && data[0]) {
      const { error: deleteError } = await window.supabase
        .from('invoices')
        .delete()
        .eq('id', data[0].id);
        
      if (!deleteError) {
        console.log('Test invoice cleaned up');
      }
    }
  }
}

// Run the test
testInvoiceCreation();