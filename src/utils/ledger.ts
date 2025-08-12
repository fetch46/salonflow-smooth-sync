import { supabase } from "@/integrations/supabase/client";

export type LedgerPostParams = {
  organizationId: string;
  amount: number;
  transactionDate?: string; // yyyy-mm-dd
  description?: string;
  debitAccountId: string; // asset/expense/etc to debit
  creditAccountId: string; // income/liability/etc to credit
  referenceType?: string;
  referenceId?: string;
  locationId?: string | null;
};

let accountTransactionsSupportsLocationIdCache: boolean | null = null;
async function accountTransactionsSupportsLocationId(): Promise<boolean> {
  if (accountTransactionsSupportsLocationIdCache !== null) return accountTransactionsSupportsLocationIdCache;
  try {
    const { error } = await supabase
      .from("account_transactions")
      .select("id, location_id")
      .limit(1);
    if (error) {
      const msg = String(error.message || "").toLowerCase();
      if (msg.includes("column") && msg.includes("location_id") && msg.includes("does not exist")) {
        accountTransactionsSupportsLocationIdCache = false;
        return false;
      }
      // Unknown error: default to assuming column exists to avoid data shape drift
      accountTransactionsSupportsLocationIdCache = true;
      return true;
    }
    accountTransactionsSupportsLocationIdCache = true;
    return true;
  } catch {
    accountTransactionsSupportsLocationIdCache = false;
    return false;
  }
}

async function findAccountIdBySubtype(organizationId: string, subtype: string): Promise<string | null> {
  try {
    // Prefer account_subtype match
    const { data, error } = await supabase
      .from("accounts")
      .select("id, account_code, account_name, account_subtype")
      .eq("organization_id", organizationId)
      .eq("account_subtype", subtype)
      .limit(1);
    if (!error && data && data.length) return data[0].id;
  } catch {}

  // Fallback to canonical codes
  try {
    const code = subtype === "Cash" ? "1001" : subtype === "Bank" ? "1002" : undefined;
    if (!code) return null;
    const { data } = await supabase
      .from("accounts")
      .select("id, account_code")
      .eq("organization_id", organizationId)
      .eq("account_code", code)
      .limit(1);
    if (data && data.length) return data[0].id;
  } catch {}
  return null;
}

async function findDefaultIncomeAccountId(organizationId: string): Promise<string | null> {
  // Prefer Hair Services Revenue (4001), then any Income account
  try {
    const { data } = await supabase
      .from("accounts")
      .select("id, account_code, account_type")
      .eq("organization_id", organizationId)
      .eq("account_code", "4001")
      .limit(1);
    if (data && data.length) return data[0].id;
  } catch {}
  try {
    const { data } = await supabase
      .from("accounts")
      .select("id, account_type")
      .eq("organization_id", organizationId)
      .eq("account_type", "Income")
      .order("account_code", { ascending: true })
      .limit(1);
    if (data && data.length) return data[0].id;
  } catch {}
  return null;
}

// New: find Accounts Receivable account id (prefer 1100 or name containing Receivable)
async function findAccountsReceivableAccountId(organizationId: string): Promise<string | null> {
  try {
    const { data } = await supabase
      .from("accounts")
      .select("id, account_code")
      .eq("organization_id", organizationId)
      .eq("account_code", "1100")
      .limit(1);
    if (data && data.length) return data[0].id;
  } catch {}
  try {
    const { data } = await supabase
      .from("accounts")
      .select("id, account_name, account_type")
      .eq("organization_id", organizationId)
      .eq("account_type", "Asset")
      .ilike("account_name", "%receivable%")
      .order("account_code", { ascending: true })
      .limit(1);
    if (data && data.length) return data[0].id;
  } catch {}
  return null;
}

