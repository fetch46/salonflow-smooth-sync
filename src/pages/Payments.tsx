import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Calendar, Download, Edit, MoreVertical, Plus, RefreshCw, Trash2, TrendingDown, TrendingUp, DollarSign, Receipt, Banknote, CreditCard } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { toast } from "sonner";
import { 
  getAllInvoicePaymentsWithFallback, 
  updateInvoicePaymentWithFallback, 
  deleteInvoicePaymentWithFallback,
  recordInvoicePaymentWithFallback,
  getInvoicesWithBalanceWithFallback 
} from "@/utils/mockDatabase";
import { useNavigate } from "react-router-dom";
import { downloadInvoicePDF } from "@/utils/invoicePdf";
import { useOrganizationCurrency, useOrganization } from "@/lib/saas/hooks";

interface InvoicePayment {
  id: string;
  invoice_id: string;
  amount: number;
  payment_method: string;
  reference: string | null;
  payment_date: string;
  created_at?: string;
}

interface InvoiceLite {
  id: string;
  invoice_number: string;
  customer_id: string | null;
  total_amount: number;
  created_at: string;
  amount_paid?: number;
  status?: string;
}

interface ClientLite { 
  id: string; 
  full_name: string;
}

interface ExpenseMetrics {
  totalExpenses: number;
  expenseCount: number;
  avgExpense: number;
  previousMonthExpenses: number;
  expensesTrend: number;
}

interface PaymentMetrics {
  totalReceived: number;
  paymentCount: number;
  avgPayment: number;
  previousMonthReceived: number;
  receivedTrend: number;
}

