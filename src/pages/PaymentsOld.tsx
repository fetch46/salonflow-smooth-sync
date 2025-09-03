import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Calendar } from "@/components/ui/calendar";
import { CalendarRange, Download, Edit, Filter, List, MoreVertical, ReceiptText, RefreshCw, Search, Trash2, Bookmark, BookmarkPlus, Banknote } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { getInvoicesWithBalanceWithFallback, getAllInvoicePaymentsWithFallback, updateInvoicePaymentWithFallback, deleteInvoicePaymentWithFallback } from "@/utils/mockDatabase";
import { useNavigate } from "react-router-dom";
import type { DateRange } from "react-day-picker";
import { DollarSign } from "lucide-react";
import { downloadInvoicePDF } from "@/utils/invoicePdf";
import { useOrganizationCurrency, useOrganization } from "@/lib/saas/hooks";
import { deleteTransactionsByReference } from "@/utils/ledger";
import { recordInvoicePaymentWithFallback } from "@/utils/mockDatabase";

interface InvoicePayment {
  id: string;
  invoice_id: string;
  amount: number;
  method: string;
  reference_number: string | null;
  payment_date: string; // yyyy-mm-dd
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

interface ClientLite { id: string; full_name: string }

interface ExpenseLite {
  id: string;
  expense_number: string;
  vendor_name: string;
  amount: number;
  expense_date: string;
  payment_method: string | null;
  status: string;
  receipt_url: string | null;
}

interface PurchaseLite {
  id: string;
  purchase_number: string;
  vendor_name: string;
  total_amount: number;
  purchase_date: string;
  created_at?: string;
  status: string;
}

export default function PaymentsOld() {
  const navigate = useNavigate();
  const { format: formatCurrency } = useOrganizationCurrency();
  const { organization } = useOrganization();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Received
  const [payments, setPayments] = useState<InvoicePayment[]>([]);
  const [invoicesById, setInvoicesById] = useState<Record<string, InvoiceLite>>({});
  const [clientsById, setClientsById] = useState<Record<string, ClientLite>>({});
  const [invoiceItems, setInvoiceItems] = useState<any[]>([]);
  const [searchReceived, setSearchReceived] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [compact, setCompact] = useState<boolean>(false);
  type FilterPreset = { id: string; name: string; search: string; method: string; from?: string; to?: string; pageSize: number };
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [savePresetOpen, setSavePresetOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");

  // Made
  const [expenses, setExpenses] = useState<ExpenseLite[]>([]);
  const [purchases, setPurchases] = useState<PurchaseLite[]>([]);
  const [searchMade, setSearchMade] = useState("");

  // Edit payment dialog (received)
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<InvoicePayment | null>(null);
  const [editForm, setEditForm] = useState({ amount: "", method: "cash", reference_number: "", payment_date: "" });

  // Full-page form lives at /payments/received/new; modal state removed
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");
  const [invoiceOptions, setInvoiceOptions] = useState<Array<{ id: string; invoice_number: string; total_amount: number; amount_paid?: number }>>([]);
  const [createStatus, setCreateStatus] = useState<string>("unpaid");
  const [createForm, setCreateForm] = useState<{ amount: string; method: string; reference: string; payment_date: string; account_id: string }>({ amount: "", method: "cash", reference: "", payment_date: new Date().toISOString().slice(0,10), account_id: "" });
  const [assetAccounts, setAssetAccounts] = useState<Array<{ id: string; account_code: string; account_name: string; account_subtype?: string | null }>>([]);

  // Auto-open create dialog when navigated with invoiceId
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invoiceId = params.get('invoiceId');
    const action = params.get('action');
    if (invoiceId) {
      setCreateOpen(true);
      setSelectedInvoiceId(invoiceId);
      // Ensure default form values are reset
      setCreateStatus("unpaid");
      setCreateForm({ amount: "", method: "cash", reference: "", payment_date: new Date().toISOString().slice(0,10), account_id: "" });
      // Remove params from URL to prevent re-trigger on state changes
      const url = new URL(window.location.href);
      url.searchParams.delete('invoiceId');
      url.searchParams.delete('action');
      window.history.replaceState({}, '', url.toString());
    } else if (action === 'record') {
      setCreateOpen(true);
    }
  }, []);