// New: find Unearned/Deferred Revenue liability account (prefer code 2300 or name containing "unearned"/"deferred")
async function findUnearnedRevenueAccountId(organizationId: string): Promise<string | null> {
  try {
    const { data } = await supabase
      .from("accounts")
      .select("id, account_code")
      .eq("organization_id", organizationId)
      .eq("account_code", "2300")
      .limit(1);
    if (data && data.length) return data[0].id;
  } catch {}
  try {
    const { data } = await supabase
      .from("accounts")
      .select("id, account_name, account_type")
      .eq("organization_id", organizationId)
      .eq("account_type", "Liability")
      .or("account_name.ilike.%unearned%,account_name.ilike.%deferred%")
      .order("account_code", { ascending: true })
      .limit(1);
    if (data && data.length) return data[0].id;
  } catch {}
  // Fallback: first liability account
  try {
    const { data } = await supabase
      .from("accounts")
      .select("id, account_type")
      .eq("organization_id", organizationId)
      .eq("account_type", "Liability")
      .order("account_code", { ascending: true })
      .limit(1);
    if (data && data.length) return data[0].id;
  } catch {}
  return null;
}

export async function findAccountIdByCode(organizationId: string, code: string): Promise<string | null> {
  try {
    const { data } = await supabase
      .from("accounts")
      .select("id, account_code")
      .eq("organization_id", organizationId)
      .eq("account_code", code)
      .limit(1);
    if (data && data.length) return data[0].id;
  } catch {}
  return null;
}

async function findDefaultExpenseAccountId(organizationId: string): Promise<string | null> {
  // Prefer Supplies Expense (5400), else any Expense account
  try {
    const { data } = await supabase
      .from("accounts")
      .select("id, account_code")
      .eq("organization_id", organizationId)
      .eq("account_code", "5400")
      .limit(1);
    if (data && data.length) return data[0].id;
  } catch {}
  try {
    const { data } = await supabase
      .from("accounts")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("account_type", "Expense")
      .order("account_code", { ascending: true })
      .limit(1);
    if (data && data.length) return data[0].id;
  } catch {}
  return null;
}

async function findDepositAccountIdForMethod(organizationId: string, method: string): Promise<string | null> {
  try {
    const methodKey = String(method || "").toLowerCase();
    const { data: org } = await supabase
      .from("organizations")
      .select("id, settings")
      .eq("id", organizationId)
      .maybeSingle();
    const map = (org?.settings as any)?.default_deposit_accounts_by_method || {};
    const candidateId: string | null = map?.[methodKey] || null;
    if (!candidateId) return null;
    const { data: acc } = await supabase
      .from("accounts")
      .select("id")
      .eq("id", candidateId)
      .eq("organization_id", organizationId)
      .limit(1);
    if (acc && acc.length) return candidateId;
  } catch {}
  return null;
}

export async function postDoubleEntry(params: LedgerPostParams): Promise<boolean> {
  const {
    organizationId,
    amount,
    transactionDate,
    description,
    debitAccountId,
    creditAccountId,
    referenceType,
    referenceId,
    locationId,
  } = params;

  if (!debitAccountId || !creditAccountId) return false;
  const date = transactionDate || new Date().toISOString().slice(0, 10);
  const desc = description || "Transaction";

  try {
    const includeLocation = !!locationId && (await accountTransactionsSupportsLocationId());
    const debitRow: any = {
      account_id: debitAccountId,
      transaction_date: date,
      description: desc,
      debit_amount: amount,
      credit_amount: 0,
      reference_type: referenceType || null,
      reference_id: referenceId || null,
    };
    const creditRow: any = {
      account_id: creditAccountId,
      transaction_date: date,
      description: desc,
      debit_amount: 0,
      credit_amount: amount,
      reference_type: referenceType || null,
      reference_id: referenceId || null,
    };
    if (includeLocation) {
      debitRow.location_id = locationId;
      creditRow.location_id = locationId;
    }

    const { error } = await supabase.from("account_transactions").insert([debitRow, creditRow]);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error("Failed to post ledger entries", err);
    return false;
  }
}

