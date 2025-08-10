import React, { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RefreshCw, CreditCard, Search, Upload, Lock, Unlock, FileDown } from "lucide-react";
import { useSaas } from "@/lib/saas";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import type { DateRange } from "react-day-picker";

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
  const [importing, setImporting] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [locking, setLocking] = useState(false);
  const [reconciling, setReconciling] = useState(false);

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

  const parseCsv = (text: string) => {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length <= 1) return [] as any[];
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const idx = (name: string) => headers.findIndex(h => h.replace(/[^a-z]/g,'') === name.replace(/[^a-z]/g,''));
    const di = idx('date');
    const desc = idx('description');
    const debit = idx('debit');
    const credit = idx('credit');
    const amount = idx('amount');
    const balance = idx('balance');
    const refi = idx('reference');
    const rows = [] as any[];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      const get = (j: number) => (j >= 0 && j < cols.length ? cols[j] : '').trim().replace(/^"|"$/g,'');
      const d = get(di);
      if (!d) continue;
      const row: any = {
        line_date: d,
        description: get(desc),
        debit: debit >= 0 ? Number(get(debit) || 0) : (amount >= 0 ? Math.max(0, -(Number(get(amount))||0)) : 0),
        credit: credit >= 0 ? Number(get(credit) || 0) : (amount >= 0 ? Math.max(0, (Number(get(amount))||0)) : 0),
        balance: balance >= 0 ? Number(get(balance) || 0) : null,
        external_reference: refi >= 0 ? get(refi) : null,
      };
      rows.push(row);
    }
    return rows;
  };

  const onImportCsv = async (file: File) => {
    if (!selectedAccountId || !organization?.id) { toast.error("Select an account"); return; }
    try {
      setImporting(true);
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) { toast.error('No rows parsed'); return; }
      const name = file.name;
      const start = rows.reduce((min: string, r: any) => (min && min < r.line_date ? min : r.line_date), rows[0].line_date);
      const end = rows.reduce((max: string, r: any) => (max && max > r.line_date ? max : r.line_date), rows[0].line_date);
      const { data: stmt, error: stmtErr } = await supabase.from('bank_statements').insert([{
        organization_id: organization.id,
        account_id: selectedAccountId,
        statement_name: name,
        start_date: start,
        end_date: end,
      }]).select('id').single();
      if (stmtErr) throw stmtErr;
      const statementId = (stmt as any)?.id;
      if (!statementId) throw new Error('Failed to create statement');
      // Create hashes client-side to avoid duplicates within same statement
      const withHash = rows.map((r, idx) => ({
        statement_id: statementId,
        line_date: r.line_date,
        description: r.description,
        debit: r.debit,
        credit: r.credit,
        balance: r.balance,
        external_reference: r.external_reference,
        hash: btoa(unescape(encodeURIComponent(`${r.line_date}|${r.description}|${r.debit}|${r.credit}|${r.balance}|${r.external_reference}|${idx}`))).slice(0, 200),
      }));
      // Chunk insert to avoid payload limits
      const chunkSize = 500;
      for (let i = 0; i < withHash.length; i += chunkSize) {
        const chunk = withHash.slice(i, i + chunkSize);
        const { error } = await supabase.from('bank_statement_lines').insert(chunk);
        if (error) {
          // ignore duplicates on unique hash within same statement
          const msg = String((error as any)?.message || '').toLowerCase();
          if (!(msg.includes('duplicate') || msg.includes('unique'))) throw error;
        }
      }
      toast.success(`Imported ${withHash.length} lines`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const onLockPeriod = async () => {
    if (!organization?.id || !dateRange?.from || !dateRange?.to) { toast.error('Select a date range'); return; }
    try {
      setLocking(true);
      const start = dateRange.from.toISOString().slice(0,10);
      const end = dateRange.to.toISOString().slice(0,10);
      const { error } = await supabase.from('accounting_periods').insert([{ organization_id: organization.id, period_start: start, period_end: end, status: 'locked' }]);
      if (error) throw error;
      toast.success('Period locked');
      await onRefresh();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to lock period');
    } finally { setLocking(false); }
  };

  const onUnlockPeriod = async () => {
    if (!organization?.id || !dateRange?.from || !dateRange?.to) { toast.error('Select a date range'); return; }
    try {
      setLocking(true);
      const start = dateRange.from.toISOString().slice(0,10);
      const end = dateRange.to.toISOString().slice(0,10);
      const { error } = await supabase.from('accounting_periods').delete().eq('organization_id', organization.id).eq('period_start', start).eq('period_end', end);
      if (error) throw error;
      toast.success('Period unlocked');
      await onRefresh();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to unlock period');
    } finally { setLocking(false); }
  };

  const onAutoReconcile = async () => {
    if (!organization?.id || !selectedAccountId || !dateRange?.from || !dateRange?.to) { toast.error('Select account and date range'); return; }
    try {
      setReconciling(true);
      const start = dateRange.from.toISOString().slice(0,10);
      const end = dateRange.to.toISOString().slice(0,10);
      // Create or get reconciliation
      const { data: reconExisting } = await supabase
        .from('bank_reconciliations')
        .select('id')
        .eq('organization_id', organization.id)
        .eq('account_id', selectedAccountId)
        .eq('period_start', start)
        .eq('period_end', end)
        .maybeSingle();
      let reconId = (reconExisting as any)?.id || null;
      if (!reconId) {
        const { data: recon, error: reconErr } = await supabase
          .from('bank_reconciliations')
          .insert([{ organization_id: organization.id, account_id: selectedAccountId, period_start: start, period_end: end }])
          .select('id')
          .single();
        if (reconErr) throw reconErr;
        reconId = (recon as any)?.id;
      }
      if (!reconId) throw new Error('Failed to create reconciliation');

      // Fetch statement lines in range for selected account
      const { data: statements } = await supabase
        .from('bank_statements')
        .select('id')
        .eq('organization_id', organization.id)
        .eq('account_id', selectedAccountId)
        .lte('start_date', end)
        .gte('end_date', start);
      const statementIds = (statements || []).map((s: any) => s.id);
      if (statementIds.length === 0) { toast.error('No statement lines in selected range'); return; }
      const { data: lines } = await supabase
        .from('bank_statement_lines')
        .select('id, line_date, description, debit, credit, amount')
        .in('statement_id', statementIds)
        .gte('line_date', start)
        .lte('line_date', end)
        .order('line_date', { ascending: true });

      // Fetch account transactions in range
      const { data: txns } = await supabase
        .from('account_transactions')
        .select('id, transaction_date, description, debit_amount, credit_amount')
        .eq('account_id', selectedAccountId)
        .gte('transaction_date', start)
        .lte('transaction_date', end)
        .order('transaction_date', { ascending: true });

      const lineByKey = new Map<string, any>();
      (lines || []).forEach((l: any) => {
        const key = `${l.line_date}|${(l.amount ?? (Number(l.credit||0)-Number(l.debit||0))).toFixed(2)}`;
        if (!lineByKey.has(key)) lineByKey.set(key, l);
      });

      const matches: any[] = [];
      (txns || []).forEach((t: any) => {
        const amt = Number(t.credit_amount || 0) - Number(t.debit_amount || 0);
        const key = `${String(t.transaction_date).slice(0,10)}|${amt.toFixed(2)}`;
        const line = lineByKey.get(key);
        if (line) {
          matches.push({ reconciliation_id: reconId, statement_line_id: line.id, account_transaction_id: t.id, match_amount: amt });
          lineByKey.delete(key);
        }
      });

      // Insert matches
      const chunkSize = 500;
      for (let i = 0; i < matches.length; i += chunkSize) {
        const chunk = matches.slice(i, i + chunkSize);
        const { error } = await supabase.from('bank_reconciliation_matches').insert(chunk);
        if (error) {
          const msg = String((error as any)?.message || '').toLowerCase();
          if (!(msg.includes('duplicate') || msg.includes('unique'))) throw error;
        }
      }
      // Mark matched lines
      const matchedIds = matches.map(m => m.statement_line_id);
      if (matchedIds.length) {
        const { error } = await supabase.from('bank_statement_lines').update({ matched: true, reconciled_at: new Date().toISOString() }).in('id', matchedIds);
        if (error) console.warn('Failed to update matched flags', error);
      }

      toast.success(`Auto-matched ${matches.length} items`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Reconciliation failed');
    } finally {
      setReconciling(false);
    }
  };

  const downloadTemplate = () => {
    const headers = ['Date','Description','Debit','Credit','Balance','Reference'];
    const sample = ['2025-01-05','Client deposit', '0.00','250.00','1250.00','ABC123'];
    const csv = [headers.join(','), sample.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'bank_statement_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
          <Button variant="outline" onClick={downloadTemplate}>
            <FileDown className="w-4 h-4 mr-2" />
            CSV Template
          </Button>
          <label className="inline-flex items-center">
            <input type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onImportCsv(f); e.currentTarget.value=''; }} />
            <Button asChild disabled={!selectedAccountId || importing}>
              <span className="cursor-pointer"><Upload className="w-4 h-4 mr-2" />Import CSV</span>
            </Button>
          </label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="whitespace-nowrap">Select Period</Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="start">
              <Calendar mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={2} />
            </PopoverContent>
          </Popover>
          <Button variant="outline" onClick={onAutoReconcile} disabled={!selectedAccountId || !dateRange || reconciling}>
            Reconcile
          </Button>
          <Button onClick={onLockPeriod} disabled={!dateRange || locking} className="bg-rose-600 hover:bg-rose-700">
            <Lock className="w-4 h-4 mr-2" /> Lock Period
          </Button>
          <Button variant="destructive" onClick={onUnlockPeriod} disabled={!dateRange || locking}>
            <Unlock className="w-4 h-4 mr-2" /> Unlock Period
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