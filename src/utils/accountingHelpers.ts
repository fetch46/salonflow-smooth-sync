import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Enhanced accounting helpers for automatic journal entries
 */

interface JournalEntry {
  date: string;
  memo?: string;
  lines: Array<{
    accountId: string;
    description?: string;
    debit: number;
    credit: number;
  }>;
}

/**
 * Posts a journal entry with proper validation
 */
export const postJournalEntry = async (entry: JournalEntry) => {
  try {
    // Validate the entry
    if (!entry.lines || entry.lines.length < 2) {
      throw new Error('Journal entry must have at least 2 lines');
    }

    const totalDebits = entry.lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredits = entry.lines.reduce((sum, line) => sum + line.credit, 0);
    
    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      throw new Error('Debits and credits must balance');
    }

    // Create the journal entry via API
    const response = await fetch('/api/journal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('jwt_token') || ''}`
      },
      body: JSON.stringify({
        date: entry.date,
        memo: entry.memo,
        lines: entry.lines.map(line => ({
          accountId: line.accountId,
          description: line.description,
          debit: line.debit,
          credit: line.credit
        }))
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to post journal entry');
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error posting journal entry:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Creates automatic journal entries for common business transactions
 */
export const createAutoJournalEntry = async (
  transactionType: string,
  amount: number,
  date: string,
  description: string,
  organizationId: string,
  referenceId?: string
) => {
  try {
    // Get the default accounts for this organization
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id, account_code, account_name')
      .eq('organization_id', organizationId)
      .eq('is_active', true);

    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts found for organization');
    }

    const accountMap = new Map(accounts.map(acc => [acc.account_code, acc]));

    let journalLines: Array<{ accountId: string; description: string; debit: number; credit: number }> = [];

    switch (transactionType) {
      case 'sales_revenue':
        // Dr. Accounts Receivable, Cr. Service Revenue
        const arAccount = accountMap.get('1100'); // Accounts Receivable
        const revenueAccount = accountMap.get('4001'); // Service Revenue
        
        if (arAccount && revenueAccount) {
          journalLines = [
            { accountId: arAccount.id, description, debit: amount, credit: 0 },
            { accountId: revenueAccount.id, description, debit: 0, credit: amount }
          ];
        }
        break;

      case 'cash_payment':
        // Dr. Cash, Cr. Accounts Receivable
        const cashAccount = accountMap.get('1001'); // Cash
        const arAccountPayment = accountMap.get('1100'); // Accounts Receivable
        
        if (cashAccount && arAccountPayment) {
          journalLines = [
            { accountId: cashAccount.id, description, debit: amount, credit: 0 },
            { accountId: arAccountPayment.id, description, debit: 0, credit: amount }
          ];
        }
        break;

      case 'expense_payment':
        // Dr. Expense Account, Cr. Cash/Bank
        const expenseAccount = accountMap.get('5400'); // Supplies Expense (default)
        const bankAccount = accountMap.get('1002'); // Bank Account
        
        if (expenseAccount && bankAccount) {
          journalLines = [
            { accountId: expenseAccount.id, description, debit: amount, credit: 0 },
            { accountId: bankAccount.id, description, debit: 0, credit: amount }
          ];
        }
        break;

      case 'inventory_purchase':
        // Dr. Inventory, Cr. Accounts Payable
        const inventoryAccount = accountMap.get('1200'); // Inventory
        const apAccount = accountMap.get('2001'); // Accounts Payable
        
        if (inventoryAccount && apAccount) {
          journalLines = [
            { accountId: inventoryAccount.id, description, debit: amount, credit: 0 },
            { accountId: apAccount.id, description, debit: 0, credit: amount }
          ];
        }
        break;

      case 'cost_of_goods_sold':
        // Dr. COGS, Cr. Inventory
        const cogsAccount = accountMap.get('5001'); // Cost of Goods Sold
        const invAccount = accountMap.get('1200'); // Inventory
        
        if (cogsAccount && invAccount) {
          journalLines = [
            { accountId: cogsAccount.id, description, debit: amount, credit: 0 },
            { accountId: invAccount.id, description, debit: 0, credit: amount }
          ];
        }
        break;

      default:
        throw new Error(`Unsupported transaction type: ${transactionType}`);
    }

    if (journalLines.length === 0) {
      throw new Error('Could not create journal entry - missing required accounts');
    }

    // Post the journal entry
    const result = await postJournalEntry({
      date,
      memo: `Auto: ${description} ${referenceId ? `(Ref: ${referenceId})` : ''}`,
      lines: journalLines
    });

    return result;
  } catch (error: any) {
    console.error('Error creating auto journal entry:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Automatic journal entries for invoice-related transactions
 */
export const handleInvoiceJournalEntries = {
  /**
   * Creates journal entry when invoice is created (sales on credit)
   */
  onCreate: async (invoiceData: {
    id: string;
    total_amount: number;
    created_at: string;
    organization_id: string;
    invoice_number?: string;
  }) => {
    return await createAutoJournalEntry(
      'sales_revenue',
      invoiceData.total_amount,
      invoiceData.created_at.split('T')[0],
      `Invoice ${invoiceData.invoice_number || invoiceData.id}`,
      invoiceData.organization_id,
      invoiceData.id
    );
  },

  /**
   * Creates journal entry when payment is received
   */
  onPayment: async (paymentData: {
    amount: number;
    payment_date: string;
    organization_id: string;
    invoice_id: string;
    reference?: string;
  }) => {
    return await createAutoJournalEntry(
      'cash_payment',
      paymentData.amount,
      paymentData.payment_date,
      `Payment for invoice ${paymentData.reference || paymentData.invoice_id}`,
      paymentData.organization_id,
      paymentData.invoice_id
    );
  }
};

/**
 * Automatic journal entries for expense transactions
 */
export const handleExpenseJournalEntries = {
  onPayment: async (expenseData: {
    id: string;
    amount: number;
    expense_date: string;
    organization_id: string;
    description: string;
    expense_number?: string;
  }) => {
    return await createAutoJournalEntry(
      'expense_payment',
      expenseData.amount,
      expenseData.expense_date,
      `${expenseData.description} - ${expenseData.expense_number || expenseData.id}`,
      expenseData.organization_id,
      expenseData.id
    );
  }
};

/**
 * Automatic journal entries for inventory transactions
 */
export const handleInventoryJournalEntries = {
  onPurchase: async (purchaseData: {
    id: string;
    total_amount: number;
    purchase_date: string;
    organization_id: string;
    purchase_number?: string;
  }) => {
    return await createAutoJournalEntry(
      'inventory_purchase',
      purchaseData.total_amount,
      purchaseData.purchase_date,
      `Purchase ${purchaseData.purchase_number || purchaseData.id}`,
      purchaseData.organization_id,
      purchaseData.id
    );
  },

  onSale: async (saleData: {
    cost_amount: number;
    sale_date: string;
    organization_id: string;
    reference: string;
  }) => {
    return await createAutoJournalEntry(
      'cost_of_goods_sold',
      saleData.cost_amount,
      saleData.sale_date,
      `COGS for ${saleData.reference}`,
      saleData.organization_id,
      saleData.reference
    );
  }
};