export async function postReceiptPaymentToLedger(opts: {
  organizationId: string;
  amount: number;
  method: string; // cash | mpesa | bank_transfer | card | other
  receiptId: string;
  receiptNumber?: string | null;
  paymentDate?: string; // yyyy-mm-dd
  locationId?: string | null;
}): Promise<boolean> {
  const { organizationId, amount, method, receiptId, receiptNumber, paymentDate, locationId } = opts;

  // Determine asset account using explicit mapping if configured; fallback to subtype
  const mappedAssetAccountId = await findDepositAccountIdForMethod(organizationId, method);

  // Determine asset account: Cash vs Bank
  const isBankLike = ["mpesa", "bank_transfer", "card", "bank", "mpesa_paybill", "mpesa_till"].includes(
    String(method || "").toLowerCase()
  );
  const assetSubtype = isBankLike ? "Bank" : "Cash";

  const assetAccountId = mappedAssetAccountId || (await findAccountIdBySubtype(organizationId, assetSubtype));
  const incomeAccountId = await findDefaultIncomeAccountId(organizationId);

  if (!assetAccountId || !incomeAccountId) {
    console.warn("Missing asset or income account for ledger posting", { assetSubtype, assetAccountId, incomeAccountId });
    return false;
  }

  const desc = `Receipt ${receiptNumber || receiptId} payment via ${method}`;
  return await postDoubleEntry({
    organizationId,
    amount,
    transactionDate: paymentDate,
    description: desc,
    debitAccountId: assetAccountId,
    creditAccountId: incomeAccountId,
    referenceType: "receipt_payment",
    referenceId: receiptId,
    locationId: locationId || null,
  });
}

export async function postReceiptPaymentWithAccount(opts: {
  organizationId: string;
  amount: number;
  depositAccountId: string; // Cash/Bank account to debit
  receiptId: string;
  receiptNumber?: string | null;
  paymentDate?: string; // yyyy-mm-dd
  locationId?: string | null;
}): Promise<boolean> {
  const { organizationId, amount, depositAccountId, receiptId, receiptNumber, paymentDate, locationId } = opts;
  const incomeAccountId = await findDefaultIncomeAccountId(organizationId);
  if (!incomeAccountId) return false;
  const desc = `Receipt ${receiptNumber || receiptId} payment`;
  return await postDoubleEntry({
    organizationId,
    amount,
    transactionDate: paymentDate,
    description: desc,
    debitAccountId: depositAccountId,
    creditAccountId: incomeAccountId,
    referenceType: "receipt_payment",
    referenceId: receiptId,
    locationId: locationId || null,
  });
}

export async function postReceiptPaymentWithAccounts(opts: {
  organizationId: string;
  amount: number;
  depositAccountId: string; // Cash/Bank account to debit
  incomeAccountId: string;  // Revenue account to credit
  receiptId: string;
  receiptNumber?: string | null;
  paymentDate?: string; // yyyy-mm-dd
  locationId?: string | null;
}): Promise<boolean> {
  const { organizationId, amount, depositAccountId, incomeAccountId, receiptId, receiptNumber, paymentDate, locationId } = opts;
  const desc = `Receipt ${receiptNumber || receiptId} payment`;
  return await postDoubleEntry({
    organizationId,
    amount,
    transactionDate: paymentDate,
    description: desc,
    debitAccountId: depositAccountId,
    creditAccountId: incomeAccountId,
    referenceType: "receipt_payment",
    referenceId: receiptId,
    locationId: locationId || null,
  });
}

// New: Post an invoice payment (DR Cash/Bank, CR Accounts Receivable)
export async function postInvoicePaymentToLedger(opts: {
  organizationId: string;
  amount: number;
  method: string;
  invoiceId: string;
  invoiceNumber?: string | null;
  paymentDate?: string;
  locationId?: string | null;
}): Promise<boolean> {
  const { organizationId, amount, method, invoiceId, invoiceNumber, paymentDate, locationId } = opts;
  const mappedAssetAccountId = await findDepositAccountIdForMethod(organizationId, method);
  const isBankLike = ["mpesa", "bank_transfer", "card", "bank", "mpesa_paybill", "mpesa_till"].includes(String(method || "").toLowerCase());
  const assetSubtype = isBankLike ? "Bank" : "Cash";
  const assetAccountId = mappedAssetAccountId || (await findAccountIdBySubtype(organizationId, assetSubtype));
  const arAccountId = await findAccountsReceivableAccountId(organizationId);
  if (!assetAccountId || !arAccountId) return false;
  const desc = `Invoice ${invoiceNumber || invoiceId} payment via ${method}`;
  return await postDoubleEntry({
    organizationId,
    amount,
    transactionDate: paymentDate,
    description: desc,
    debitAccountId: assetAccountId,
    creditAccountId: arAccountId,
    referenceType: "invoice_payment",
    referenceId: invoiceId,
    locationId: locationId || null,
  });
}

