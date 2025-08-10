import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Plus, Search, Receipt, DollarSign, TrendingUp, AlertTriangle, RefreshCw, MapPin } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useSaas } from "@/lib/saas";
import { postExpensePaymentToLedger } from "@/utils/ledger";


interface Expense {
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

interface LocationOption {
  id: string;
  name: string;
}

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const { toast } = useToast();
  const { organization } = useSaas();

  const [formData, setFormData] = useState({
    expense_number: "",
    vendor_name: "",
    description: "",
    amount: "",
    expense_date: "",
    category: "",
    payment_method: "",
    receipt_url: "",
    status: "pending",
    notes: "",
    location_id: "",
  });

  const [expenseAccounts, setExpenseAccounts] = useState<AccountOption[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<AccountOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [paidFromAccountId, setPaidFromAccountId] = useState<string>("");

  const [locationFilter, setLocationFilter] = useState<string>("all");

  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setExpenses((data || []) as Expense[]);
    } catch (error) {
      console.error("Error fetching expenses:", error);
      toast({
        title: "Error",
        description: "Failed to fetch expenses",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await fetchExpenses();
    } finally {
      setRefreshing(false);
    }
  };

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

  useEffect(() => {
    fetchExpenses();
    fetchLocations();
  }, [fetchExpenses, fetchLocations]);

  const fetchExpenseAccounts = useCallback(async () => {
    try {
      const orgId = organization?.id || null;

      // Try subtype-aware query first
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
          // Fallback: filter only by type
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
      // Prefer Cash/Bank when subtype exists; fallback to Asset type if subtype missing in schema
      const filtered = list.filter(a =>
        (a.account_subtype === "Cash" || a.account_subtype === "Bank") ||
        (a.account_type === "Asset" && (!a.account_subtype || a.account_subtype === null))
      );
      // Sort by code
      filtered.sort((a, b) => (a.account_code || "").localeCompare(b.account_code || ""));
      setPaymentAccounts(filtered);
    } catch (err) {
      console.warn("Failed to load payment accounts", err);
      setPaymentAccounts([]);
    }
  }, []);

  useEffect(() => {
    if (isModalOpen) {
      fetchExpenseAccounts();
      fetchPaymentAccounts();
      fetchLocations();
    }
  }, [isModalOpen, fetchExpenseAccounts, fetchPaymentAccounts, fetchLocations]);

  const generateExpenseNumber = () => {
    const timestamp = Date.now().toString().slice(-6);
    return `EXP-${timestamp}`;
  };

  const upsertExpenseBankTransaction = useCallback(async (
    expId: string,
    amountNumber: number,
    transDate: string,
    description: string,
    accountId: string,
    locId: string | null
  ) => {
    try {
      // Check for existing transaction for this expense
      const { data: existing, error: findErr } = await supabase
        .from("account_transactions")
        .select("id")
        .eq("reference_type", "expense")
        .eq("reference_id", expId)
        .limit(1)
        .maybeSingle();
      if (findErr) throw findErr;

      if (existing?.id) {
        const { error: updErr } = await supabase
          .from("account_transactions")
          .update({
            account_id: accountId,
            transaction_date: transDate,
            description,
            debit_amount: 0,
            credit_amount: amountNumber,
            location_id: locId,
          })
          .eq("id", existing.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase
          .from("account_transactions")
          .insert([{ 
            account_id: accountId,
            transaction_date: transDate,
            description,
            debit_amount: 0,
            credit_amount: amountNumber,
            reference_type: "expense",
            reference_id: expId,
            location_id: locId,
          }]);
        if (insErr) throw insErr;
      }
    } catch (txErr) {
      console.error("Failed to upsert expense bank transaction", txErr);
      toast({ title: "Warning", description: "Saved expense, but failed to record bank transaction.", variant: "destructive" });
    }
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const amountNumber = parseFloat(formData.amount) || 0;
      const expenseData = {
        ...formData,
        expense_number: formData.expense_number || generateExpenseNumber(),
        amount: amountNumber,
        location_id: formData.location_id || null,
      } as any;

      let saved: Expense | null = null;

      if (editingExpense) {
        const { data: updated, error } = await supabase
          .from("expenses")
          .update(expenseData)
          .eq("id", editingExpense.id)
          .select("*")
          .single();

        if (error) throw error;
        saved = updated as any as Expense;
      } else {
        const { data: created, error } = await supabase
          .from("expenses")
          .insert([expenseData])
          .select("*")
          .single();
        if (error) throw error;
        saved = created as any as Expense;
      }

      // If marked as paid, post to ledger (debit Expense, credit Cash/Bank) once
      if (saved && formData.status === "paid" && organization?.id) {
        try {
          // Avoid duplicate postings for the same expense
          const { data: existingTxn } = await supabase
            .from("account_transactions")
            .select("id")
            .eq("reference_type", "expense_payment")
            .eq("reference_id", saved.id)
            .limit(1);

          if (!existingTxn || existingTxn.length === 0) {
            await postExpensePaymentToLedger({
              organizationId: organization.id,
              amount: Number(saved.amount || amountNumber || 0),
              method: String(saved.payment_method || formData.payment_method || "Cash"),
              expenseId: saved.id,
              expenseNumber: saved.expense_number,
              paymentDate: String(saved.expense_date || formData.expense_date || new Date().toISOString().slice(0,10)),
              locationId: (saved.location_id as any) || null,
            });
          }
        } catch (ledgerErr) {
          console.warn("Ledger posting failed for expense", ledgerErr);
        }
      }

      setIsModalOpen(false);
      setEditingExpense(null);
      resetForm();
      fetchExpenses();
    } catch (error) {
      console.error("Error saving expense:", error);
      toast({
        title: "Error",
        description: "Failed to save expense",
        variant: "destructive",
      });
    }
  };

  const handleEdit = async (expense: Expense) => {
    setEditingExpense(expense);
    setFormData({
      expense_number: expense.expense_number,
      vendor_name: expense.vendor_name,
      description: expense.description,
      amount: expense.amount.toString(),
      expense_date: expense.expense_date,
      category: expense.category || "",
      payment_method: expense.payment_method || "",
      receipt_url: expense.receipt_url || "",
      status: expense.status,
      notes: expense.notes || "",
      location_id: expense.location_id || "",
    });
    // Try to prefill paid-from account based on existing transaction
    try {
      const { data: existing, error } = await supabase
        .from("account_transactions")
        .select("id, account_id")
        .eq("reference_type", "expense")
        .eq("reference_id", expense.id)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      setPaidFromAccountId(existing?.account_id || "");
    } catch {
      setPaidFromAccountId("");
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this expense?")) {
      try {
        const { error } = await supabase
          .from("expenses")
          .delete()
          .eq("id", id);

        if (error) throw error;
        toast({
          title: "Success",
          description: "Expense deleted successfully",
        });
        fetchExpenses();
      } catch (error) {
        console.error("Error deleting expense:", error);
        toast({
          title: "Error",
          description: "Failed to delete expense",
          variant: "destructive",
        });
      }
    }
  };

  const resetForm = () => {
    setFormData({
      expense_number: "",
      vendor_name: "",
      description: "",
      amount: "",
      expense_date: "",
      category: "",
      payment_method: "",
      receipt_url: "",
      status: "pending",
      notes: "",
      location_id: "",
    });
    setPaidFromAccountId("");
  };

  const filteredExpenses = expenses
    .filter((expense) => locationFilter === "all" || expense.location_id === locationFilter)
    .filter((expense) =>
      expense.expense_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.vendor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (expense.category || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

  const getStatusBadge = (status: string) => {
    const statusColors = {
      pending: "bg-yellow-100 text-yellow-800",
      approved: "bg-blue-100 text-blue-800",
      paid: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
    };

    return (
      <Badge className={statusColors[status as keyof typeof statusColors] || "bg-gray-100 text-gray-800"}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  const stats = {
    total: filteredExpenses.length,
    pending: filteredExpenses.filter(e => e.status === 'pending').length,
    approved: filteredExpenses.filter(e => e.status === 'approved').length,
    paid: filteredExpenses.filter(e => e.status === 'paid').length,
    totalAmount: filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0),
    totalPaidAmount: filteredExpenses.filter(e => e.status === 'paid').reduce((sum, e) => sum + (e.amount || 0), 0),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading expenses...</p>
        </div>
      </div>
    );
  }

  return (
      <div className="flex-1 space-y-6 p-6 bg-gradient-to-br from-slate-50 to-slate-100/50 min-h-screen">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl shadow-lg">
              <Receipt className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Expenses</h2>
              <p className="text-slate-600">Track and manage your business expenses</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search expenses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Filter by location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations.map(loc => (
                  <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={onRefresh} disabled={refreshing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { setEditingExpense(null); resetForm(); }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Expense
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingExpense ? "Edit Expense" : "Add New Expense"}</DialogTitle>
                  <DialogDescription>
                    {editingExpense ? "Update the expense details." : "Fill in the expense information."}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="expense_number">Expense Number</Label>
                      <Input
                        id="expense_number"
                        placeholder="Auto-generated if empty"
                        value={formData.expense_number}
                        onChange={(e) => setFormData({ ...formData, expense_number: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vendor_name">Vendor Name</Label>
                      <Input
                        id="vendor_name"
                        placeholder="Enter vendor name"
                        value={formData.vendor_name}
                        onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      placeholder="Expense description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="amount">Amount</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="expense_date">Expense Date</Label>
                      <Input
                        id="expense_date"
                        type="date"
                        value={formData.expense_date}
                        onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
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

                  <div className="grid grid-cols-2 gap-4">
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
                      <Input
                        id="receipt_url"
                        placeholder="https://..."
                        value={formData.receipt_url}
                        onChange={(e) => setFormData({ ...formData, receipt_url: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
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
                    <Textarea
                      id="notes"
                      placeholder="Additional notes..."
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    />
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">
                      {editingExpense ? "Update Expense" : "Add Expense"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">${stats.totalAmount.toFixed(2)} total</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.approved}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.totalPaidAmount.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">{stats.paid} expenses</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters Row (Search + Location) */}
        {/* Kept above in header */}

        {/* Expenses Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Expenses</CardTitle>
            <CardDescription>
              Track and manage your business expenses.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Expense #</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="font-medium">{expense.expense_number}</TableCell>
                    <TableCell>{expense.vendor_name}</TableCell>
                    <TableCell>{expense.description}</TableCell>
                    <TableCell>{expense.category || "N/A"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-slate-700">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                        {locations.find(l => l.id === expense.location_id)?.name || "-"}
                      </div>
                    </TableCell>
                    <TableCell>{format(new Date(expense.expense_date), "MMM dd, yyyy")}</TableCell>
                    <TableCell>${expense.amount.toFixed(2)}</TableCell>
                    <TableCell>{getStatusBadge(expense.status)}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(expense)}>
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(expense.id)}>
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
  );
}