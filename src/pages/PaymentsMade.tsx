import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CalendarRange, Download, Edit, MoreVertical, RefreshCw, Search, CreditCard, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useOrganizationCurrency, useOrganization } from "@/lib/saas/hooks";

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

export default function PaymentsMade() {
  const navigate = useNavigate();
  const { format: formatCurrency } = useOrganizationCurrency();
  const { organization } = useOrganization();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expenses, setExpenses] = useState<ExpenseLite[]>([]);
  const [purchases, setPurchases] = useState<PurchaseLite[]>([]);
  const [searchMade, setSearchMade] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [{ data: expData }, { data: purData }] = await Promise.all([
        supabase.from('expenses').select('id, expense_number, vendor_name, amount, expense_date, payment_method, status, receipt_url').order('created_at', { ascending: false }),
        supabase.from('purchases').select('id, purchase_number, vendor_name, total_amount, purchase_date, status').order('created_at', { ascending: false }),
      ]);
      
      setExpenses((expData || []) as any);
      setPurchases((purData || []) as any);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load payments made');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const refresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  // Combine expenses and purchases into a unified list
  const allPayments = useMemo(() => {
    const expensePayments = expenses.map(e => ({
      id: e.id,
      type: 'expense' as const,
      number: e.expense_number,
      vendor: e.vendor_name,
      amount: e.amount,
      date: e.expense_date,
      status: e.status,
      payment_method: e.payment_method,
      receipt_url: e.receipt_url,
    }));

    const purchasePayments = purchases.filter(p => p.status === 'paid' || p.status === 'completed').map(p => ({
      id: p.id,
      type: 'purchase' as const,
      number: p.purchase_number,
      vendor: p.vendor_name,
      amount: p.total_amount,
      date: p.purchase_date,
      status: p.status,
      payment_method: null,
      receipt_url: null,
    }));

    return [...expensePayments, ...purchasePayments].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [expenses, purchases]);

  const filteredPayments = useMemo(() => {
    const s = searchMade.toLowerCase();
    return allPayments.filter(p => {
      const matchesQuery = (
        (p.number || '').toLowerCase().includes(s) ||
        (p.vendor || '').toLowerCase().includes(s) ||
        (p.payment_method || '').toLowerCase().includes(s)
      );

      const matchesType = typeFilter === 'all' ? true : p.type === typeFilter;
      const matchesStatus = statusFilter === 'all' ? true : p.status === statusFilter;

      return matchesQuery && matchesType && matchesStatus;
    });
  }, [allPayments, searchMade, typeFilter, statusFilter]);

  const totalsMade = useMemo(() => {
    const total = filteredPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const count = filteredPayments.length;
    const avg = count ? total / count : 0;
    return { total, count, avg };
  }, [filteredPayments]);

  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / pageSize));
  const paginatedPayments = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredPayments.slice(start, start + pageSize);
  }, [filteredPayments, page, pageSize]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Paid</Badge>;
      case 'completed':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Completed</Badge>;
      case 'pending':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

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
          <div className="p-2.5 bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg">
            <CreditCard className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Payments Made</h1>
            <p className="text-slate-600">Track outgoing payments for expenses and purchases</p>
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
            onClick={() => navigate('/expenses/new')}
            className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 gap-2"
          >
            <CreditCard className="w-4 h-4" />
            Record Expense
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Paid</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(totalsMade.total)}</p>
              </div>
              <CreditCard className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Payment Count</p>
                <p className="text-2xl font-bold text-slate-900">{totalsMade.count}</p>
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
                <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalsMade.avg)}</p>
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
                  value={searchMade}
                  onChange={(e) => setSearchMade(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="expense">Expenses</SelectItem>
                <SelectItem value="purchase">Purchases</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Payments Made ({filteredPayments.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Number</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedPayments.map((payment) => (
                <TableRow key={`${payment.type}-${payment.id}`}>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {payment.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {payment.number || '—'}
                  </TableCell>
                  <TableCell>
                    {payment.vendor || '—'}
                  </TableCell>
                  <TableCell>
                    {format(new Date(payment.date), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell className="font-semibold text-red-600">
                    {formatCurrency(payment.amount)}
                  </TableCell>
                  <TableCell>
                    {payment.payment_method ? (
                      <Badge variant="outline" className="capitalize">
                        {payment.payment_method}
                      </Badge>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(payment.status)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={() => navigate(`/${payment.type === 'expense' ? 'expenses' : 'purchases'}/${payment.id}`)}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        {payment.receipt_url && (
                          <DropdownMenuItem asChild>
                            <a href={payment.receipt_url} target="_blank" rel="noopener noreferrer">
                              <Download className="mr-2 h-4 w-4" />
                              View Receipt
                            </a>
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
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