export async function postInvoicePaymentWithAccount(opts: {
  organizationId: string;
  amount: number;
  depositAccountId: string; // Cash/Bank
  invoiceId: string;
  invoiceNumber?: string | null;
  paymentDate?: string;
  locationId?: string | null;
}): Promise<boolean> {
  const { organizationId, amount, depositAccountId, invoiceId, invoiceNumber, paymentDate, locationId } = opts;
  const arAccountId = await findAccountsReceivableAccountId(organizationId);
  if (!arAccountId) return false;
  const desc = `Invoice ${invoiceNumber || invoiceId} payment`;
  return await postDoubleEntry({
    organizationId,
    amount,
    transactionDate: paymentDate,
    description: desc,
    debitAccountId: depositAccountId,
    creditAccountId: arAccountId,
    referenceType: "invoice_payment",
    referenceId: invoiceId,
    locationId: locationId || null,
  });
}

// New: Post booking prepayment to Unearned Revenue (DR Cash/Bank, CR Unearned Revenue)
export async function postBookingPrepaymentToUnearnedRevenue(opts: {
  organizationId: string;
  amount: number;
  method: string;
  clientId?: string | null;
  paymentDate?: string;
  locationId?: string | null;
}): Promise<boolean> {
  const { organizationId, amount, method, clientId, paymentDate, locationId } = opts;
  const mappedAssetAccountId = await findDepositAccountIdForMethod(organizationId, method);
  const isBankLike = ["mpesa", "bank_transfer", "card", "bank", "mpesa_paybill", "mpesa_till"].includes(String(method || "").toLowerCase());
  const assetSubtype = isBankLike ? "Bank" : "Cash";
  const assetAccountId = mappedAssetAccountId || (await findAccountIdBySubtype(organizationId, assetSubtype));
  const unearnedRevenueAccountId = await findUnearnedRevenueAccountId(organizationId);
  if (!assetAccountId || !unearnedRevenueAccountId) return false;
  const desc = `Booking prepayment${clientId ? ` for client ${clientId}` : ""}`;
  return await postDoubleEntry({
    organizationId,
    amount,
    transactionDate: paymentDate,
    description: desc,
    debitAccountId: assetAccountId,
    creditAccountId: unearnedRevenueAccountId,
    referenceType: "prepayment",
    referenceId: clientId || null,
    locationId: locationId || null,
  });
}

// New: Apply a prepayment to an invoice (DR Unearned Revenue, CR Accounts Receivable)
export async function applyPrepaymentToInvoice(opts: {
  organizationId: string;
  amount: number;
  invoiceId: string;
  invoiceNumber?: string | null;
  clientId?: string | null;
  applyDate?: string;
  locationId?: string | null;
}): Promise<boolean> {
  const { organizationId, amount, invoiceId, invoiceNumber, clientId, applyDate, locationId } = opts;
  const unearnedRevenueAccountId = await findUnearnedRevenueAccountId(organizationId);
  const arAccountId = await findAccountsReceivableAccountId(organizationId);
  if (!unearnedRevenueAccountId || !arAccountId) return false;
  const desc = `Apply prepayment${clientId ? ` for client ${clientId}` : ""} to invoice ${invoiceNumber || invoiceId}`;
  return await postDoubleEntry({
    organizationId,
    amount,
    transactionDate: applyDate,
    description: desc,
    debitAccountId: unearnedRevenueAccountId,
    creditAccountId: arAccountId,
    referenceType: "prepayment_application",
    referenceId: invoiceId,
    locationId: locationId || null,
  });
}

