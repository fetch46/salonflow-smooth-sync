import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { RefreshCw, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/lib/saas/hooks";

interface TrialRow {
  account_id: string;
  account_code: string;
  account_name: string;
  debit_total: number;
  credit_total: number;
  balance: number;
}

export default function Journal() {
  const [rows, setRows] = useState<TrialRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const { organization } = useOrganization();

  const totals = useMemo(() => {
    const debit = rows.reduce((acc, r) => acc + (Number(r.debit_total) || 0), 0);
    const credit = rows.reduce((acc, r) => acc + (Number(r.credit_total) || 0), 0);
    const balanced = Math.round((debit - credit) * 100) === 0;
    return { debit, credit, balanced };
  }, [rows]);

  const loadTrialBalance = async () => {
    try {
      setLoading(true);
      setError("");
      
      if (!organization?.id) {
        setRows([]);
        return;
      }
      
      // Use database function for trial balance
      const { data, error } = await supabase.rpc('calculate_trial_balance', {
        p_org_id: organization.id,
        p_date: new Date().toISOString().split('T')[0]
      });
      
      if (error) throw error;
      setRows(data || []);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to load trial balance");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    await loadTrialBalance();
    setRefreshing(false);
  };

  useEffect(() => {
    document.title = "Journal | SalonOS";
    loadTrialBalance();
  }, [organization?.id]);

  return (
    <div className="flex-1 space-y-6 p-6 bg-gradient-to-br from-slate-50 to-slate-100/50 min-h-screen">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-amber-600 to-orange-600 rounded-xl shadow-lg">
            <BookOpen className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Journal</h1>
            <p className="text-slate-600">Trial balance summary of posted journal entries</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Trial Balance</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-sm text-red-600">{error}</div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Account</TableHead>
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
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-slate-500">No data</TableCell>
                    </TableRow>
                  ) : (
                    rows.map((r) => (
                      <TableRow key={r.account_id}>
                        <TableCell className="whitespace-nowrap">{r.account_code}</TableCell>
                        <TableCell className="whitespace-nowrap">{r.account_name}</TableCell>
                        <TableCell className="text-right tabular-nums">{Number(r.debit_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right tabular-nums">{Number(r.credit_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right tabular-nums">{Number(r.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      </TableRow>
                    ))
                  )}
                  {!loading && rows.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-right font-medium">Totals</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{totals.debit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{totals.credit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{(totals.debit - totals.credit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          {!loading && rows.length > 0 && (
            <div className="text-sm text-slate-600 mt-3">
              {totals.balanced ? (
                <span className="text-green-600">Balanced: Debits = Credits</span>
              ) : (
                <span className="text-amber-600">Unbalanced: Debits and Credits differ</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}