export default function PaymentsNew() {
  const navigate = useNavigate();
  const { format: formatCurrency } = useOrganizationCurrency();
  const { organization } = useOrganization();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Received payments
  const [payments, setPayments] = useState<InvoicePayment[]>([]);
  const [invoicesById, setInvoicesById] = useState<Record<string, InvoiceLite>>({});
  const [clientsById, setClientsById] = useState<Record<string, ClientLite>>({});
  const [searchReceived, setSearchReceived] = useState("");
  
  // Payment made data (expenses)
  const [expenses, setExpenses] = useState<any[]>([]);
  const [searchMade, setSearchMade] = useState("");
  
  // Metrics
  const [paymentMetrics, setPaymentMetrics] = useState<PaymentMetrics>({
    totalReceived: 0,
    paymentCount: 0,
    avgPayment: 0,
    previousMonthReceived: 0,
    receivedTrend: 0,
  });
  
  const [expenseMetrics, setExpenseMetrics] = useState<ExpenseMetrics>({
    totalExpenses: 0,
    expenseCount: 0,
    avgExpense: 0,
    previousMonthExpenses: 0,
    expensesTrend: 0,
  });

  // Payment creation
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");
  const [invoiceOptions, setInvoiceOptions] = useState<Array<{ id: string; invoice_number: string; total_amount: number; amount_paid?: number }>>([]);
  const [createForm, setCreateForm] = useState<{ amount: string; method: string; reference: string; payment_date: string; account_id: string }>({ 
    amount: "", 
    method: "cash", 
    reference: "", 
    payment_date: new Date().toISOString().slice(0,10), 
    account_id: "" 
  });
  const [assetAccounts, setAssetAccounts] = useState<Array<{ id: string; account_code: string; account_name: string }>>([]);

  // Edit payment
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<InvoicePayment | null>(null);
  const [editForm, setEditForm] = useState({ amount: "", method: "cash", reference: "", payment_date: "" });

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load payments received
      const [pays, invs] = await Promise.all([
        getAllInvoicePaymentsWithFallback(supabase),
        getInvoicesWithBalanceWithFallback(supabase),
      ]);
      
      setPayments(pays as any);
      const byId: Record<string, InvoiceLite> = {};
      (invs as any[]).forEach(r => { byId[r.id] = r; });
      setInvoicesById(byId);

      // Load clients
      const clientIds = Array.from(new Set((invs as any[]).map(r => r.customer_id).filter(Boolean)));
      if (clientIds.length) {
        try {
          const { data } = await supabase
            .from('clients')
            .select('id, full_name')
            .in('id', clientIds as string[]);
          const cById: Record<string, ClientLite> = {};
          (data || []).forEach(c => { cById[c.id] = c as any; });
          setClientsById(cById);
        } catch {
          setClientsById({});
        }
      }

      // Load expenses (payments made)
      const { data: expData } = await supabase
        .from('expenses')
        .select('id, expense_number, vendor_name, amount, expense_date, payment_method, status')
        .order('created_at', { ascending: false });
      setExpenses(expData || []);

      // Calculate metrics
      calculateMetrics(pays as any[], expData || []);

    } catch (err) {
      console.error(err);
      toast.error('Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  const calculateMetrics = (receivedPayments: InvoicePayment[], expenseData: any[]) => {
    const currentMonth = new Date();
    const previousMonth = subMonths(currentMonth, 1);
    
    const currentStart = startOfMonth(currentMonth);
    const currentEnd = endOfMonth(currentMonth);
    const previousStart = startOfMonth(previousMonth);
    const previousEnd = endOfMonth(previousMonth);

    // Received payments metrics
    const currentReceivedPayments = receivedPayments.filter(p => {
      const paymentDate = new Date(p.payment_date);
      return paymentDate >= currentStart && paymentDate <= currentEnd;
    });
    
    const previousReceivedPayments = receivedPayments.filter(p => {
      const paymentDate = new Date(p.payment_date);
      return paymentDate >= previousStart && paymentDate <= previousEnd;
    });

    const totalReceived = currentReceivedPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const previousMonthReceived = previousReceivedPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const receivedTrend = previousMonthReceived > 0 ? ((totalReceived - previousMonthReceived) / previousMonthReceived) * 100 : 0;

    setPaymentMetrics({
      totalReceived,
      paymentCount: currentReceivedPayments.length,
      avgPayment: currentReceivedPayments.length ? totalReceived / currentReceivedPayments.length : 0,
      previousMonthReceived,
      receivedTrend,
    });

    // Expense metrics
    const currentExpenses = expenseData.filter(e => {
      const expenseDate = new Date(e.expense_date);
      return expenseDate >= currentStart && expenseDate <= currentEnd;
    });
    
    const previousExpenses = expenseData.filter(e => {
      const expenseDate = new Date(e.expense_date);
      return expenseDate >= previousStart && expenseDate <= previousEnd;
    });

    const totalExpenses = currentExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const previousMonthExpenses = previousExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const expensesTrend = previousMonthExpenses > 0 ? ((totalExpenses - previousMonthExpenses) / previousMonthExpenses) * 100 : 0;

    setExpenseMetrics({
      totalExpenses,
      expenseCount: currentExpenses.length,
      avgExpense: currentExpenses.length ? totalExpenses / currentExpenses.length : 0,
      previousMonthExpenses,
      expensesTrend,
    });
  };

  const loadCreateFormData = async () => {
    if (!createOpen) return;

    try {
      // Load invoice options
      const invs = await getInvoicesWithBalanceWithFallback(supabase);
      setInvoiceOptions(invs as any);

      // Load asset accounts
      if (organization?.id) {
        let data: any[] | null = null;
        try {
          const res = await supabase
            .from("accounts")
            .select("id, account_code, account_name, account_type, account_subtype")
            .eq("organization_id", organization.id)
            .eq("account_type", "Asset")
            .order("account_code", { ascending: true });
          data = res.data as any[] | null;
        } catch {}
        
        const filtered = (data || []).filter((a: any) => 
          a.account_type === "Asset" && 
          (!a.account_subtype || ["Cash","Bank"].includes(a.account_subtype))
        );
        setAssetAccounts(filtered);
      }
    } catch (err) {
      console.error('Failed to load form data:', err);
    }
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => { loadCreateFormData(); }, [createOpen, organization?.id]);

  // Auto-fill amount when invoice is selected
  useEffect(() => {
    if (createOpen && selectedInvoiceId && invoiceOptions.length) {
      const invoice = invoiceOptions.find(x => x.id === selectedInvoiceId);
      if (invoice) {
        const outstanding = Math.max(0, Number(invoice.total_amount || 0) - Number(invoice.amount_paid || 0));
        setCreateForm(prev => ({ ...prev, amount: outstanding > 0 ? outstanding.toFixed(2) : "" }));
      }
    }
  }, [createOpen, selectedInvoiceId, invoiceOptions]);

  const refresh = async () => { 
    setRefreshing(true); 
    await loadData(); 
    setRefreshing(false); 
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceId) { toast.error('Select an invoice'); return; }
    const amt = parseFloat(createForm.amount) || 0;
    if (amt <= 0) { toast.error('Invalid amount'); return; }
    if (!createForm.account_id) { toast.error('Select a deposit account'); return; }
    
    try {
      const result = await recordInvoicePaymentWithFallback(supabase, {
        invoice_id: selectedInvoiceId,
        amount: amt,
        method: createForm.method,
        reference_number: createForm.reference || null,
        payment_date: createForm.payment_date,
        account_id: createForm.account_id,
      });
      
      if (result.success) {
        toast.success('Payment recorded successfully');
        setCreateOpen(false);
        setSelectedInvoiceId("");
        setCreateForm({ amount: "", method: "cash", reference: "", payment_date: new Date().toISOString().slice(0,10), account_id: "" });
        await loadData();
      } else {
        toast.error(result.error || 'Failed to record payment');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to record payment');
    }
  };

  const openEdit = (p: InvoicePayment) => {
    setEditing(p);
    setEditForm({
      amount: String(p.amount ?? ''),
      method: p.payment_method || 'cash',
      reference: p.reference || '',
      payment_date: p.payment_date || new Date().toISOString().slice(0,10),
    });
    setEditOpen(true);
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const amt = parseFloat(editForm.amount) || 0;
    if (amt <= 0) { toast.error('Invalid amount'); return; }
    
    try {
      await updateInvoicePaymentWithFallback(supabase, editing.id, {
        amount: amt,
        method: editForm.method,
        reference_number: editForm.reference || null,
        payment_date: editForm.payment_date,
      });
      toast.success('Payment updated');
      setEditOpen(false);
      setEditing(null);
      await loadData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update payment');
    }
  };

  const deletePayment = async (p: InvoicePayment) => {
    if (!confirm('Delete this payment? This cannot be undone.')) return;
    try {
      await deleteInvoicePaymentWithFallback(supabase, p.id);
      toast.success('Payment deleted');
      await loadData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete payment');
    }
  };

  const handleDownloadInvoice = async (invoiceId: string, format: 'standard' | '80mm' = 'standard') => {
    try {
      const invoice = invoicesById[invoiceId];
      if (!invoice) return;
      
      await downloadInvoicePDF({
        id: invoiceId,
        invoice_number: invoice.invoice_number,
        client_id: invoice.customer_id,
        total_amount: invoice.total_amount,
        issue_date: invoice.created_at,
        status: invoice.status || 'sent'
      }, format);
      
      toast.success(`Invoice downloaded (${format})`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to download invoice');
    }
  };

  // Filter data
  const filteredReceived = payments.filter(p => {
    const invoice = invoicesById[p.invoice_id];
    const clientName = invoice?.customer_id ? (clientsById[invoice.customer_id]?.full_name || '') : '';
    const s = searchReceived.toLowerCase();
    return (
      (invoice?.invoice_number || '').toLowerCase().includes(s) ||
      clientName.toLowerCase().includes(s) ||
      (p.payment_method || '').toLowerCase().includes(s) ||
      (p.reference || '').toLowerCase().includes(s)
    );
  });

  const filteredMade = expenses.filter(e => {
    const s = searchMade.toLowerCase();
    return (
      (e.expense_number || '').toLowerCase().includes(s) ||
      (e.vendor_name || '').toLowerCase().includes(s) ||
      (e.payment_method || '').toLowerCase().includes(s)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="mt-2 text-muted-foreground">Loading payments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
            <p className="text-muted-foreground">Manage payments received and made</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={refresh} disabled={refreshing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={() => navigate('/payments/received/new')}>
              <Plus className="w-4 h-4 mr-2" />
              Record Payment
            </Button>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Received</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(paymentMetrics.totalReceived)}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                {paymentMetrics.receivedTrend > 0 ? (
                  <TrendingUp className="h-3 w-3 mr-1 text-green-600" />
                ) : (
                  <TrendingDown className="h-3 w-3 mr-1 text-red-600" />
                )}
                <span className={paymentMetrics.receivedTrend > 0 ? "text-green-600" : "text-red-600"}>
                  {Math.abs(paymentMetrics.receivedTrend).toFixed(1)}%
                </span>
                <span className="ml-1">vs last month</span>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Payments Count</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{paymentMetrics.paymentCount}</div>
              <p className="text-xs text-muted-foreground">
                Avg: {formatCurrency(paymentMetrics.avgPayment)}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(expenseMetrics.totalExpenses)}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                {expenseMetrics.expensesTrend > 0 ? (
                  <TrendingUp className="h-3 w-3 mr-1 text-red-600" />
                ) : (
                  <TrendingDown className="h-3 w-3 mr-1 text-green-600" />
                )}
                <span className={expenseMetrics.expensesTrend > 0 ? "text-red-600" : "text-green-600"}>
                  {Math.abs(expenseMetrics.expensesTrend).toFixed(1)}%
                </span>
                <span className="ml-1">vs last month</span>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Net Cash Flow</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(paymentMetrics.totalReceived - expenseMetrics.totalExpenses)}
              </div>
              <p className="text-xs text-muted-foreground">
                This month
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Payments Received Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-green-600" />
              Payments Received
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <Input
                placeholder="Search by invoice, client, method..."
                value={searchReceived}
                onChange={(e) => setSearchReceived(e.target.value)}
                className="md:max-w-sm"
              />
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReceived.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No payments found
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredReceived.map((payment) => {
                    const invoice = invoicesById[payment.invoice_id];
                    const clientName = invoice?.customer_id ? (clientsById[invoice.customer_id]?.full_name || '—') : 'Walk-in';
                    
                    return (
                      <TableRow key={payment.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">{invoice?.invoice_number || '—'}</TableCell>
                        <TableCell>{clientName}</TableCell>
                        <TableCell>{format(new Date(payment.payment_date), 'MMM dd, yyyy')}</TableCell>
                        <TableCell>{formatCurrency(Number(payment.amount || 0))}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {(payment.payment_method || 'cash').toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>{payment.reference || '—'}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => handleDownloadInvoice(payment.invoice_id)}>
                                <Download className="mr-2 h-4 w-4" /> Download Invoice
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEdit(payment)}>
                                <Edit className="mr-2 h-4 w-4" /> Edit Payment
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-red-600" onClick={() => deletePayment(payment)}>
                                <Trash2 className="mr-2 h-4 w-4" /> Delete Payment
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Payments Made Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-red-600" />
              Payments Made (Expenses)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <Input
                placeholder="Search expenses..."
                value={searchMade}
                onChange={(e) => setSearchMade(e.target.value)}
                className="md:max-w-sm"
              />
              <Button variant="outline" onClick={() => navigate('/expenses/new')}>
                <Plus className="w-4 h-4 mr-2" />
                Add Expense
              </Button>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Expense #</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMade.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No expenses found
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredMade.map((expense) => (
                    <TableRow key={expense.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">{expense.expense_number}</TableCell>
                      <TableCell>{expense.vendor_name}</TableCell>
                      <TableCell>{format(new Date(expense.expense_date), 'MMM dd, yyyy')}</TableCell>
                      <TableCell>{formatCurrency(Number(expense.amount || 0))}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {(expense.payment_method || 'cash').toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={expense.status === 'paid' ? 'default' : 'secondary'}>
                          {expense.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/expenses/${expense.id}`)}>
                              <Edit className="mr-2 h-4 w-4" /> View/Edit
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

        {/* Edit Payment Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Payment</DialogTitle>
            </DialogHeader>
            <form onSubmit={submitEdit} className="space-y-4">
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editForm.amount}
                  onChange={(e) => setEditForm(prev => ({ ...prev, amount: e.target.value }))}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={editForm.method} onValueChange={(v) => setEditForm(prev => ({ ...prev, method: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="mpesa">M-Pesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Reference</Label>
                <Input
                  value={editForm.reference}
                  onChange={(e) => setEditForm(prev => ({ ...prev, reference: e.target.value }))}
                  placeholder="Optional reference number"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Payment Date</Label>
                <Input
                  type="date"
                  value={editForm.payment_date}
                  onChange={(e) => setEditForm(prev => ({ ...prev, payment_date: e.target.value }))}
                  required
                />
              </div>
              
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Update Payment</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}