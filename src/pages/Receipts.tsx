import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, DollarSign, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { format, startOfToday, endOfToday, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { toast } from "sonner";
import { getReceiptsWithFallback } from "@/utils/mockDatabase";
import { useOrganizationCurrency } from "@/lib/saas/hooks";
import { Switch } from "@/components/ui/switch";
import { useNavigate } from "react-router-dom";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Eye, Mail, MessageSquare, MoreHorizontal, Trash2, Printer } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { useSaas } from "@/lib/saas";
import { postReceiptPaymentToLedger, postReceiptPaymentWithAccount, postReceiptPaymentWithAccounts, postReceiptPaymentToLedgerWithIncomeAccount } from "@/utils/ledger";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

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
  const { organization } = useSaas();
  const [customers, setCustomers] = useState<{ id: string; full_name: string }[]>([]);
  const [customerId, setCustomerId] = useState<string>("all");
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [locationIdFilter, setLocationIdFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [selected, setSelected] = useState<Receipt | null>(null);
  const [payment, setPayment] = useState({ amount: "", method: "cash", reference: "" });
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [selectedAccountId, setSelectedAccountId] = useState<string>("")
  const [assetAccounts, setAssetAccounts] = useState<Array<{ id: string; account_code: string; account_name: string; account_subtype?: string | null }>>([]);
  const [incomeAccounts, setIncomeAccounts] = useState<Array<{ id: string; account_code: string; account_name: string }>>([]);
  const [selectedIncomeAccountId, setSelectedIncomeAccountId] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reportApplyTax, setReportApplyTax] = useState<boolean>(false);
  const navigate = useNavigate();
  const [compact, setCompact] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'number' | 'date' | 'customer' | 'status' | 'total' | 'paid' | 'balance'>("date");
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>("desc");

  // Load Cash/Bank asset accounts for deposit selection
  const loadAssetAccounts = useCallback(async () => {
    try {
      if (!organization?.id) { setAssetAccounts([]); return; }
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
    } catch {
      setAssetAccounts([]);
    }
  }, [organization?.id]);

  const loadIncomeAccounts = useCallback(async () => {
    try {
      if (!organization?.id) { setIncomeAccounts([]); return; }
      const res = await supabase
        .from("accounts")
        .select("id, account_code, account_name, account_type")
        .eq("organization_id", organization.id)
        .eq("account_type", "Income")
        .order("account_code", { ascending: true });
      const data = (res.data || []) as any[];
      setIncomeAccounts(data.map(a => ({ id: a.id, account_code: a.account_code, account_name: a.account_name })));
    } catch {
      setIncomeAccounts([]);
    }
  }, [organization?.id]);

  // Enhanced UI state
  const customersById = useMemo(() => {
    const map: Record<string, string> = {};
    customers.forEach(c => { map[c.id] = c.full_name; });
    return map;
  }, [customers]);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [quickDate, setQuickDate] = useState<string>("all_time");

  // Pre-status filtered results for status counts
  const preStatusFiltered = useMemo(() => {
    const s = search.toLowerCase();
    return receipts
      .filter(r => (customerId === 'all' ? true : r.customer_id === customerId))
      .filter(r => (locationIdFilter === 'all' ? true : (r as any).location_id === locationIdFilter))
      .filter(r => {
        if (!dateFrom && !dateTo) return true;
        const d = new Date(r.created_at).toISOString().slice(0, 10);
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
        return true;
      })
      .filter(r => r.receipt_number.toLowerCase().includes(s) || (r.notes || '').toLowerCase().includes(s));
  }, [receipts, search, customerId, dateFrom, dateTo, locationIdFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { open: 0, partial: 0, paid: 0, cancelled: 0 };
    for (const r of preStatusFiltered) { counts[r.status] = (counts[r.status] || 0) + 1; }
    return counts;
  }, [preStatusFiltered]);

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
      try {
        const { data: locs } = await supabase.from('business_locations').select('id, name').order('name');
        setLocations((locs || []) as any);
      } catch {
        setLocations([]);
      }
    })();
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    await fetchReceipts();
    setRefreshing(false);
  };

  const handlePrintReceipt = (receipt: Receipt) => {
    window.open(`/receipts/${receipt.id}?print=1`, "_blank");
  };

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return receipts
      .filter(r => (status === 'all' ? true : r.status === status))
      .filter(r => (customerId === 'all' ? true : r.customer_id === customerId))
      .filter(r => (locationIdFilter === 'all' ? true : (r as any).location_id === locationIdFilter))
      .filter(r => {
        if (!dateFrom && !dateTo) return true;
        const d = new Date(r.created_at).toISOString().slice(0, 10);
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
        return true;
      })
      .filter(r => r.receipt_number.toLowerCase().includes(s) || (r.notes || '').toLowerCase().includes(s));
  }, [receipts, search, status, customerId, dateFrom, dateTo, locationIdFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'date') {
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortBy === 'number') {
        cmp = a.receipt_number.localeCompare(b.receipt_number, undefined, { numeric: true });
      } else if (sortBy === 'customer') {
        const an = a.customer_id ? (customersById[a.customer_id] || '') : 'Walk-in';
        const bn = b.customer_id ? (customersById[b.customer_id] || '') : 'Walk-in';
        cmp = an.localeCompare(bn);
      } else if (sortBy === 'status') {
        const order: Record<string, number> = { open: 1, partial: 2, paid: 3, cancelled: 4 };
        cmp = (order[a.status] || 99) - (order[b.status] || 99);
      } else if (sortBy === 'total') {
        cmp = (a.total_amount || 0) - (b.total_amount || 0);
      } else if (sortBy === 'paid') {
        cmp = (a.amount_paid || 0) - (b.amount_paid || 0);
      } else if (sortBy === 'balance') {
        const balA = Math.max(0, (a.total_amount || 0) - (a.amount_paid || 0));
        const balB = Math.max(0, (b.total_amount || 0) - (b.amount_paid || 0));
        cmp = balA - balB;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortBy, sortDir, customersById]);

  const outstanding = (r: Receipt) => Math.max(0, (r.total_amount || 0) - (r.amount_paid || 0));
  const paidPct = (r: Receipt) => {
    const total = Number(r.total_amount || 0);
    if (total <= 0) return 0;
    return Math.min(100, Math.round((Number(r.amount_paid || 0) / total) * 100));
  };

  const totals = useMemo(() => {
    const total = filtered.reduce((sum, r) => sum + (r.total_amount || 0), 0);
    const paid = filtered.reduce((sum, r) => sum + (r.amount_paid || 0), 0);
    const due = total - paid;
    const totalWithoutTax = filtered.reduce((sum, r) => sum + ((r.total_amount || 0) - (r.tax_amount || 0)), 0);
    return reportApplyTax ? { total, paid, due } : { total: totalWithoutTax, paid, due: Math.max(0, totalWithoutTax - paid) };
  }, [filtered, reportApplyTax]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(sorted.length / pageSize)), [sorted.length, pageSize]);
  const currentPage = useMemo(() => Math.min(page, totalPages), [page, totalPages]);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return sorted.slice(start, end);
  }, [sorted, currentPage, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [search, status, customerId, dateFrom, dateTo, pageSize, sortBy, sortDir]);

  function toggleSort(key: 'number' | 'date' | 'customer' | 'status' | 'total' | 'paid' | 'balance') {
    if (sortBy === key) setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(key); setSortDir('desc'); }
  }

  const exportCsv = () => {
    const headers = [
      'Sales Receipt Number',
      'Date',
      'Customer',
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
      r.customer_id ? (customersById[r.customer_id] || 'Customer') : 'Walk-in',
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
    a.download = `sales_receipts_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportSelectedCsv = () => {
    const selected = filtered.filter(r => selectedIds.has(r.id));
    if (selected.length === 0) {
      toast.error('No sales receipts selected');
      return;
    }
    const headers = ['Sales Receipt Number','Date','Customer','Status','Total','Paid','Outstanding'];
    const rows = selected.map(r => [
      r.receipt_number,
      new Date(r.created_at).toISOString(),
      r.customer_id ? (customersById[r.customer_id] || 'Customer') : 'Walk-in',
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
    a.download = `sales_receipts_selected_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const openPayment = (r: Receipt) => {
    setSelected(r);
    setPayment({ amount: String(outstanding(r)), method: 'cash', reference: '' });
    setPaymentDate(new Date().toISOString().slice(0,10));
    setSelectedAccountId("");
    setSelectedIncomeAccountId("");
    setIsPayOpen(true);
    loadAssetAccounts();
    loadIncomeAccounts();
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
        payment_date: paymentDate,
        location_id: (selected as any)?.location_id || null,
      });
      if (!ok) throw new Error('Failed to record payment');

      // Post to ledger (debit Cash/Bank, credit Income)
                if (organization?.id) {
            try {
              const locationId = (selected as any)?.location_id || null;
              if (selectedAccountId && selectedIncomeAccountId) {
                await postReceiptPaymentWithAccounts({
                  organizationId: organization.id,
                  amount: amt,
                  depositAccountId: selectedAccountId,
                  incomeAccountId: selectedIncomeAccountId,
                  receiptId: selected.id,
                  receiptNumber: selected.receipt_number,
                  paymentDate,
                  locationId,
                });
              } else if (selectedIncomeAccountId && !selectedAccountId) {
                await postReceiptPaymentToLedgerWithIncomeAccount({
                  organizationId: organization.id,
                  amount: amt,
                  method: payment.method,
                  incomeAccountId: selectedIncomeAccountId,
                  receiptId: selected.id,
                  receiptNumber: selected.receipt_number,
                  paymentDate,
                  locationId,
                });
              } else if (selectedAccountId && !selectedIncomeAccountId) {
                await postReceiptPaymentWithAccount({
                  organizationId: organization.id,
                  amount: amt,
                  depositAccountId: selectedAccountId,
                  receiptId: selected.id,
                  receiptNumber: selected.receipt_number,
                  paymentDate,
                  locationId,
                });
              } else {
                await postReceiptPaymentToLedger({
                  organizationId: organization.id,
                  amount: amt,
                  method: payment.method,
                  receiptId: selected.id,
                  receiptNumber: selected.receipt_number,
                  paymentDate,
                  locationId,
                });
              }
            } catch (ledgerErr) {
              console.warn('Ledger posting failed', ledgerErr);
            }
          }

      toast.success('Payment recorded');
      setIsPayOpen(false);
      setSelected(null);
      await fetchReceipts();
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
      toast.success('Sales receipt deleted');
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

  const applyQuickDate = (value: string) => {
    setQuickDate(value);
    const fmt = (d: Date) => d.toISOString().slice(0,10);
    if (value === 'today') {
      setDateFrom(fmt(startOfToday()));
      setDateTo(fmt(endOfToday()));
    } else if (value === 'this_month') {
      setDateFrom(fmt(startOfMonth(new Date())));
      setDateTo(fmt(endOfMonth(new Date())));
    } else if (value === 'this_year') {
      setDateFrom(fmt(startOfYear(new Date())));
      setDateTo(fmt(endOfYear(new Date())));
    } else {
      setDateFrom("");
      setDateTo("");
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="mt-2 text-muted-foreground">Loading sales receipts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold">Sales Receipts</h2>
          <div className="text-sm text-muted-foreground">{filtered.length} result{filtered.length === 1 ? '' : 's'}</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ToggleGroup type="single" value={compact ? 'compact' : 'comfortable'} onValueChange={(v) => v && setCompact(v === 'compact')}>
            <ToggleGroupItem value="comfortable" aria-label="Comfortable density">Comfort</ToggleGroupItem>
            <ToggleGroupItem value="compact" aria-label="Compact density">Compact</ToggleGroupItem>
          </ToggleGroup>
          <Button variant="outline" onClick={exportCsv}>Export CSV</Button>
          <Button variant="outline" onClick={exportSelectedCsv} disabled={selectedIds.size === 0}>Export Selected</Button>
          <Button variant="outline" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => navigate('/receipts/new')}>New Sales Receipt</Button>
        </div>
      </div>

      <Tabs value={status} onValueChange={setStatus}>
        <TabsList>
          <TabsTrigger value="all">All ({preStatusFiltered.length})</TabsTrigger>
          <TabsTrigger value="open">Open ({statusCounts.open || 0})</TabsTrigger>
          <TabsTrigger value="partial">Partial ({statusCounts.partial || 0})</TabsTrigger>
          <TabsTrigger value="paid">Paid ({statusCounts.paid || 0})</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled ({statusCounts.cancelled || 0})</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-1 flex-wrap gap-2 items-end">
          <div className="w-[220px]">
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="All Customers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Customers</SelectItem>
                {customers.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-[220px]">
            <Select value={locationIdFilter} onValueChange={setLocationIdFilter}>
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
          <div className="w-[180px]">
            <Select value={quickDate} onValueChange={applyQuickDate}>
              <SelectTrigger>
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_time">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="this_year">This Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[170px]" />
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[170px]" />
          <Input placeholder="Search sales receipts..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 min-w-[200px]" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-[120px]">
            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
              <SelectTrigger>
                <SelectValue placeholder="Rows" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 / page</SelectItem>
                <SelectItem value="20">20 / page</SelectItem>
                <SelectItem value="50">50 / page</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center justify-between">Total
            <span className="flex items-center gap-2 text-xs font-normal">
              <Switch checked={reportApplyTax} onCheckedChange={setReportApplyTax} /> Include Tax
            </span>
          </CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{formatMoney(totals.total)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Paid</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{formatMoney(totals.paid)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Outstanding</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{formatMoney(totals.due)}</CardContent>
        </Card>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-md border p-3 bg-muted/40">
          <div className="text-sm">{selectedIds.size} selected</div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportSelectedCsv}>Export Selected</Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Clear</Button>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Sales Receipts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className={compact ? 'h-10' : ''}>
                  <TableHead className={compact ? 'py-2' : ''}>
                    <input type="checkbox" onChange={(e) => toggleSelectAll(e.currentTarget.checked)} checked={selectedIds.size === filtered.length && filtered.length > 0} />
                  </TableHead>
                  <TableHead className={compact ? 'py-2' : ''}>
                    <button className="inline-flex items-center gap-1" onClick={() => toggleSort('number')}>
                      # {sortBy === 'number' ? (sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />) : <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />}
                    </button>
                  </TableHead>
                  <TableHead className={compact ? 'py-2' : ''}>
                    <button className="inline-flex items-center gap-1" onClick={() => toggleSort('date')}>
                      Date {sortBy === 'date' ? (sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />) : <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />}
                    </button>
                  </TableHead>
                  <TableHead className={compact ? 'py-2' : ''}>
                    <button className="inline-flex items-center gap-1" onClick={() => toggleSort('customer')}>
                      Customer {sortBy === 'customer' ? (sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />) : <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />}
                    </button>
                  </TableHead>
                  <TableHead className={compact ? 'py-2' : ''}>Location</TableHead>
                  <TableHead className={compact ? 'py-2' : ''}>
                    <button className="inline-flex items-center gap-1" onClick={() => toggleSort('status')}>
                      Status {sortBy === 'status' ? (sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />) : <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />}
                    </button>
                  </TableHead>
                  <TableHead className={compact ? 'py-2' : ''}>
                    <button className="inline-flex items-center gap-1" onClick={() => toggleSort('total')}>
                      Total {sortBy === 'total' ? (sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />) : <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />}
                    </button>
                  </TableHead>
                  <TableHead className={compact ? 'py-2' : ''}>
                    <button className="inline-flex items-center gap-1" onClick={() => toggleSort('paid')}>
                      Paid {sortBy === 'paid' ? (sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />) : <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />}
                    </button>
                  </TableHead>
                  <TableHead className={compact ? 'py-2' : ''}>
                    <button className="inline-flex items-center gap-1" onClick={() => toggleSort('balance')}>
                      Balance {sortBy === 'balance' ? (sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />) : <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />}
                    </button>
                  </TableHead>
                  <TableHead className={compact ? 'py-2' : ''}>Progress</TableHead>
                  <TableHead className={`text-right ${compact ? 'py-2' : ''}`}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map(r => (
                  <TableRow key={r.id} className={compact ? 'h-10' : ''}>
                    <TableCell className={compact ? 'py-2' : ''}>
                      <input type="checkbox" checked={selectedIds.has(r.id)} onChange={(e) => toggleSelect(r.id, e.currentTarget.checked)} />
                    </TableCell>
                    <TableCell className={`font-medium ${compact ? 'py-2' : ''}`}>{r.receipt_number}</TableCell>
                    <TableCell className={compact ? 'py-2' : ''}>{format(new Date(r.created_at), 'MMM dd, yyyy')}</TableCell>
                    <TableCell className={compact ? 'py-2' : ''}>{r.customer_id ? (customersById[r.customer_id] || 'Customer') : 'Walk-in'}</TableCell>
                    <TableCell className={compact ? 'py-2' : ''}>{(() => { const lid = (r as any).location_id; return lid ? (locations.find(l => l.id === lid)?.name || '—') : '—'; })()}</TableCell>
                    <TableCell className={compact ? 'py-2' : ''}>
                      <Badge variant={r.status === 'paid' ? 'default' : r.status === 'partial' ? 'outline' : 'secondary'}>
                        {r.status.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className={compact ? 'py-2' : ''}>{formatMoney(r.total_amount || 0)}</TableCell>
                    <TableCell className={compact ? 'py-2' : ''}>{formatMoney(r.amount_paid || 0)}</TableCell>
                    <TableCell className={compact ? 'py-2' : ''}>{formatMoney(outstanding(r))}</TableCell>
                    <TableCell className={`w-[180px] ${compact ? 'py-2' : ''}`}>
                      <div className="flex items-center gap-2">
                        <Progress value={paidPct(r)} />
                        <span className="text-xs text-muted-foreground w-10 text-right">{paidPct(r)}%</span>
                      </div>
                    </TableCell>
                    <TableCell className={`text-right ${compact ? 'py-2' : ''}`}>
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
            {paginated.map(r => (
              <div key={r.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{r.receipt_number}</div>
                    <div className="text-sm text-muted-foreground">{format(new Date(r.created_at), 'MMM dd, yyyy')}</div>
                    <div className="text-sm text-muted-foreground">{r.customer_id ? (customersById[r.customer_id] || 'Customer') : 'Walk-in'}</div>
                  </div>
                  <Badge variant={r.status === 'paid' ? 'default' : r.status === 'partial' ? 'outline' : 'secondary'}>
                    {r.status.toUpperCase()}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="text-muted-foreground">Total</div>
                    <div className="font-medium">{formatMoney(r.total_amount || 0)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Paid</div>
                    <div className="font-medium">{formatMoney(r.amount_paid || 0)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Outstanding</div>
                    <div className="font-medium">{formatMoney(outstanding(r))}</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Progress value={paidPct(r)} />
                  <span className="text-xs text-muted-foreground w-10 text-right">{paidPct(r)}%</span>
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

          <div className="mt-4 flex items-center justify-between gap-2">
            <div className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</div>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); setPage(p => Math.max(1, p - 1)); }} />
                </PaginationItem>
                {Array.from({ length: totalPages }).slice(0, 5).map((_, idx) => {
                  const pageNum = idx + 1;
                  return (
                    <PaginationItem key={pageNum}>
                      <PaginationLink href="#" isActive={currentPage === pageNum} onClick={(e) => { e.preventDefault(); setPage(pageNum); }}>
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                <PaginationItem>
                  <PaginationNext href="#" onClick={(e) => { e.preventDefault(); setPage(p => Math.min(totalPages, p + 1)); }} />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
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
            <div className="space-y-2">
              <Label>Payment Date</Label>
              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Deposit to (Cash/Bank)</Label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger><SelectValue placeholder={assetAccounts.length ? 'Select account' : 'No accounts available'} /></SelectTrigger>
                <SelectContent>
                  {assetAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.account_code} - {a.account_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Revenue Account (Credit)</Label>
              <Select value={selectedIncomeAccountId} onValueChange={setSelectedIncomeAccountId}>
                <SelectTrigger><SelectValue placeholder={incomeAccounts.length ? 'Select revenue account' : 'No income accounts'} /></SelectTrigger>
                <SelectContent>
                  {incomeAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.account_code} - {a.account_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsPayOpen(false)}>Cancel</Button>
              <Button type="submit">Record</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}