  // When options load and an invoice is preselected, auto-fill amount
  useEffect(() => {
    if (createOpen && selectedInvoiceId && invoiceOptions.length) {
      const r = invoiceOptions.find(x => x.id === selectedInvoiceId);
      if (r) {
        const outstanding = Math.max(0, Number(r.total_amount || 0) - Number(r.amount_paid || 0));
        setCreateForm(prev => ({ ...prev, amount: String(outstanding > 0 ? outstanding.toFixed(2) : "") }));
      }
    }
  }, [createOpen, selectedInvoiceId, invoiceOptions]);

  // If dialog opened (e.g. via URL) and options not loaded yet, fetch them
  useEffect(() => {
    (async () => {
      if (createOpen && invoiceOptions.length === 0) {
        try {
          const invs = (await getInvoicesWithBalanceWithFallback(supabase)) as any[];
          setInvoiceOptions(invs as any);
        } catch {
          setInvoiceOptions([]);
        }
        try {
          if (organization?.id) {
            let data: any[] | null = null;
            let error: any = null;
            try {
              const res = await supabase
                .from("accounts")
                .select("id, account_code, account_name, account_type, account_subtype")
                .eq("organization_id", organization.id)
                .eq("account_type", "Asset")
                .order("account_code", { ascending: true });
              data = res.data as any[] | null;
              error = res.error;
            } catch (err: any) {
              error = err;
            }
            if (error) {
              const res = await supabase
                .from("accounts")
                .select("id, account_code, account_name, account_type")
                .eq("organization_id", organization.id)
                .order("account_code", { ascending: true });
              data = res.data as any[] | null;
            }
            const filtered = (data || []).filter((a: any) => (a.account_type === "Asset") && (!a.account_subtype || ["Cash","Bank"].includes(a.account_subtype)));
            setAssetAccounts(filtered.map((a: any) => ({ id: a.id, account_code: a.account_code, account_name: a.account_name, account_subtype: (a as any).account_subtype || null })));
          } else {
            setAssetAccounts([]);
          }
        } catch {
          setAssetAccounts([]);
        }
      }
    })();
  }, [createOpen]);

  const loadData = async () => {
    try {
      setLoading(true);
      // Payments received
      const [pays, invs] = await Promise.all([
        getAllInvoicePaymentsWithFallback(supabase),
        getInvoicesWithBalanceWithFallback(supabase),
      ]);
      setPayments(pays as any);
      const byId: Record<string, InvoiceLite> = {};
      (invs as any[]).forEach(r => { byId[r.id] = r; });
      setInvoicesById(byId);

      // Clients used in those receipts
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
      } else {
        setClientsById({});
      }

      // Payments made: expenses and purchases  
      const [{ data: expData }, { data: purData }, { data: itemsData }] = await Promise.all([
        supabase.from('expenses').select('id, expense_number, vendor_name, amount, expense_date, payment_method, status, receipt_url').order('created_at', { ascending: false }),
        supabase.from('purchases').select('id, purchase_number, vendor_name, total_amount, purchase_date, status').order('created_at', { ascending: false }),
        supabase.from('invoice_items').select('*').order('created_at', { ascending: false }),
      ]);
      setExpenses((expData || []) as any);
      setPurchases((purData || []) as any);
      setInvoiceItems((itemsData || []) as any);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => {
    try {
      const raw = localStorage.getItem('payments_filter_presets_v1');
      if (raw) setPresets(JSON.parse(raw));
      const savedCompact = localStorage.getItem('payments_density_compact');
      if (savedCompact) setCompact(savedCompact === '1');
    } catch {}
    (async () => {
      try {
        const { data } = await supabase
          .from('business_locations')
          .select('id, name')
          .eq('organization_id', organization?.id || '')
          .order('name');
        setLocations((data || []) as any);
      } catch {
        setLocations([]);
      }
    })();
  }, [organization?.id]);

  useEffect(() => {
    localStorage.setItem('payments_density_compact', compact ? '1' : '0');
  }, [compact]);

