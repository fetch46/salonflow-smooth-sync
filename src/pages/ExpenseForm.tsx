import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Receipt } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSaas } from "@/lib/saas";
import { postExpensePaymentWithAccount } from "@/utils/ledger";

interface ExpenseRecord {
  id: string;
  expense_number: string;
  vendor_name: string;
  description: string;
  amount: number;
  expense_date: string;
  category: string | null;
  payment_method: string | null;
  receipt_url: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  location_id: string | null;
}

interface AccountOption {
  id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  account_subtype: string | null;
}

interface LocationOption { id: string; name: string }

export default function ExpenseForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const { organization } = useSaas();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [expenseAccounts, setExpenseAccounts] = useState<AccountOption[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<AccountOption[]>([]);

  const [formData, setFormData] = useState({
    expense_number: "",
    vendor_name: "",
    description: "",
    amount: "",
    expense_date: new Date().toISOString().slice(0, 10),
    category: "",
    payment_method: "",
    receipt_url: "",
    status: "pending",
    notes: "",
    location_id: "",
  });
  const [paidFromAccountId, setPaidFromAccountId] = useState<string>("");

  const generateExpenseNumber = () => `EXP-${Date.now().toString().slice(-6)}`;

  const fetchLocations = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("business_locations")
        .select("id, name")
        .order("name");
      if (error) throw error;
      setLocations((data || []) as LocationOption[]);
    } catch (err) {
      console.warn("Failed to load business locations", err);
      setLocations([]);
    }
  }, []);

  const fetchExpenseAccounts = useCallback(async () => {
    try {
      const orgId = organization?.id || null;
      let data: any[] | null = null;
      let error: any = null;
      try {
        const baseSel = supabase
          .from("accounts")
          .select("id, account_code, account_name, account_type, account_subtype")
          .eq("account_type", "Expense")
          .eq("account_subtype", "Expense")
          .order("account_code", { ascending: true });
        if (orgId) {
          const scoped = await baseSel.eq("organization_id", orgId);
          data = scoped.data as any[] | null;
          error = scoped.error;
        } else {
          const res = await baseSel;
          data = (res as any).data as any[] | null;
          error = (res as any).error;
        }
      } catch (innerErr: any) {
        error = innerErr;
      }
      if (error) {
        const message = String(error?.message || "");
        if (message.includes("account_subtype") || (message.toLowerCase().includes("column") && message.toLowerCase().includes("does not exist"))) {
          const baseSel = supabase
            .from("accounts")
            .select("id, account_code, account_name, account_type")
            .eq("account_type", "Expense")
            .order("account_code", { ascending: true });
          const scoped = orgId ? await baseSel.eq("organization_id", orgId) : await baseSel;
          if (scoped.error) throw scoped.error;
          data = scoped.data as any[] | null;
        } else {
          throw error;
        }
      }
      setExpenseAccounts((data || []) as AccountOption[]);
    } catch (err) {
      console.warn("Failed to load expense accounts", err);
      setExpenseAccounts([]);
    }
  }, [organization?.id]);

  const fetchPaymentAccounts = useCallback(async () => {
    try {
      const query = supabase
        .from("accounts")
        .select("id, account_code, account_name, account_type, account_subtype");
      const { data, error } = await query;
      if (error) throw error;
      const list = (data || []) as AccountOption[];
      const filtered = list.filter(a =>
        (a.account_subtype === "Cash" || a.account_subtype === "Bank") ||
        (a.account_type === "Asset" && (!a.account_subtype || a.account_subtype === null))
      );
      filtered.sort((a, b) => (a.account_code || "").localeCompare(b.account_code || ""));
      setPaymentAccounts(filtered);
    } catch (err) {
      console.warn("Failed to load payment accounts", err);
      setPaymentAccounts([]);
    }
  }, []);

  const fetchExisting = useCallback(async (expenseId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("id", expenseId)
        .single();
      if (error) throw error;
      const e = data as unknown as ExpenseRecord;
      setFormData({
        expense_number: e.expense_number,
        vendor_name: e.vendor_name,
        description: e.description,
        amount: String(e.amount ?? ""),
        expense_date: (e.expense_date || "").slice(0,10),
        category: e.category || "",
        payment_method: e.payment_method || "",
        receipt_url: e.receipt_url || "",
        status: e.status,
        notes: e.notes || "",
        location_id: e.location_id || "",
      });
      try {
        const { data: existing, error: findErr } = await supabase
          .from("account_transactions")
          .select("id, account_id")
          .eq("reference_type", "expense_payment")
          .eq("reference_id", expenseId)
          .limit(1)
          .maybeSingle();
        if (findErr) throw findErr;
        setPaidFromAccountId(existing?.account_id || "");
      } catch {
        setPaidFromAccountId("");
      }
    } catch (err) {
      console.error("Error loading expense", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocations();
    fetchExpenseAccounts();
    fetchPaymentAccounts();
  }, [fetchLocations, fetchExpenseAccounts, fetchPaymentAccounts]);

  useEffect(() => {
    if (isEdit && id) fetchExisting(id);
  }, [isEdit, id, fetchExisting]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const amountNumber = parseFloat(formData.amount) || 0;
      const expenseData: any = {
        ...formData,
        expense_number: formData.expense_number || generateExpenseNumber(),
        amount: amountNumber,
        location_id: formData.location_id || null,
      };

      let saved: ExpenseRecord | null = null;
      if (isEdit && id) {
        const { data: updated, error } = await supabase
          .from("expenses")
          .update(expenseData)
          .eq("id", id)
          .select("*")
          .single();
        if (error) throw error;
        saved = (updated as any) as ExpenseRecord;
      } else {
        const { data: created, error } = await supabase
          .from("expenses")
          .insert([expenseData])
          .select("*")
          .single();
        if (error) throw error;
        saved = (created as any) as ExpenseRecord;
      }

      if (saved && formData.status === "paid" && organization?.id && paidFromAccountId) {
        try {
          const ok = await postExpensePaymentWithAccount({
            organizationId: organization.id,
            amount: Number(saved.amount || amountNumber || 0),
            paidFromAccountId,
            expenseId: saved.id,
            expenseNumber: saved.expense_number,
            paymentDate: String(saved.expense_date || formData.expense_date || new Date().toISOString().slice(0,10)),
            locationId: (saved.location_id as any) || null,
          });
          if (!ok) throw new Error("Ledger posting failed");
        } catch (ledgerErr) {
          console.warn("Ledger posting failed for expense", ledgerErr);
          toast({ title: "Warning", description: "Saved expense, but failed to post to ledger.", variant: "destructive" });
        }
      }

      toast({ title: "Success", description: isEdit ? "Expense updated" : "Expense created" });
      navigate("/expenses");
    } catch (error) {
      console.error("Error saving expense:", error);
      toast({ title: "Error", description: "Failed to save expense", variant: "destructive" });
    }
  };

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 pb-24 sm:pb-6 bg-gradient-to-br from-slate-50 to-slate-100/50 min-h-screen overflow-x-hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl shadow-lg">
            <Receipt className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{isEdit ? "Edit Expense" : "Create Expense"}</h1>
            <p className="text-slate-600">{isEdit ? "Update expense details" : "Add a new business expense"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <Button onClick={handleSubmit as any}>{isEdit ? "Update Expense" : "Create Expense"}</Button>
        </div>
      </div>

      <Card className="shadow-lg border-0">
        <CardHeader>
          <CardTitle>Expense Details</CardTitle>
          <CardDescription>Fill in the expense information</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expense_number">Expense Number</Label>
                <Input id="expense_number" placeholder="Auto-generated if empty" value={formData.expense_number} onChange={(e) => setFormData({ ...formData, expense_number: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor_name">Vendor Name</Label>
                <Input id="vendor_name" placeholder="Enter vendor name" value={formData.vendor_name} onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" placeholder="Expense description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} required />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input id="amount" type="number" step="0.01" placeholder="0.00" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expense_date">Expense Date</Label>
                <Input id="expense_date" type="date" value={formData.expense_date} onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })} required />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Account</Label>
                <Select value={formData.category} onValueChange={(value) => { const acc = expenseAccounts.find(a => a.account_name === value || a.id === value); setFormData({ ...formData, category: acc?.account_name || '' }); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select expense account" />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseAccounts.map(acc => (
                      <SelectItem key={acc.id} value={acc.account_name || acc.id}>{acc.account_code} - {acc.account_name || 'Unnamed Account'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment_method">Payment Method</Label>
                <Select value={formData.payment_method} onValueChange={(value) => setFormData({ ...formData, payment_method: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Credit Card">Credit Card</SelectItem>
                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    <SelectItem value="Check">Check</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="receipt_url">Receipt URL</Label>
                <Input id="receipt_url" placeholder="https://..." value={formData.receipt_url} onChange={(e) => setFormData({ ...formData, receipt_url: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Select value={formData.location_id} onValueChange={(value) => setFormData({ ...formData, location_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map(loc => (
                      <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {formData.status === 'paid' && (
                <div className="space-y-2">
                  <Label htmlFor="paid_from">Paid From Account</Label>
                  <Select value={paidFromAccountId} onValueChange={setPaidFromAccountId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Cash/Bank account" />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentAccounts.map(acc => (
                        <SelectItem key={acc.id} value={acc.id}>{acc.account_code} - {acc.account_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" placeholder="Additional notes..." value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => navigate("/expenses")}>Cancel</Button>
              <Button type="submit">{isEdit ? "Update Expense" : "Create Expense"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}