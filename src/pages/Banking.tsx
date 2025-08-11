import React, { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RefreshCw, CreditCard, Search, Upload, Lock, Unlock, FileDown } from "lucide-react";
import { useSaas } from "@/lib/saas";
import { postAccountTransfer } from "@/utils/ledger";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate } from "react-router-dom";


interface AccountRow {
  id: string;
  account_code: string;
  account_name: string;
  account_subtype?: string | null;
  account_type?: string | null;
  normal_balance?: string | null;
}

interface TransactionRow {
  id: string;
  transaction_date: string;
  description: string;
  debit_amount: number | null;
  credit_amount: number | null;
  reference_type?: string | null;
  reference_id?: string | null;
}

export default function Banking() {
  const { organization } = useSaas();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [transferFromId, setTransferFromId] = useState<string>("");
  const [transferToId, setTransferToId] = useState<string>("");
  const [transferAmount, setTransferAmount] = useState<string>("");
  const [transferDate, setTransferDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [transferLoading, setTransferLoading] = useState(false);

  // Reconciliation state
  const [reconOpen, setReconOpen] = useState(false);
  const [reconLoading, setReconLoading] = useState(false);
  const [unreconciled, setUnreconciled] = useState<any[]>([]);
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<string[]>([]);
  const [statementDate, setStatementDate] = useState<string>(() => new Date().toISOString().slice(0,10));
  const [endingBalance, setEndingBalance] = useState<string>("");


  const loadAccounts = useCallback(async () => {
    if (!organization?.id) {
      setAccounts([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, account_code, account_name, account_subtype, account_type, normal_balance")
        .eq("organization_id", organization.id)
        .in("account_subtype", ["Cash", "Bank"])
        .order("account_code", { ascending: true });
      if (error) throw error;
      let list = (data || []) as any[];

      // Fallback for older schemas without account_subtype
      if (!list.length) {
        const { data: fallbackData } = await supabase
          .from("accounts")
          .select("id, account_code, account_name, account_subtype, account_type, normal_balance")
          .eq("organization_id", organization.id)
          .or("account_code.in.(1001,1002),account_name.ilike.%Cash%,account_name.ilike.%Bank%")
          .order("account_code", { ascending: true });
        list = (fallbackData || []) as any[];
      }

      setAccounts(list as AccountRow[]);
      if (list.length > 0 && !selectedAccountId) {
        setSelectedAccountId(list[0].id);
      }
    } catch (e) {
      console.error("Error loading banking accounts", e);
      setAccounts([]);
    }
  }, [organization?.id, selectedAccountId]);

  const loadTransactions = useCallback(async () => {
    if (!selectedAccountId) {
      setTransactions([]);
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("account_transactions")
        .select("id, transaction_date, description, debit_amount, credit_amount, reference_type, reference_id")
        .eq("account_id", selectedAccountId)
        .order("transaction_date", { ascending: true });
      if (error) throw error;
      setTransactions((data || []) as any as TransactionRow[]);
    } catch (e) {
      console.error("Error loading transactions", e);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId]);

  useEffect(() => {
    document.title = "Banking | SalonOS";
  }, []);

  const loadUnreconciled = useCallback(async () => {
    if (!selectedAccountId) { setUnreconciled([]); return; }
    try {
      setReconLoading(true);
      const base = (import.meta.env.VITE_SERVER_URL || "/api").replace(/\/$/, "");
      const resp = await fetch(`${base}/bank/unreconciled?bankAccountId=${encodeURIComponent(selectedAccountId)}`);
      if (!resp.ok) throw new Error(`Failed to load unreconciled: ${resp.status}`);
      const json = await resp.json();
      setUnreconciled(json.items || []);
    } catch (e) {
      console.warn("Unreconciled fetch failed", e);
      setUnreconciled([]);
    } finally {
      setReconLoading(false);
    }
  }, [selectedAccountId]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  useEffect(() => {
    if (reconOpen) loadUnreconciled();
  }, [reconOpen, loadUnreconciled]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadAccounts(), loadTransactions()]);
    setRefreshing(false);
  };

  const accountOptions = useMemo(() => accounts.map(a => ({ value: a.id, label: `${a.account_code} - ${a.account_name}` })), [accounts]);

  type DisplayTxn = TransactionRow & { displayDebit: number; displayCredit: number; runningBalance: number };

  const filteredTransactions: DisplayTxn[] = useMemo(() => {
    // Banking view convention:
    // - Inflows (to this Cash/Bank account) appear under Credit
    // - Outflows appear under Debit
    const matchesSearch = (t: TransactionRow) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        (t.description || "").toLowerCase().includes(q) ||
        (t.reference_type || "").toLowerCase().includes(q) ||
        (t.transaction_date || "").toLowerCase().includes(q)
      );
    };

    const base: Array<Omit<DisplayTxn, "runningBalance"> > = (transactions || [])
      .filter(matchesSearch)
      .map((t) => {
        const debit = Number(t.debit_amount || 0);
        const credit = Number(t.credit_amount || 0);
        // Map to bank statement presentation for this account
        const displayCredit = debit;   // money into this account
        const displayDebit = credit;   // money out of this account
        return { ...t, displayDebit, displayCredit } as any;
      });

    // Running balance: credits increase, debits decrease
    let bal = 0;
    return base.map((t) => {
      bal += (Number(t.displayCredit || 0) - Number(t.displayDebit || 0));
      return { ...(t as any), runningBalance: bal } as DisplayTxn;
    });
  }, [transactions, search]);

  const selectedAccount = useMemo(() => accounts.find(a => a.id === selectedAccountId), [accounts, selectedAccountId]);

  const navigateToReference = (row: TransactionRow) => {
    const refType = String(row.reference_type || "").toLowerCase();
    const refId = row.reference_id;
    if (!refId) return;
    if (refType === "receipt_payment") { navigate(`/receipts/${refId}`); return; }
    if (refType === "purchase_payment") { navigate(`/purchases/${refId}`); return; }
    if (refType === "expense_payment") { navigate(`/expenses/${refId}/edit`); return; }
    if (refType === "account_transfer") { navigate(`/banking`); return; }
    navigate(`/banking`);
  };

  const openTransfer = () => {
    setTransferFromId(selectedAccountId || "");
    setTransferToId("");
    setTransferAmount("");
    setTransferDate(new Date().toISOString().slice(0, 10));
    setIsTransferOpen(true);
  };

  const openReconcile = () => {
    setSelectedPaymentIds([]);
    setStatementDate(new Date().toISOString().slice(0,10));
    setEndingBalance("");
    setReconOpen(true);
  };

  const togglePayment = (pid: string) => {
    setSelectedPaymentIds(prev => prev.includes(pid) ? prev.filter(id => id !== pid) : [...prev, pid]);
  };

  const submitReconcile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountId) return;
    try {
      setReconLoading(true);
      const base = (import.meta.env.VITE_SERVER_URL || "/api").replace(/\/$/, "");
      const resp = await fetch(`${base}/bank/reconcile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankAccountId: selectedAccountId,
          statementDate,
          endingBalance: Number(endingBalance || 0),
          paymentIds: selectedPaymentIds,
        })
      });
      if (!resp.ok) throw new Error(`Reconcile failed: ${resp.status}`);
      setReconOpen(false);
      await Promise.all([loadTransactions(), loadUnreconciled()]);
    } catch (err) {
      console.error(err);
      window.alert('Reconciliation failed. Ensure server is running and you have permissions.');
    } finally {
      setReconLoading(false);
    }
  };

  const doTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id) return;
    const amount = parseFloat(transferAmount);
    if (!transferFromId || !transferToId) {
      window.alert("Please select both source and destination accounts");
      return;
    }
    if (transferFromId === transferToId) {
      window.alert("Source and destination accounts must be different");
      return;
    }
    if (!amount || amount <= 0) {
      window.alert("Please enter a valid amount greater than 0");
      return;
    }

    try {
      setTransferLoading(true);
      const fromAcc = accounts.find(a => a.id === transferFromId);
      const toAcc = accounts.find(a => a.id === transferToId);
      const desc = `Transfer from ${fromAcc?.account_name || "Account"} to ${toAcc?.account_name || "Account"}`;
      const ok = await postAccountTransfer({
        organizationId: organization.id,
        amount,
        fromAccountId: transferFromId,
        toAccountId: transferToId,
        transferDate,
        description: desc,
        locationId: null,
      });
      if (!ok) throw new Error("Transfer failed");
      setIsTransferOpen(false);
      await onRefresh();
    } catch (err) {
      console.error(err);
      window.alert("Transfer failed. Please try again.");
    } finally {
      setTransferLoading(false);
    }
  };

  return (
    <div className="flex-1 space-y-6 p-6 bg-gradient-to-br from-slate-50 to-slate-100/50 min-h-screen">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-xl shadow-lg">
            <CreditCard className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Banking</h1>
            <p className="text-slate-600">View Cash and Bank transactions</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Search transactions..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button variant="outline" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={openTransfer}>
            <Upload className="w-4 h-4 mr-2" />
            Transfer
          </Button>
          <Button variant="outline" onClick={openReconcile} disabled={!selectedAccountId}>
            <Lock className="w-4 h-4 mr-2" />
            Reconcile
          </Button>

        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base sm:text-lg">Select Account</CardTitle>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger className="w-full sm:w-80">
                <SelectValue placeholder="Choose Cash/Bank account" />
              </SelectTrigger>
              <SelectContent>
                {accountOptions.map(opt => (
                  <SelectItem value={opt.value} key={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {!selectedAccountId ? (
            <div className="text-sm text-slate-600">No Cash/Bank accounts found.</div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm text-slate-600">{selectedAccount?.account_code} · {selectedAccount?.account_name} ({selectedAccount?.account_subtype})</div>
              <div className="overflow-x-auto">
                <Table className="min-w-[900px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-slate-500">Loading...</TableCell>
                      </TableRow>
                    ) : filteredTransactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-slate-500">No transactions</TableCell>
                      </TableRow>
                    ) : (
                      filteredTransactions.map(txn => (
                        <TableRow
                          key={txn.id}
                          onClick={() => txn.reference_id && navigateToReference(txn)}
                          className={txn.reference_id ? "cursor-pointer hover:bg-slate-50" : ""}
                          title={txn.reference_id ? `Open ${(txn.reference_type || '').toString()} ${txn.reference_id || ''}` : undefined}
                        >
                          <TableCell className="whitespace-nowrap">{String(txn.transaction_date || "").slice(0,10)}</TableCell>
                          <TableCell className="max-w-[500px]">{txn.description}</TableCell>
                          <TableCell className="text-right">{Number(txn.displayDebit || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right">{Number(txn.displayCredit || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right font-medium">{Number(txn.runningBalance || 0).toLocaleString()}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {isTransferOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-4 w-full max-w-md">
            <div className="text-lg font-semibold mb-3">Transfer Between Accounts</div>
            <form onSubmit={doTransfer} className="space-y-3">
              <div className="space-y-1">
                <div className="text-sm text-slate-600">From</div>
                <select className="border rounded px-3 py-2 w-full" value={transferFromId} onChange={(e) => setTransferFromId(e.target.value)}>
                  <option value="">Select account</option>
                  {accounts.map(a => (<option key={a.id} value={a.id}>{a.account_code} · {a.account_name}</option>))}
                </select>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-slate-600">To</div>
                <select className="border rounded px-3 py-2 w-full" value={transferToId} onChange={(e) => setTransferToId(e.target.value)}>
                  <option value="">Select account</option>
                  {accounts.map(a => (<option key={a.id} value={a.id}>{a.account_code} · {a.account_name}</option>))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="text-sm text-slate-600">Amount</div>
                  <Input type="number" step="0.01" min="0" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-slate-600">Date</div>
                  <Input type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsTransferOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={transferLoading}>{transferLoading ? 'Transferring...' : 'Transfer'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Dialog open={reconOpen} onOpenChange={setReconOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Bank Reconciliation</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitReconcile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-slate-600 mb-1">Statement Date</div>
                <Input type="date" value={statementDate} onChange={(e) => setStatementDate(e.target.value)} />
              </div>
              <div>
                <div className="text-sm text-slate-600 mb-1">Ending Balance</div>
                <Input type="number" step="0.01" value={endingBalance} onChange={(e) => setEndingBalance(e.target.value)} />
              </div>
            </div>
            <div className="text-sm text-slate-600">Select payments to reconcile</div>
            <div className="border rounded max-h-80 overflow-auto">
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reconLoading ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-slate-500">Loading...</TableCell></TableRow>
                  ) : (unreconciled || []).length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-slate-500">No unreconciled payments</TableCell></TableRow>
                  ) : (
                    unreconciled.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <input type="checkbox" checked={selectedPaymentIds.includes(p.id)} onChange={() => togglePayment(p.id)} />
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{String(p.date || '').slice(0,10)}</TableCell>
                        <TableCell className="max-w-[420px] truncate">{p.referenceType ? `${p.referenceType} #${p.referenceId || ''}` : 'Payment'}</TableCell>
                        <TableCell className="text-right">{Number(p.amount || 0).toLocaleString()}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setReconOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={reconLoading || selectedPaymentIds.length === 0}>{reconLoading ? 'Reconciling...' : 'Reconcile'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}