export async function postReceiptPaymentToLedgerWithIncomeAccount(opts: {
  organizationId: string;
  amount: number;
  method: string; // cash | mpesa | bank_transfer | card | other
  incomeAccountId: string; // Revenue account to credit
  receiptId: string;
  receiptNumber?: string | null;
  paymentDate?: string; // yyyy-mm-dd
  locationId?: string | null;
}): Promise<boolean> {
  const { organizationId, amount, method, incomeAccountId, receiptId, receiptNumber, paymentDate, locationId } = opts;
  // Determine asset account using explicit mapping if configured; fallback to subtype
  const mappedAssetAccountId = await findDepositAccountIdForMethod(organizationId, method);
  const isBankLike = ["mpesa", "bank_transfer", "card", "bank", "mpesa_paybill", "mpesa_till"].includes(String(method || "").toLowerCase());
  const assetSubtype = isBankLike ? "Bank" : "Cash";
  const assetAccountId = mappedAssetAccountId || (await findAccountIdBySubtype(organizationId, assetSubtype));
  if (!assetAccountId) return false;
  const desc = `Receipt ${receiptNumber || receiptId} payment via ${method}`;
  return await postDoubleEntry({
    organizationId,
    amount,
    transactionDate: paymentDate,
    description: desc,
    debitAccountId: assetAccountId,
    creditAccountId: incomeAccountId,
    referenceType: "receipt_payment",
    referenceId: receiptId,
    locationId: locationId || null,
  });
}

export async function postExpensePaymentToLedger(opts: {
  organizationId: string;
  amount: number;
  method: string; // Cash | Bank Transfer | Credit Card | Other
  expenseId: string;
  expenseNumber?: string | null;
  paymentDate?: string; // yyyy-mm-dd
  locationId?: string | null;
}): Promise<boolean> {
  const { organizationId, amount, method, expenseId, expenseNumber, paymentDate, locationId } = opts;
  const isBankLike = ["bank transfer", "credit card", "bank", "card"].includes(String(method || "").toLowerCase());
  const assetSubtype = isBankLike ? "Bank" : "Cash";

  const assetAccountId = await findAccountIdBySubtype(organizationId, assetSubtype);
  const expenseAccountId = await findDefaultExpenseAccountId(organizationId);
  if (!assetAccountId || !expenseAccountId) return false;

  const desc = `Expense ${expenseNumber || expenseId} payment via ${method}`;
  return await postDoubleEntry({
    organizationId,
    amount,
    transactionDate: paymentDate,
    description: desc,
    debitAccountId: expenseAccountId,
    creditAccountId: assetAccountId,
    referenceType: "expense_payment",
    referenceId: expenseId,
    locationId: locationId || null,
  });
}

export async function postExpensePaymentWithAccount(opts: {
  organizationId: string;
  amount: number;
  paidFromAccountId: string; // Cash/Bank account used
  expenseId: string;
  expenseNumber?: string | null;
  paymentDate?: string; // yyyy-mm-dd
  locationId?: string | null;
}): Promise<boolean> {
  const { organizationId, amount, paidFromAccountId, expenseId, expenseNumber, paymentDate, locationId } = opts;
  const expenseAccountId = await findDefaultExpenseAccountId(organizationId);
  if (!expenseAccountId) return false;
  const desc = `Expense ${expenseNumber || expenseId} payment`;
  return await postDoubleEntry({
    organizationId,
    amount,
    transactionDate: paymentDate,
    description: desc,
    debitAccountId: expenseAccountId,
    creditAccountId: paidFromAccountId,
    referenceType: "expense_payment",
    referenceId: expenseId,
    locationId: locationId || null,
  });
}

export async function postPurchasePaymentToLedger(opts: {
  organizationId: string;
  amount: number;
  paidFromAccountId: string; // Cash/Bank account used
  purchaseId: string;
  purchaseNumber?: string | null;
  paymentDate?: string; // yyyy-mm-dd
  locationId?: string | null;
}): Promise<boolean> {
  const { organizationId, amount, paidFromAccountId, purchaseId, purchaseNumber, paymentDate, locationId } = opts;
  const apAccountId = await findAccountIdByCode(organizationId, "2001"); // Accounts Payable
  if (!apAccountId) return false;
  const desc = `Purchase ${purchaseNumber || purchaseId} payment`;
  return await postDoubleEntry({
    organizationId,
    amount,
    transactionDate: paymentDate,
    description: desc,
    debitAccountId: apAccountId,
    creditAccountId: paidFromAccountId,
    referenceType: "purchase_payment",
    referenceId: purchaseId,
    locationId: locationId || null,
  });
}

