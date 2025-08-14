import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Minus, BookOpen, RefreshCw } from "lucide-react";

interface AccountOption {
  id: string;
  code: string;
  name: string;
  category: string;
}

interface LineForm {
  accountId: string;
  description: string;
  debit: string;   // keep as string for inputs; parse to number on submit
  credit: string;  // keep as string for inputs; parse to number on submit
}

export default function Journal() {
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [memo, setMemo] = useState<string>("");
  const [lines, setLines] = useState<LineForm[]>([
    { accountId: "", description: "", debit: "0.00", credit: "0.00" },
    { accountId: "", description: "", debit: "0.00", credit: "0.00" },
  ]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState<boolean>(false);
  const [posting, setPosting] = useState<boolean>(false);
  const [search, setSearch] = useState<string>("");

  const baseUrl = (import.meta.env.VITE_SERVER_URL || "/api").replace(/\/$/, "");

  useEffect(() => {
    document.title = "Journal | SalonOS";
  }, []);

  const loadAccounts = async (query: string = "") => {
    try {
      setLoadingAccounts(true);
      const params = new URLSearchParams();
      if (query) params.set('search', query);
      params.set('page', '1');
      params.set('pageSize', '100');
      const resp = await fetch(`${baseUrl}/accounts?${params.toString()}`, {
        headers: (() => { const t = localStorage.getItem('jwt_token'); return t ? { Authorization: `Bearer ${t}` } : {}; })(),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const js = await resp.json();
      const items = Array.isArray(js.items) ? js.items : [];
      setAccounts(items.map((a: any) => ({ id: a.id, code: a.code, name: a.name, category: a.category })));
    } catch (e: any) {
      console.error(e);
      setAccounts([]);
    } finally {
      setLoadingAccounts(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const totals = useMemo(() => {
    const debit = lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
    const credit = lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
    const balanced = Math.round((debit - credit) * 100) === 0 && debit > 0;
    return { debit, credit, balanced };
  }, [lines]);

  const addLine = () => {
    setLines((prev) => [...prev, { accountId: "", description: "", debit: "0.00", credit: "0.00" }]);
  };

  const removeLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, patch: Partial<LineForm>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const normalizeMoney = (v: string) => {
    const n = Number(v);
    if (!isFinite(n) || n < 0) return "0.00";
    return n.toFixed(2);
  };

  const validateLines = () => {
    // Basic validations following double-entry principles
    if (lines.length < 2) return { ok: false, msg: "Add at least 2 lines" };
    for (const [i, l] of lines.entries()) {
      if (!l.accountId) return { ok: false, msg: `Line ${i + 1}: select an account` };
      const d = Number(l.debit) || 0;
      const c = Number(l.credit) || 0;
      if (d < 0 || c < 0) return { ok: false, msg: `Line ${i + 1}: amounts cannot be negative` };
      if (d > 0 && c > 0) return { ok: false, msg: `Line ${i + 1}: cannot have both debit and credit` };
      if (d === 0 && c === 0) return { ok: false, msg: `Line ${i + 1}: enter a debit or credit` };
    }
    if (!totals.balanced) return { ok: false, msg: "Debits and credits must balance" };
    return { ok: true, msg: "" };
  };

  const postEntry = async () => {
    try {
      const val = validateLines();
      if (!val.ok) {
        toast.error(val.msg);
        return;
      }
      setPosting(true);
      const body = {
        date,
        memo: memo || null,
        lines: lines.map((l) => ({
          accountId: l.accountId,
          description: l.description || null,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
        })),
      };
      const resp = await fetch(`${baseUrl}/journal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('jwt_token') ? { Authorization: `Bearer ${localStorage.getItem('jwt_token')}` } : {}),
        },
        body: JSON.stringify(body),
      });
      const js = await resp.json();
      if (!resp.ok) throw new Error(js?.error || `HTTP ${resp.status}`);
      toast.success("Journal entry posted");
      // Reset form for next entry
      setMemo("");
      setLines([
        { accountId: "", description: "", debit: "0.00", credit: "0.00" },
        { accountId: "", description: "", debit: "0.00", credit: "0.00" },
      ]);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to post entry");
    } finally {
      setPosting(false);
    }
  };

  const filteredAccounts = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return accounts;
    return accounts.filter((a) =>
      a.code.toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q) ||
      a.category.toLowerCase().includes(q)
    );
  }, [accounts, search]);

  return (
    <div className="flex-1 space-y-6 p-6 bg-gradient-to-br from-slate-50 to-slate-100/50 min-h-screen">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-amber-600 to-orange-600 rounded-xl shadow-lg">
            <BookOpen className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Journal</h1>
            <p className="text-slate-600">Post manual journal entries (double-entry)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => loadAccounts(search)} disabled={loadingAccounts}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loadingAccounts ? "animate-spin" : ""}`} />
            Refresh Accounts
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">New Journal Entry</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label>Memo</Label>
              <Input placeholder="Optional memo" value={memo} onChange={(e) => setMemo(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div className="space-y-1">
                <div className="text-xs text-slate-600">Search accounts</div>
                <Input placeholder="Code, name or category" value={search} onChange={(e) => setSearch(e.target.value)} className="w-72" />
              </div>
              <div className="text-sm text-slate-600">
                Totals — Debit: <span className="font-medium">{totals.debit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> · Credit: <span className="font-medium">{totals.credit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> · {totals.balanced ? <span className="text-green-600">Balanced</span> : <span className="text-amber-600">Unbalanced</span>}
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-64">Account</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-36 text-right">Debit</TableHead>
                    <TableHead className="w-36 text-right">Credit</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <select
                          className="border rounded px-2 py-2 w-full"
                          value={l.accountId}
                          onChange={(e) => updateLine(idx, { accountId: e.target.value })}
                        >
                          <option value="">Select account…</option>
                          {filteredAccounts.map((a) => (
                            <option key={a.id} value={a.id}>{`${a.code} — ${a.name}`}</option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="Optional description"
                          value={l.description}
                          onChange={(e) => updateLine(idx, { description: e.target.value })}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={l.debit}
                          onChange={(e) => updateLine(idx, { debit: normalizeMoney(e.target.value), credit: e.target.value && Number(e.target.value) > 0 ? "0.00" : l.credit })}
                          className="text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={l.credit}
                          onChange={(e) => updateLine(idx, { credit: normalizeMoney(e.target.value), debit: e.target.value && Number(e.target.value) > 0 ? "0.00" : l.debit })}
                          className="text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="icon" onClick={() => removeLine(idx)} disabled={lines.length <= 2} title="Remove line">
                            <Minus className="w-4 h-4" />
                          </Button>
                          {idx === lines.length - 1 && (
                            <Button variant="outline" size="icon" onClick={addLine} title="Add line">
                              <Plus className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between mt-2">
              <div className="text-xs text-slate-600">Tip: Each line must have either a debit or a credit, not both.</div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={addLine}><Plus className="w-4 h-4 mr-2" />Add Line</Button>
                <Button onClick={postEntry} disabled={posting || !totals.balanced} className="bg-amber-600 hover:bg-amber-700">
                  {posting ? "Posting…" : "Post Entry"}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Looking for Trial Balance?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-slate-600">
            Trial Balance has moved to Reports. Go to Reports → Trial Balance to view debits and credits by account.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}