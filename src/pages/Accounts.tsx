import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { RefreshCw, Download, TrendingUp, TrendingDown, Wallet, FileText, DollarSign, Receipt, ArrowUpRight, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface InvoiceRow {
  id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string | null;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  client?: { id: string; full_name: string; email: string | null } | null;
}

interface ExpenseRow {
  id: string;
  expense_number: string;
  expense_date: string;
  amount: number;
  category: string | null;
  vendor_name: string;
  status: string;
}

export default function Accounts() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);

  useEffect(() => {
    document.title = "Accounting | SalonOS";
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [{ data: inv, error: invErr }, { data: exp, error: expErr }] = await Promise.all([
        supabase
          .from("invoices")
          .select(`id, invoice_number, issue_date, due_date, subtotal, tax_amount, total_amount, status, client:client_id (id, full_name, email)`) 
          .order("created_at", { ascending: false }),
        supabase
          .from("expenses")
          .select("id, expense_number, expense_date, amount, category, vendor_name, status")
          .order("expense_date", { ascending: false }),
      ]);
      if (invErr) throw invErr;
      if (expErr) throw expErr;
      const mappedInv: InvoiceRow[] = (inv || []).map((row: any) => ({
        id: row.id,
        invoice_number: row.invoice_number,
        issue_date: row.issue_date,
        due_date: row.due_date,
        subtotal: row.subtotal,
        tax_amount: row.tax_amount,
        total_amount: row.total_amount,
        status: row.status,
        client: row.client ? (Array.isArray(row.client) ? row.client[0] : row.client) : null,
      }));
      setInvoices(mappedInv);
      setExpenses(exp || []);
    } catch (e) {
      console.error("Error loading accounting data", e);
      toast.error("Failed to load accounting data");
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    try {
      setRefreshing(true);
      await fetchData();
      toast.success("Data refreshed");
    } catch {
      toast.error("Refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  const metrics = useMemo(() => {
    const totalRevenue = invoices.reduce((sum, r) => sum + (r.total_amount || 0), 0);
    const paid = invoices.filter(i => i.status === "paid").reduce((s, r) => s + r.total_amount, 0);
    const overdue = invoices.filter(i => i.status === "overdue").reduce((s, r) => s + r.total_amount, 0);
    const pending = invoices.filter(i => ["draft", "sent", "partial"].includes(i.status)).reduce((s, r) => s + r.total_amount, 0);

    const totalExpenses = expenses.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const net = totalRevenue - totalExpenses;

    return { totalRevenue, paid, overdue, pending, totalExpenses, net };
  }, [invoices, expenses]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto"></div>
          <p className="text-slate-600">Loading accounting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-6 bg-gradient-to-br from-slate-50 to-slate-100/50 min-h-screen">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-emerald-600 to-cyan-600 rounded-xl shadow-lg">
              <Wallet className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Accounting Overview</h1>
              <p className="text-slate-600">Track revenue, expenses and profitability</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={refresh} disabled={refreshing} className="border-slate-300 hover:bg-slate-50">
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="border-slate-300 hover:bg-slate-50">
                <Download className="w-4 h-4 mr-2" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 z-50 bg-background">
              <DropdownMenuItem>Export Summary</DropdownMenuItem>
              <DropdownMenuItem>Export Invoices</DropdownMenuItem>
              <DropdownMenuItem>Export Expenses</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card className="relative overflow-hidden border-0 shadow-lg">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-indigo-600 opacity-100" />
          <CardHeader className="relative">
            <CardTitle className="text-sm text-white/90 flex items-center gap-2"><DollarSign className="w-4 h-4" />Total Revenue</CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-white">${metrics.totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-white/80">All invoices</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-lg">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-emerald-600 opacity-100" />
          <CardHeader className="relative">
            <CardTitle className="text-sm text-white/90 flex items-center gap-2"><TrendingUp className="w-4 h-4" />Paid</CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-white">${metrics.paid.toFixed(2)}</div>
            <p className="text-xs text-white/80">Cash collected</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-lg">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500 to-amber-600 opacity-100" />
          <CardHeader className="relative">
            <CardTitle className="text-sm text-white/90 flex items-center gap-2"><FileText className="w-4 h-4" />Pending</CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-white">${metrics.pending.toFixed(2)}</div>
            <p className="text-xs text-white/80">Draft/Sent/Partial</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-lg">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500 to-rose-600 opacity-100" />
          <CardHeader className="relative">
            <CardTitle className="text-sm text-white/90 flex items-center gap-2"><TrendingDown className="w-4 h-4" />Overdue</CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-white">${metrics.overdue.toFixed(2)}</div>
            <p className="text-xs text-white/80">Requires attention</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-lg">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-500 to-slate-600 opacity-100" />
          <CardHeader className="relative">
            <CardTitle className="text-sm text-white/90 flex items-center gap-2"><Receipt className="w-4 h-4" />Expenses</CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-white">${metrics.totalExpenses.toFixed(2)}</div>
            <p className="text-xs text-white/80">Total spend</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-lg">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-teal-600 opacity-100" />
          <CardHeader className="relative">
            <CardTitle className="text-sm text-white/90 flex items-center gap-2"><ArrowUpRight className="w-4 h-4" />Net Income</CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-white">${metrics.net.toFixed(2)}</div>
            <p className="text-xs text-white/80">Revenue - Expenses</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="invoices" className="space-y-6">
        <TabsList>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4" /> Recent Invoices</CardTitle>
              <div className="text-sm text-slate-500 flex items-center gap-2"><CalendarDays className="w-4 h-4" /> Updated {format(new Date(), 'MMM dd, yyyy')}</div>
            </CardHeader>
            <Separator />
            <CardContent className="p-0">
              {invoices.length === 0 ? (
                <div className="text-center py-10 text-slate-500">No invoices found</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.slice(0, 8).map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                        <TableCell>{inv.client?.full_name || "—"}</TableCell>
                        <TableCell>{format(new Date(inv.issue_date), 'MMM dd, yyyy')}</TableCell>
                        <TableCell>{inv.due_date ? format(new Date(inv.due_date), 'MMM dd, yyyy') : '—'}</TableCell>
                        <TableCell>{inv.status}</TableCell>
                        <TableCell className="text-right font-semibold">${inv.total_amount.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><Receipt className="w-4 h-4" /> Recent Expenses</CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="p-0">
              {expenses.length === 0 ? (
                <div className="text-center py-10 text-slate-500">No expenses found</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.slice(0, 8).map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">{e.expense_number}</TableCell>
                        <TableCell>{e.vendor_name}</TableCell>
                        <TableCell>{format(new Date(e.expense_date), 'MMM dd, yyyy')}</TableCell>
                        <TableCell>{e.category || '—'}</TableCell>
                        <TableCell>{e.status}</TableCell>
                        <TableCell className="text-right font-semibold">${Number(e.amount).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
