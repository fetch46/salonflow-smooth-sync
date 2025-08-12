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
  location_id?: string | null;
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
      location_id: receiptData.location_id || null,
    };
    let receiptIns = null as any;
    try {
      const { data: receipt, error: receiptError } = await supabase
        .from('receipts')
        .insert([dbReceipt])
        .select('id')
        .maybeSingle();
      if (receiptError) throw receiptError;
      receiptIns = receipt;
    } catch (e: any) {
      const msg = String(e?.message || '').toLowerCase();
      const code = (e as any)?.code || '';
      const missingLoc = code === '42703' || (msg.includes('column') && msg.includes('location_id') && msg.includes('does not exist'));
      if (!missingLoc) throw e;
      const { data: receipt, error: receiptError } = await supabase
        .from('receipts')
        .insert([{ ...dbReceipt, location_id: undefined } as any])
        .select('id')
        .maybeSingle();
      if (receiptError) throw receiptError;
      receiptIns = receipt;
    }
    if (!receiptIns?.id) throw new Error('Receipt created but no ID returned');

    if (items?.length) {
      await supabase
        .from('receipt_items')
        .insert(items.map((it: any) => ({
           receipt_id: receiptIns.id,
          description: it.description,
          quantity: it.quantity || 1,
          unit_price: it.unit_price || 0,
          total_price: it.total_price || 0,
          service_id: it.service_id || null,
          product_id: it.product_id || null,
          staff_id: it.staff_id || null,
        })));

      // Best-effort: also create staff commission rows if table exists and data is available
      try {
        const commissionRows = (items || [])
          .filter((it: any) => it.staff_id && (typeof it.commission_percentage === 'number'))
          .map((it: any) => ({
             receipt_id: receiptIns.id,
            staff_id: it.staff_id,
            service_id: it.service_id || null,
            commission_rate: Number(it.commission_percentage || 0),
            gross_amount: Number(it.total_price || ((Number(it.quantity || 1)) * Number(it.unit_price || 0))) || 0,
            commission_amount: Number(((Number(it.commission_percentage || 0) / 100) * (Number(it.total_price || ((Number(it.quantity || 1)) * Number(it.unit_price || 0))) || 0)).toFixed(2)),
          }));
        if (commissionRows.length > 0) {
          await supabase.from('staff_commissions').insert(commissionRows as any);
        }
      } catch (e) {
        // Ignore if table missing or policies prevent insert; UI will still show items/staff
        console.warn('Skipping staff_commissions insert:', e);
      }
    }
    return receiptIns;
  } catch (err) {
    console.log('Using mock database for receipts');
    const nowIso = new Date().toISOString();
    const receipt = await mockDb.createReceipt({
      receipt_number: receiptData.receipt_number,
      customer_id: receiptData.customer_id || null,
      subtotal: receiptData.subtotal ?? 0,
      tax_amount: receiptData.tax_amount ?? 0,
      discount_amount: receiptData.discount_amount ?? 0,
      total_amount: receiptData.total_amount ?? 0,
      status: receiptData.status || 'open',
      notes: receiptData.notes || null,
      updated_at: nowIso,
      created_at: nowIso,
      location_id: receiptData.location_id || null,
    } as any);

    // Persist items to local storage for reporting/commissions fallbacks
    try {
      const storage = getStorage();
      storage.receipt_items = storage.receipt_items || [];
      for (const it of (items || [])) {
        storage.receipt_items.push({
          id: `ritem_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          receipt_id: receipt.id,
          service_id: it.service_id || null,
          product_id: it.product_id || null,
          description: it.description || 'Item',
          quantity: it.quantity || 1,
          unit_price: it.unit_price || 0,
          total_price: it.total_price || ((it.quantity || 1) * (it.unit_price || 0)),
          staff_id: it.staff_id || null,
          created_at: nowIso,
          updated_at: nowIso,
        });
      }
      setStorage(storage);
    } catch (err) { console.error(err) }

    return receipt;
  }
}

export async function getReceiptsWithFallback(supabase: any) {
  try {
    const { data, error } = await supabase
      .from('receipts')
      .select('id, receipt_number, customer_id, subtotal, tax_amount, discount_amount, total_amount, amount_paid, status, notes, created_at, updated_at, location_id')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.log('Using mock database for receipts');
    const storage = getStorage();
    const receipts = (storage.receipts || []).map((r: any) => {
      const paid = (storage.receipt_payments || [])
        .filter((p: any) => p.receipt_id === r.id)
        .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
      const total = Number(r.total_amount || 0);
      const derivedStatus = paid >= total ? 'paid' : paid > 0 ? 'partial' : (r.status || 'open');
      return { ...r, amount_paid: paid, status: derivedStatus };
    });
    return receipts;
  }
}

export async function getReceiptByIdWithFallback(supabase: any, id: string): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('receipts')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  } catch (err) {
    console.log('Using mock database for fetching single receipt');
    const storage = getStorage();
    const r = (storage.receipts || []).find((x: any) => x.id === id) || null;
    if (!r) return null;
    const paid = (storage.receipt_payments || [])
      .filter((p: any) => p.receipt_id === id)
      .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
    const total = Number(r.total_amount || 0);
    const derivedStatus = paid >= total ? 'paid' : paid > 0 ? 'partial' : (r.status || 'open');
    return { ...r, amount_paid: paid, status: derivedStatus };
  }
}

export async function getReceiptItemsWithFallback(supabase: any, receiptId: string): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('receipt_items')
      .select('id, receipt_id, description, quantity, unit_price, total_price, service_id, product_id, staff_id')
      .eq('receipt_id', receiptId);
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.log('Using mock database for fetching receipt items');
    const storage = getStorage();
    return (storage.receipt_items || [])
      .filter((it: any) => it.receipt_id === receiptId)
      .map((it: any) => ({
        id: it.id,
        receipt_id: it.receipt_id,
        description: it.description || 'Item',
        quantity: it.quantity || 1,
        unit_price: it.unit_price || 0,
        total_price: it.total_price || ((it.quantity || 1) * (it.unit_price || 0)),
        service_id: it.service_id || null,
        product_id: it.product_id || null,
        staff_id: it.staff_id || null,
        created_at: it.created_at,
        updated_at: it.updated_at,
      }));
  }
}

// Helper to record a receipt payment with fallback to local storage
export async function recordReceiptPaymentWithFallback(
  supabase: any,
  payment: { receipt_id: string; amount: number; method: string; reference_number?: string | null; payment_date?: string; location_id?: string | null }
): Promise<boolean> {
  try {
    const payload = {
      receipt_id: payment.receipt_id,
      amount: payment.amount,
      method: payment.method,
      reference_number: payment.reference_number || null,
      payment_date: payment.payment_date || new Date().toISOString().slice(0, 10),
      location_id: payment.location_id || null,
    } as any;
    const { error } = await supabase.from('receipt_payments').insert([payload]);
    if (error) throw error;
    return true;
  } catch (err) {
    console.log('Using mock database for receipt payments');
    // Guard: prevent fallback posting if period is locked (best-effort)
    try {
      const dateStr = (payment.payment_date || new Date().toISOString()).slice(0,10);
      // Try find organization via receipt
      const { data: rec } = await supabase.from('receipts').select('organization_id').eq('id', payment.receipt_id).maybeSingle();
      const orgId = (rec as any)?.organization_id || null;
      if (orgId) {
        const locked = await isDateLockedViaRpc(supabase, orgId, dateStr);
        if (locked) throw new Error('Accounting period is locked for this date');
      }
    } catch (guardErr: any) {
      throw guardErr;
    }
    const storage = getStorage();
    const nowIso = new Date().toISOString();
    const localPay = {
      id: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      receipt_id: payment.receipt_id,
      payment_date: (payment.payment_date || nowIso).slice(0, 10),
      amount: payment.amount,
      method: payment.method,
      reference_number: payment.reference_number || null,
      created_at: nowIso,
      updated_at: nowIso,
      location_id: payment.location_id || null,
    };
    storage.receipt_payments = storage.receipt_payments || [];
    storage.receipt_payments.push(localPay);

    // Update the related receipt's status based on total paid
    const receiptsArr: any[] = storage.receipts || [];
    const idx = receiptsArr.findIndex((x: any) => x.id === payment.receipt_id);
    if (idx !== -1) {
      const receipt = receiptsArr[idx];
      const paidSum = (storage.receipt_payments || [])
        .filter((p: any) => p.receipt_id === payment.receipt_id)
        .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
      const total = Number(receipt.total_amount || 0);
      const newStatus = paidSum >= total ? 'paid' : paidSum > 0 ? 'partial' : (receipt.status || 'open');
      receiptsArr[idx] = { ...receipt, status: newStatus, updated_at: nowIso };
      storage.receipts = receiptsArr;
    }

    setStorage(storage);
    return true;
  }
}

// Helper to fetch receipt payments with fallback to local storage
export async function getReceiptPaymentsWithFallback(supabase: any, receiptId: string): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('receipt_payments')
      .select('*')
      .eq('receipt_id', receiptId)
      .order('payment_date', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.log('Using mock database for fetching receipt payments');
    const storage = getStorage();
    const pays = (storage.receipt_payments || []).filter((p: any) => p.receipt_id === receiptId);
    return pays.sort((a: any, b: any) => String(b.payment_date).localeCompare(String(a.payment_date)));
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

// New: delete receipt with fallback helper
export async function deleteReceiptWithFallback(supabase: any, id: string) {
  try {
    // Delete child rows first
    await supabase.from('receipt_payments').delete().eq('receipt_id', id);
    await supabase.from('receipt_items').delete().eq('receipt_id', id);

    // Best-effort: delete any staff commission rows linked to this receipt
    try {
      await supabase.from('staff_commissions').delete().eq('receipt_id', id);
    } catch (e) {
      // Ignore if table missing or policies disallow
    }

    // Best-effort: remove any ledger entries that referenced this receipt's payments via RPC
    try {
      await (supabase as any).rpc('delete_account_transactions_by_reference', { p_reference_type: 'receipt_payment', p_reference_id: String(id) });
    } catch {
      try {
        await supabase
          .from('account_transactions')
          .delete()
          .eq('reference_type', 'receipt_payment')
          .eq('reference_id', String(id));
      } catch {}
    }

    const { error } = await supabase
      .from('receipts')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return true;
  } catch (error) {
    console.log('Using mock database for receipt deletion');
    const storage = getStorage();
    storage.receipts = (storage.receipts || []).filter((r: any) => r.id !== id);
    storage.receipt_items = (storage.receipt_items || []).filter((it: any) => it.receipt_id !== id && it.invoice_id !== id);
    storage.receipt_payments = (storage.receipt_payments || []).filter((p: any) => p.receipt_id !== id);
    setStorage(storage);
    return true;
  }
}

export async function updateReceiptWithFallback(supabase: any, id: string, updates: any) {
  try {
    // Whitelist updatable fields to avoid DB errors on unknown columns
    const allowed: any = {};
    if (typeof updates.status !== 'undefined') allowed.status = updates.status;
    if (typeof updates.notes !== 'undefined') allowed.notes = updates.notes;
    if (typeof updates.receipt_number !== 'undefined') allowed.receipt_number = updates.receipt_number;
    if (typeof updates.subtotal !== 'undefined') allowed.subtotal = updates.subtotal;
    if (typeof updates.tax_amount !== 'undefined') allowed.tax_amount = updates.tax_amount;
    if (typeof updates.discount_amount !== 'undefined') allowed.discount_amount = updates.discount_amount;
    if (typeof updates.total_amount !== 'undefined') allowed.total_amount = updates.total_amount;
    if (typeof updates.customer_id !== 'undefined') allowed.customer_id = updates.customer_id;
    if (typeof updates.job_card_id !== 'undefined') allowed.job_card_id = updates.job_card_id;
    if (typeof updates.location_id !== 'undefined') allowed.location_id = updates.location_id;

    const { error } = await supabase
      .from('receipts')
      .update(allowed)
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.log('Using mock database for receipt update');
    return await mockDb.updateInvoice(id, updates);
  }
}

export async function getAllReceiptPaymentsWithFallback(supabase: any): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('receipt_payments')
      .select('*')
      .order('payment_date', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.log('Using mock database for fetching all receipt payments');
    const storage = getStorage();
    return (storage.receipt_payments || []).slice().sort((a: any, b: any) => String(b.payment_date).localeCompare(String(a.payment_date)));
  }
}

export async function updateReceiptPaymentWithFallback(
  supabase: any,
  id: string,
  updates: Partial<{ amount: number; method: string; reference_number: string | null; payment_date: string }>
): Promise<boolean> {
  try {
    const allowed: any = {};
    if (typeof updates.amount !== 'undefined') allowed.amount = updates.amount;
    if (typeof updates.method !== 'undefined') allowed.method = updates.method;
    if (typeof updates.reference_number !== 'undefined') allowed.reference_number = updates.reference_number;
    if (typeof updates.payment_date !== 'undefined') allowed.payment_date = updates.payment_date;

    const { error } = await supabase
      .from('receipt_payments')
      .update(allowed)
      .eq('id', id);
    if (error) throw error;
    return true;
  } catch (err) {
    console.log('Using mock database for updating receipt payment');
    const storage = getStorage();
    storage.receipt_payments = (storage.receipt_payments || []).map((p: any) =>
      p.id === id ? { ...p, ...updates, updated_at: new Date().toISOString() } : p
    );
    setStorage(storage);
    return true;
  }
}

export async function deleteReceiptPaymentWithFallback(supabase: any, id: string): Promise<boolean> {
  // Prefer RPC that also removes ledger entries, if available
  try {
    const { error: rpcError } = await supabase.rpc('delete_receipt_payment_and_ledger', { p_payment_id: id });
    if (!rpcError) return true;
    // If RPC is missing or fails, fall through to legacy path
  } catch {}

  // Legacy: delete just the payment row
  try {
    // Fetch the payment first (to allow potential client-side cleanups if needed)
    let payment: any = null;
    try {
      const { data } = await supabase.from('receipt_payments').select('id, receipt_id, amount, payment_date').eq('id', id).maybeSingle();
      payment = data || null;
    } catch {}

    const { error } = await supabase.from('receipt_payments').delete().eq('id', id);
    if (error) throw error;

    // Best-effort: attempt to remove matching ledger rows if policy allows (not guaranteed)
    // Many setups keep ledger immutable; ignore failures silently
    if (payment && payment.receipt_id && payment.amount && payment.payment_date) {
      try {
        await supabase
          .from('account_transactions')
          .delete()
          .eq('reference_type', 'receipt_payment')
          .eq('reference_id', String(payment.receipt_id))
          .eq('transaction_date', payment.payment_date)
          .or(`debit_amount.eq.${Number(payment.amount)},credit_amount.eq.${Number(payment.amount)}` as any);
      } catch {}
    }

    return true;
  } catch (err) {
    console.log('Using mock database for deleting receipt payment');
    const storage = getStorage();

    // Capture the payment to recalc receipt status
    const existing = (storage.receipt_payments || []).find((p: any) => p.id === id) || null;

    storage.receipt_payments = (storage.receipt_payments || []).filter((p: any) => p.id !== id);

    // Recalculate related receipt status after deletion
    if (existing && existing.receipt_id) {
      try {
        const recId = existing.receipt_id;
        const receiptsArr: any[] = storage.receipts || [];
        const idx = receiptsArr.findIndex((x: any) => x.id === recId);
        if (idx !== -1) {
          const nowIso = new Date().toISOString();
          const receipt = receiptsArr[idx];
          const paidSum = (storage.receipt_payments || [])
            .filter((p: any) => p.receipt_id === recId)
            .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
          const total = Number(receipt.total_amount || 0);
          const newStatus = paidSum >= total ? 'paid' : paidSum > 0 ? 'partial' : (receipt.status || 'open');
          receiptsArr[idx] = { ...receipt, status: newStatus, updated_at: nowIso };
          storage.receipts = receiptsArr;
        }
      } catch {}
    }

    setStorage(storage);
    return true;
  }
}

export async function getReceiptItemsByServiceWithFallback(
  supabase: any,
  serviceId: string
): Promise<Array<{
  id: string;
  receipt_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  staff_id: string | null;
  created_at: string;
  receipt_number?: string | null;
  receipt_created_at?: string | null;
  customer_id?: string | null;
  staff_name?: string | null;
}>> {
  try {
    const { data, error } = await supabase
      .from('receipt_items')
      .select(`
        id, receipt_id, description, quantity, unit_price, total_price, staff_id, created_at,
        receipts:receipt_id ( id, receipt_number, created_at, customer_id ),
        staff:staff_id ( id, full_name )
      `)
      .eq('service_id', serviceId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const rows = (data || []).map((it: any) => ({
      id: it.id,
      receipt_id: it.receipt_id,
      description: it.description,
      quantity: Number(it.quantity) || 0,
      unit_price: Number(it.unit_price) || 0,
      total_price: Number(it.total_price) || 0,
      staff_id: it.staff_id || null,
      created_at: it.created_at,
      receipt_number: it.receipts?.receipt_number || null,
      receipt_created_at: it.receipts?.created_at || null,
      customer_id: it.receipts?.customer_id || null,
      staff_name: it.staff?.full_name || null,
    }));

    return rows;
  } catch (err) {
    // Fallback to local storage
    try {
      const storage = getStorage();
      const items = (storage.receipt_items || []).filter((x: any) => x.service_id === serviceId);
      const receiptsById: Record<string, any> = {};
      for (const r of (storage.receipts || [])) {
        receiptsById[r.id] = r;
      }
      return items
        .map((it: any) => {
          const rec = receiptsById[it.receipt_id] || null;
          return {
            id: it.id,
            receipt_id: it.receipt_id,
            description: it.description || 'Item',
            quantity: Number(it.quantity) || 0,
            unit_price: Number(it.unit_price) || 0,
            total_price: Number(it.total_price) || ((Number(it.quantity) || 0) * (Number(it.unit_price) || 0)),
            staff_id: it.staff_id || null,
            created_at: it.created_at,
            receipt_number: rec?.receipt_number || null,
            receipt_created_at: rec?.created_at || null,
            customer_id: rec?.customer_id || null,
            staff_name: null,
          };
        })
        .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)));
    } catch (e) {
      console.error('Local fallback failed for getReceiptItemsByServiceWithFallback', e);
      return [];
    }
  }
}

export async function isDateLockedViaRpc(supabase: any, organizationId: string, dateStr: string): Promise<boolean> {
  try {
    // Prefer RPC if exists
    const { data, error } = await supabase.rpc('is_date_locked', { p_org: organizationId, p_date: dateStr });
    if (error) return false;
    return !!data;
  } catch { return false; }
}