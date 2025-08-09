// Mock database for handling missing tables until proper migration
// This allows POS and receipts systems to work without database errors

interface MockReceipt {
  id: string;
  receipt_number: string;
  customer_id: string | null;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  status: string; // open, partial, paid, cancelled
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function getStorage() {
  try {
    const stored = JSON.parse(localStorage.getItem('mockDb') || '{}');
    return stored ? stored : { sales: [], receipts: [], receipt_items: [], receipt_payments: [] };
  } catch {
    return { sales: [], receipts: [], receipt_items: [], receipt_payments: [] };
  }
}

function setStorage(data: any) {
  localStorage.setItem('mockDb', JSON.stringify(data));
}

export const mockDb = {
  async getStore() {
    return getStorage();
  },
  async saveStore(data: any) {
    setStorage(data);
  },

  // Receipt operations
  async createReceipt(receiptData: Omit<MockReceipt, 'id' | 'created_at' | 'updated_at'>): Promise<MockReceipt> {
    const storage = getStorage();
    const receipt: MockReceipt = {
      ...receiptData,
      id: `receipt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    storage.receipts = storage.receipts || [];
    storage.receipts.push(receipt);
    setStorage(storage);
    return receipt;
  },
  async getReceipts(): Promise<MockReceipt[]> {
    const storage = getStorage();
    return storage.receipts || [];
  },
  async updateInvoice(id: string, updates: Partial<MockReceipt>): Promise<boolean> {
    const storage = getStorage();
    storage.receipts = (storage.receipts || []).map((r: MockReceipt) => {
      if (r.id === id) {
        return { ...r, ...updates, updated_at: new Date().toISOString() };
      }
      return r;
    });
    setStorage(storage);
    return true;
  },
  async deleteInvoice(id: string): Promise<boolean> {
    const storage = getStorage();
    storage.receipts = (storage.receipts || []).filter((r: MockReceipt) => r.id !== id);
    // No invoice_items in mock; if present as receipt_items with invoice_id, remove them
    storage.receipt_items = (storage.receipt_items || []).filter((it: any) => it.invoice_id !== id && it.receipt_id !== id);
    setStorage(storage);
    return true;
  },
  async getInvoiceItems(invoiceId: string): Promise<any[]> {
    const storage = getStorage();
    // Return any items linked to this invoice/receipt id if present
    return (storage.receipt_items || []).filter((it: any) => it.invoice_id === invoiceId || it.receipt_id === invoiceId);
  },
};

// Wrapper functions for Receipts
export async function createReceiptWithFallback(supabase: any, receiptData: any, items: any[]) {
  try {
    const dbReceipt = {
      receipt_number: receiptData.receipt_number,
      customer_id: receiptData.customer_id || null,
      job_card_id: receiptData.job_card_id || null,
      subtotal: receiptData.subtotal ?? 0,
      tax_amount: receiptData.tax_amount ?? 0,
      discount_amount: receiptData.discount_amount ?? 0,
      total_amount: receiptData.total_amount ?? 0,
      status: receiptData.status || 'open',
      notes: receiptData.notes || null,
    };
    const { data: receipt, error: receiptError } = await supabase
      .from('receipts')
      .insert([dbReceipt])
      .select('id')
      .maybeSingle();
    if (receiptError) throw receiptError;
    if (!receipt?.id) throw new Error('Receipt created but no ID returned');

    if (items?.length) {
      await supabase
        .from('receipt_items')
        .insert(items.map((it: any) => ({
          receipt_id: receipt.id,
          description: it.description,
          quantity: it.quantity || 1,
          unit_price: it.unit_price || 0,
          total_price: it.total_price || 0,
          service_id: it.service_id || null,
          product_id: it.product_id || null,
          staff_id: it.staff_id || null,
        })));
    }
    return receipt;
  } catch (err) {
    console.log('Using mock database for receipts');
    const receipt = await mockDb.createReceipt({
      receipt_number: receiptData.receipt_number,
      customer_id: receiptData.customer_id || null,
      subtotal: receiptData.subtotal ?? 0,
      tax_amount: receiptData.tax_amount ?? 0,
      discount_amount: receiptData.discount_amount ?? 0,
      total_amount: receiptData.total_amount ?? 0,
      status: receiptData.status || 'open',
      notes: receiptData.notes || null,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    } as any);
    return receipt;
  }
}

export async function getReceiptsWithFallback(supabase: any) {
  try {
    const { data, error } = await supabase
      .from('receipts')
      .select('id, receipt_number, customer_id, subtotal, tax_amount, discount_amount, total_amount, status, notes, created_at, updated_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.log('Using mock database for receipts');
    return await mockDb.getReceipts();
  }
}

// Helper function to check if table exists in Supabase
export async function tableExists(supabase: any, tableName: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.from(tableName).select('*').limit(1);
    return !error;
  } catch {
    return false;
  }
}

// Wrapper function for POS operations
export async function createSaleWithFallback(supabase: any, saleData: any, items: any[]) {
  try {
    // Try to use real database first
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert([saleData])
      .select()
      .single();

    if (saleError) throw saleError;

    const itemsData = items.map(item => ({
      sale_id: sale.id,
      product_id: item.product.id,
      quantity: item.quantity,
      unit_price: item.product.selling_price,
      discount_percentage: item.discount,
      total_price: item.total,
    }));

    const { error: itemsError } = await supabase
      .from('sale_items')
      .insert(itemsData);

    if (itemsError) throw itemsError;

    return sale;
  } catch (error) {
    console.log('Using mock database for sales');
    // Fallback to mock database
    const sale = await mockDb.createReceipt({
      receipt_number: saleData.sale_number,
      customer_id: saleData.customer_id || null,
      subtotal: saleData.subtotal,
      tax_amount: saleData.tax_amount,
      discount_amount: saleData.discount_amount,
      total_amount: saleData.total_amount,
      status: 'open',
      notes: saleData.notes || null,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    } as any);
    return sale;
  }
}

// Wrapper function for Invoice operations
export async function createInvoiceWithFallback(supabase: any, invoiceData: any, items: any[]) {
  try {
    // Build payload with only existing DB columns
    const dbInvoice = {
      invoice_number: invoiceData.invoice_number,
      client_id: invoiceData.customer_id || invoiceData.client_id || null,
      issue_date: invoiceData.issue_date || new Date().toISOString().split('T')[0],
      due_date: invoiceData.due_date || null,
      subtotal: invoiceData.subtotal ?? 0,
      tax_amount: invoiceData.tax_amount ?? 0,
      total_amount: invoiceData.total_amount ?? 0,
      status: invoiceData.status || 'draft',
      notes: invoiceData.notes || null,
    };

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert([dbInvoice])
      .select('id')
      .maybeSingle();

    if (invoiceError) throw invoiceError;
    if (!invoice?.id) throw new Error('Invoice created but no ID returned');

    const itemsData = items.map((item: any) => ({
      invoice_id: invoice.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
    }));

    const { error: itemsError } = await supabase
      .from('invoice_items')
      .insert(itemsData);

    if (itemsError) throw itemsError;

    return invoice;
  } catch (error) {
    console.log('Using mock database for invoices');
    // Fallback to mock database
    const invoice = await mockDb.createReceipt({
      receipt_number: invoiceData.invoice_number,
      customer_id: invoiceData.customer_id || null,
      subtotal: invoiceData.subtotal ?? 0,
      tax_amount: invoiceData.tax_amount ?? 0,
      discount_amount: invoiceData.discount_amount ?? 0,
      total_amount: invoiceData.total_amount ?? 0,
      status: invoiceData.status || 'draft',
      notes: invoiceData.notes || null,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    } as any);
    return invoice;
  }
}

export async function getInvoicesWithFallback(supabase: any) {
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        id, invoice_number, client_id, issue_date, due_date, subtotal, tax_amount, total_amount, status, notes, created_at, updated_at,
        client:client_id (id, full_name, email, phone)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Map to the shape expected by the UI (with customer_*)
    return (data || []).map((inv: any) => ({
      id: inv.id,
      invoice_number: inv.invoice_number,
      customer_id: inv.client_id,
      customer_name: inv.client?.full_name || '',
      customer_email: inv.client?.email || null,
      customer_phone: inv.client?.phone || null,
      subtotal: inv.subtotal,
      tax_amount: inv.tax_amount,
      discount_amount: 0,
      total_amount: inv.total_amount,
      status: inv.status,
      due_date: inv.due_date,
      payment_method: null,
      notes: inv.notes,
      jobcard_id: null,
      created_at: inv.created_at,
      updated_at: inv.updated_at,
    }));
  } catch (error) {
    console.log('Using mock database for invoices');
    return await mockDb.getReceipts();
  }
}

export async function updateInvoiceWithFallback(supabase: any, id: string, updates: any) {
  try {
    const allowed: any = {};
    if (typeof updates.status !== 'undefined') allowed.status = updates.status;
    if (typeof updates.due_date !== 'undefined') allowed.due_date = updates.due_date;
    if (typeof updates.notes !== 'undefined') allowed.notes = updates.notes;

    const { error } = await supabase
      .from('invoices')
      .update(allowed)
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.log('Using mock database for invoice update');
    return await mockDb.updateInvoice(id, updates);
  }
}

export async function deleteInvoiceWithFallback(supabase: any, id: string) {
  try {
    // Delete items first (safeguard)
    await supabase.from('invoice_items').delete().eq('invoice_id', id);

    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.log('Using mock database for invoice deletion');
    return await mockDb.deleteInvoice(id);
  }
}

export async function getInvoiceItemsWithFallback(supabase: any, invoiceId: string) {
  try {
    const { data, error } = await supabase
      .from('invoice_items')
      .select('id, invoice_id, description, quantity, unit_price, total_price')
      .eq('invoice_id', invoiceId);

    if (error) throw error;

    return (data || []).map((it: any) => ({
      id: it.id,
      invoice_id: it.invoice_id,
      service_id: null,
      product_id: null,
      description: it.description,
      quantity: it.quantity,
      unit_price: it.unit_price,
      discount_percentage: 0,
      staff_id: null,
      commission_percentage: 0,
      commission_amount: 0,
      total_price: it.total_price,
    }));
  } catch (error) {
    console.log('Using mock database for invoice items');
    return await mockDb.getInvoiceItems(invoiceId);
  }
}