export async function postAccountTransfer(opts: {
  organizationId: string;
  amount: number;
  fromAccountId: string; // credit this account
  toAccountId: string;   // debit this account
  transferDate?: string; // yyyy-mm-dd
  description?: string;
  referenceId?: string;
  locationId?: string | null;
}): Promise<boolean> {
  const { organizationId, amount, fromAccountId, toAccountId, transferDate, description, referenceId, locationId } = opts;
  const desc = description || "Account transfer";
  return await postDoubleEntry({
    organizationId,
    amount,
    transactionDate: transferDate,
    description: desc,
    debitAccountId: toAccountId,
    creditAccountId: fromAccountId,
    referenceType: "account_transfer",
    referenceId: referenceId || null,
    locationId: locationId || null,
  });
}

export async function deleteTransactionsByReference(referenceType: string, referenceId: string): Promise<number> {
  try {
    const { data, error } = await (supabase as any).rpc(
      "delete_account_transactions_by_reference",
      { p_reference_type: referenceType, p_reference_id: String(referenceId) }
    );
    if (error) throw error;
    let deletedCount = Number(data || 0);

    // Also clean legacy/alternate reference types for expenses
    if (referenceType === "expense_payment") {
      try {
        const { data: data2, error: err2 } = await (supabase as any).rpc(
          "delete_account_transactions_by_reference",
          { p_reference_type: "expense", p_reference_id: String(referenceId) }
        );
        if (!err2) deletedCount += Number(data2 || 0);
      } catch {}
    } else if (referenceType === "expense") {
      try {
        const { data: data2, error: err2 } = await (supabase as any).rpc(
          "delete_account_transactions_by_reference",
          { p_reference_type: "expense_payment", p_reference_id: String(referenceId) }
        );
        if (!err2) deletedCount += Number(data2 || 0);
      } catch {}
    }

    return deletedCount;
  } catch (rpcErr) {
    // Fallback: attempt direct delete (may fail due to RLS; ignore errors)
    let total = 0;
    try {
      const { count } = await (supabase as any)
        .from("account_transactions")
        .delete({ count: "exact" })
        .eq("reference_type", referenceType)
        .eq("reference_id", String(referenceId));
      total += Number(count || 0);
    } catch {}

    // Also attempt legacy expense type cleanup in fallback
    if (referenceType === "expense_payment") {
      try {
        const { count } = await (supabase as any)
          .from("account_transactions")
          .delete({ count: "exact" })
          .eq("reference_type", "expense")
          .eq("reference_id", String(referenceId));
        total += Number(count || 0);
      } catch {}
    } else if (referenceType === "expense") {
      try {
        const { count } = await (supabase as any)
          .from("account_transactions")
          .delete({ count: "exact" })
          .eq("reference_type", "expense_payment")
          .eq("reference_id", String(referenceId));
        total += Number(count || 0);
      } catch {}
    }

    return total;
  }
}

export type MultiLineEntry = {
  accountId: string;
  debit: number;
  credit: number;
  description?: string;
  productId?: string;
  locationId?: string | null;
};

export async function postMultiLineEntry(opts: {
  date?: string;
  description?: string;
  lines: MultiLineEntry[];
  referenceType?: string;
  referenceId?: string;
}): Promise<boolean> {
  const { date, description, lines, referenceType, referenceId } = opts;
  try {
    const txDate = date || new Date().toISOString().slice(0, 10);
    const rows = lines.map((l) => ({
      account_id: l.accountId,
      transaction_date: txDate,
      description: l.description || description || null,
      debit_amount: Number(l.debit || 0),
      credit_amount: Number(l.credit || 0),
      reference_type: referenceType || null,
      reference_id: referenceId || null,
      location_id: l.locationId || null,
    }));
    const total = rows.reduce((s, r) => s + Number(r.debit_amount) - Number(r.credit_amount), 0);
    if (Math.abs(total) > 0.0001) {
      console.warn("Unbalanced multi-line entry", { total });
      return false;
    }
    const { error } = await supabase.from("account_transactions").insert(rows);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error("postMultiLineEntry failed", e);
    return false;
  }
}

