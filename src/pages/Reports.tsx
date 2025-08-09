import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Label } from '@/components/ui/label';
import {
  BarChart3,
  TrendingUp,
  Users,
  DollarSign,
  Calendar,
  Download,
  Filter,
  RefreshCw,
  PieChart,
  LineChart,
  Activity,
  Target,
  Package,
} from 'lucide-react';
import { useSaas } from '@/lib/saas/context';
import { supabase } from '@/integrations/supabase/client';
import { useSearchParams } from 'react-router-dom';
import { mockDb } from '@/utils/mockDatabase';

const Reports = () => {
  const { organization, subscriptionPlan } = useSaas();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'overview';
  const initialSub = searchParams.get('sub');
  const [timeRange, setTimeRange] = useState('month');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [activeSubTab, setActiveSubTab] = useState<Record<string, string>>({ overview: 'summary', revenue: 'summary', services: 'top', clients: 'top', pnl: 'summary', balancesheet: 'summary', commissions: initialSub || 'summary', product_usage: 'history' });
  const [staffList, setStaffList] = useState<Array<{ id: string; full_name: string; commission_rate?: number | null }>>([]);
  const [commissionRows, setCommissionRows] = useState<Array<any>>([]);
  const [commissionSummary, setCommissionSummary] = useState<Record<string, { staffId: string; staffName: string; gross: number; commissionRate: number; commission: number }>>({});
  const [commissionStaffFilter, setCommissionStaffFilter] = useState<string>('all');
  const [pl, setPl] = useState<{ income: number; cogs: number; expenses: number; grossProfit: number; netProfit: number; breakdown?: { income: Record<string, number>; expense: Record<string, number> } }>({ income: 0, cogs: 0, expenses: 0, grossProfit: 0, netProfit: 0 });
  const [bs, setBs] = useState<{ assets: number; liabilities: number; equity: number } >({ assets: 0, liabilities: 0, equity: 0 });
  const [startDate, setStartDate] = useState<string>(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return start.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [recalcLoading, setRecalcLoading] = useState(false);
  const [density, setDensity] = useState<'compact' | 'comfortable'>('comfortable');

  useEffect(() => {
    const tab = searchParams.get('tab') || 'overview';
    const sub = searchParams.get('sub');
    if (tab !== activeTab) {
      setActiveTab(tab);
    }
    if (sub && activeSubTab[tab] !== sub) {
      setActiveSubTab((prev) => ({ ...prev, [tab]: sub }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', activeTab);
    const sub = activeSubTab[activeTab];
    if (sub) next.set('sub', sub); else next.delete('sub');
    // Only update if changed to avoid loops
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, activeSubTab]);

  const recalcFinancials = useCallback(async () => {
    setRecalcLoading(true);
    try {
      // Cash-basis: derive income from receipt_payments and expenses from expenses with status paid within date range
      const [{ data: payments }, { data: paidExpenses }, { data: txns } ] = await Promise.all([
        supabase
          .from('receipt_payments')
          .select('amount, payment_date')
          .gte('payment_date', startDate)
          .lte('payment_date', endDate),
        supabase
          .from('expenses')
          .select('amount, expense_date, category')
          .eq('status', 'paid')
          .gte('expense_date', startDate)
          .lte('expense_date', endDate),
        supabase
          .from('account_transactions')
          .select('account_id, transaction_date, debit_amount, credit_amount, description, accounts:account_id (account_type, account_code, account_subtype)')
          .gte('transaction_date', startDate)
          .lte('transaction_date', endDate),
      ]);

      const paymentsIncome = (payments || []).reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
      const expenseCash = (paidExpenses || []).reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);

      // Optional: COGS from account transactions tagged to COGS account (5001)
      const transactions = txns || [];
      const cogs = transactions
        .filter((t: any) => t.accounts?.account_code === '5001')
        .reduce((sum: number, t: any) => sum + (Number(t.debit_amount) || 0) - (Number(t.credit_amount) || 0), 0);

      // Breakdown by subtype
      const incomeBreakdown: Record<string, number> = {};
      const expenseBreakdown: Record<string, number> = {};
      for (const t of transactions as any[]) {
        if (t.accounts?.account_type === 'Income') {
          const key = t.accounts?.account_subtype || 'Income';
          incomeBreakdown[key] = (incomeBreakdown[key] || 0) + ((Number(t.credit_amount) || 0) - (Number(t.debit_amount) || 0));
        } else if (t.accounts?.account_type === 'Expense') {
          const key = t.accounts?.account_subtype || 'Expense';
          expenseBreakdown[key] = (expenseBreakdown[key] || 0) + ((Number(t.debit_amount) || 0) - (Number(t.credit_amount) || 0));
        }
      }

      const income = paymentsIncome; // cash-basis income
      const expenses = Math.max(0, expenseCash); // cash-basis expenses
      const grossProfit = income - cogs;
      const netProfit = grossProfit - expenses;
      setPl({ income, cogs, expenses, grossProfit, netProfit, breakdown: { income: incomeBreakdown, expense: expenseBreakdown } });

      // Balance Sheet snapshot using ledger by type within range
      const sumByType = (type: string) => transactions
        .filter((t: any) => t.accounts?.account_type === type)
        .reduce((sum: number, t: any) => sum + (Number(t.debit_amount) || 0) - (Number(t.credit_amount) || 0), 0);
      const sumByTypeCreditMinusDebit = (type: string) => transactions
        .filter((t: any) => t.accounts?.account_type === type)
        .reduce((sum: number, t: any) => sum + (Number(t.credit_amount) || 0) - (Number(t.debit_amount) || 0), 0);

      const assets = sumByType('Asset');
      const liabilities = sumByTypeCreditMinusDebit('Liability');
      const equity = sumByTypeCreditMinusDebit('Equity');
      setBs({ assets, liabilities, equity });
    } catch (e) {
      console.error('Error calculating financials', e);
    } finally {
      setRecalcLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    recalcFinancials();
  }, [recalcFinancials]);

  useEffect(() => {
    const loadStaff = async () => {
      const { data } = await supabase.from('staff').select('id, full_name, commission_rate');
      setStaffList(data || []);
    };
    loadStaff();
  }, []);

  const loadCommissions = async () => {
    setLoading(true);
    try {
      // Step 1: find receipts in range
      const { data: receiptsInRange, error: rcptErr } = await supabase
        .from('receipts')
        .select('id, created_at')
        .gte('created_at', startDate)
        .lte('created_at', endDate);
      if (rcptErr) throw rcptErr;
      const receiptIds: string[] = (receiptsInRange || []).map((r: any) => r.id);

      if (receiptIds.length === 0) {
        setCommissionRows([]);
        setCommissionSummary({});
        return;
      }

      // Step 2: load staff commissions for those receipts
      const { data: comms, error: commErr } = await supabase
        .from('staff_commissions')
        .select(`
          id, commission_rate, gross_amount, commission_amount, created_at,
          receipt:receipt_id ( id, created_at ),
          staff:staff_id ( id, full_name ),
          service:service_id ( id, name )
        `)
        .in('receipt_id', receiptIds);
      if (commErr) throw commErr;

      const normalized = (comms || []).map((r: any) => {
        const staff = Array.isArray(r.staff) ? r.staff[0] : r.staff;
        const service = Array.isArray(r.service) ? r.service[0] : r.service;
        const receipt = Array.isArray(r.receipt) ? r.receipt[0] : r.receipt;
        return { ...r, staff, service, receipt };
      });

      const filtered = normalized.filter((r: any) => commissionStaffFilter === 'all' ? true : r.staff?.id === commissionStaffFilter);
      setCommissionRows(filtered.map((r: any) => ({
        id: r.id,
        created_at: r.receipt?.created_at || r.created_at,
        service: r.service,
        staff: r.staff,
        quantity: 1,
        unit_price: Number(r.gross_amount || 0),
        gross_amount: Number(r.gross_amount || 0),
        commission_rate: Number(r.commission_rate || 0),
        commission_amount: Number(r.commission_amount || 0),
      })));

      const summary: Record<string, { staffId: string; staffName: string; gross: number; commissionRate: number; commission: number }> = {};
      for (const r of filtered as any[]) {
        const staffId = r.staff?.id || 'unassigned';
        const staffName = r.staff?.full_name || 'Unassigned';
        const gross = Number(r.gross_amount || 0);
        const rate = Number(r.commission_rate || 0);
        const commission = Number(r.commission_amount || 0);
        if (!summary[staffId]) summary[staffId] = { staffId, staffName, gross: 0, commissionRate: 0, commission: 0 };
        summary[staffId].gross += gross;
        // For display, keep last non-zero rate; this is a per-line rate in reality
        summary[staffId].commissionRate = rate || summary[staffId].commissionRate;
        summary[staffId].commission += commission;
      }
      setCommissionSummary(summary);
    } catch (e) {
      console.error('Error loading commissions', e);
      // Fallback to mock storage when Supabase not available
      try {
        const storage = await mockDb.getStore();
        const inRangeReceiptIds = (storage.receipts || [])
          .filter((r: any) => {
            const d = String(r.created_at || '').slice(0, 10);
            return (!startDate || d >= startDate) && (!endDate || d <= endDate);
          })
          .map((r: any) => r.id);
        const items = (storage.receipt_items || [])
          .filter((it: any) => inRangeReceiptIds.includes(it.receipt_id));
        const rows = items.filter((it: any) => commissionStaffFilter === 'all' ? true : it.staff_id === commissionStaffFilter)
          .map((it: any) => ({
            id: it.id,
            created_at: it.created_at,
            service: { id: it.service_id, name: it.description },
            staff: { id: it.staff_id, full_name: (storage.staff?.find?.((s: any) => s.id === it.staff_id)?.full_name) || 'Unassigned' },
            quantity: Number(it.quantity || 1),
            unit_price: Number(it.unit_price || 0),
          }));
        setCommissionRows(rows);
        const summary: Record<string, { staffId: string; staffName: string; gross: number; commissionRate: number; commission: number }> = {};
        for (const r of rows as any[]) {
          const staffId = r.staff?.id || 'unassigned';
          const staffName = r.staff?.full_name || 'Unassigned';
          const gross = Number(r.unit_price || 0) * Number(r.quantity || 1);
          const rate = 0; // mock has no rate context
          const commission = 0;
          if (!summary[staffId]) summary[staffId] = { staffId, staffName, gross: 0, commissionRate: 0, commission: 0 };
          summary[staffId].gross += gross;
        }
                setCommissionSummary(summary);
       } catch (err2) {
         console.error('Commission fallback error', err2);
       }
     } finally {
       setLoading(false);
     }
   };

   // Automatically refresh commissions when tab or filters change
   useEffect(() => {
     if (activeTab === 'commissions') {
       loadCommissions();
     }
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [activeTab, startDate, endDate, commissionStaffFilter]);

  // Real metrics state for reports
  type OverviewStat = { current: number; previous: number; change: number };
  const safePercent = (current: number, previous: number) => {
    if (!previous || previous === 0) return current > 0 ? 100 : 0;
    return Number((((current - previous) / previous) * 100).toFixed(1));
  };

  const [overview, setOverview] = useState<{
    revenue: OverviewStat;
    appointments: OverviewStat;
    clients: OverviewStat;
    services: OverviewStat;
  }>({
    revenue: { current: 0, previous: 0, change: 0 },
    appointments: { current: 0, previous: 0, change: 0 },
    clients: { current: 0, previous: 0, change: 0 },
    services: { current: 0, previous: 0, change: 0 },
  });

  const [topServices, setTopServices] = useState<Array<{ name: string; revenue: number; appointments: number; growth: number }>>([]);
  const [topClients, setTopClients] = useState<Array<{ name: string; visits: number; totalSpent: number; lastVisit: string }>>([]);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const dayMs = 24 * 60 * 60 * 1000;
      const periodDays = Math.max(1, Math.floor((end.getTime() - start.getTime()) / dayMs) + 1);
      const prevEnd = new Date(start.getTime() - dayMs);
      const prevStart = new Date(prevEnd.getTime() - (periodDays - 1) * dayMs);
      const toDateStr = (d: Date) => d.toISOString().slice(0, 10);

      // Fetch core datasets
      const [
        receiptsNowRes,
        receiptsPrevRes,
        apptsNowRes,
        apptsPrevRes,
        clientsNowRes,
        clientsPrevRes,
        svcItemsNowRes,
        svcItemsPrevRes,
      ] = await Promise.all([
        supabase.from('receipts')
          .select('id, total_amount, created_at, customer_id')
          .gte('created_at', startDate)
          .lte('created_at', endDate),
        supabase.from('receipts')
          .select('id, total_amount, created_at, customer_id')
          .gte('created_at', toDateStr(prevStart))
          .lte('created_at', toDateStr(prevEnd)),
        supabase.from('appointments')
          .select('id, appointment_date')
          .gte('appointment_date', startDate)
          .lte('appointment_date', endDate),
        supabase.from('appointments')
          .select('id, appointment_date')
          .gte('appointment_date', toDateStr(prevStart))
          .lte('appointment_date', toDateStr(prevEnd)),
        supabase.from('clients')
          .select('id, created_at')
          .gte('created_at', startDate)
          .lte('created_at', endDate),
        supabase.from('clients')
          .select('id, created_at')
          .gte('created_at', toDateStr(prevStart))
          .lte('created_at', toDateStr(prevEnd)),
        supabase.from('receipt_items')
          .select('id, created_at, quantity, unit_price, total_price, service_id')
          .not('service_id', 'is', null)
          .gte('created_at', startDate)
          .lte('created_at', endDate),
        supabase.from('receipt_items')
          .select('id, created_at, quantity, unit_price, total_price, service_id')
          .not('service_id', 'is', null)
          .gte('created_at', toDateStr(prevStart))
          .lte('created_at', toDateStr(prevEnd)),
      ]);

      const receiptsNow = receiptsNowRes.data || [];
      const receiptsPrev = receiptsPrevRes.data || [];
      const apptsNow = apptsNowRes.data || [];
      const apptsPrev = apptsPrevRes.data || [];
      const clientsNow = clientsNowRes.data || [];
      const clientsPrev = clientsPrevRes.data || [];
      const svcItemsNow = svcItemsNowRes.data || [];
      const svcItemsPrev = svcItemsPrevRes.data || [];

      const revenueNow = receiptsNow.reduce((s: number, r: any) => s + (Number(r.total_amount) || 0), 0);
      const revenuePrev = receiptsPrev.reduce((s: number, r: any) => s + (Number(r.total_amount) || 0), 0);
      const appointmentsNow = apptsNow.length;
      const appointmentsPrev = apptsPrev.length;
      const newClientsNow = clientsNow.length;
      const newClientsPrev = clientsPrev.length;
      const servicesNow = svcItemsNow.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);
      const servicesPrev = svcItemsPrev.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);

      setOverview({
        revenue: { current: revenueNow, previous: revenuePrev, change: safePercent(revenueNow, revenuePrev) },
        appointments: { current: appointmentsNow, previous: appointmentsPrev, change: safePercent(appointmentsNow, appointmentsPrev) },
        clients: { current: newClientsNow, previous: newClientsPrev, change: safePercent(newClientsNow, newClientsPrev) },
        services: { current: servicesNow, previous: servicesPrev, change: safePercent(servicesNow, servicesPrev) },
      });

      // Top services (by revenue)
      const byService: Record<string, { revenue: number; qty: number }> = {};
      for (const it of svcItemsNow as any[]) {
        const id = it.service_id as string;
        if (!byService[id]) byService[id] = { revenue: 0, qty: 0 };
        const gross = Number(it.total_price) || (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
        byService[id].revenue += gross;
        byService[id].qty += Number(it.quantity) || 0;
      }
      const serviceIds = Object.keys(byService);
      let serviceNames: Record<string, string> = {};
      if (serviceIds.length > 0) {
        const { data: services } = await supabase.from('services').select('id, name').in('id', serviceIds);
        (services || []).forEach((s: any) => { serviceNames[s.id] = s.name; });
      }
      const topSvc = serviceIds.map(id => ({
        name: serviceNames[id] || 'Service',
        revenue: Math.round(byService[id].revenue),
        appointments: byService[id].qty,
        growth: 0,
      })).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
      setTopServices(topSvc);

      // Top clients (by total spent)
      const byClient: Record<string, { total: number; count: number; last: string }> = {};
      for (const r of receiptsNow as any[]) {
        const cid = r.customer_id as string | null;
        if (!cid) continue;
        if (!byClient[cid]) byClient[cid] = { total: 0, count: 0, last: '' };
        byClient[cid].total += Number(r.total_amount) || 0;
        byClient[cid].count += 1;
        const d = r.created_at as string;
        if (!byClient[cid].last || new Date(d).getTime() > new Date(byClient[cid].last).getTime()) byClient[cid].last = d;
      }
      const clientIds = Object.keys(byClient);
      let clientNames: Record<string, string> = {};
      if (clientIds.length > 0) {
        const { data: clientsData } = await supabase.from('clients').select('id, full_name, name').in('id', clientIds);
        (clientsData || []).forEach((c: any) => { clientNames[c.id] = c.full_name || c.name || 'Client'; });
      }
      const topCli = clientIds.map(id => ({
        name: clientNames[id] || 'Client',
        visits: byClient[id].count,
        totalSpent: Math.round(byClient[id].total),
        lastVisit: (byClient[id].last ? new Date(byClient[id].last).toLocaleDateString() : ''),
      })).sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 5);
      setTopClients(topCli);
    } catch (e) {
      console.error('Failed to load overview metrics', e);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const refreshData = async () => {
    setLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setLoading(false);
  };

  const exportReport = (type: string) => {
    // Simulate export functionality
    console.log(`Exporting ${type} report...`);
  };

  return (
    <div className="flex-1 w-full space-y-6 px-4 sm:px-6 py-6 bg-gradient-to-br from-slate-50 to-slate-100/50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 md:gap-6 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Reports & Analytics</h1>
              <p className="text-slate-600">Comprehensive insights into your salon performance</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 md:gap-3 flex-wrap">
          <ToggleGroup type="single" value={density} onValueChange={(v) => v && setDensity(v as any)}>
            <ToggleGroupItem value="compact">Compact</ToggleGroupItem>
            <ToggleGroupItem value="comfortable">Comfortable</ToggleGroupItem>
          </ToggleGroup>
          <div className="flex items-center gap-2">
            <div className="space-y-1">
              <div className="text-xs text-slate-600">Start</div>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border rounded px-2 py-1" />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-slate-600">End</div>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border rounded px-2 py-1" />
            </div>
            <Button variant="outline" onClick={recalcFinancials} disabled={recalcLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${recalcLoading ? 'animate-spin' : ''}`} />
              Recalculate
            </Button>
          </div>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
          
          <Button 
            variant="outline" 
            onClick={refreshData}
            disabled={loading}
            className="border-slate-300 hover:bg-slate-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Main Content with vertical tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        {/* Mobile tab selector */}
        <div className="lg:hidden">
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select report section" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="overview">Overview</SelectItem>
              <SelectItem value="revenue">Revenue</SelectItem>
              <SelectItem value="services">Services</SelectItem>
              <SelectItem value="clients">Clients</SelectItem>
              <SelectItem value="pnl">P&L</SelectItem>
              <SelectItem value="balancesheet">Balance Sheet</SelectItem>
              <SelectItem value="commissions">Commissions</SelectItem>
              <SelectItem value="product_usage">Product Usage</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <aside className="lg:col-span-3 xl:col-span-2 lg:sticky lg:top-24 self-start max-h-[calc(100vh-7rem)] overflow-y-auto">
            <TabsList className="flex flex-col w-full items-stretch rounded-xl border bg-card shadow-sm p-1 gap-1 h-auto">
              <TabsTrigger value="overview" className="justify-start flex items-center gap-2 rounded-md data-[state=active]:bg-muted">
                <Activity className="w-4 h-4" /> Overview
              </TabsTrigger>
              {activeTab === 'overview' && (
                <div className="ml-6 mt-2 space-y-1 text-sm">
                  <button className={`text-left ${activeSubTab.overview === 'summary' ? 'font-semibold' : ''}`} onClick={() => { setActiveSubTab(prev => ({ ...prev, overview: 'summary' })); setSearchParams({ tab: 'overview', sub: 'summary' }, { replace: true }); }}>Summary</button>
                </div>
              )}
              <TabsTrigger value="revenue" className="justify-start flex items-center gap-2 rounded-md data-[state=active]:bg-muted">
                <DollarSign className="w-4 h-4" /> Revenue
              </TabsTrigger>
              {activeTab === 'revenue' && (
                <div className="ml-6 mt-2 space-y-1 text-sm">
                  <button className={`text-left ${activeSubTab.revenue === 'summary' ? 'font-semibold' : ''}`} onClick={() => { setActiveSubTab(prev => ({ ...prev, revenue: 'summary' })); setSearchParams({ tab: 'revenue', sub: 'summary' }, { replace: true }); }}>Summary</button>
                </div>
              )}
              <TabsTrigger value="services" className="justify-start flex items-center gap-2 rounded-md data-[state=active]:bg-muted">
                <Target className="w-4 h-4" /> Services
              </TabsTrigger>
              {activeTab === 'services' && (
                <div className="ml-6 mt-2 space-y-1 text-sm">
                  <button className={`text-left ${activeSubTab.services === 'top' ? 'font-semibold' : ''}`} onClick={() => { setActiveSubTab(prev => ({ ...prev, services: 'top' })); setSearchParams({ tab: 'services', sub: 'top' }, { replace: true }); }}>Top Services</button>
                </div>
              )}
              <TabsTrigger value="clients" className="justify-start flex items-center gap-2 rounded-md data-[state=active]:bg-muted">
                <Users className="w-4 h-4" /> Clients
              </TabsTrigger>
              {activeTab === 'clients' && (
                <div className="ml-6 mt-2 space-y-1 text-sm">
                  <button className={`text-left ${activeSubTab.clients === 'top' ? 'font-semibold' : ''}`} onClick={() => { setActiveSubTab(prev => ({ ...prev, clients: 'top' })); setSearchParams({ tab: 'clients', sub: 'top' }, { replace: true }); }}>Top Clients</button>
                </div>
              )}
              <TabsTrigger value="pnl" className="justify-start flex items-center gap-2 rounded-md data-[state=active]:bg-muted">
                <DollarSign className="w-4 h-4" /> P&L
              </TabsTrigger>
              <TabsTrigger value="balancesheet" className="justify-start flex items-center gap-2 rounded-md data-[state=active]:bg-muted">
                <PieChart className="w-4 h-4" /> Balance Sheet
              </TabsTrigger>
              <TabsTrigger value="commissions" className="justify-start flex items-center gap-2 rounded-md data-[state=active]:bg-muted">
                <DollarSign className="w-4 h-4" /> Commissions
              </TabsTrigger>
              {activeTab === 'commissions' && (
                <div className="ml-6 mt-2 space-y-1 text-sm">
                  <button className={`text-left ${activeSubTab.commissions === 'summary' ? 'font-semibold' : ''}`} onClick={() => { setActiveSubTab(prev => ({ ...prev, commissions: 'summary' })); setSearchParams({ tab: 'commissions', sub: 'summary' }, { replace: true }); }}>Summary</button>
                  <button className={`text-left ${activeSubTab.commissions === 'detailed' ? 'font-semibold' : ''}`} onClick={() => { setActiveSubTab(prev => ({ ...prev, commissions: 'detailed' })); setSearchParams({ tab: 'commissions', sub: 'detailed' }, { replace: true }); }}>Detailed</button>
                </div>
              )}
              <TabsTrigger value="product_usage" className="justify-start flex items-center gap-2 rounded-md data-[state=active]:bg-muted">
                <Package className="w-4 h-4" /> Product Usage
              </TabsTrigger>
              {activeTab === 'product_usage' && (
                <div className="ml-6 mt-2 space-y-1 text-sm">
                  <button className={`text-left ${activeSubTab.product_usage === 'history' ? 'font-semibold' : ''}`} onClick={() => { setActiveSubTab(prev => ({ ...prev, product_usage: 'history' })); setSearchParams({ tab: 'product_usage', sub: 'history' }, { replace: true }); }}>Usage History</button>
                </div>
              )}
            </TabsList>
          </aside>

          <main className="lg:col-span-9 xl:col-span-10 space-y-6">
            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* Key Metrics */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border-0 shadow-lg">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-slate-600">Total Revenue</CardTitle>
                    <DollarSign className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">${overview.revenue.current.toLocaleString()}</div>
                    <div className="flex items-center text-xs text-slate-600">
                      <TrendingUp className="h-3 w-3 mr-1 text-green-600" />
                      +{overview.revenue.change}% from last period
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-slate-600">Appointments</CardTitle>
                    <Calendar className="h-4 w-4 text-blue-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{overview.appointments.current}</div>
                    <div className="flex items-center text-xs text-slate-600">
                      <TrendingUp className="h-3 w-3 mr-1 text-green-600" />
                      +{overview.appointments.change}% from last period
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-slate-600">New Clients</CardTitle>
                    <Users className="h-4 w-4 text-purple-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{overview.clients.current}</div>
                    <div className="flex items-center text-xs text-slate-600">
                      <TrendingUp className="h-3 w-3 mr-1 text-green-600" />
                      +{overview.clients.change}% from last period
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-slate-600">Services Rendered</CardTitle>
                    <Target className="h-4 w-4 text-orange-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{overview.services.current}</div>
                    <div className="flex items-center text-xs text-slate-600">
                      <TrendingUp className="h-3 w-3 mr-1 text-green-600" />
                      +{overview.services.change}% from last period
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts Row */}
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <LineChart className="w-5 h-5 text-blue-600" />
                      Revenue Trend
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64 flex items-center justify-center text-slate-500">
                      <div className="text-center">
                        <BarChart3 className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                        <p>Revenue chart will be displayed here</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PieChart className="w-5 h-5 text-purple-600" />
                      Service Distribution
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64 flex items-center justify-center text-slate-500">
                      <div className="text-center">
                        <PieChart className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                        <p>Service distribution chart will be displayed here</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Revenue Tab */}
            <TabsContent value="revenue" className="space-y-6">
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle>Revenue Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">${overview.revenue.current.toLocaleString()}</div>
                        <div className="text-sm text-green-700">Total Revenue</div>
                      </div>
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">${(overview.appointments.current ? (overview.revenue.current / overview.appointments.current) : 0).toFixed(0)}</div>
                        <div className="text-sm text-blue-700">Average per Appointment</div>
                      </div>
                      <div className="text-center p-4 bg-purple-50 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">${(overview.clients.current ? (overview.revenue.current / overview.clients.current) : 0).toFixed(0)}</div>
                        <div className="text-sm text-purple-700">Average per Client</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Services Tab */}
            <TabsContent value="services" className="space-y-6">
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle>Top Performing Services</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {topServices.map((service, index) => (
                      <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="w-8 h-8 flex items-center justify-center">
                            {index + 1}
                          </Badge>
                          <div>
                            <div className="font-medium">{service.name}</div>
                            <div className="text-sm text-slate-600">{service.appointments} appointments</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">${service.revenue.toLocaleString()}</div>
                          <div className="text-sm text-green-600">+{service.growth}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Clients Tab */}
            <TabsContent value="clients" className="space-y-6">
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle>Top Clients</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {topClients.map((client, index) => (
                      <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="w-8 h-8 flex items-center justify-center">
                            {index + 1}
                          </Badge>
                          <div>
                            <div className="font-medium">{client.name}</div>
                            <div className="text-sm text-slate-600">{client.visits} visits • Last: {client.lastVisit}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">${client.totalSpent}</div>
                          <div className="text-sm text-slate-600">Total spent</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="pnl" className="space-y-6">
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle>Profit & Loss</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-700">${pl.income.toFixed(2)}</div>
                      <div className="text-sm text-green-700">Income (Cash-basis)</div>
                    </div>
                    <div className="text-center p-4 bg-amber-50 rounded-lg">
                      <div className="text-2xl font-bold text-amber-700">${pl.cogs.toFixed(2)}</div>
                      <div className="text-sm text-amber-700">Cost of Goods Sold</div>
                    </div>
                    <div className="text-center p-4 bg-red-50 rounded-lg">
                      <div className="text-2xl font-bold text-red-700">${pl.expenses.toFixed(2)}</div>
                      <div className="text-sm text-red-700">Expenses (Cash-basis)</div>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-700">${pl.grossProfit.toFixed(2)}</div>
                      <div className="text-sm text-blue-700">Gross Profit</div>
                    </div>
                  </div>
                  <div className="mt-6 text-center p-4 bg-indigo-50 rounded-lg">
                    <div className="text-3xl font-bold text-indigo-700">${pl.netProfit.toFixed(2)}</div>
                    <div className="text-sm text-indigo-700">Net Profit</div>
                  </div>
                  {pl.breakdown && (
                    <div className="grid gap-6 md:grid-cols-2 mt-6">
                      <div>
                        <div className="font-semibold mb-2">Income Breakdown</div>
                        <Table>
                          <TableHeader><TableRow><TableHead>Subtype</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {Object.entries(pl.breakdown.income).map(([k,v]) => (
                              <TableRow key={k}><TableCell>{k}</TableCell><TableCell className="text-right">${Number(v).toFixed(2)}</TableCell></TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <div>
                        <div className="font-semibold mb-2">Expense Breakdown</div>
                        <Table>
                          <TableHeader><TableRow><TableHead>Subtype</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {Object.entries(pl.breakdown.expense).map(([k,v]) => (
                              <TableRow key={k}><TableCell>{k}</TableCell><TableCell className="text-right">${Number(v).toFixed(2)}</TableCell></TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="balancesheet" className="space-y-6">
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle>Balance Sheet</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="text-center p-4 bg-slate-50 rounded-lg">
                      <div className="text-2xl font-bold text-slate-700">${bs.assets.toFixed(2)}</div>
                      <div className="text-sm text-slate-700">Assets</div>
                    </div>
                    <div className="text-center p-4 bg-slate-50 rounded-lg">
                      <div className="text-2xl font-bold text-slate-700">${bs.liabilities.toFixed(2)}</div>
                      <div className="text-sm text-slate-700">Liabilities</div>
                    </div>
                    <div className="text-center p-4 bg-slate-50 rounded-lg">
                      <div className="text-2xl font-bold text-slate-700">${bs.equity.toFixed(2)}</div>
                      <div className="text-sm text-slate-700">Equity</div>
                    </div>
                  </div>
                  <div className="mt-6 text-center text-sm text-slate-600">
                    Check: Assets (${bs.assets.toFixed(2)}) = Liabilities (${bs.liabilities.toFixed(2)}) + Equity (${bs.equity.toFixed(2)})
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Commissions Tab */}
            <TabsContent value="commissions" className="space-y-6">
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle>Commissions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-end gap-4">
                    <div className="w-56">
                      <Label>Staff</Label>
                      <Select value={commissionStaffFilter} onValueChange={setCommissionStaffFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="All staff" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Staff</SelectItem>
                          {staffList.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Start</Label>
                      <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    </div>
                    <div>
                      <Label>End</Label>
                      <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                    </div>
                    <Button onClick={loadCommissions}>
                      <Filter className="w-4 h-4 mr-2" /> Apply
                    </Button>
                  </div>

                  {activeSubTab.commissions === 'summary' && (
                    <div className="space-y-4">
                      <div className="overflow-x-auto">
                        <Table className={`min-w-[720px] ${density === 'compact' ? 'overflow-hidden' : ''}`}>
                          <TableHeader className={`${density === 'compact' ? 'text-xs' : ''}`}>
                            <TableRow>
                              <TableHead className={`${density === 'compact' ? 'px-2 py-1' : ''}`}>Staff</TableHead>
                              <TableHead className="text-right text-sm">Gross</TableHead>
                              <TableHead className="text-right text-sm">Rate %</TableHead>
                              <TableHead className="text-right text-sm">Commission</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody className={`${density === 'compact' ? 'text-xs' : ''}`}>
                            {Object.values(commissionSummary).map(row => (
                              <TableRow key={row.staffId}>
                                <TableCell className={`${density === 'compact' ? 'px-2 py-1' : ''}`}>{row.staffName}</TableCell>
                                <TableCell className="text-right">${row.gross.toFixed(2)}</TableCell>
                                <TableCell className="text-right">{row.commissionRate.toFixed(2)}</TableCell>
                                <TableCell className="text-right">${row.commission.toFixed(2)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {activeSubTab.commissions === 'detailed' && (
                    <div className="space-y-4">
                      <div className="overflow-x-auto">
                        <Table className={`min-w-[900px] ${density === 'compact' ? 'overflow-hidden' : ''}`}>
                          <TableHeader className={`${density === 'compact' ? 'text-xs' : ''}`}>
                            <TableRow>
                              <TableHead className={`${density === 'compact' ? 'px-2 py-1' : ''}`}>Date</TableHead>
                              <TableHead className={`${density === 'compact' ? 'px-2 py-1' : ''}`}>Service</TableHead>
                              <TableHead className={`${density === 'compact' ? 'px-2 py-1' : ''}`}>Staff</TableHead>
                              <TableHead className="text-right text-sm">Qty</TableHead>
                              <TableHead className="text-right text-sm">Unit Price</TableHead>
                              <TableHead className="text-right text-sm">Gross</TableHead>
                              <TableHead className="text-right text-sm">Rate %</TableHead>
                              <TableHead className="text-right text-sm">Commission</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody className={`${density === 'compact' ? 'text-xs' : ''}`}>
                            {commissionRows.map((r: any) => {
                              const qty = Number(r.quantity || 1);
                              const unit = Number(r.unit_price || 0);
                              const gross = qty * unit;
                              const rate = Number(r.service?.commission_percentage ?? r.staff?.commission_rate ?? 0);
                              const comm = gross * (Number(rate) || 0) / 100;
                              return (
                                <TableRow key={r.id}>
                                  <TableCell className={`${density === 'compact' ? 'px-2 py-1' : ''}`}>{(r.created_at || r.receipt?.created_at || '').split('T')[0]}</TableCell>
                                  <TableCell className={`${density === 'compact' ? 'px-2 py-1' : ''}`}>{r.service?.name || r.description}</TableCell>
                                  <TableCell className={`${density === 'compact' ? 'px-2 py-1' : ''}`}>{r.staff?.full_name || 'Unassigned'}</TableCell>
                                  <TableCell className="text-right">{qty}</TableCell>
                                  <TableCell className="text-right">${unit.toFixed(2)}</TableCell>
                                  <TableCell className="text-right">${gross.toFixed(2)}</TableCell>
                                  <TableCell className="text-right">{Number(rate).toFixed(2)}</TableCell>
                                  <TableCell className="text-right">${comm.toFixed(2)}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Product Usage Tab */}
            <TabsContent value="product_usage" className="space-y-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Product Usage History</CardTitle>
                    <p className="text-sm text-slate-600">Detailed movements from Purchases, Sales/Receipts, Inventory Adjustments and Service Kits</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="space-y-1">
                      <div className="text-xs text-slate-600">Start</div>
                      <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border rounded px-2 py-1" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-slate-600">End</div>
                      <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border rounded px-2 py-1" />
                    </div>
                    <Button variant="outline" onClick={refreshData} disabled={loading}>
                      <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ProductUsageHistory startDate={startDate} endDate={endDate} density={density} />
                </CardContent>
              </Card>
            </TabsContent>
          </main>
        </div>
      </Tabs>
    </div>
  );
};

export default Reports;

function groupBy<T, K extends string | number>(arr: T[], keyFn: (t: T) => K): Record<K, T[]> {
  return arr.reduce((acc: any, item) => {
    const k = keyFn(item);
    (acc[k] ||= []).push(item);
    return acc;
  }, {} as Record<K, T[]>);
}

function sum(arr: number[]) { return arr.reduce((a, b) => a + (Number(b) || 0), 0); }

const ProductUsageHistory: React.FC<{ startDate: string; endDate: string; density: 'compact' | 'comfortable'; }> = ({ startDate, endDate, density }) => {
  const [rows, setRows] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [productFilter, setProductFilter] = React.useState<string>('all');
  const [products, setProducts] = React.useState<Array<{ id: string; name: string }>>([]);

  React.useEffect(() => {
    const loadProducts = async () => {
      const { data } = await supabase.from('inventory_items').select('id, name').eq('type', 'good').order('name');
      setProducts(data || []);
    };
    loadProducts();
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      // Purchases
      const { data: purchaseItems } = await supabase
        .from('purchase_items')
        .select('id, created_at, quantity, unit_cost, item_id, purchases:purchase_id (purchase_number, purchase_date)')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      // Sales
      const { data: saleItems } = await supabase
        .from('sale_items')
        .select('id, created_at, quantity, unit_price, product_id, sales:sale_id (sale_number, sale_date)')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      // Receipt Items (alternative to Sales)
      let receiptItems: any[] = [];
      try {
        const { data: rItems } = await supabase
          .from('receipt_items')
          .select('id, created_at, quantity, unit_price, product_id, receipt:receipt_id (receipt_number, created_at)')
          .gte('created_at', startDate)
          .lte('created_at', endDate);
        receiptItems = rItems || [];
      } catch {
        receiptItems = [];
      }

      // Inventory Adjustments
      const { data: adjItems } = await supabase
        .from('inventory_adjustment_items')
        .select('id, created_at, quantity_adjusted, unit_cost, inventory_item_id, adjustment:adjustment_id (adjustment_number, adjustment_date, adjustment_type)')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      const normalize: any[] = [];
      (purchaseItems || []).forEach((pi: any) => normalize.push({
        date: pi.created_at,
        type: 'Purchase',
        reference: pi.purchases?.purchase_number || '',
        product_id: pi.item_id,
        quantity_in: Number(pi.quantity) || 0,
        quantity_out: 0,
        unit_price: Number(pi.unit_cost) || 0,
        total: (Number(pi.quantity) || 0) * (Number(pi.unit_cost) || 0),
      }));
      (saleItems || []).forEach((si: any) => normalize.push({
        date: si.created_at,
        type: 'Sale',
        reference: si.sales?.sale_number || '',
        product_id: si.product_id,
        quantity_in: 0,
        quantity_out: Number(si.quantity) || 0,
        unit_price: Number(si.unit_price) || 0,
        total: (Number(si.quantity) || 0) * (Number(si.unit_price) || 0),
      }));
      (receiptItems || []).forEach((ri: any) => normalize.push({
        date: ri.created_at,
        type: 'Receipt',
        reference: ri.receipt?.receipt_number || '',
        product_id: ri.product_id,
        quantity_in: 0,
        quantity_out: Number(ri.quantity) || 0,
        unit_price: Number(ri.unit_price) || 0,
        total: (Number(ri.quantity) || 0) * (Number(ri.unit_price) || 0),
      }));
      (adjItems || []).forEach((ai: any) => normalize.push({
        date: ai.created_at,
        type: `Adjustment (${ai.adjustment?.adjustment_type || ''})`,
        reference: ai.adjustment?.adjustment_number || '',
        product_id: ai.inventory_item_id,
        quantity_in: Math.max(0, Number(ai.quantity_adjusted) || 0),
        quantity_out: Math.max(0, -(Number(ai.quantity_adjusted) || 0)),
        unit_price: Number(ai.unit_cost) || 0,
        total: Math.abs((Number(ai.quantity_adjusted) || 0) * (Number(ai.unit_cost) || 0)),
      }));

      const filtered = productFilter === 'all' ? normalize : normalize.filter(r => r.product_id === productFilter);
      setRows(filtered.sort((a, b) => a.date.localeCompare(b.date)));
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, productFilter]);

  React.useEffect(() => { load(); }, [load]);

  const byProduct = groupBy(rows, r => r.product_id || 'unassigned');

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div className="w-72">
          <Label>Product</Label>
          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger><SelectValue placeholder="All products" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All products</SelectItem>
              {products.map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {Object.entries(byProduct).length === 0 ? (
        <div className="text-sm text-muted-foreground">No usage found for the selected filters.</div>
      ) : (
        Object.entries(byProduct).map(([productId, entries]) => (
          <Card key={productId}>
            <CardHeader>
              <CardTitle className="text-base">{products.find(p => p.id === productId)?.name || 'Unknown Product'}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table className={density === 'compact' ? 'text-xs' : ''}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Qty In</TableHead>
                    <TableHead className="text-right">Qty Out</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(entries as any[]).map((r) => (
                    <TableRow key={`${r.type}-${r.reference}-${r.date}-${r.product_id}`}>
                      <TableCell>{new Date(r.date).toLocaleString()}</TableCell>
                      <TableCell>{r.type}</TableCell>
                      <TableCell>{r.reference}</TableCell>
                      <TableCell className="text-right">{Number(r.quantity_in || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">{Number(r.quantity_out || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">{Number(r.unit_price || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">{Number(r.total || 0).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={3} className="font-semibold">Totals</TableCell>
                    <TableCell className="text-right font-semibold">{sum((entries as any[]).map(e => e.quantity_in)).toLocaleString()}</TableCell>
                    <TableCell className="text-right font-semibold">{sum((entries as any[]).map(e => e.quantity_out)).toLocaleString()}</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right font-semibold">{sum((entries as any[]).map(e => e.total)).toLocaleString()}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};
