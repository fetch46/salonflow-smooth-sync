import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, RefreshCw, FileText } from "lucide-react";
import { toast } from "sonner";

interface AccountLite { id: string; code: string; name: string; category: string }
interface LineForm { accountId: string; description: string; debit: string; credit: string }

export default function Journal() {
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<AccountLite[]>([]);
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState<string>("");
  const [lines, setLines] = useState<LineForm[]>([{ accountId: "", description: "", debit: "", credit: "" }, { accountId: "", description: "", debit: "", credit: "" }]);
  const [recent, setRecent] = useState<Array<{ id: string; date: string; memo?: string | null }>>([]);

  const baseUrl = (import.meta.env.VITE_SERVER_URL || "/api").replace(/\/$/, "");

  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(`${baseUrl}/accounts?pageSize=200`);
        const js = await resp.json();
        const items = (js.items || []).map((a: any) => ({ id: a.id, code: a.code, name: a.name, category: a.category }));
        setAccounts(items);
      } catch {
        setAccounts([]);
      }
      try {
        const resp = await fetch(`${baseUrl}/reports/recent-journal-entries`);
        if (resp.ok) {
          const js = await resp.json();
          setRecent(js.items || []);
        }
      } catch {}
    })();
  }, []);

  const totals = useMemo(() => {
    const debit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
    const credit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
    return { debit, credit, diff: Math.round((debit - credit) * 100) / 100 };
  }, [lines]);

  const addLine = () => setLines([...lines, { accountId: "", description: "", debit: "", credit: "" }]);
  const removeLine = (idx: number) => setLines(lines.filter((_, i) => i !== idx));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lines.length < 2) { toast.error("Add at least two lines"); return; }
    if (Math.abs(totals.diff) > 0.0001) { toast.error("Debits and credits must balance"); return; }
    try {
      setLoading(true);
      const payload = {
        date,
        memo: memo || null,
        lines: lines.map(l => ({ accountId: l.accountId, description: l.description || undefined, debit: Number(l.debit || 0), credit: Number(l.credit || 0) })),
      };
      const resp = await fetch(`${baseUrl}/journal`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(t || `Failed: ${resp.status}`);
      }
      toast.success("Journal entry posted");
      setMemo("");
      setLines([{ accountId: "", description: "", debit: "", credit: "" }, { accountId: "", description: "", debit: "", credit: "" }]);
    } catch (err: any) {
      toast.error(err?.message || "Failed to post entry");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 space-y-6 p-6 bg-gradient-to-br from-slate-50 to-slate-100/50 min-h-screen">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-xl shadow-lg">
            <FileText className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Journal</h1>
            <p className="text-slate-600">Post manual journal entries</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => window.location.reload()}><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New Journal Entry</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="md:col-span-2 space-y-1">
                <Label>Memo</Label>
                <Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Description (optional)" />
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="w-80">
                        <select className="border rounded px-2 py-2 w-full" value={l.accountId} onChange={(e) => {
                          const val = e.target.value; setLines(prev => prev.map((x,i) => i===idx ? { ...x, accountId: val } : x));
                        }}>
                          <option value="">Select account</option>
                          {accounts.map(a => (
                            <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell>
                        <Input value={l.description} onChange={(e) => setLines(prev => prev.map((x,i) => i===idx ? { ...x, description: e.target.value } : x))} placeholder="Line memo" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input type="number" step="0.01" value={l.debit} onChange={(e) => setLines(prev => prev.map((x,i) => i===idx ? { ...x, debit: e.target.value, credit: e.target.value ? "" : x.credit } : x))} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input type="number" step="0.01" value={l.credit} onChange={(e) => setLines(prev => prev.map((x,i) => i===idx ? { ...x, credit: e.target.value, debit: e.target.value ? "" : x.debit } : x))} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(idx)}><Trash2 className="w-4 h-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Button type="button" onClick={addLine}><Plus className="w-4 h-4 mr-2" /> Add Line</Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-end gap-6">
              <div className={`text-sm ${Math.abs(totals.diff) < 0.0001 ? 'text-emerald-700' : 'text-red-700'}`}>
                Total Debit {totals.debit.toFixed(2)} • Total Credit {totals.credit.toFixed(2)} • Diff {totals.diff.toFixed(2)}
              </div>
              <Button type="submit" disabled={loading || Math.abs(totals.diff) > 0.0001}>{loading ? 'Posting…' : 'Post Entry'}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {recent.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Recent Entries</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Memo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>{String(r.date || '').slice(0,10)}</TableCell>
                    <TableCell>{r.memo || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}