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
    const { error } = await supabase
      .from("account_transactions")
      .insert([
        {
          account_id: debitAccountId,
          transaction_date: date,
          description: desc,
          debit_amount: amount,
          credit_amount: 0,
          reference_type: referenceType || null,
          reference_id: referenceId || null,
          organization_id: organizationId,
          location_id: locationId || null,
        },
        {
          account_id: creditAccountId,
          transaction_date: date,
          description: desc,
          debit_amount: 0,
          credit_amount: amount,
          reference_type: referenceType || null,
          reference_id: referenceId || null,
          organization_id: organizationId,
          location_id: locationId || null,
        },
      ]);
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

  // Determine asset account: Cash vs Bank
  const isBankLike = ["mpesa", "bank_transfer", "card", "bank", "mpesa_paybill", "mpesa_till"].includes(
    String(method || "").toLowerCase()
  );
  const assetSubtype = isBankLike ? "Bank" : "Cash";

  const assetAccountId = await findAccountIdBySubtype(organizationId, assetSubtype);
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