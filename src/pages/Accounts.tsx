import React, { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Eye, Pencil, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Calculator, Plus, RefreshCw, Search } from "lucide-react";
import { useSaas } from "@/lib/saas";
import { Link } from "react-router-dom";

interface Account {
  id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  normal_balance?: string | null;
  description?: string | null;
  balance?: number | null;
  is_active?: boolean | null;
  parent_account_id?: string | null;
  account_subtype?: string | null;
}

export default function Accounts() {
  const { organization } = useSaas();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const { systemSettings } = useSaas();
  const appName = (systemSettings as any)?.app_name || 'AURA OS';
  // Prefill search from query param for report drill-downs
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (q) setSearch(q);
  }, []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [txHasRows, setTxHasRows] = useState<Record<string, boolean>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    account_code: "",
    account_name: "",
    account_type: "Asset",
    normal_balance: "debit",
    description: "",
    parent_account_id: "",
    account_subtype: "Cash",
  });

  useEffect(() => {
    document.title = `Chart of Accounts | ${appName}`;
  }, [appName]);

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      if (!organization?.id) {
        // No active organization yet; surface an empty list
        setAccounts([]);
        return;
      }
      let data: any[] | null = null;
      let error: any = null;
      try {
        const res = await supabase
          .from("accounts")
          .select("id, account_code, account_name, account_type, normal_balance, description, parent_account_id, account_subtype")
          .eq("organization_id", organization.id)
          .order("account_code", { ascending: true });
        data = res.data as any[] | null;
        error = res.error;
      } catch (innerErr: any) {
        error = innerErr;
      }
      if (error) {
        // Fallback: older schemas might not have account_subtype yet
        const message = String(error?.message || "");
        if (message.includes("account_subtype") || message.toLowerCase().includes("column") && message.toLowerCase().includes("does not exist")) {
          const { data: dataFallback, error: errFallback } = await supabase
            .from("accounts")
            .select("id, account_code, account_name, account_type, normal_balance, description, parent_account_id")
            .eq("organization_id", organization.id)
            .order("account_code", { ascending: true });
          if (errFallback) throw errFallback;
          data = dataFallback as any[] | null;
        } else {
          throw error;
        }
      }

      // If no accounts exist, try initializing defaults
      if ((data || []).length === 0 && organization?.id) {
        try {
          await supabase.rpc('setup_new_organization', { org_id: organization.id });
          const { data: afterInit } = await supabase
            .from("accounts")
            .select("id, account_code, account_name, account_type, normal_balance, description, parent_account_id")
            .eq("organization_id", organization.id)
            .order("account_code", { ascending: true });
          setAccounts(afterInit || []);
          return;
        } catch (initErr) {
          console.warn('Account initialization failed', initErr);
        }
      }

      setAccounts(data || []);
      // Try to prefetch transaction existence per account (best-effort)
      try {
        const ids = (data || []).map((a: any) => a.id);
        if (ids.length > 0) {
          // Attempt grouped query first
          let grouped: { account_id: string; count: number }[] | null = null;
          let groupedErr: any = null;
          try {
            const res = await supabase
              .from("account_transactions")
              .select("account_id, count:account_id")
              .in("account_id", ids)
              .group("account_id");
            grouped = (res.data as any) || null;
            groupedErr = res.error;
          } catch (gErr: any) {
            groupedErr = gErr;
          }
          if (!groupedErr && grouped) {
            const map: Record<string, boolean> = {};
            grouped.forEach((r: any) => { map[r.account_id] = Number(r.count || 0) > 0; });
            setTxHasRows(map);
          } else {
            // Fallback: per-id head counts (safe, low payload)
            const entries = await Promise.all(ids.map(async (aid: string) => {
              try {
                const { count } = await supabase
                  .from("account_transactions")
                  .select("*", { count: "exact", head: true })
                  .eq("account_id", aid);
                return [aid, (count || 0) > 0] as const;
              } catch {
                return [aid, false] as const;
              }
            }));
            const map: Record<string, boolean> = {};
            entries.forEach(([k, v]) => { map[k] = v; });
            setTxHasRows(map);
          }
        } else {
          setTxHasRows({});
        }
      } catch (err) {
        console.warn("Failed to prefetch transaction existence", err);
        setTxHasRows({});
      }
    } catch (e: any) {
      console.error(e);
      // Graceful fallback: surface empty state rather than erroring
      setAccounts([]);
      toast.error(e?.message || "Failed to load accounts");
    } finally {
      setLoading(false);
    }
  }, [organization?.id]);

  useEffect(() => {
    // Re-fetch when organization changes and is available
    if (organization?.id) {
      fetchAccounts();
    } else {
      // Reset view when org not ready
      setAccounts([]);
    }
  }, [organization?.id, fetchAccounts]);

  const refresh = async () => {
    setRefreshing(true);
    await fetchAccounts();
    setRefreshing(false);
  };

  const rebuildCoa = async (force: boolean = false) => {
    try {
      if (!organization?.id) return toast.error("No active organization");
      const { data, error } = await supabase.rpc('rebuild_organization_chart_of_accounts', { p_organization_id: organization.id, p_force: force });
      if (error) throw error;
      toast.success(`Chart rebuilt${data ? ` (inserted ${data.inserted}, updated ${data.updated}${force ? `, deleted ${data.deleted}` : ''})` : ''}`);
      await refresh();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Failed to rebuild chart');
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ account_code: "", account_name: "", account_type: "Asset", normal_balance: "debit", description: "", parent_account_id: "", account_subtype: "Cash" });
    setIsModalOpen(true);
  };

  const openEdit = (acc: Account) => {
    setEditing(acc);
    setForm({
      account_code: acc.account_code,
      account_name: acc.account_name,
      account_type: acc.account_type,
      normal_balance: acc.normal_balance || "debit",
      description: acc.description || "",
      parent_account_id: acc.parent_account_id || "",
      account_subtype: acc.account_subtype || "",
    });
    setIsModalOpen(true);
  };

  const handleAccountTypeChange = (nextType: string) => {
    // Sensible default: Asset/Expense -> debit, others -> credit
    const inferredNormal = nextType === "Asset" || nextType === "Expense" ? "debit" : "credit";
    const defaultSubtypeByType: Record<string, string> = {
      Asset: "Cash",
      Income: "Income",
      Liability: "Current Liability",
      Expense: "Expense",
      Equity: "Equity",
    };
    setForm({ ...form, account_type: nextType, normal_balance: inferredNormal, account_subtype: defaultSubtypeByType[nextType] || "" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!organization?.id) {
        toast.error("No active organization selected");
        return;
      }
      if (editing) {
        const { error } = await supabase
          .from("accounts")
          .update({
            account_code: form.account_code,
            account_name: form.account_name,
            account_type: form.account_type,
            normal_balance: form.normal_balance,
            description: form.description || null,
            parent_account_id: form.parent_account_id || null,
            account_subtype: form.account_subtype || null,
          })
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Account updated");
      } else {
        const { error } = await supabase
          .from("accounts")
          .insert([
            {
              account_code: form.account_code,
              account_name: form.account_name,
              account_type: form.account_type,
              normal_balance: form.normal_balance,
              description: form.description || null,
              parent_account_id: form.parent_account_id || null,
              organization_id: organization.id,
              account_subtype: form.account_subtype || null,
            },
          ]);
        if (error) throw error;
        toast.success("Account created");
      }
      setIsModalOpen(false);
      setEditing(null);
      fetchAccounts();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to save account");
    }
  };

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return accounts.filter((a) =>
      a.account_code.toLowerCase().includes(s) ||
      a.account_name.toLowerCase().includes(s) ||
      a.account_type.toLowerCase().includes(s) ||
      (a.normal_balance || "").toLowerCase().includes(s)
    );
  }, [accounts, search]);

  const subtypeOptionsByType: Record<string, string[]> = {
    Asset: ["Cash", "Bank", "Fixed Asset", "Accounts Receivable", "Stock"],
    Income: ["Income", "Other Income"],
    Liability: ["Accounts Payable", "Current Liability", "Goods Received Not Invoiced", "Other Liability", "Non Current Liability"],
    Expense: ["Expense", "Cost of Goods Sold", "Other Expense"],
    Equity: ["Equity"],
  };

  const requestDelete = (id: string) => {
    setConfirmDeleteId(id);
  };

  const performDelete = async () => {
    const id = confirmDeleteId;
    if (!id) return;
    try {
      const { count } = await supabase
        .from("account_transactions")
        .select("*", { count: "exact", head: true })
        .eq("account_id", id);
      if ((count || 0) > 0) {
        toast.error("Cannot delete: account has posted transactions");
        setConfirmDeleteId(null);
        return;
      }
      const { error } = await supabase.from("accounts").delete().eq("id", id);
      if (error) throw error;
      toast.success("Account deleted");
      setConfirmDeleteId(null);
      fetchAccounts();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to delete account");
      setConfirmDeleteId(null);
    }
  };

  return (
    <div className="flex-1 space-y-6 p-6 bg-gradient-to-br from-slate-50 to-slate-100/50 min-h-screen">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-xl shadow-lg">
            <Calculator className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Chart of Accounts</h1>
            <p className="text-slate-600">Manage account structure for your ledger</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Search accounts..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button variant="outline" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">Rebuild</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => rebuildCoa(false)}>Rebuild Defaults</DropdownMenuItem>
              <DropdownMenuItem onClick={() => rebuildCoa(true)} className="text-red-600 focus:text-red-600">Rebuild + Clean Unused</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700">
                <Plus className="w-4 h-4 mr-2" />
                New Account
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>{editing ? "Edit Account" : "Create Account"}</DialogTitle>
              </DialogHeader>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-slate-500">Prefer full page?</div>
                <div className="flex items-center gap-2 text-xs">
                  <Link to="/accounts/new" className="text-indigo-600 hover:underline">Open Create Page</Link>
                  {editing && <Link to={`/accounts/${editing.id}/edit`} className="text-indigo-600 hover:underline">Open Edit Page</Link>}
                </div>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Account Code</Label>
                    <Input value={form.account_code} onChange={(e) => setForm({ ...form, account_code: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Account Name</Label>
                    <Input value={form.account_name} onChange={(e) => setForm({ ...form, account_name: e.target.value })} required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <select className="border rounded px-3 py-2 w-full" value={form.account_type} onChange={(e) => handleAccountTypeChange(e.target.value)}>
                      <option>Asset</option>
                      <option>Income</option>
                      <option>Liability</option>
                      <option>Expense</option>
                      <option>Equity</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Normal Balance</Label>
                    <select className="border rounded px-3 py-2 w-full" value={form.normal_balance} onChange={(e) => setForm({ ...form, normal_balance: e.target.value })}>
                      <option value="debit">debit</option>
                      <option value="credit">credit</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Subtype</Label>
                    <select className="border rounded px-3 py-2 w-full" value={form.account_subtype} onChange={(e) => setForm({ ...form, account_subtype: e.target.value })}>
                      {(subtypeOptionsByType[form.account_type] || []).map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Parent Account (optional)</Label>
                  <Input value={form.parent_account_id} onChange={(e) => setForm({ ...form, parent_account_id: e.target.value })} placeholder="Parent account UUID" />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                  <Button type="submit">{editing ? "Save Changes" : "Create Account"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Subtype</TableHead>
                  <TableHead>Normal Balance</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((acc) => (
                  <TableRow key={acc.id}>
                    <TableCell className="font-medium">{acc.account_code}</TableCell>
                    <TableCell>
                      <Link to={`/accounts/${acc.id}`} className="text-indigo-700 hover:underline">
                        {acc.account_name}
                      </Link>
                    </TableCell>
                    <TableCell>{acc.account_type}</TableCell>
                    <TableCell>{acc.account_subtype || "—"}</TableCell>
                    <TableCell>{acc.normal_balance || "—"}</TableCell>
                    <TableCell>{acc.description || "—"}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => window.location.assign(`/accounts/${acc.id}`)}>
                            <Eye className="w-4 h-4 mr-2" /> View Account
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(acc)}>
                            <Pencil className="w-4 h-4 mr-2" /> Quick Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => window.location.assign(`/accounts/${acc.id}/edit`)}>
                            <Pencil className="w-4 h-4 mr-2" /> Edit Full Page
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled={!!txHasRows[acc.id]} onClick={() => requestDelete(acc.id)} className="text-red-600 focus:text-red-600">
                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <AlertDialog open={!!confirmDeleteId} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete account?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Accounts with transactions cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={performDelete} disabled={confirmDeleteId ? !!txHasRows[confirmDeleteId] : true}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
