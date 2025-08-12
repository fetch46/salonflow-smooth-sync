import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calculator, RefreshCw } from "lucide-react";

interface Row { accountId: string; code: string; name: string; category: string; debit: number; credit: number; balance: number }

export default function TrialBalance() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const baseUrl = (import.meta.env.VITE_SERVER_URL || "/api").replace(/\/$/, "");

  const load = async () => {
    try {
      setLoading(true);
      const resp = await fetch(`${baseUrl}/journal/trial-balance`);
      const js = await resp.json();
      setRows((js.rows || []) as Row[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter(r => r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q) || r.category.toLowerCase().includes(q));
  }, [rows, search]);

  const totals = useMemo(() => {
    const debit = filtered.reduce((s, r) => s + Number(r.debit || 0), 0);
    const credit = filtered.reduce((s, r) => s + Number(r.credit || 0), 0);
    return { debit, credit };
  }, [filtered]);

  return (
    <div className="flex-1 space-y-6 p-6 bg-gradient-to-br from-slate-50 to-slate-100/50 min-h-screen">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-xl shadow-lg">
            <Calculator className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Trial Balance</h1>
            <p className="text-slate-600">Debits and credits by account</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input placeholder="Search code, name, category" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
          <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>As of Today</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No rows</TableCell></TableRow>
              ) : (
                filtered.map(r => (
                  <TableRow key={r.accountId}>
                    <TableCell className="font-medium">{r.code}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>{r.category}</TableCell>
                    <TableCell className="text-right">{Number(r.debit || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">{Number(r.credit || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right font-medium">{Number(r.balance || 0).toLocaleString()}</TableCell>
                  </TableRow>
                ))
              )}
              {filtered.length > 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="font-semibold">Totals</TableCell>
                  <TableCell className="text-right font-semibold">{Number(totals.debit || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right font-semibold">{Number(totals.credit || 0).toLocaleString()}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}