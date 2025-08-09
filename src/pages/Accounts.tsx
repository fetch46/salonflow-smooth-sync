import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Calculator, Plus, RefreshCw, Search } from "lucide-react";
import { useSaas } from "@/lib/saas";
import { getReceiptsWithFallback } from "@/utils/mockDatabase";

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
}

export default function Accounts() {
  const { organization } = useSaas();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState({
    account_code: "",
    account_name: "",
    account_type: "Asset",
    normal_balance: "debit",
    description: "",
    parent_account_id: "",
  });

  useEffect(() => {
    document.title = "Chart of Accounts | SalonOS";
  }, []);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("accounts")
        .select("id, account_code, account_name, account_type, normal_balance, description, parent_account_id")
        .eq("organization_id", organization?.id || "00000000-0000-0000-0000-000000000000")
        .order("account_code", { ascending: true });
      if (error) throw error;

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
    } catch (e) {
      console.error(e);
      // Graceful fallback: surface empty state rather than erroring
      setAccounts([]);
      toast.error("Failed to load accounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    await fetchAccounts();
    setRefreshing(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ account_code: "", account_name: "", account_type: "Asset", normal_balance: "debit", description: "", parent_account_id: "" });
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
    });
    setIsModalOpen(true);
  };

  const handleAccountTypeChange = (nextType: string) => {
    // Sensible default: Asset/Expense -> debit, others -> credit
    const inferredNormal = nextType === "Asset" || nextType === "Expense" ? "debit" : "credit";
    setForm({ ...form, account_type: nextType, normal_balance: inferredNormal });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
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
            organization_id: organization?.id || null,
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
              organization_id: organization?.id || null,
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
                  <TableHead>Normal Balance</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((acc) => (
                  <TableRow key={acc.id}>
                    <TableCell className="font-medium">{acc.account_code}</TableCell>
                    <TableCell>{acc.account_name}</TableCell>
                    <TableCell>{acc.account_type}</TableCell>
                    <TableCell>{acc.normal_balance || "—"}</TableCell>
                    <TableCell>{acc.description || "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => openEdit(acc)}>Edit</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