  const persistPresets = (next: FilterPreset[]) => {
    setPresets(next);
    try { localStorage.setItem('payments_filter_presets_v1', JSON.stringify(next)); } catch {}
  };

  const saveCurrentAsPreset = () => {
    if (!newPresetName.trim()) { toast.error('Enter a preset name'); return; }
    const next: FilterPreset = {
      id: `${Date.now()}`,
      name: newPresetName.trim(),
      search: searchReceived,
      method: methodFilter,
      from: dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined,
      to: dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined,
      pageSize,
    };
    const updated = [next, ...presets].slice(0, 20);
    persistPresets(updated);
    setNewPresetName("");
    setSavePresetOpen(false);
    toast.success('Preset saved');
  };

  const applyPreset = (p: FilterPreset) => {
    setSearchReceived(p.search || "");
    setMethodFilter(p.method || 'all');
    if (p.from || p.to) {
      setDateRange({
        from: p.from ? new Date(`${p.from}T00:00:00`) : undefined,
        to: p.to ? new Date(`${p.to}T00:00:00`) : undefined,
      });
    } else {
      setDateRange(undefined);
    }
    if (p.pageSize) setPageSize(p.pageSize);
    setPage(1);
    toast.success(`Applied preset: ${p.name}`);
  };

  const deletePreset = (id: string) => {
    const updated = presets.filter(p => p.id !== id);
    persistPresets(updated);
    toast.success('Preset deleted');
  };

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

      const paymentDate = new Date(p.payment_date || r?.created_at || new Date());
      const inDateRange = dateRange?.from && dateRange?.to
        ? paymentDate >= new Date(dateRange.from.setHours(0,0,0,0)) && paymentDate <= new Date(dateRange.to.setHours(23,59,59,999))
        : true;

      const matchesMethod = methodFilter === 'all' ? true : (p.method || '').toLowerCase() === methodFilter.toLowerCase();
      const matchesLocation = locationFilter === 'all' ? true : ((r as any)?.location_id === locationFilter);

