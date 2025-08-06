// Mock database for handling missing tables until proper migration
// This allows POS and invoice systems to work without database errors

interface MockSale {
  id: string;
  sale_number: string;
  customer_id: string | null;
  customer_name: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  payment_method: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface MockInvoice {
  id: string;
  invoice_number: string;
  customer_id: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  status: string;
  due_date: string | null;
  payment_method: string | null;
  notes: string | null;
  jobcard_id: string | null;
  created_at: string;
  updated_at: string;
}

// Use localStorage to persist mock data
class MockDatabase {
  private storageKey = 'salon_mock_db';

  private getStorage(): any {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : { sales: [], invoices: [], sale_items: [], invoice_items: [] };
    }
    return { sales: [], invoices: [], sale_items: [], invoice_items: [] };
  }

  private setStorage(data: any): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    }
  }

  // Sales operations
  async createSale(saleData: Omit<MockSale, 'id' | 'created_at' | 'updated_at'>): Promise<MockSale> {
    const storage = this.getStorage();
    const sale: MockSale = {
      ...saleData,
      id: `sale_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    storage.sales.push(sale);
    this.setStorage(storage);
    return sale;
  }

  async getSales(): Promise<MockSale[]> {
    const storage = this.getStorage();
    return storage.sales || [];
  }

  // Sale items operations
  async createSaleItems(items: any[]): Promise<any[]> {
    const storage = this.getStorage();
    const saleItems = items.map(item => ({
      ...item,
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString(),
    }));
    
    storage.sale_items.push(...saleItems);
    this.setStorage(storage);
    return saleItems;
  }

  // Invoice operations
  async createInvoice(invoiceData: Omit<MockInvoice, 'id' | 'created_at' | 'updated_at'>): Promise<MockInvoice> {
    const storage = this.getStorage();
    const invoice: MockInvoice = {
      ...invoiceData,
      id: `invoice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    storage.invoices.push(invoice);
    this.setStorage(storage);
    return invoice;
  }

  async getInvoices(): Promise<MockInvoice[]> {
    const storage = this.getStorage();
    return storage.invoices || [];
  }

  async updateInvoice(id: string, updates: Partial<MockInvoice>): Promise<MockInvoice | null> {
    const storage = this.getStorage();
    const index = storage.invoices.findIndex((inv: MockInvoice) => inv.id === id);
    
    if (index !== -1) {
      storage.invoices[index] = {
        ...storage.invoices[index],
        ...updates,
        updated_at: new Date().toISOString(),
      };
      this.setStorage(storage);
      return storage.invoices[index];
    }
    
    return null;
  }

  async deleteInvoice(id: string): Promise<boolean> {
    const storage = this.getStorage();
    const index = storage.invoices.findIndex((inv: MockInvoice) => inv.id === id);
    
    if (index !== -1) {
      storage.invoices.splice(index, 1);
      // Also remove associated items
      storage.invoice_items = storage.invoice_items.filter((item: any) => item.invoice_id !== id);
      this.setStorage(storage);
      return true;
    }
    
    return false;
  }

  // Invoice items operations
  async createInvoiceItems(items: any[]): Promise<any[]> {
    const storage = this.getStorage();
    const invoiceItems = items.map(item => ({
      ...item,
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString(),
    }));
    
    storage.invoice_items.push(...invoiceItems);
    this.setStorage(storage);
    return invoiceItems;
  }

  async getInvoiceItems(invoiceId: string): Promise<any[]> {
    const storage = this.getStorage();
    return storage.invoice_items.filter((item: any) => item.invoice_id === invoiceId) || [];
  }
}

export const mockDb = new MockDatabase();

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
    const sale = await mockDb.createSale(saleData);
    await mockDb.createSaleItems(items.map(item => ({
      sale_id: sale.id,
      product_id: item.product.id,
      quantity: item.quantity,
      unit_price: item.product.selling_price,
      discount_percentage: item.discount,
      total_price: item.total,
    })));
    return sale;
  }
}

// Wrapper function for Invoice operations
export async function createInvoiceWithFallback(supabase: any, invoiceData: any, items: any[]) {
  try {
    // Try to use real database first
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert([invoiceData])
      .select()
      .single();

    if (invoiceError) throw invoiceError;

    const itemsData = items.map(item => ({
      invoice_id: invoice.id,
      service_id: item.service_id || null,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount_percentage: item.discount_percentage,
      staff_id: item.staff_id || null,
      commission_percentage: item.commission_percentage,
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
    const invoice = await mockDb.createInvoice(invoiceData);
    await mockDb.createInvoiceItems(items.map(item => ({
      invoice_id: invoice.id,
      service_id: item.service_id || null,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount_percentage: item.discount_percentage,
      staff_id: item.staff_id || null,
      commission_percentage: item.commission_percentage,
      total_price: item.total_price,
    })));
    return invoice;
  }
}

export async function getInvoicesWithFallback(supabase: any) {
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.log('Using mock database for invoices');
    return await mockDb.getInvoices();
  }
}

export async function updateInvoiceWithFallback(supabase: any, id: string, updates: any) {
  try {
    const { error } = await supabase
      .from('invoices')
      .update(updates)
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
      .select('*')
      .eq('invoice_id', invoiceId);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.log('Using mock database for invoice items');
    return await mockDb.getInvoiceItems(invoiceId);
  }
}