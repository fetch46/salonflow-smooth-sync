import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useSaas } from "@/lib/saas";

interface AccountFormProps {
  accountId?: string | null;
}

export default function AccountForm({ accountId }: AccountFormProps) {
  const navigate = useNavigate();
  const { organization } = useSaas();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    account_code: "",
    account_name: "",
    account_type: "Asset",
    account_subtype: "Cash",
    normal_balance: "debit",
    description: "",
    parent_account_id: "",
  });

  const subtypeOptionsByType: Record<string, string[]> = {
    Asset: ["Cash", "Bank", "Fixed Asset", "Accounts Receivable", "Stock"],
    Income: ["Income", "Other Income"],
    Liability: ["Accounts Payable", "Current Liability", "Other Liability", "Non Current Liability"],
    Expense: ["Expense", "Cost of Goods Sold", "Other Expense"],
    Equity: ["Equity"],
  };

  useEffect(() => {
    if (!accountId) return;
    (async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("accounts")
          .select("id, account_code, account_name, account_type, account_subtype, normal_balance, description, parent_account_id")
          .eq("id", accountId)
          .maybeSingle();
        if (error) throw error;
        if (data) {
          setForm({
            account_code: data.account_code || "",
            account_name: data.account_name || "",
            account_type: data.account_type || "Asset",
            account_subtype: data.account_subtype || "Cash",
            normal_balance: data.normal_balance || "debit",
            description: data.description || "",
            parent_account_id: data.parent_account_id || "",
          });
        }
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message || "Failed to load account");
      } finally {
        setLoading(false);
      }
    })();
  }, [accountId]);

  const handleTypeChange = (nextType: string) => {
    const inferredNormal = nextType === "Asset" || nextType === "Expense" ? "debit" : "credit";
    const defaultSubtypeByType: Record<string, string> = {
      Asset: "Cash",
      Income: "Income",
      Liability: "Current Liability",
      Expense: "Expense",
      Equity: "Equity",
    };
    setForm(prev => ({ ...prev, account_type: nextType, normal_balance: inferredNormal, account_subtype: defaultSubtypeByType[nextType] || prev.account_subtype }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!organization?.id && !accountId) {
        toast.error("No active organization selected");
        return;
      }
      setLoading(true);
      if (accountId) {
        const { error } = await supabase
          .from("accounts")
          .update({
            account_code: form.account_code,
            account_name: form.account_name,
            account_type: form.account_type,
            account_subtype: form.account_subtype,
            normal_balance: form.normal_balance,
            description: form.description || null,
            parent_account_id: form.parent_account_id || null,
          })
          .eq("id", accountId);
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
              account_subtype: form.account_subtype,
              normal_balance: form.normal_balance,
              description: form.description || null,
              parent_account_id: form.parent_account_id || null,
              organization_id: organization!.id,
            },
          ]);
        if (error) throw error;
        toast.success("Account created");
      }
      navigate("/accounts");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to save account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 space-y-6 p-6 bg-gradient-to-br from-slate-50 to-slate-100/50 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{accountId ? "Edit Account" : "Create Account"}</h1>
          <p className="text-slate-600">Manage your chart of accounts</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Account Code</Label>
                <Input value={form.account_code} onChange={(e) => setForm({ ...form, account_code: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Account Name</Label>
                <Input value={form.account_name} onChange={(e) => setForm({ ...form, account_name: e.target.value })} required />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <select className="border rounded px-3 py-2 w-full" value={form.account_type} onChange={(e) => handleTypeChange(e.target.value)}>
                  <option>Asset</option>
                  <option>Income</option>
                  <option>Liability</option>
                  <option>Expense</option>
                  <option>Equity</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Subtype</Label>
                <select className="border rounded px-3 py-2 w-full" value={form.account_subtype} onChange={(e) => setForm({ ...form, account_subtype: e.target.value })}>
                  {(subtypeOptionsByType[form.account_type] || []).map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Normal Balance</Label>
                <select className="border rounded px-3 py-2 w-full" value={form.normal_balance} onChange={(e) => setForm({ ...form, normal_balance: e.target.value })}>
                  <option value="debit">debit</option>
                  <option value="credit">credit</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Parent Account (optional)</Label>
                <Input value={form.parent_account_id} onChange={(e) => setForm({ ...form, parent_account_id: e.target.value })} placeholder="Parent account UUID" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => navigate('/accounts')}>Cancel</Button>
              <Button type="submit" disabled={loading}>{accountId ? "Save Changes" : "Create Account"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}