export async function postSaleCOGSAndInventory(opts: {
  organizationId: string;
  productId: string;
  quantity: number;
  unitCost: number;
  locationId?: string | null;
  date?: string;
  referenceId?: string;
  cogsAccountId?: string | null; // optional override
  inventoryAccountId?: string | null; // optional override
}): Promise<boolean> {
  const { organizationId, productId, quantity, unitCost, locationId, date, referenceId, cogsAccountId, inventoryAccountId } = opts;
  try {
    const totalCost = Number(quantity || 0) * Number(unitCost || 0);
    if (totalCost <= 0) return false;

    let invAccId = inventoryAccountId || null;
    let cogsAccId = cogsAccountId || null;

    // Try per-item mapping first
    try {
      const { data: map } = await supabase
        .from("inventory_item_accounts")
        .select("inventory_account_id")
        .eq("item_id", productId)
        .maybeSingle();
      invAccId = invAccId || (map as any)?.inventory_account_id || null;
    } catch {}

    // Fallbacks: Inventory (1200), COGS (5001)
    if (!invAccId) invAccId = await findAccountIdByCode(organizationId, "1200");
    if (!cogsAccId) cogsAccId = await findAccountIdByCode(organizationId, "5001");
    if (!invAccId || !cogsAccId) return false;

    return await postMultiLineEntry({
      date,
      description: "COGS posting",
      referenceType: "sale_cogs",
      referenceId: referenceId || productId,
      lines: [
        { accountId: cogsAccId, debit: totalCost, credit: 0, locationId: locationId || null },
        { accountId: invAccId, debit: 0, credit: totalCost, locationId: locationId || null },
      ],
    });
  } catch (e) {
    console.error("postSaleCOGSAndInventory failed", e);
    return false;
  }
}

export async function postPurchaseInventoryCapitalization(opts: {
  organizationId: string;
  itemId: string;
  quantity: number;
  unitCost: number;
  date?: string;
  locationId?: string | null;
  referenceId?: string;
  inventoryAccountId?: string | null; // optional override
  apOrClearingAccountId?: string | null; // optional; if omitted, posts to Supplies Expense as credit to offset; can be set to GRNI
}): Promise<boolean> {
  const { organizationId, itemId, quantity, unitCost, date, locationId, referenceId, inventoryAccountId, apOrClearingAccountId } = opts;
  try {
    const total = Number(quantity || 0) * Number(unitCost || 0);
    if (total <= 0) return false;

    let invAccId = inventoryAccountId || null;
    if (!invAccId) {
      try {
        const { data: map } = await supabase
          .from("inventory_item_accounts")
          .select("inventory_account_id")
          .eq("item_id", itemId)
          .maybeSingle();
        invAccId = (map as any)?.inventory_account_id || null;
      } catch {}
    }
    if (!invAccId) invAccId = await findAccountIdByCode(organizationId, "1200");

    let creditAccId = apOrClearingAccountId || null;
    if (!creditAccId) {
      // Default to Accounts Payable if available; else Other Liability or Owner Equity as placeholder
      creditAccId = await findAccountIdByCode(organizationId, "2001");
    }
    if (!creditAccId) return false;

    return await postMultiLineEntry({
      date,
      description: "Inventory capitalization",
      referenceType: "purchase_receive",
      referenceId: referenceId || itemId,
      lines: [
        { accountId: invAccId, debit: total, credit: 0, locationId: locationId || null },
        { accountId: creditAccId, debit: 0, credit: total, locationId: locationId || null },
      ],
    });
  } catch (e) {
    console.error("postPurchaseInventoryCapitalization failed", e);
    return false;
  }
}