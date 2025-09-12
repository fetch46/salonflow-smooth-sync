import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CalendarRange, Download, Edit, MoreVertical, RefreshCw, Search, Trash2, DollarSign, Banknote } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { getAllInvoicePaymentsWithFallback, updateInvoicePaymentWithFallback, deleteInvoicePaymentWithFallback } from "@/utils/mockDatabase";
import { useNavigate } from "react-router-dom";
import { useOrganizationCurrency, useOrganization } from "@/lib/saas/hooks";
import { downloadInvoicePDF } from "@/utils/invoicePdf";

interface InvoicePayment {
  id: string;
  invoice_id: string;
  amount: number;
  method: string;
  reference_number: string | null;
  payment_date: string;
  created_at?: string;
}

interface InvoiceLite {
  id: string;
  invoice_number: string;
  customer_id: string | null;
  customer_name?: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  total_amount: number;
  created_at: string;
  amount_paid?: number;
  status?: string;
}

interface ClientLite { id: string; full_name: string }

export default function PaymentsReceived() {
  const navigate = useNavigate();
  const { format: formatCurrency } = useOrganizationCurrency();
  const { organization } = useOrganization();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payments, setPayments] = useState<InvoicePayment[]>([]);
  const [invoicesById, setInvoicesById] = useState<Record<string, InvoiceLite>>({});
  const [clientsById, setClientsById] = useState<Record<string, ClientLite>>({});
  const [searchReceived, setSearchReceived] = useState("");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Edit payment dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<InvoicePayment | null>(null);
  const [editForm, setEditForm] = useState({ amount: "", method: "cash", reference_number: "", payment_date: "" });

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Get payments and invoices data
      const [paymentsData, { data: invoicesData }] = await Promise.all([
        getAllInvoicePaymentsWithFallback(supabase),
        supabase.from('invoices').select('id, invoice_number, client_id, total_amount, created_at, status')
      ]);
      
      setPayments(paymentsData as any);
      
      const byId: Record<string, InvoiceLite> = {};
      (invoicesData || []).forEach(r => { byId[r.id] = r as any; });
      setInvoicesById(byId);

      // Get clients
      const clientIds = Array.from(new Set((invoicesData || []).map(r => r.client_id).filter(Boolean)));
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
      } else {
        setClientsById({});
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load payments received');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const refresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const openEdit = (p: InvoicePayment) => {
    setEditing(p);
    setEditForm({
      amount: String(p.amount ?? ''),
      method: p.method || 'cash',
      reference_number: p.reference_number || '',
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
        reference_number: editForm.reference_number || null,
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
        client_id: (invoice as any).customer_id,
        customer_name: (invoice as any).customer_name || '',
        customer_email: (invoice as any).customer_email || null,
        customer_phone: (invoice as any).customer_phone || null,
        total_amount: invoice.total_amount,
        issue_date: invoice.created_at,
        status: (invoice as any).status || 'sent'
      }, format);
      toast.success(`Invoice downloaded (${format})`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to download invoice');
    }
  };

  const filteredReceived = useMemo(() => {
    const s = searchReceived.toLowerCase();
    return payments.filter(p => {
      const r = invoicesById[p.invoice_id];
      const clientName = r?.customer_id ? (clientsById[r.customer_id]?.full_name || '') : '';
      const matchesQuery = (
        (r?.invoice_number || '').toLowerCase().includes(s) ||
        clientName.toLowerCase().includes(s) ||
        (p.method || '').toLowerCase().includes(s) ||
        (p.reference_number || '').toLowerCase().includes(s)
      );

      const matchesMethod = methodFilter === 'all' ? true : (p.method || '').toLowerCase() === methodFilter.toLowerCase();

      return matchesQuery && matchesMethod;
    });
  }, [payments, invoicesById, clientsById, searchReceived, methodFilter]);

  const totalsReceived = useMemo(() => {
    const total = filteredReceived.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const count = filteredReceived.length;
    const avg = count ? total / count : 0;
    return { total, count, avg };
  }, [filteredReceived]);

  const totalPages = Math.max(1, Math.ceil(filteredReceived.length / pageSize));
  const paginatedReceived = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredReceived.slice(start, start + pageSize);
  }, [filteredReceived, page, pageSize]);

  if (loading) {
    return (
      <div className="flex-1 p-6 bg-slate-50/30 min-h-screen">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/4"></div>
          <div className="h-64 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-6 bg-slate-50/30 min-h-screen">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl shadow-lg">
            <DollarSign className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Payments Received</h1>
            <p className="text-slate-600">Track incoming payments from invoices</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={refresh} 
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            onClick={() => navigate('/payments/received/new')}
            className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 gap-2"
          >
            <DollarSign className="w-4 h-4" />
            Record Payment
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Received</p>
                <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalsReceived.total)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-emerald-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Payment Count</p>
                <p className="text-2xl font-bold text-slate-900">{totalsReceived.count}</p>
              </div>
              <CalendarRange className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Average Payment</p>
                <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalsReceived.avg)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-violet-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Search & Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Search payments..."
                  value={searchReceived}
                  onChange={(e) => setSearchReceived(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Payment method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="bank">Bank Transfer</SelectItem>
                <SelectItem value="mpesa">M-Pesa</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Payments Received Section (from Payments page) */}
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
                  const clientName = invoice?.customer_id ? (clientsById[invoice.customer_id]?.full_name || '—') : '—';
                  
                  return (
                    <TableRow key={payment.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">{invoice?.invoice_number || '—'}</TableCell>
                      <TableCell>{clientName}</TableCell>
                      <TableCell>{format(new Date(payment.payment_date), 'MMM dd, yyyy')}</TableCell>
                      <TableCell>{formatCurrency(Number(payment.amount || 0))}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize">
                          {payment.method || 'cash'}
                        </span>
                      </TableCell>
                      <TableCell>{payment.reference_number || '—'}</TableCell>
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

      {/* Edit Payment Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Payment</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitEdit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-amount">Amount</Label>
                <Input
                  id="edit-amount"
                  type="number"
                  step="0.01"
                  value={editForm.amount}
                  onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-method">Payment Method</Label>
                <Select value={editForm.method} onValueChange={(value) => setEditForm({ ...editForm, method: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="bank">Bank Transfer</SelectItem>
                    <SelectItem value="mpesa">M-Pesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="edit-reference">Reference Number</Label>
              <Input
                id="edit-reference"
                value={editForm.reference_number}
                onChange={(e) => setEditForm({ ...editForm, reference_number: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-date">Payment Date</Label>
              <Input
                id="edit-date"
                type="date"
                value={editForm.payment_date}
                onChange={(e) => setEditForm({ ...editForm, payment_date: e.target.value })}
                required
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}