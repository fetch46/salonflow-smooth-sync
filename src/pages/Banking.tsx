import React, { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RefreshCw, CreditCard, Search } from "lucide-react";
import { useSaas } from "@/lib/saas";

interface AccountRow {
  id: string;
  account_code: string;
  account_name: string;
  account_subtype?: string | null;
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
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const loadAccounts = useCallback(async () => {
    if (!organization?.id) {
      setAccounts([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, account_code, account_name, account_subtype")
        .eq("organization_id", organization.id)
        .in("account_subtype", ["Cash", "Bank"])
        .order("account_code", { ascending: true });
      if (error) throw error;
      const list = (data || []) as any[];
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

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadAccounts(), loadTransactions()]);
    setRefreshing(false);
  };

  const accountOptions = useMemo(() => accounts.map(a => ({ value: a.id, label: `${a.account_code} - ${a.account_name}` })), [accounts]);

  type DisplayTxn = TransactionRow & { displayDebit: number; displayCredit: number; runningBalance: number };

  const filteredTransactions: DisplayTxn[] = useMemo(() => {
    // Business rule:
    // - Payments received from customers => treat as Credit (use debit_amount)
    // - Payments made to suppliers and Expenses => treat as Debit (use credit_amount)
    // - Otherwise fall back to natural debit/credit columns
    const matchesSearch = (t: TransactionRow) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        (t.description || "").toLowerCase().includes(q) ||
        (t.reference_type || "").toLowerCase().includes(q) ||
        (t.transaction_date || "").toLowerCase().includes(q)
      );
    };

    const base: Array<Omit<DisplayTxn, "runningBalance">> = (transactions || [])
      .filter(matchesSearch)
      .map((t) => {
        const debit = Number(t.debit_amount || 0);
        const credit = Number(t.credit_amount || 0);
        let displayDebit = debit;
        let displayCredit = credit;
        const type = (t.reference_type || "").toLowerCase();
        if (type === "receipt_payment") {
          displayDebit = 0;
          displayCredit = debit; // incoming cash shown as credit in banking view
        } else if (type === "expense" || type === "purchase_payment") {
          displayDebit = credit; // outgoing cash shown as debit in banking view
          displayCredit = 0;
        }
        return { ...t, displayDebit, displayCredit } as any;
      });

    // Compute running balance (credits increase, debits decrease)
    let bal = 0;
    return base.map((t) => {
      bal += (Number(t.displayCredit || 0) - Number(t.displayDebit || 0));
      return { ...(t as any), runningBalance: bal } as DisplayTxn;
    });
  }, [transactions, search]);

  const selectedAccount = useMemo(() => accounts.find(a => a.id === selectedAccountId), [accounts, selectedAccountId]);

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
                        <TableRow key={txn.id}>
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
    </div>
  );
}