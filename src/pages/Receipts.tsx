import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { getReceiptsWithFallback } from "@/utils/mockDatabase";
import { useOrganizationCurrency } from "@/lib/saas/hooks";
import { Switch } from "@/components/ui/switch";
import { useNavigate } from "react-router-dom";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Eye, Mail, MessageSquare, MoreHorizontal, Trash2, Printer } from "lucide-react";

interface Receipt {
  id: string;
  receipt_number: string;
  customer_id: string | null;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  amount_paid: number;
  status: string;
  notes: string | null;
  created_at: string;
}

export default function Receipts() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const { format: formatMoney } = useOrganizationCurrency();
  const [customers, setCustomers] = useState<{ id: string; full_name: string }[]>([]);
  const [customerId, setCustomerId] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [selected, setSelected] = useState<Receipt | null>(null);
  const [payment, setPayment] = useState({ amount: "", method: "cash", reference: "" });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reportApplyTax, setReportApplyTax] = useState<boolean>(false);
  const navigate = useNavigate();

  // Create Receipt modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [jobcards, setJobcards] = useState<any[]>([]);
  const [selectedJobcardId, setSelectedJobcardId] = useState<string>("");
  const [jobcardDetails, setJobcardDetails] = useState<any | null>(null);
  const [jobcardItems, setJobcardItems] = useState<any[]>([]);
  const [existingReceiptForJob, setExistingReceiptForJob] = useState<any | null>(null);
  const [bookingNumber, setBookingNumber] = useState<string | null>(null);
  const [createPayment, setCreatePayment] = useState<{ enabled: boolean; amount: string; method: string; reference: string }>({ enabled: false, amount: "", method: "cash", reference: "" });

  const fetchReceipts = async () => {
    try {
      setLoading(true);
      const data = await getReceiptsWithFallback(supabase);
      setReceipts((data as any[]) as Receipt[]);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load receipts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
    (async () => {
      try {
        const { data } = await supabase.from('clients').select('id, full_name').order('full_name');
        setCustomers(data || []);
      } catch {
        setCustomers([]);
      }
    })();
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    await fetchReceipts();
    setRefreshing(false);
  };

  const handlePrintReceipt = (receipt: Receipt) => {
    // Open detail page in print mode in a new tab
    window.open(`/receipts/${receipt.id}?print=1`, "_blank");
  };

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return receipts
      .filter(r => (status === 'all' ? true : r.status === status))
      .filter(r => (customerId === 'all' ? true : r.customer_id === customerId))
      .filter(r => {
        if (!dateFrom && !dateTo) return true;
        const d = new Date(r.created_at).toISOString().slice(0, 10);
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
        return true;
      })
      .filter(r => r.receipt_number.toLowerCase().includes(s) || (r.notes || '').toLowerCase().includes(s));
  }, [receipts, search, status, customerId, dateFrom, dateTo]);

  const outstanding = (r: Receipt) => Math.max(0, (r.total_amount || 0) - (r.amount_paid || 0));
  const totals = useMemo(() => {
    const total = filtered.reduce((sum, r) => sum + (r.total_amount || 0), 0);
    const paid = filtered.reduce((sum, r) => sum + (r.amount_paid || 0), 0);
    const due = total - paid;
    // Optional tax inclusion for reporting: if enabled, add up all receipt subtotals*rate differences.
    // Here, as receipts already include tax in total_amount, toggling tax is treated as a display feature: when off, show subtotal-like by subtracting tax_amount.
    const totalWithoutTax = filtered.reduce((sum, r) => sum + ((r.total_amount || 0) - (r.tax_amount || 0)), 0);
    return reportApplyTax ? { total, paid, due } : { total: totalWithoutTax, paid, due: Math.max(0, totalWithoutTax - paid) };
  }, [filtered, reportApplyTax]);

  const exportCsv = () => {
    const headers = [
      'Receipt Number',
      'Date',
      'Status',
      'Subtotal',
      'Tax',
      'Discount',
      'Total',
      'Amount Paid',
      'Outstanding',
    ];
    const rows = filtered.map(r => [
      r.receipt_number,
      new Date(r.created_at).toISOString(),
      r.status,
      (r.subtotal || 0).toFixed(2),
      (r.tax_amount || 0).toFixed(2),
      (r.discount_amount || 0).toFixed(2),
      (r.total_amount || 0).toFixed(2),
      (r.amount_paid || 0).toFixed(2),
      outstanding(r).toFixed(2),
    ]);
    const csv = [headers, ...rows].map(cols => cols.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipts_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportSelectedCsv = () => {
    const selected = filtered.filter(r => selectedIds.has(r.id));
    if (selected.length === 0) {
      toast.error('No receipts selected');
      return;
    }
    const headers = ['Receipt Number','Date','Status','Total','Paid','Outstanding'];
    const rows = selected.map(r => [
      r.receipt_number,
      new Date(r.created_at).toISOString(),
      r.status,
      (r.total_amount || 0).toFixed(2),
      (r.amount_paid || 0).toFixed(2),
      outstanding(r).toFixed(2),
    ]);
    const csv = [headers, ...rows].map(cols => cols.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipts_selected_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const openPayment = (r: Receipt) => {
    setSelected(r);
    setPayment({ amount: String(outstanding(r)), method: 'cash', reference: '' });
    setIsPayOpen(true);
  };

  const recordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    const amt = parseFloat(payment.amount) || 0;
    if (amt <= 0 || amt > outstanding(selected)) {
      toast.error('Invalid amount');
      return;
    }
    try {
      const { recordReceiptPaymentWithFallback } = await import('@/utils/mockDatabase');
      const ok = await recordReceiptPaymentWithFallback(supabase, {
        receipt_id: selected.id,
        amount: amt,
        method: payment.method,
        reference_number: payment.reference || null,
      });
      if (!ok) throw new Error('Failed to record payment');
      toast.success('Payment recorded');
      setIsPayOpen(false);
      setSelected(null);
      fetchReceipts();
    } catch (e) {
      console.error(e);
      toast.error('Failed to record payment');
    }
  };

  const handleDeleteReceipt = async (receipt: Receipt) => {
    const payments = Number(receipt.amount_paid || 0);
    if (payments > 0) {
      toast.error('Cannot delete a receipt with recorded payments');
      return;
    }
    if (!confirm(`Delete receipt ${receipt.receipt_number}? This cannot be undone.`)) return;
    try {
      const { deleteReceiptWithFallback } = await import('@/utils/mockDatabase');
      await deleteReceiptWithFallback(supabase, receipt.id);
      toast.success('Receipt deleted');
      fetchReceipts();
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete receipt');
    }
  };

  const handleSendReceipt = (receipt: Receipt) => {
    toast.success('Send receipt flow started');
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) setSelectedIds(new Set(filtered.map(r => r.id)));
    else setSelectedIds(new Set());
  };

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };

  // Fetch eligible job cards (completed and not fully paid)
  const openCreate = async () => {
    setIsCreateOpen(true);
    setSelectedJobcardId("");
    setJobcardDetails(null);
    setJobcardItems([]);
    setExistingReceiptForJob(null);
    setBookingNumber(null);
    setCreatePayment({ enabled: false, amount: "", method: "cash", reference: "" });
    try {
      const { data: cards } = await supabase
        .from('job_cards')
        .select('id, job_number, status, total_amount, client_id, start_time')
        .eq('status', 'completed')
        .order('created_at', { ascending: false });
      const jobIds = (cards || []).map(c => c.id);
      const rcptByJob: Record<string, any[]> = {};
      if (jobIds.length > 0) {
        const { data: rcpts } = await supabase
          .from('receipts')
          .select('id, job_card_id, status, total_amount, amount_paid')
          .in('job_card_id', jobIds);
        (rcpts || []).forEach(r => {
          rcptByJob[r.job_card_id] = rcptByJob[r.job_card_id] || [];
          rcptByJob[r.job_card_id].push(r);
        });
      }
      const eligible = (cards || []).filter(c => {
        const rcpts = rcptByJob[c.id] || [];
        // Include if no receipt exists or receipt exists but not paid
        if (rcpts.length === 0) return true;
        return rcpts.some(r => (r.status !== 'paid') && (Number(r.amount_paid || 0) < Number(r.total_amount || 0)));
      });
      // Attach display name
      const clientIds = Array.from(new Set(eligible.map(c => c.client_id).filter(Boolean)));
      const clientsById: Record<string, any> = {};
      if (clientIds.length) {
        const { data: clients } = await supabase.from('clients').select('id, full_name').in('id', clientIds as string[]);
        (clients || []).forEach(c => { clientsById[c.id] = c; });
      }
      setJobcards(eligible.map(c => ({ ...c, client_name: c.client_id ? (clientsById[c.client_id]?.full_name || '') : '' })));
    } catch (e) {
      console.error('Failed to load job cards', e);
      setJobcards([]);
    }
  };

  const onSelectJobcard = async (jobcardId: string) => {
    setSelectedJobcardId(jobcardId);
    setJobcardDetails(null);
    setJobcardItems([]);
    setExistingReceiptForJob(null);
    setBookingNumber(null);
    setCreatePayment({ enabled: false, amount: "", method: "cash", reference: "" });
    if (!jobcardId) return;
    try {
      const { data: jc } = await supabase
        .from('job_cards')
        .select('id, job_number, status, total_amount, client_id, staff_id, start_time')
        .eq('id', jobcardId)
        .maybeSingle();
      setJobcardDetails(jc);

      const [{ data: items }, { data: client }, { data: rcpt } ] = await Promise.all([
        supabase.from('job_card_services').select('service_id, staff_id, quantity, unit_price, services:service_id(name)').eq('job_card_id', jobcardId),
        jc?.client_id ? supabase.from('clients').select('id, full_name').eq('id', jc.client_id).maybeSingle() : Promise.resolve({ data: null } as any),
        supabase.from('receipts').select('id, status, total_amount, amount_paid').eq('job_card_id', jobcardId)
      ] as any);

      const mappedItems = (items || []).map((it: any) => ({
        service_id: it.service_id,
        product_id: null,
        description: it.services?.name || 'Service',
        quantity: it.quantity || 1,
        unit_price: it.unit_price || 0,
        total_price: (it.quantity || 1) * (it.unit_price || 0),
        staff_id: it.staff_id || null,
      }));
      setJobcardItems(mappedItems);

      if (rcpt && rcpt.length > 0) {
        // Prefer the most recent open/partial
        const open = rcpt.find((r: any) => r.status !== 'paid');
        setExistingReceiptForJob(open || rcpt[0]);
        if (open) {
          const outstandingAmt = Math.max(0, Number(open.total_amount || 0) - Number(open.amount_paid || 0));
          setCreatePayment({ enabled: true, amount: String(outstandingAmt), method: 'cash', reference: '' });
        }
      } else {
        // Set default payment amount to total
        const total = Number(jc?.total_amount || 0);
        setCreatePayment({ enabled: false, amount: String(total), method: 'cash', reference: '' });
      }

      // Try to find a booking number (appointment) for same client and date
      if (jc?.client_id && jc?.start_time) {
        const apptDate = new Date(jc.start_time).toISOString().slice(0,10);
        const { data: appts } = await supabase
          .from('appointments')
          .select('id')
          .eq('client_id', jc.client_id)
          .eq('appointment_date', apptDate)
          .limit(1);
        if (appts && appts.length > 0) setBookingNumber(appts[0].id);
      }
    } catch (e) {
      console.error('Failed to load jobcard details', e);
    }
  };

  const handleCreateReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJobcardId || !jobcardDetails) return;
    try {
      let receiptId = existingReceiptForJob?.id as string | undefined;
      if (!receiptId) {
        const receiptNumber = `RCT-${Date.now().toString().slice(-6)}`;
        const payload = {
          receipt_number: receiptNumber,
          customer_id: jobcardDetails.client_id || null,
          job_card_id: jobcardDetails.id,
          subtotal: jobcardItems.reduce((s, it) => s + (it.total_price || 0), 0),
          tax_amount: 0,
          discount_amount: 0,
          total_amount: Number(jobcardDetails.total_amount || 0),
          status: 'open',
          notes: `Receipt for ${jobcardDetails.job_number}`,
        };
        const created = await (await import('@/utils/mockDatabase')).createReceiptWithFallback(supabase, payload, jobcardItems);
        receiptId = (created as any)?.id;
      }

      // Optional payment
      if (receiptId && createPayment.enabled) {
        const amt = parseFloat(createPayment.amount) || 0;
        if (amt > 0) {
          const { recordReceiptPaymentWithFallback } = await import('@/utils/mockDatabase');
          const ok = await recordReceiptPaymentWithFallback(supabase, {
            receipt_id: receiptId,
            amount: amt,
            method: createPayment.method,
            reference_number: createPayment.reference || null,
          });
          if (!ok) throw new Error('Failed to record payment');
        }
      }

      toast.success(existingReceiptForJob ? 'Payment recorded' : 'Receipt created');
      setIsCreateOpen(false);
      await fetchReceipts();
    } catch (e: any) {
      console.error('Failed to create receipt', e);
      toast.error(e?.message || 'Failed to create receipt');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="mt-2 text-muted-foreground">Loading receipts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h2 className="text-2xl font-bold">Receipts</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <select className="border rounded px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All</option>
            <option value="open">Open</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select className="border rounded px-3 py-2" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="all">All Customers</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-auto" />
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-auto" />
          <Input placeholder="Search receipts..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full md:max-w-xs" />
          <Button variant="outline" onClick={exportCsv}>
            Export CSV
          </Button>
          <Button variant="outline" onClick={exportSelectedCsv}>
            Export Selected
          </Button>
          <Button variant="outline" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={openCreate}>Create Receipt</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center justify-between">Total
            <span className="flex items-center gap-2 text-xs font-normal">
              <Switch checked={reportApplyTax} onCheckedChange={setReportApplyTax} /> Include Tax
            </span>
          </CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">${totals.total.toFixed(2)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Paid</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">${totals.paid.toFixed(2)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Outstanding</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">${totals.due.toFixed(2)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Receipts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <input type="checkbox" onChange={(e) => toggleSelectAll(e.currentTarget.checked)} checked={selectedIds.size === filtered.length && filtered.length > 0} />
                  </TableHead>
                  <TableHead>#</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Outstanding</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <input type="checkbox" checked={selectedIds.has(r.id)} onChange={(e) => toggleSelect(r.id, e.currentTarget.checked)} />
                    </TableCell>
                    <TableCell className="font-medium">{r.receipt_number}</TableCell>
                    <TableCell>{format(new Date(r.created_at), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === 'paid' ? 'default' : r.status === 'partial' ? 'outline' : 'secondary'}>
                        {r.status.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>${(r.total_amount || 0).toFixed(2)}</TableCell>
                    <TableCell>${(r.amount_paid || 0).toFixed(2)}</TableCell>
                    <TableCell>${outstanding(r).toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-2 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/receipts/${r.id}`)}
                        >
                          <Eye className="w-4 h-4 mr-2" /> View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePrintReceipt(r)}
                        >
                          <Printer className="w-4 h-4 mr-2" /> Print
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSendReceipt(r)}
                        >
                          <Mail className="w-4 h-4 mr-2" /> Send
                        </Button>
                        {outstanding(r) > 0 && (
                          <Button size="sm" onClick={() => openPayment(r)}>
                            <DollarSign className="w-4 h-4 mr-1" /> Pay
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => handleSendReceipt(r)}>
                              <Mail className="w-4 h-4 mr-2" />
                              Send Email
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleSendReceipt(r)}>
                              <MessageSquare className="w-4 h-4 mr-2" />
                              Send WhatsApp
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDeleteReceipt(r)}
                              disabled={(r.amount_paid || 0) > 0}
                              className={(r.amount_paid || 0) > 0 ? 'opacity-50' : 'text-red-600 focus:text-red-600'}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filtered.map(r => (
              <div key={r.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{r.receipt_number}</div>
                    <div className="text-sm text-muted-foreground">{format(new Date(r.created_at), 'MMM dd, yyyy')}</div>
                  </div>
                  <Badge variant={r.status === 'paid' ? 'default' : r.status === 'partial' ? 'outline' : 'secondary'}>
                    {r.status.toUpperCase()}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="text-muted-foreground">Total</div>
                    <div className="font-medium">${(r.total_amount || 0).toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Paid</div>
                    <div className="font-medium">${(r.amount_paid || 0).toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Outstanding</div>
                    <div className="font-medium">${outstanding(r).toFixed(2)}</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => navigate(`/receipts/${r.id}`)}>
                    <Eye className="w-4 h-4 mr-2" /> View
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handlePrintReceipt(r)}>
                    <Printer className="w-4 h-4 mr-2" /> Print
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleSendReceipt(r)}>
                    <Mail className="w-4 h-4 mr-2" /> Send
                  </Button>
                  {outstanding(r) > 0 && (
                    <Button size="sm" onClick={() => openPayment(r)}>
                      <DollarSign className="w-4 h-4 mr-1" /> Pay
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isPayOpen} onOpenChange={setIsPayOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <form onSubmit={recordPayment} className="space-y-4">
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input type="number" step="0.01" value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Method</Label>
              <select className="border rounded px-3 py-2 w-full" value={payment.method} onChange={(e) => setPayment({ ...payment, method: e.target.value })}>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="mpesa">M-Pesa</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Reference (optional)</Label>
              <Input value={payment.reference} onChange={(e) => setPayment({ ...payment, reference: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsPayOpen(false)}>Cancel</Button>
              <Button type="submit">Record</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Create Receipt</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateReceipt} className="space-y-6">
            <div className="space-y-2">
              <Label>Job Card</Label>
              <select className="border rounded px-3 py-2 w-full" value={selectedJobcardId} onChange={(e) => onSelectJobcard(e.target.value)}>
                <option value="">Select a completed, unpaid job card</option>
                {jobcards.map(j => (
                  <option key={j.id} value={j.id}>{j.job_number} — {j.client_name || 'No client'} — ${Number(j.total_amount||0).toFixed(2)}</option>
                ))}
              </select>
              {existingReceiptForJob && (
                <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mt-2">
                  An existing receipt is linked to this job. You can record a payment below.
                </div>
              )}
            </div>

            {jobcardDetails && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div>
                    <Label>Booking Number (if applicable)</Label>
                    <div className="text-sm text-muted-foreground">{bookingNumber || '—'}</div>
                  </div>
                  <div>
                    <Label>Customer</Label>
                    <div className="text-sm">{jobcards.find(j => j.id === jobcardDetails.id)?.client_name || '—'}</div>
                  </div>
                  <div>
                    <Label>Job Card</Label>
                    <div className="text-sm">{jobcardDetails.job_number}</div>
                  </div>
                  <div>
                    <Label>Total Amount</Label>
                    <div className="text-sm">${Number(jobcardDetails.total_amount || 0).toFixed(2)}</div>
                  </div>
                </div>
                <div>
                  <Label>Services</Label>
                  {jobcardItems.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No services found for this job card.</div>
                  ) : (
                    <div className="border rounded">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Description</TableHead>
                            <TableHead>Qty</TableHead>
                            <TableHead>Unit</TableHead>
                            <TableHead>Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {jobcardItems.map((it, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{it.description}</TableCell>
                              <TableCell>{it.quantity}</TableCell>
                              <TableCell>${Number(it.unit_price).toFixed(2)}</TableCell>
                              <TableCell>${Number(it.total_price).toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input id="record-pay" type="checkbox" checked={createPayment.enabled} onChange={(e) => setCreatePayment(prev => ({ ...prev, enabled: e.target.checked }))} />
                <Label htmlFor="record-pay">Record payment now</Label>
              </div>
              {createPayment.enabled && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Amount</Label>
                    <Input type="number" step="0.01" value={createPayment.amount} onChange={(e) => setCreatePayment(prev => ({ ...prev, amount: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Method</Label>
                    <select className="border rounded px-3 py-2 w-full" value={createPayment.method} onChange={(e) => setCreatePayment(prev => ({ ...prev, method: e.target.value }))}>
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="mpesa">M-Pesa</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Reference (optional)</Label>
                    <Input value={createPayment.reference} onChange={(e) => setCreatePayment(prev => ({ ...prev, reference: e.target.value }))} />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button type="submit">{existingReceiptForJob ? 'Record Payment' : 'Create Receipt'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}