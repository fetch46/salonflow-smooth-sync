import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowLeft, Calculator, Edit2, Eye, Trash2, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useOrganizationCurrency, useRegionalDateFormatter } from "@/lib/saas";

interface AccountRow {
  id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  account_subtype?: string | null;
  normal_balance?: string | null; // "debit" | "credit"
  description?: string | null;
}

interface TransactionRow {
  id: string;
  transaction_date: string;
  description: string | null;
  debit_amount: number | null;
  credit_amount: number | null;
  reference_type?: string | null;
  reference_id?: string | null;
}

export default function AccountView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [account, setAccount] = useState<AccountRow | null>(null);
  const [txns, setTxns] = useState<TransactionRow[]>([]);
  const [hasTransactions, setHasTransactions] = useState<boolean>(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const { format: formatCurrency } = useOrganizationCurrency();
  const formatDate = useRegionalDateFormatter();

  const fetchData = async () => {
    if (!id) return;
    try {
      const { data: acc, error: accErr } = await supabase
        .from("accounts")
        .select("id, account_code, account_name, account_type, account_subtype, normal_balance, description")
        .eq("id", id)
        .maybeSingle();
      if (accErr) throw accErr;
      setAccount(acc as AccountRow);

      const { data: rows, error: txErr } = await supabase
        .from("account_transactions")
        .select("id, transaction_date, description, debit_amount, credit_amount, reference_type, reference_id")
        .eq("account_id", id)
        .order("transaction_date", { ascending: true })
        .order("id", { ascending: true });
      if (txErr) throw txErr;
      setTxns((rows || []) as TransactionRow[]);
      setHasTransactions((rows || []).length > 0);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to load account");
    }
  };

  useEffect(() => {
    (async () => {
      if (!id) return;
      setLoading(true);
      await fetchData();
      setLoading(false);
    })();
  }, [id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const filteredTxns = useMemo(() => {
    const fd = fromDate?.trim() || "";
    const td = toDate?.trim() || "";
    return (txns || []).filter((r) => {
      const d = String(r.transaction_date || "").slice(0, 10);
      if (fd && d < fd) return false;
      if (td && d > td) return false;
      return true;
    });
  }, [txns, fromDate, toDate]);

  const totals = useMemo(() => {
    const debit = (filteredTxns || []).reduce((sum, r) => sum + Number(r.debit_amount || 0), 0);
    const credit = (filteredTxns || []).reduce((sum, r) => sum + Number(r.credit_amount || 0), 0);
    return { debit, credit };
  }, [filteredTxns]);

  const rowsWithRunning = useMemo(() => {
    let running = 0;
    const normal = (account?.normal_balance || "debit").toLowerCase();
    const preferDebit = normal === "debit";
    return (filteredTxns || []).map((r) => {
      const d = Number(r.debit_amount || 0);
      const c = Number(r.credit_amount || 0);
      running += preferDebit ? (d - c) : (c - d);
      return { ...r, running_balance: running } as TransactionRow & { running_balance: number };
    });
  }, [filteredTxns, account?.normal_balance]);

  const navigateToReference = (row: TransactionRow) => {
    const refType = String(row.reference_type || "").toLowerCase();
    const refId = row.reference_id;
    if (!refId) return;
    if (refType === "receipt_payment") {
      navigate(`/banking`);
      return;
    }
    if (refType === "purchase_payment") {
      navigate(`/purchases/${refId}`);
      return;
    }
    if (refType === "expense_payment") {
      navigate(`/expenses/${refId}/edit`);
      return;
    }
    if (refType === "account_transfer") {
      navigate(`/banking`);
      return;
    }
    // Fallback
    navigate(`/banking`);
  };

  const onDelete = async () => {
    if (!id) return;
    try {
      // Final safety check
      const { count } = await supabase
        .from("account_transactions")
        .select("*", { count: "exact", head: true })
        .eq("account_id", id);
      if ((count || 0) > 0) {
        toast.error("Cannot delete: account has posted transactions");
        setConfirmOpen(false);
        return;
      }

      const { error } = await supabase.from("accounts").delete().eq("id", id);
      if (error) throw error;
      toast.success("Account deleted");
      navigate("/accounts");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to delete account");
    } finally {
      setConfirmOpen(false);
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;
  if (!account) return <div className="p-6">Account not found</div>;

  return (
    <div className="flex-1 space-y-6 p-6 bg-gradient-to-br from-slate-50 to-slate-100/50 min-h-screen">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-xl shadow-lg">
            <Calculator className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{account.account_name}</h1>
            <div className="text-slate-600 text-sm">Code {account.account_code} • {account.account_type}{account.account_subtype ? ` • ${account.account_subtype}` : ""} • Normal {account.normal_balance || "debit"}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button variant="outline" onClick={() => navigate(`/accounts/${account.id}/edit`)}>
            <Edit2 className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <Button variant="destructive" disabled={hasTransactions} onClick={() => setConfirmOpen(true)}>
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">{hasTransactions ? "Active" : "No Transactions"}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Totals</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <div className="flex justify-between"><span className="text-slate-600">Total Debits</span><span className="font-semibold">{formatCurrency(totals.debit)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Total Credits</span><span className="font-semibold">{formatCurrency(totals.credit)}</span></div>
            <div className="flex justify-between pt-1 border-t"><span className="text-slate-600">Ending Balance</span><span className="font-bold text-indigo-700">{formatCurrency(rowsWithRunning.at(-1)?.running_balance || 0)}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Details</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <div className="flex justify-between"><span className="text-slate-600">Type</span><span className="font-medium">{account.account_type}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Subtype</span><span className="font-medium">{account.account_subtype || "—"}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Normal Balance</span><span className="font-medium capitalize">{account.normal_balance || "debit"}</span></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <CardTitle>Ledger</CardTitle>
            <div className="flex gap-3 flex-wrap">
              <div className="space-y-1">
                <div className="text-xs text-slate-600">From</div>
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-44" />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-slate-600">To</div>
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-44" />
              </div>
              {(fromDate || toDate) && (
                <Button variant="outline" onClick={() => { setFromDate(""); setToDate(""); }}>Clear</Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {rowsWithRunning.length === 0 ? (
            <div className="text-sm text-muted-foreground">No transactions</div>
          ) : (
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Running Balance</TableHead>
                  <TableHead>Ref</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rowsWithRunning.map((r) => (
                  <TableRow
                    key={r.id}
                    onClick={() => r.reference_id && navigateToReference(r)}
                    className={r.reference_id ? "cursor-pointer hover:bg-slate-50" : ""}
                    title={r.reference_id ? `Open ${(r.reference_type || '').toString()} ${r.reference_id || ''}` : undefined}
                  >
                    <TableCell>{formatDate(r.transaction_date)}</TableCell>
                    <TableCell className="max-w-[380px] truncate" title={r.description || ''}>{r.description || "—"}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(r.debit_amount || 0))}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(r.credit_amount || 0))}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency((rowsWithRunning.find(x => x.id === r.id) as any).running_balance)}</TableCell>
                    <TableCell className="text-xs text-slate-500">{r.reference_type || "—"}{r.reference_id ? ` #${r.reference_id}` : ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete account?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The account will be permanently removed. Accounts with transactions cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={hasTransactions} onClick={onDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}