      return matchesQuery && inDateRange && matchesMethod && matchesLocation;
    });
  }, [payments, invoicesById, clientsById, searchReceived, dateRange, methodFilter, locationFilter]);

  useEffect(() => { setPage(1); }, [searchReceived, dateRange, methodFilter]);

  const totalsReceived = useMemo(() => {
    const total = filteredReceived.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const count = filteredReceived.length;
    const avg = count ? total / count : 0;
    return { total, count, avg };
  }, [filteredReceived]);

  const filteredExpenses = useMemo(() => {
    const s = searchMade.toLowerCase();
    return expenses.filter(e => (
      (e.expense_number || '').toLowerCase().includes(s) ||
      (e.vendor_name || '').toLowerCase().includes(s) ||
      (e.payment_method || '').toLowerCase().includes(s)
    ));
  }, [expenses, searchMade]);

  const filteredPurchases = useMemo(() => {
    const s = searchMade.toLowerCase();
    return purchases.filter(p => (
      (p.purchase_number || '').toLowerCase().includes(s) ||
      (p.vendor_name || '').toLowerCase().includes(s) ||
      (p.status || '').toLowerCase().includes(s)
    ));
  }, [purchases, searchMade]);

  const totalPages = Math.max(1, Math.ceil(filteredReceived.length / pageSize));
  const paginatedReceived = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredReceived.slice(start, start + pageSize);
  }, [filteredReceived, page, pageSize]);

  const exportCsv = () => {
    try {
      const headers = ["Invoice #", "Client", "Location", "Payment Date", "Amount", "Method", "Reference"];
      const rows = filteredReceived.map(p => {
        const r = invoicesById[p.invoice_id];
        const clientName = r?.customer_id ? (clientsById[r.customer_id]?.full_name || '—') : '—';
        const locationName = (() => { const lid = (r as any)?.location_id; return lid ? (locations.find(l => l.id === lid)?.name || '—') : '—'; })();
        const dateStr = format(new Date(p.payment_date || r?.created_at || new Date()), 'yyyy-MM-dd');
        return [r?.invoice_number || '—', clientName, locationName, dateStr, String(Number(p.amount || 0).toFixed(2)), (p.method || '').toUpperCase(), p.reference_number || '—'];
      });
      const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `payments_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error('Failed to export CSV');
    }
  };


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
    <div className="flex-1 space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h2 className="text-2xl font-bold">Payments</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="default">
                Create
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => navigate('/payments/received/new')}>
                <DollarSign className="w-4 h-4 mr-2" /> Create Payment Received
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/expenses/new')}>
                <Banknote className="w-4 h-4 mr-2" /> Create Payments Made
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={exportCsv}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      <Tabs defaultValue="received" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:w-auto h-9 overflow-x-hidden">
          <TabsTrigger
            value="received"
            className="px-3 py-2 text-sm text-green-700 data-[state=active]:!bg-green-600 data-[state=active]:!text-white data-[state=active]:shadow-sm"
          >
            Payments Received
          </TabsTrigger>
          <TabsTrigger
            value="made"
            className="px-3 py-2 text-sm text-red-700 data-[state=active]:!bg-red-600 data-[state=active]:!text-white data-[state=active]:shadow-sm"
          >
            Payments Made
          </TabsTrigger>
        </TabsList>

        <TabsContent value="received" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Total Received</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold">{formatCurrency(totalsReceived.total)}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Payments Count</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold">{totalsReceived.count}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Average Amount</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold">{formatCurrency(totalsReceived.avg)}</CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Filters</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
                <div className="relative md:w-[340px] w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Search by invoice, client, method, reference..."
                    value={searchReceived}
                    onChange={(e) => setSearchReceived(e.target.value)}
                  />
                </div>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start w-full md:w-[260px]">
                      <CalendarRange className="mr-2 h-4 w-4" />
                      {dateRange?.from && dateRange?.to ? (
                        <span>{format(dateRange.from, 'MMM d, yyyy')} - {format(dateRange.to, 'MMM d, yyyy')}</span>
                      ) : (
                        <span>Select date range</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      initialFocus
                      defaultMonth={dateRange?.from}
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={2}
                    />
                    <div className="flex items-center justify-end gap-2 p-3 pt-0">
                      <Button variant="ghost" size="sm" onClick={() => setDateRange(undefined)}>Clear</Button>
                    </div>
                  </PopoverContent>
                </Popover>

                <div className="flex items-center gap-2 w-full md:w-auto">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select value={methodFilter} onValueChange={setMethodFilter}>
                    <SelectTrigger className="w-full md:w-[180px]">
                      <SelectValue placeholder="Method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Methods</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="mpesa">M-Pesa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full md:w-[220px]">
                  <Select value={locationFilter} onValueChange={setLocationFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Locations" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Locations</SelectItem>
                      {locations.map(l => (
                        <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button variant="ghost" onClick={() => { setSearchReceived(''); setDateRange(undefined); setMethodFilter('all'); }}>
                  Clear filters
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full md:w-auto">
                      <Bookmark className="h-4 w-4 mr-2" /> Presets
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64">
                    <DropdownMenuItem onClick={() => setSavePresetOpen(true)}>
                      <BookmarkPlus className="h-4 w-4 mr-2" /> Save current as preset
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {presets.length === 0 && (
                      <DropdownMenuLabel className="text-muted-foreground">No presets saved</DropdownMenuLabel>
                    )}
                    {presets.map(p => (
                      <DropdownMenuItem key={p.id} onClick={() => applyPreset(p)} className="flex items-center justify-between">
                        <span className="truncate">{p.name}</span>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); deletePreset(p.id); }}
                          aria-label={`Delete ${p.name}`}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button variant="outline" className="ml-auto" onClick={() => setCompact(c => !c)}>
                  <List className="h-4 w-4 mr-2" /> {compact ? 'Comfortable' : 'Compact'}
                </Button>

                <div className="ml-auto flex items-center gap-2">
                  <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                    <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 / page</SelectItem>
                      <SelectItem value="25">25 / page</SelectItem>
                      <SelectItem value="50">50 / page</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>All Payments Received</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table className={`w-full ${compact ? 'text-sm' : ''}`}>
                  <TableHeader className="sticky top-0 z-10 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                    <TableRow>
                      <TableHead className={compact ? 'py-2' : ''}>Invoice #</TableHead>
                      <TableHead className={compact ? 'py-2' : ''}>Client</TableHead>
                      <TableHead className={compact ? 'py-2' : ''}>Location</TableHead>
                      <TableHead className={compact ? 'py-2' : ''}>Payment Date</TableHead>
                      <TableHead className={compact ? 'py-2' : ''}>Amount</TableHead>
                      <TableHead className={compact ? 'py-2' : ''}>Method</TableHead>
                      <TableHead className={compact ? 'py-2' : ''}>Reference</TableHead>
                      <TableHead className={`text-right ${compact ? 'py-2' : ''}`}>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedReceived.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className={`text-center text-muted-foreground ${compact ? 'py-6' : 'h-24'}`}>
                          No payments found. Adjust filters or try a different search.
                        </TableCell>
                      </TableRow>
                    )}
                    {paginatedReceived.map((p) => {
                      const r = invoicesById[p.invoice_id];
                      const clientName = r?.customer_id ? (clientsById[r.customer_id]?.full_name || '—') : 'Walk-in';
                      return (
                        <TableRow key={p.id} className="hover:bg-muted/50">
                          <TableCell className={`font-medium ${compact ? 'py-2' : ''}`}>{r?.invoice_number || '—'}</TableCell>
                          <TableCell className={compact ? 'py-2' : ''}>{clientName}</TableCell>
                          <TableCell className={compact ? 'py-2' : ''}>{(() => { const lid = (r as any)?.location_id; return lid ? (locations.find(l => l.id === lid)?.name || '—') : '—'; })()}</TableCell>
                          <TableCell className={compact ? 'py-2' : ''}>{format(new Date(p.payment_date || r?.created_at || new Date()), 'MMM dd, yyyy')}</TableCell>
                          <TableCell className={compact ? 'py-2' : ''}>{formatCurrency(Number(p.amount || 0))}</TableCell>
                          <TableCell className={compact ? 'py-2' : ''}>{(p.method || '').toUpperCase()}</TableCell>
                          <TableCell className={compact ? 'py-2' : ''}>{p.reference_number || '—'}</TableCell>
                          <TableCell className={`text-right ${compact ? 'py-2' : ''}`}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem disabled>
                                  <ReceiptText className="mr-2 h-4 w-4" /> View Invoice
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openEdit(p)}>
                                  <Edit className="mr-2 h-4 w-4" /> Edit Payment
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-red-600" onClick={() => deletePayment(p)}>
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
              <div className="mt-4">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious onClick={() => setPage(p => Math.max(1, p - 1))} />
                    </PaginationItem>
                    <span className="px-2 text-sm text-muted-foreground">Page {page} of {totalPages}</span>
                    <PaginationItem>
                      <PaginationNext onClick={() => setPage(p => Math.min(totalPages, p + 1))} />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={savePresetOpen} onOpenChange={setSavePresetOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Save filter preset</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Preset name</Label>
              <Input value={newPresetName} onChange={(e) => setNewPresetName(e.target.value)} placeholder="e.g. Last 30 days - Card" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSavePresetOpen(false)}>Cancel</Button>
              <Button onClick={saveCurrentAsPreset}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Payment</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitEdit} className="space-y-4">
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input type="number" step="0.01" value={editForm.amount} onChange={(e) => setEditForm(prev => ({ ...prev, amount: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Method</Label>
              <select className="border rounded px-3 py-2 w-full" value={editForm.method} onChange={(e) => setEditForm(prev => ({ ...prev, method: e.target.value }))}>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="mpesa">M-Pesa</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Reference (optional)</Label>
              <Input value={editForm.reference_number} onChange={(e) => setEditForm(prev => ({ ...prev, reference_number: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Payment Date</Label>
              <Input type="date" value={editForm.payment_date} onChange={(e) => setEditForm(prev => ({ ...prev, payment_date: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Full-page form lives at /payments/received/new */}
    </div>
  );
}