import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent } from '@/components/ui/tabs';
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
  MapPin,
  Calculator,
  Receipt,
  ShoppingCart,
} from 'lucide-react';
import { useSaas } from '@/lib/saas';
import { supabase } from '@/integrations/supabase/client';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { mockDb } from '@/utils/mockDatabase';
import { useOrganization } from '@/lib/saas/hooks';
import { useOrganizationCurrency } from '@/lib/saas/hooks';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { LineChart as RLineChart, Line, XAxis, YAxis, CartesianGrid, PieChart as RPieChart, Pie, Cell } from 'recharts';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const Reports = () => {
  const navigate = useNavigate();
  const { organization, subscriptionPlan, organizationRole } = useSaas();
  const { organization: org } = useOrganization();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'overview';
  const initialSub = searchParams.get('sub');
  const [timeRange, setTimeRange] = useState('month');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [activeSubTab, setActiveSubTab] = useState<Record<string, string>>({ overview: 'summary', revenue: 'summary', clients: 'top', expenses: 'summary', purchases: 'summary', pnl: 'summary', balancesheet: 'summary', commissions: initialSub || 'summary', product_usage: 'history' });
  const [staffList, setStaffList] = useState<Array<{ id: string; full_name: string; commission_rate?: number | null }>>([]);
  const [commissionRows, setCommissionRows] = useState<Array<any>>([]);
  const [commissionSummary, setCommissionSummary] = useState<Record<string, { staffId: string; staffName: string; gross: number; commissionRate: number; commission: number }>>({});
  const [commissionStaffFilter, setCommissionStaffFilter] = useState<string>('all');
  const [pl, setPl] = useState<{ income: number; cogs: number; expenses: number; grossProfit: number; netProfit: number; breakdown?: { income: Record<string, number>; expense: Record<string, number> } }>({ income: 0, cogs: 0, expenses: 0, grossProfit: 0, netProfit: 0 });
  const [bs, setBs] = useState<{ assets: number; liabilities: number; equity: number; breakdown?: { assets: Record<string, number>; liabilities: Record<string, number>; equity: Record<string, number> } } >({ assets: 0, liabilities: 0, equity: 0 });
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return start.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [recalcLoading, setRecalcLoading] = useState(false);
  const [density, setDensity] = useState<'compact' | 'comfortable'>('comfortable');
  const [revenueSeries, setRevenueSeries] = useState<Array<{ label: string; current: number; previous: number }>>([]);
  const [serviceDistribution, setServiceDistribution] = useState<Array<{ name: string; value: number; fill?: string }>>([]);
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillTitle, setDrillTitle] = useState('');
  const [drillType, setDrillType] = useState<'Income' | 'Expense' | null>(null);
  const [drillRows, setDrillRows] = useState<Array<any>>([]);

  // Hard block access unless accountant or owner
  useEffect(() => {
    const role = organizationRole || '';
    if (role !== 'accountant' && role !== 'owner') {
      navigate('/dashboard');
    }
  }, [organizationRole]);

  const { symbol, format: formatMoney } = useOrganizationCurrency();

  // Load locations for current organization
  useEffect(() => {
    (async () => {
      if (!org?.id) return;
      try {
        const { data, error } = await supabase
          .from('business_locations')
          .select('id, name')
          .eq('organization_id', org.id)
          .eq('is_active', true)
          .order('name');
        if (error) throw error;
        setLocations(data || []);
      } catch (e: any) {
        console.error('Unexpected error loading locations', e);
        setLocations([]);
      }
    })();
  }, [org?.id]);

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
    if (locationFilter && locationFilter !== 'all') next.set('location', locationFilter); else next.delete('location');
    // Only update if changed to avoid loops
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, activeSubTab, locationFilter]);

  const openReferenceFromTxn = (row: any) => {
    const refType = String(row.reference_type || '').toLowerCase();
    const refId = row.reference_id;
    if (!refId) return;
    if (refType === 'receipt_payment' || refType === 'receipt' || refType === 'receipt_item' || refType === 'account_transfer') {
      navigate('/banking');
      return;
    }
    if (refType === 'purchase_payment') {
      navigate(`/purchases/${refId}`);
      return;
    }
    if (refType === 'expense' || refType === 'expense_payment') {
      navigate(`/expenses/${refId}/edit`);
      return;
    }
    navigate('/banking');
  };

  const openBreakdownDetails = useCallback(async (type: 'Income' | 'Expense', category: string) => {
    try {
      setDrillType(type);
      setDrillTitle(`${type} — ${category}`);
      const baseQuery = () =>
        supabase
          .from('account_transactions')
          .select('id, account_id, transaction_date, description, debit_amount, credit_amount, reference_type, reference_id, location_id, accounts:account_id (account_type, account_code, account_name, account_subtype)')
          .gte('transaction_date', startDate)
          .lte('transaction_date', endDate)
          .order('transaction_date', { ascending: true })
          .order('id', { ascending: true });

      let txnsQuery = baseQuery();
      if (locationFilter !== 'all') {
        txnsQuery = txnsQuery.eq('location_id', locationFilter);
      }
      let { data, error } = await txnsQuery;
      let rows = (data || []) as any[];

      // Fallback for schemas without account_subtype
      if (error) {
        const msg = String(error.message || '').toLowerCase();
        if (msg.includes('account_subtype') && msg.includes('does not exist')) {
          let fbQuery = supabase
            .from('account_transactions')
            .select('id, account_id, transaction_date, description, debit_amount, credit_amount, reference_type, reference_id, location_id, accounts:account_id (account_type, account_code, account_name)')
            .gte('transaction_date', startDate)
            .lte('transaction_date', endDate)
            .order('transaction_date', { ascending: true })
            .order('id', { ascending: true });
          if (locationFilter !== 'all') {
            fbQuery = fbQuery.eq('location_id', locationFilter);
          }
          const { data: fbData, error: fbError } = await fbQuery;
          if (fbError) throw fbError;
          rows = (fbData || []) as any[];
          error = null as any;
        } else {
          throw error;
        }
      }

      const filtered = rows.filter((t: any) => {
        const matchesType = t.accounts?.account_type === type;
        const subtype = (t.accounts as any)?.account_subtype;
        return matchesType && (subtype ? String(subtype) === category : category === type);
      });
      setDrillRows(filtered);
      setDrillOpen(true);
    } catch (e) {
      console.error('Failed to open breakdown details', e);
      setDrillRows([]);
      setDrillOpen(true);
    }
  }, [startDate, endDate, locationFilter]);

  const recalcFinancials = useCallback(async () => {
    setRecalcLoading(true);
    try {
      // Cash-basis: derive income from invoice_payments and expenses from expenses with status paid within date range
      const paymentsQuery = supabase
        .from('invoice_payments')
        .select('amount, payment_date, location_id')
        .gte('payment_date', startDate)
        .lte('payment_date', endDate);
      const expensesQuery = supabase
        .from('expenses')
        .select('amount, expense_date, category, location_id')
        .eq('status', 'paid')
        .gte('expense_date', startDate)
        .lte('expense_date', endDate);
      const txnsQuery = supabase
        .from('account_transactions')
        .select('account_id, transaction_date, debit_amount, credit_amount, description, location_id, accounts:account_id (account_type, account_code, account_subtype)')
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate);
      if (locationFilter !== 'all') {
        paymentsQuery.eq('location_id', locationFilter);
        expensesQuery.eq('location_id', locationFilter);
        txnsQuery.eq('location_id', locationFilter);
      }
      const [{ data: payments }, { data: paidExpenses }, { data: txns } ] = await Promise.all([
        paymentsQuery, expensesQuery, txnsQuery,
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

      // Balance Sheet snapshot using ledger by type within range: as of endDate
      const asOf = endDate;
      const withinRange = (t: any) => String(t.transaction_date) <= asOf;
      const sumByType = (type: string) => transactions
        .filter((t: any) => withinRange(t) && t.accounts?.account_type === type)
        .reduce((sum: number, t: any) => sum + (Number(t.debit_amount) || 0) - (Number(t.credit_amount) || 0), 0);
      const sumByTypeCreditMinusDebit = (type: string) => transactions
        .filter((t: any) => withinRange(t) && t.accounts?.account_type === type)
        .reduce((sum: number, t: any) => sum + (Number(t.credit_amount) || 0) - (Number(t.debit_amount) || 0), 0);

      const assets = sumByType('Asset');
      const liabilities = sumByTypeCreditMinusDebit('Liability');
      const equity = sumByTypeCreditMinusDebit('Equity');
      const assetsMap: Record<string, number> = {};
      const liabilitiesMap: Record<string, number> = {};
      const equityMap: Record<string, number> = {};
      for (const t of (transactions as any[]).filter(withinRange)) {
        const name = t.accounts?.account_name || '';
        const key = name || `Account ${t.account_id || '—'}`;
        if (t.accounts?.account_type === 'Asset') {
          assetsMap[key] = (assetsMap[key] || 0) + (Number(t.debit_amount) || 0) - (Number(t.credit_amount) || 0);
        } else if (t.accounts?.account_type === 'Liability') {
          liabilitiesMap[key] = (liabilitiesMap[key] || 0) + (Number(t.credit_amount) || 0) - (Number(t.debit_amount) || 0);
        } else if (t.accounts?.account_type === 'Equity') {
          equityMap[key] = (equityMap[key] || 0) + (Number(t.credit_amount) || 0) - (Number(t.debit_amount) || 0);
        }
      }
      setBs({ assets, liabilities, equity, breakdown: { assets: assetsMap, liabilities: liabilitiesMap, equity: equityMap } });
    } catch (e) {
      console.error('Error calculating financials', e);
    } finally {
      setRecalcLoading(false);
    }
  }, [startDate, endDate, locationFilter]);

  useEffect(() => {
    recalcFinancials();
  }, [recalcFinancials]);

  // Automatically update P&L when related transactions are deleted
  useEffect(() => {
    // Guard when Supabase stub is active or realtime is unavailable
    const supabaseAny = supabase as any;
    if (!supabaseAny || typeof supabaseAny.channel !== 'function') return;

    const channel = supabaseAny
      .channel('reports-pnl-realtime')
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'account_transactions' }, () => {
        recalcFinancials();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'expenses' }, () => {
        recalcFinancials();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'invoice_payments' }, () => {
        recalcFinancials();
      })
      .subscribe();

    return () => {
      try {
        supabaseAny.removeChannel(channel);
      } catch {
        // ignore
      }
    };
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
      // Step 1: find job cards in range
      let jobCardsInRange: any[] = [];
      try {
        let jcQuery = supabase
          .from('job_cards')
          .select('id, created_at, location_id')
          .gte('created_at', startDate)
          .lte('created_at', endDate);
        if (locationFilter !== 'all') jcQuery = jcQuery.eq('location_id', locationFilter);
        const { data, error } = await jcQuery;
        if (error) throw error;
        jobCardsInRange = data || [];
      } catch (err: any) {
        const msg = String(err?.message || '');
        const code = (err as any)?.code || '';
        const isMissingLocationCol = code === '42703' || /column\s+"?location_id"?\s+does not exist/i.test(msg) || (/schema cache/i.test(msg) && /job_cards/i.test(msg) && /location_id/i.test(msg));
        if (isMissingLocationCol) {
          const { data, error } = await supabase
            .from('job_cards')
            .select('id, created_at')
            .gte('created_at', startDate)
            .lte('created_at', endDate);
          if (error) throw error;
          jobCardsInRange = data || [];
        } else {
          throw err;
        }
      }
      const jobCardIds: string[] = (jobCardsInRange || []).map((r: any) => r.id);

      if (jobCardIds.length === 0) {
        setCommissionRows([]);
        setCommissionSummary({});
        return;
      }

      // Step 2: load job card services for those job cards (Services & Commissions)
      const { data: jcs, error: jcsErr } = await supabase
        .from('job_card_services')
        .select(`
          id, created_at, job_card_id, service_id, staff_id, quantity, unit_price, commission_percentage,
          services:service_id ( id, name, commission_percentage ),
          staff:staff_id ( id, full_name, commission_rate )
        `)
        .in('job_card_id', jobCardIds);
      if (jcsErr) throw jcsErr;

      const computeRate = (row: any) => {
        if (typeof row.commission_percentage === 'number' && !isNaN(row.commission_percentage)) return Number(row.commission_percentage);
        if (typeof row.services?.commission_percentage === 'number' && !isNaN(row.services.commission_percentage)) return Number(row.services.commission_percentage);
        if (typeof row.staff?.commission_rate === 'number' && !isNaN(row.staff.commission_rate)) return Number(row.staff.commission_rate);
        return 0;
      };

      const filtered = (jcs || []).map((r: any) => ({
        ...r,
        staff: Array.isArray(r.staff) ? r.staff[0] : r.staff,
        services: Array.isArray(r.services) ? r.services[0] : r.services,
      })).filter((r: any) => commissionStaffFilter === 'all' ? true : (r.staff?.id === commissionStaffFilter || r.staff_id === commissionStaffFilter));

      setCommissionRows(filtered.map((r: any) => {
        const qty = Number(r.quantity || 1);
        const unit = Number(r.unit_price || 0);
        const gross = qty * unit;
        const rate = computeRate(r);
        return {
          id: r.id,
          created_at: r.created_at,
          service: r.services,
          staff: r.staff,
          quantity: qty,
          unit_price: unit,
          gross_amount: gross,
          commission_rate: rate,
          commission_amount: Number(((gross * rate) / 100).toFixed(2)),
        };
      }));

      const summary: Record<string, { staffId: string; staffName: string; gross: number; commissionRate: number; commission: number }> = {};
      for (const r of filtered as any[]) {
        const staffId = r.staff?.id || r.staff_id || 'unassigned';
        const staffName = r.staff?.full_name || 'Unassigned';
        const qty = Number(r.quantity || 1);
        const unit = Number(r.unit_price || 0);
        const gross = qty * unit;
        const rate = computeRate(r);
        const commission = (gross * (Number(rate) || 0)) / 100;
        if (!summary[staffId]) summary[staffId] = { staffId, staffName, gross: 0, commissionRate: 0, commission: 0 };
        summary[staffId].gross += gross;
        // For display, keep last non-zero rate; this is a per-line rate in reality
        summary[staffId].commissionRate = Number(rate) || summary[staffId].commissionRate;
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
          .filter((it: any) => inRangeReceiptIds.includes(it.invoice_id || it.receipt_id));
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
   }, [activeTab, startDate, endDate, commissionStaffFilter, locationFilter]);

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
  const [topClients, setTopClients] = useState<Array<{ id: string; name: string; visits: number; totalSpent: number; lastVisit: string }>>([]);

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
      const invoicesNowQ = supabase.from('invoices')
        .select('id, total_amount, created_at, client_id, location_id')
        .gte('created_at', startDate)
        .lte('created_at', endDate);
      const invoicesPrevQ = supabase.from('invoices')
        .select('id, total_amount, created_at, client_id, location_id')
        .gte('created_at', toDateStr(prevStart))
        .lte('created_at', toDateStr(prevEnd));
      const apptsNowQ = supabase.from('appointments')
        .select('id, appointment_date, location_id')
        .gte('appointment_date', startDate)
        .lte('appointment_date', endDate);
      const apptsPrevQ = supabase.from('appointments')
        .select('id, appointment_date, location_id')
        .gte('appointment_date', toDateStr(prevStart))
        .lte('appointment_date', toDateStr(prevEnd));
      const clientsNowQ = supabase.from('clients')
        .select('id, created_at')
        .gte('created_at', startDate)
        .lte('created_at', endDate);
      const clientsPrevQ = supabase.from('clients')
        .select('id, created_at')
        .gte('created_at', toDateStr(prevStart))
        .lte('created_at', toDateStr(prevEnd));
      const svcItemsNowQ = supabase.from('invoice_items')
        .select('id, created_at, quantity, unit_price, total_price, service_id, location_id')
        .not('service_id', 'is', null)
        .gte('created_at', startDate)
        .lte('created_at', endDate);
      const svcItemsPrevQ = supabase.from('invoice_items')
        .select('id, created_at, quantity, unit_price, total_price, service_id, location_id')
        .not('service_id', 'is', null)
        .gte('created_at', toDateStr(prevStart))
        .lte('created_at', toDateStr(prevEnd));
      if (locationFilter !== 'all') {
        invoicesNowQ.eq('location_id', locationFilter);
        invoicesPrevQ.eq('location_id', locationFilter);
        apptsNowQ.eq('location_id', locationFilter);
        apptsPrevQ.eq('location_id', locationFilter);
        svcItemsNowQ.eq('location_id', locationFilter);
        svcItemsPrevQ.eq('location_id', locationFilter);
      }
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
        invoicesNowQ, invoicesPrevQ, apptsNowQ, apptsPrevQ, clientsNowQ, clientsPrevQ, svcItemsNowQ, svcItemsPrevQ,
      ]);

      let receiptsNow = (receiptsNowRes as any)?.data || [];
      let receiptsPrev = (receiptsPrevRes as any)?.data || [];
      let apptsNow = apptsNowRes.data || [];
      let apptsPrev = apptsPrevRes.data || [];
      let clientsNow = clientsNowRes.data || [];
      let clientsPrev = clientsPrevRes.data || [];
      let svcItemsNow = svcItemsNowRes.data || [];
      let svcItemsPrev = svcItemsPrevRes.data || [];

      // Fallback to mock storage when Supabase client is stubbed or returned null data
      const supaIsStub = !(supabase as any)?.auth?.getSession || (receiptsNowRes as any)?.error || (receiptsPrevRes as any)?.error;
      if (supaIsStub) {
        try {
          const storage = await mockDb.getStore();
          const inNow = (storage.receipts || []).filter((r: any) => r.created_at?.slice(0,10) >= startDate && r.created_at?.slice(0,10) <= endDate);
          const inPrev = (storage.receipts || []).filter((r: any) => r.created_at?.slice(0,10) >= toDateStr(prevStart) && r.created_at?.slice(0,10) <= toDateStr(prevEnd));
          receiptsNow = inNow;
          receiptsPrev = inPrev;
          svcItemsNow = (storage.receipt_items || []).filter((it: any) => it.created_at?.slice(0,10) >= startDate && it.created_at?.slice(0,10) <= endDate && it.service_id);
          svcItemsPrev = (storage.receipt_items || []).filter((it: any) => it.created_at?.slice(0,10) >= toDateStr(prevStart) && it.created_at?.slice(0,10) <= toDateStr(prevEnd) && it.service_id);
          // Approximate appointments and clients from storage if tables are unavailable
          apptsNow = [];
          apptsPrev = [];
          clientsNow = (storage.clients || []).filter((c: any) => c.created_at?.slice(0,10) >= startDate && c.created_at?.slice(0,10) <= endDate);
          clientsPrev = (storage.clients || []).filter((c: any) => c.created_at?.slice(0,10) >= toDateStr(prevStart) && c.created_at?.slice(0,10) <= toDateStr(prevEnd));
        } catch {}
      }

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
      const serviceNames: Record<string, string> = {};
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

      // Build service distribution for pie chart
      const COLORS = ['#4f46e5', '#06b6d4', '#f59e0b', '#10b981', '#ef4444'];
      setServiceDistribution(
        topSvc.map((s, i) => ({ name: s.name, value: s.revenue, fill: COLORS[i % COLORS.length] }))
      );

      // Revenue series for current vs previous period aligned by day index
      const dateKey = (d: Date) => d.toISOString().slice(0, 10);
      const nowMap: Record<string, number> = {};
      for (const r of receiptsNow as any[]) {
        const d = (r.created_at || '').slice(0, 10);
        nowMap[d] = (nowMap[d] || 0) + (Number(r.total_amount) || 0);
      }
      const prevMap: Record<string, number> = {};
      for (const r of receiptsPrev as any[]) {
        const d = (r.created_at || '').slice(0, 10);
        prevMap[d] = (prevMap[d] || 0) + (Number(r.total_amount) || 0);
      }
      const points: Array<{ label: string; current: number; previous: number }> = [];
      for (let i = 0; i < periodDays; i++) {
        const cur = new Date(start.getTime() + i * dayMs);
        const prv = new Date(prevStart.getTime() + i * dayMs);
        points.push({
          label: toDateStr(cur).slice(5),
          current: Math.round(nowMap[dateKey(cur)] || 0),
          previous: Math.round(prevMap[dateKey(prv)] || 0),
        });
      }
      setRevenueSeries(points);

      // Top clients by visits/spend
      const byClient: Record<string, { visits: number; spent: number; last: string }> = {};
      for (const r of receiptsNow as any[]) {
        const id = (r.client_id || r.customer_id) as string;
        if (!id) continue;
        if (!byClient[id]) byClient[id] = { visits: 0, spent: 0, last: r.created_at };
        byClient[id].visits += 1;
        byClient[id].spent += Number(r.total_amount) || 0;
        byClient[id].last = (byClient[id].last || '') < r.created_at ? r.created_at : byClient[id].last;
      }
      const clientIds = Object.keys(byClient);
      const clientNames: Record<string, string> = {};
      if (clientIds.length > 0) {
        const { data: clients } = await supabase.from('clients').select('id, full_name').in('id', clientIds);
        (clients || []).forEach((c: any) => { clientNames[c.id] = c.full_name; });
      }
      setTopClients(clientIds.map(id => ({
        id,
        name: clientNames[id] || 'Client',
        visits: byClient[id].visits,
        totalSpent: Math.round(byClient[id].spent),
        lastVisit: (byClient[id].last || '').slice(0,10),
      })).sort((a,b) => b.totalSpent - a.totalSpent).slice(0,5));

    } catch (e) {
      console.error('Overview load error', e);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, locationFilter]);

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

  // Trial Balance state
  const [tbRows, setTbRows] = useState<Array<{ accountId: string; code: string; name: string; category: string; debit: number; credit: number; balance: number }>>([]);
  const [tbSearch, setTbSearch] = useState('');
  const [tbLoading, setTbLoading] = useState(false);
  const baseUrl = (import.meta.env.VITE_SERVER_URL || "/api").replace(/\/$/, "");

  useEffect(() => {
    if (activeTab !== 'trialbalance') return;
    (async () => {
      try {
        setTbLoading(true);
        const params = new URLSearchParams();
        if (startDate) params.set('start', startDate);
        if (endDate) params.set('end', endDate);
        if (locationFilter && locationFilter !== 'all') params.set('locationId', locationFilter);
        const resp = await fetch(`${baseUrl}/reports/trial-balance?${params.toString()}`, {
          headers: (() => { const t = localStorage.getItem('jwt_token'); return t ? { Authorization: `Bearer ${t}` } : {}; })(),
        });
        const js = await resp.json();
        setTbRows(Array.isArray(js.rows) ? js.rows : []);
      } catch (e) {
        console.error('Failed to load trial balance', e);
        setTbRows([]);
      } finally {
        setTbLoading(false);
      }
    })();
  }, [activeTab, startDate, endDate, locationFilter]);

  // Revenue by location state
  const [revenueByLocation, setRevenueByLocation] = useState<Array<{ locationId: string | null; locationName: string; revenue: number }>>([]);
  const [revenueByLocationLoading, setRevenueByLocationLoading] = useState(false);

  useEffect(() => {
    // Load revenue by location when revenue tab active or filters change
    if (activeTab !== 'revenue') return;
    const load = async () => {
      try {
        setRevenueByLocationLoading(true);
        const baseUrl = (window as any).__API_BASE_URL__ || '/api';
        const params = new URLSearchParams();
        if (startDate) params.set('start', startDate);
        if (endDate) params.set('end', endDate);
        if (locationFilter && locationFilter !== 'all') params.set('locationId', locationFilter);
        const token = localStorage.getItem('jwt_token') || '';
        const resp = await fetch(`${baseUrl}/reports/revenue-by-location?${params.toString()}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const js = await resp.json();
        if (Array.isArray(js.rows)) {
          setRevenueByLocation(js.rows);
          return;
        }
        throw new Error('Invalid response');
      } catch (e) {
        // Fallback: compute from invoice_items
        try {
          let q = supabase
            .from('invoice_items')
            .select('id, location_id, created_at, quantity, unit_price, total_price')
            .gte('created_at', startDate)
            .lte('created_at', endDate);
          if (locationFilter && locationFilter !== 'all') q = q.eq('location_id', locationFilter);
          const { data: items } = await q;
          const map = new Map<string, { locationId: string | null; locationName: string; revenue: number }>();
          for (const it of (items || []) as any[]) {
            const locId = it.location_id || 'unassigned';
            const cur = map.get(locId) || { locationId: it.location_id || null, locationName: 'Unassigned', revenue: 0 };
            const line = Number(it.total_price) || (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
            cur.revenue += line;
            map.set(locId, cur);
          }
          // Resolve names
          const locIds = Array.from(map.keys()).filter((k) => k !== 'unassigned');
          if (locIds.length > 0) {
            try {
              const { data: locs } = await supabase.from('business_locations').select('id, name').in('id', locIds);
              const names = new Map((locs || []).map((l: any) => [l.id, l.name]));
              for (const [k, v] of map.entries()) {
                if (k !== 'unassigned') v.locationName = names.get(k) as string || v.locationName;
              }
            } catch {}
          }
          const rows = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
          setRevenueByLocation(rows);
        } catch (e2) {
          // Final fallback: compute from mock storage if available
          try {
            const storage = await mockDb.getStore();
            const items = (storage.receipt_items || []) as any[];
            const map = new Map<string, { locationId: string | null; locationName: string; revenue: number }>();
            for (const it of items) {
              const d = String(it.created_at || '').slice(0, 10);
              if ((startDate && d < startDate) || (endDate && d > endDate)) continue;
              const locId = it.location_id || 'unassigned';
              const cur = map.get(locId) || { locationId: it.location_id || null, locationName: locId === 'unassigned' ? 'Unassigned' : 'Location', revenue: 0 };
              const line = Number(it.total_price) || (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
              cur.revenue += line;
              map.set(locId, cur);
            }
            const rows = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
            setRevenueByLocation(rows);
          } catch (e3) {
            console.error('Failed to load revenue by location (fallback)', e3);
            setRevenueByLocation([]);
          }
        }
      } finally {
        setRevenueByLocationLoading(false);
      }
    };
    load();
  }, [activeTab, startDate, endDate, locationFilter]);

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
            <div className="space-y-1">
              <div className="text-xs text-slate-600">Location</div>
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="All locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All locations</SelectItem>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        {/* Mobile tab selector */}

        <div className="grid grid-cols-1 gap-6">


          <main className="space-y-6">
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
                    <div className="text-2xl font-bold">{formatMoney(overview.revenue.current, { decimals: 0 })}</div>
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
                    <div className="h-64">
                      <ChartContainer
                        config={{
                          current: { label: 'Current', color: '#2563eb' },
                          previous: { label: 'Previous', color: '#94a3b8' },
                        }}
                        className="h-64"
                      >
                        <RLineChart data={revenueSeries} margin={{ left: 12, right: 12, top: 12, bottom: 12 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="label" tickLine={false} axisLine={false} />
                          <YAxis tickLine={false} axisLine={false} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <ChartLegend content={<ChartLegendContent />} />
                          <Line type="monotone" dataKey="current" stroke="var(--color-current)" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="previous" stroke="var(--color-previous)" strokeDasharray="4 4" strokeWidth={2} dot={false} />
                        </RLineChart>
                      </ChartContainer>
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
                    <div className="h-64">
                      <ChartContainer config={{}} className="h-64">
                        <RPieChart>
                          <Pie
                            data={serviceDistribution}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={4}
                          >
                            {serviceDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill || '#94a3b8'} />
                            ))}
                          </Pie>
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <ChartLegend content={<ChartLegendContent />} />
                        </RPieChart>
                      </ChartContainer>
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
                        <div className="text-2xl font-bold text-green-600">{formatMoney(overview.revenue.current, { decimals: 0 })}</div>
                        <div className="text-sm text-green-700">Total Revenue</div>
                      </div>
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">{formatMoney(overview.appointments.current ? (overview.revenue.current / overview.appointments.current) : 0, { decimals: 0 })}</div>
                        <div className="text-sm text-blue-700">Average per Appointment</div>
                      </div>
                      <div className="text-center p-4 bg-purple-50 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">{formatMoney(overview.clients.current ? (overview.revenue.current / overview.clients.current) : 0, { decimals: 0 })}</div>
                        <div className="text-sm text-purple-700">Average per Client</div>
                      </div>
                    </div>

                    <div className="mt-6">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-semibold">Revenue by Location</div>
                        <Button variant="outline" size="sm" onClick={() => setActiveTab('revenue')} disabled={revenueByLocationLoading}>
                          <RefreshCw className={`w-4 h-4 mr-2 ${revenueByLocationLoading ? 'animate-spin' : ''}`} /> Refresh
                        </Button>
                      </div>
                      <div className="border rounded-md overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Location</TableHead>
                              <TableHead className="text-right">Revenue</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {revenueByLocation.map((r, idx) => (
                              <TableRow key={idx}>
                                <TableCell>{r.locationName}</TableCell>
                                <TableCell className="text-right">{formatMoney(r.revenue, { decimals: 2 })}</TableCell>
                              </TableRow>
                            ))}
                            {revenueByLocation.length === 0 && (
                              <TableRow>
                                <TableCell colSpan={2} className="text-center text-slate-500">No data</TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Suggested Reports */}
            <TabsContent value="suggested" className="space-y-6">
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle>Suggested Reports</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="p-4 border rounded-md hover:bg-slate-50 cursor-pointer" onClick={() => setActiveTab('pnl')}>
                      <div className="font-semibold flex items-center gap-2"><DollarSign className="w-4 h-4" /> Profit & Loss</div>
                      <div className="text-sm text-slate-500">Income, COGS and Expenses for the selected period</div>
                    </div>
                    <div className="p-4 border rounded-md hover:bg-slate-50 cursor-pointer" onClick={() => setActiveTab('balancesheet')}>
                      <div className="font-semibold flex items-center gap-2"><PieChart className="w-4 h-4" /> Balance Sheet</div>
                      <div className="text-sm text-slate-500">Assets, Liabilities and Equity as of end date</div>
                    </div>
                    <div className="p-4 border rounded-md hover:bg-slate-50 cursor-pointer" onClick={() => setActiveTab('trialbalance')}>
                      <div className="font-semibold flex items-center gap-2"><Calculator className="w-4 h-4" /> Trial Balance</div>
                      <div className="text-sm text-slate-500">Debits and Credits by account for the period</div>
                    </div>
                    <div className="p-4 border rounded-md hover:bg-slate-50 cursor-pointer" onClick={() => setActiveTab('commissions')}>
                      <div className="font-semibold flex items-center gap-2"><Activity className="w-4 h-4" /> Staff Commissions</div>
                      <div className="text-sm text-slate-500">Commission summary by staff for the period</div>
                    </div>
                    <div className="p-4 border rounded-md hover:bg-slate-50 cursor-pointer" onClick={() => setActiveTab('expenses')}>
                      <div className="font-semibold flex items-center gap-2"><Receipt className="w-4 h-4" /> Expenses</div>
                      <div className="text-sm text-slate-500">Track expenses by category and date</div>
                    </div>
                    <div className="p-4 border rounded-md hover:bg-slate-50 cursor-pointer" onClick={() => setActiveTab('purchases')}>
                      <div className="font-semibold flex items-center gap-2"><ShoppingCart className="w-4 h-4" /> Purchases</div>
                      <div className="text-sm text-slate-500">Monitor purchases and received goods</div>
                    </div>
                    <div className="p-4 border rounded-md hover:bg-slate-50 cursor-pointer" onClick={() => setActiveTab('clients')}>
                      <div className="font-semibold flex items-center gap-2"><Users className="w-4 h-4" /> Top Clients</div>
                      <div className="text-sm text-slate-500">Most valuable clients by spend</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Expenses Tab */}
            <TabsContent value="expenses" className="space-y-6">
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle>Expenses</CardTitle>
                </CardHeader>
                <CardContent>
                  <ExpenseReport startDate={startDate} endDate={endDate} locationId={locationFilter} formatMoney={formatMoney} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Purchases Tab */}
            <TabsContent value="purchases" className="space-y-6">
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle>Purchases</CardTitle>
                </CardHeader>
                <CardContent>
                  <PurchasesReport startDate={startDate} endDate={endDate} locationId={locationFilter} formatMoney={formatMoney} />
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
                      <div key={index} className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/clients/${client.id}`)} title={`View client: ${client.name}`}>
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
                          <div className="font-medium">{formatMoney(client.totalSpent, { decimals: 0 })}</div>
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
                      <div className="text-2xl font-bold text-green-700">{formatMoney(pl.income, { decimals: 2 })}</div>
                      <div className="text-sm text-green-700">Income (Cash-basis)</div>
                    </div>
                    <div className="text-center p-4 bg-amber-50 rounded-lg">
                      <div className="text-2xl font-bold text-amber-700">{formatMoney(pl.cogs, { decimals: 2 })}</div>
                      <div className="text-sm text-amber-700">Cost of Goods Sold</div>
                    </div>
                    <div className="text-center p-4 bg-red-50 rounded-lg">
                      <div className="text-2xl font-bold text-red-700">{formatMoney(pl.expenses, { decimals: 2 })}</div>
                      <div className="text-sm text-red-700">Expenses (Cash-basis)</div>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-700">{formatMoney(pl.grossProfit, { decimals: 2 })}</div>
                      <div className="text-sm text-blue-700">Gross Profit</div>
                    </div>
                  </div>
                  <div className="mt-6 text-center p-4 bg-indigo-50 rounded-lg">
                    <div className="text-3xl font-bold text-indigo-700">{formatMoney(pl.netProfit, { decimals: 2 })}</div>
                    <div className="text-sm text-indigo-700">Net Profit</div>
                  </div>
                  {pl.breakdown && (
                    <div className="grid gap-6 md:grid-cols-2 mt-6">
                      <div>
                        <div className="font-semibold mb-2">Income Breakdown</div>
                        <Table>
                          <TableHeader><TableRow><TableHead>Category</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {Object.entries(pl.breakdown.income).map(([k,v]) => (
                              <TableRow key={k} className="cursor-pointer hover:bg-slate-50" onClick={() => openBreakdownDetails('Income', k)} title={`View transactions for ${k}`}><TableCell>{k}</TableCell><TableCell className="text-right">{formatMoney(Number(v), { decimals: 2 })}</TableCell></TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <div>
                        <div className="font-semibold mb-2">Expense Breakdown</div>
                        <Table>
                          <TableHeader><TableRow><TableHead>Category</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {Object.entries(pl.breakdown.expense).map(([k,v]) => (
                              <TableRow key={k} className="cursor-pointer hover:bg-slate-50" onClick={() => openBreakdownDetails('Expense', k)} title={`View transactions for ${k}`}><TableCell>{k}</TableCell><TableCell className="text-right">{formatMoney(Number(v), { decimals: 2 })}</TableCell></TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Dialog open={drillOpen} onOpenChange={setDrillOpen}>
                <DialogContent className="max-w-3xl">
                  <DialogHeader>
                    <DialogTitle>{drillTitle || 'Details'}</DialogTitle>
                  </DialogHeader>
                  <div className="text-sm text-slate-600 mb-3">Period {startDate} to {endDate}{locationFilter !== 'all' ? ` • Filtered by location` : ''}</div>
                  <div className="overflow-x-auto">
                    <Table className="min-w-[900px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Account</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Debit</TableHead>
                          <TableHead className="text-right">Credit</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Ref</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {drillRows.length === 0 ? (
                          <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground">No transactions</TableCell></TableRow>
                        ) : (
                          drillRows.map((r: any) => {
                            const debit = Number(r.debit_amount || 0);
                            const credit = Number(r.credit_amount || 0);
                            const amt = drillType === 'Income' ? (credit - debit) : (debit - credit);
                            return (
                              <TableRow key={r.id} onClick={() => openReferenceFromTxn(r)} className={r.reference_id ? 'cursor-pointer hover:bg-slate-50' : ''} title={r.reference_id ? `Open ${(r.reference_type || '').toString()} ${r.reference_id || ''}` : undefined}>
                                <TableCell>{String(r.transaction_date || '').slice(0,10)}</TableCell>
                                <TableCell>{r.accounts?.account_code ? `${r.accounts.account_code} · ${r.accounts?.account_name || ''}` : (r.accounts?.account_name || '—')}</TableCell>
                                <TableCell>{(r as any)?.accounts?.account_subtype || (r as any)?.accounts?.account_type || '—'}</TableCell>
                                <TableCell className="max-w-[380px] truncate" title={r.description || ''}>{r.description || '—'}</TableCell>
                                <TableCell className="text-right">{formatMoney(debit, { decimals: 2 })}</TableCell>
                                <TableCell className="text-right">{formatMoney(credit, { decimals: 2 })}</TableCell>
                                <TableCell className="text-right font-medium">{formatMoney(amt, { decimals: 2 })}</TableCell>
                                <TableCell className="text-xs text-slate-500">{r.reference_type || '—'}{r.reference_id ? ` #${r.reference_id}` : ''}</TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </DialogContent>
              </Dialog>
            </TabsContent>

            <TabsContent value="balancesheet" className="space-y-6">
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle>Balance Sheet</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="text-center p-4 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100" onClick={() => navigate(`/accounts?q=${encodeURIComponent('Asset')}`)} title="Open Asset accounts">
                      <div className="text-2xl font-bold text-slate-700">{formatMoney(bs.assets, { decimals: 2 })}</div>
                      <div className="text-sm text-slate-700">Assets</div>
                    </div>
                    <div className="text-center p-4 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100" onClick={() => navigate(`/accounts?q=${encodeURIComponent('Liability')}`)} title="Open Liability accounts">
                      <div className="text-2xl font-bold text-slate-700">{formatMoney(bs.liabilities, { decimals: 2 })}</div>
                      <div className="text-sm text-slate-700">Liabilities</div>
                    </div>
                    <div className="text-center p-4 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100" onClick={() => navigate(`/accounts?q=${encodeURIComponent('Equity')}`)} title="Open Equity accounts">
                      <div className="text-2xl font-bold text-slate-700">{formatMoney(bs.equity, { decimals: 2 })}</div>
                      <div className="text-sm text-slate-700">Equity</div>
                    </div>
                  </div>
                  <div className="mt-6 text-center text-sm text-slate-600">
                    {`Check: Assets (${formatMoney(bs.assets, { decimals: 2 })}) = Liabilities (${formatMoney(bs.liabilities, { decimals: 2 })}) + Equity (${formatMoney(bs.equity, { decimals: 2 })})`}
                  </div>
                  {bs.breakdown && (
                    <div className="grid gap-6 md:grid-cols-3 mt-6">
                      <div>
                        <div className="font-semibold mb-2">Assets</div>
                        <Table>
                          <TableHeader><TableRow><TableHead>Account</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {Object.entries(bs.breakdown.assets).map(([k,v]) => (
                              <TableRow key={k}><TableCell>{k}</TableCell><TableCell className="text-right">{formatMoney(Number(v), { decimals: 2 })}</TableCell></TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <div>
                        <div className="font-semibold mb-2">Liabilities</div>
                        <Table>
                          <TableHeader><TableRow><TableHead>Account</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {Object.entries(bs.breakdown.liabilities).map(([k,v]) => (
                              <TableRow key={k}><TableCell>{k}</TableCell><TableCell className="text-right">{formatMoney(Number(v), { decimals: 2 })}</TableCell></TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <div>
                        <div className="font-semibold mb-2">Equity</div>
                        <Table>
                          <TableHeader><TableRow><TableHead>Account</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {Object.entries(bs.breakdown.equity).map(([k,v]) => (
                              <TableRow key={k}><TableCell>{k}</TableCell><TableCell className="text-right">{formatMoney(Number(v), { decimals: 2 })}</TableCell></TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Trial Balance Tab */}
            <TabsContent value="trialbalance" className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-xl shadow-lg">
                    <Calculator className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Trial Balance</h2>
                    <p className="text-slate-600 text-sm">Debits and credits by account</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Input placeholder="Search code, name, category" value={tbSearch} onChange={(e) => setTbSearch(e.target.value)} className="w-64" />
                  <Button variant="outline" onClick={() => setActiveTab('trialbalance')} disabled={tbLoading}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${tbLoading ? 'animate-spin' : ''}`} /> Refresh
                  </Button>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>As of Selected Period</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table className="min-w-[900px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tbRows
                        .filter((r) => {
                          const q = tbSearch.toLowerCase();
                          return (
                            r.code.toLowerCase().includes(q) ||
                            r.name.toLowerCase().includes(q) ||
                            String(r.category).toLowerCase().includes(q)
                          );
                        })
                        .map((r) => (
                          <TableRow key={r.accountId}>
                            <TableCell className="font-medium">{r.code}</TableCell>
                            <TableCell>{r.name}</TableCell>
                            <TableCell>{r.category}</TableCell>
                            <TableCell className="text-right">{Number(r.debit || 0).toLocaleString()}</TableCell>
                            <TableCell className="text-right">{Number(r.credit || 0).toLocaleString()}</TableCell>
                            <TableCell className="text-right font-medium">{Number(r.balance || 0).toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      {tbRows.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">No rows</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
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
                    <div>
                      <Label>Location</Label>
                      <Select value={locationFilter} onValueChange={setLocationFilter}>
                        <SelectTrigger><SelectValue placeholder="All locations" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All locations</SelectItem>
                          {locations.map((l) => (
                            <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                                <TableCell className="text-right">{formatMoney(row.gross, { decimals: 2 })}</TableCell>
                                <TableCell className="text-right">{row.commissionRate.toFixed(2)}</TableCell>
                                <TableCell className="text-right">{formatMoney(row.commission, { decimals: 2 })}</TableCell>
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
                              const rate = Number(r.commission_rate ?? r.service?.commission_percentage ?? 0);
                              const comm = gross * (Number(rate) || 0) / 100;
                              return (
                                                                 <TableRow key={r.id} className="cursor-pointer hover:bg-slate-50"  title={r.invoice?.id ? `Open invoice ${r.invoice.id}` : undefined}>
                                  <TableCell className={`${density === 'compact' ? 'px-2 py-1' : ''}`}>{(r.created_at || r.invoice?.created_at || '').split('T')[0]}</TableCell>
                                  <TableCell className={`${density === 'compact' ? 'px-2 py-1' : ''}`}>{r.service?.name || r.description}</TableCell>
                                  <TableCell className={`${density === 'compact' ? 'px-2 py-1' : ''}`}>{r.staff?.full_name || 'Unassigned'}</TableCell>
                                  <TableCell className="text-right">{qty}</TableCell>
                                  <TableCell className="text-right">{formatMoney(unit, { decimals: 2 })}</TableCell>
                                  <TableCell className="text-right">{formatMoney(gross, { decimals: 2 })}</TableCell>
                                  <TableCell className="text-right">{Number(rate).toFixed(2)}</TableCell>
                                  <TableCell className="text-right">{formatMoney(comm, { decimals: 2 })}</TableCell>
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
                    <p className="text-sm text-slate-600">Detailed movements from Purchases, Sales, Inventory Adjustments and Service Kits</p>
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
                    <div className="space-y-1">
                      <div className="text-xs text-slate-600">Location</div>
                      <Select value={locationFilter} onValueChange={setLocationFilter}>
                        <SelectTrigger className="w-40"><SelectValue placeholder="All locations" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All locations</SelectItem>
                          {locations.map((l) => (
                            <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button variant="outline" onClick={refreshData} disabled={loading}>
                      <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ProductUsageHistory startDate={startDate} endDate={endDate} density={density} locationId={locationFilter} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Warehouses Tab */}
            <TabsContent value="warehouses" className="lg:col-span-9 xl:col-span-10">
              <Card>
                <CardHeader>
                  <CardTitle>Warehouse Stock Report</CardTitle>
                </CardHeader>
                <CardContent>
                  <WarehouseReport />
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
const ExpenseReport: React.FC<{ startDate: string; endDate: string; locationId: string; formatMoney: (n: number, opts?: any) => string }>
  = ({ startDate, endDate, locationId, formatMoney }) => {
  const [rows, setRows] = React.useState<Array<{ date: string; category: string | null; amount: number; location_id: string | null }>>([]);
  const [byCategory, setByCategory] = React.useState<Record<string, number>>({});
  const [loading, setLoading] = React.useState(false);
  React.useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        let q = supabase
          .from('expenses')
          .select('expense_date, amount, category, location_id, status')
          .gte('expense_date', startDate)
          .lte('expense_date', endDate);
        if (locationId !== 'all') q = q.eq('location_id', locationId);
        const { data } = await q;
        const paid = (data || []).filter((e: any) => (e.status ? String(e.status).toLowerCase() === 'paid' : true));
        const mapped = paid.map((r: any) => ({ date: String(r.expense_date || '').slice(0,10), category: r.category || 'Uncategorized', amount: Number(r.amount || 0), location_id: r.location_id || null }));
        setRows(mapped);
        const cat: Record<string, number> = {};
        for (const r of mapped) cat[r.category || 'Uncategorized'] = (cat[r.category || 'Uncategorized'] || 0) + r.amount;
        setByCategory(cat);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [startDate, endDate, locationId]);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="text-center p-4 bg-red-50 rounded-lg">
          <div className="text-2xl font-bold text-red-700">{formatMoney(total, { decimals: 2 })}</div>
          <div className="text-sm text-red-700">Total Expenses</div>
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <div className="font-semibold mb-2">By Category</div>
          <Table>
            <TableHeader><TableRow><TableHead>Category</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
            <TableBody>
              {Object.entries(byCategory).sort((a,b)=>b[1]-a[1]).map(([k,v]) => (
                <TableRow key={k}><TableCell>{k}</TableCell><TableCell className="text-right">{formatMoney(v, { decimals: 2 })}</TableCell></TableRow>
              ))}
              {Object.keys(byCategory).length === 0 && (<TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No data</TableCell></TableRow>)}
            </TableBody>
          </Table>
        </div>
        <div>
          <div className="font-semibold mb-2">Detailed</div>
          <div className="overflow-x-auto">
            <Table className="min-w-[720px]">
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.map((r, idx) => (
                  <TableRow key={idx}><TableCell>{r.date}</TableCell><TableCell>{r.category}</TableCell><TableCell className="text-right">{formatMoney(r.amount, { decimals: 2 })}</TableCell></TableRow>
                ))}
                {rows.length === 0 && (<TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No expenses</TableCell></TableRow>)}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
};

const PurchasesReport: React.FC<{ startDate: string; endDate: string; locationId: string; formatMoney: (n: number, opts?: any) => string }>
  = ({ startDate, endDate, locationId, formatMoney }) => {
  const [rows, setRows] = React.useState<Array<{ date: string; item_id: string; qty: number; unit_cost: number }>>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  React.useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // Prefer goods_received joined to purchase_items for accurate received qty
        let q = supabase
          .from('goods_received_items')
          .select('id, quantity, created_at, goods_received:goods_received_id (location_id), purchase_items:purchase_item_id (item_id, unit_cost)')
          .gte('created_at', startDate)
          .lte('created_at', endDate);
        if (locationId !== 'all') q = q.eq('goods_received.location_id', locationId as any);
        const { data, error } = await q;
        let mapped: any[] = [];
        if (!error) {
          mapped = (data || []).map((r: any) => ({ date: String(r.created_at || '').slice(0,10), item_id: r.purchase_items?.item_id, qty: Number(r.quantity || 0), unit_cost: Number(r.purchase_items?.unit_cost || 0) }));
        } else {
          // Fallback to purchase_items
          const { data: pi } = await supabase
            .from('purchase_items')
            .select('id, created_at, quantity, unit_cost, item_id')
            .gte('created_at', startDate)
            .lte('created_at', endDate);
          mapped = (pi || []).map((r: any) => ({ date: String(r.created_at || '').slice(0,10), item_id: r.item_id, qty: Number(r.quantity || 0), unit_cost: Number(r.unit_cost || 0) }));
        }
        setRows(mapped);
        setTotal(mapped.reduce((s, r) => s + r.qty * r.unit_cost, 0));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [startDate, endDate, locationId]);
  return (
    <div className="space-y-4">
      <div className="text-center p-4 bg-emerald-50 rounded-lg">
        <div className="text-2xl font-bold text-emerald-700">{formatMoney(total, { decimals: 2 })}</div>
        <div className="text-sm text-emerald-700">Total Purchases (received)</div>
      </div>
      <div className="overflow-x-auto">
        <Table className="min-w-[720px]">
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Item</TableHead><TableHead className="text-right">Quantity</TableHead><TableHead className="text-right">Unit Cost</TableHead><TableHead className="text-right">Line Total</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((r, idx) => (
              <TableRow key={idx}>
                <TableCell>{r.date}</TableCell>
                <TableCell>{r.item_id}</TableCell>
                <TableCell className="text-right">{r.qty}</TableCell>
                <TableCell className="text-right">{formatMoney(r.unit_cost, { decimals: 2 })}</TableCell>
                <TableCell className="text-right">{formatMoney(r.qty * r.unit_cost, { decimals: 2 })}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (<TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No purchases</TableCell></TableRow>)}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};


const ProductUsageHistory: React.FC<{ startDate: string; endDate: string; density: 'compact' | 'comfortable'; locationId?: string | 'all'; }> = ({ startDate, endDate, density, locationId = 'all' }) => {
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
      // IN: Goods received items joined with purchase items to get item_id and unit_cost
      // Fallback to purchase_items when goods_received is unavailable
      let goodsQ = supabase
        .from('goods_received_items')
        .select('id, created_at, quantity, goods_received:goods_received_id (location_id, received_date), purchase_items:purchase_item_id (item_id, unit_cost)')
        .gte('created_at', startDate)
        .lte('created_at', endDate);
      // OUT: invoice_items (product_id) and job_card_products (consumption in services)
      let invoiceItemsQ = supabase
        .from('invoice_items')
        .select('id, created_at, quantity, unit_price, product_id, location_id')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .not('product_id', 'is', null);
      let jcpQ = supabase
        .from('job_card_products')
        .select('id, created_at, inventory_item_id, quantity_used');
      if (locationId !== 'all') {
        invoiceItemsQ = invoiceItemsQ.eq('location_id', locationId);
        // job_card_products has no location; derive from job_cards if needed in future
      }
      const [{ data: goodsItems, error: goodsErr }, { data: invoiceItems }, { data: jobCardProducts } ] = await Promise.all([
        goodsQ, invoiceItemsQ, jcpQ,
      ]);

      const normalize: any[] = [];
      // Goods received as positive in
      if (!goodsErr && Array.isArray(goodsItems)) {
        for (const r of goodsItems as any[]) {
          const itemId = (r.purchase_items?.item_id) || null;
          const unitCost = Number(r.purchase_items?.unit_cost || 0);
          if (!itemId) continue;
          normalize.push({
            id: r.id,
            date: String(r.created_at || r.goods_received?.received_date || '').slice(0,10),
            product_id: itemId,
            qty: Number(r.quantity || 0),
            unit_cost: unitCost,
            type: 'Received',
          });
        }
      } else {
        // Fallback to purchase_items within date range when goods_received not available
        const { data: purchases } = await supabase
          .from('purchase_items')
          .select('id, created_at, quantity, unit_cost, item_id')
          .gte('created_at', startDate)
          .lte('created_at', endDate);
        for (const p of (purchases || []) as any[]) {
          normalize.push({ id: p.id, date: (p.created_at || '').slice(0,10), product_id: p.item_id, qty: Number(p.quantity || 0), unit_cost: Number(p.unit_cost || 0), type: 'Purchased' });
        }
      }
      // Invoice product lines as negative (sold)
      for (const s of (invoiceItems || []) as any[]) {
        normalize.push({
          id: s.id,
          date: (s.created_at || '').slice(0,10),
          product_id: s.product_id,
          qty: -Math.abs(Number(s.quantity || 0)),
          unit_cost: Number(s.unit_price || 0),
          type: 'Sold',
        });
      }
      // Job card product consumption as negative (used in services)
      for (const u of (jobCardProducts || []) as any[]) {
        normalize.push({
          id: u.id,
          date: (u.created_at || '').slice(0,10),
          product_id: u.inventory_item_id,
          qty: -Math.abs(Number(u.quantity_used || 0)),
          unit_cost: 0,
          type: 'Used in Service',
        });
      }

      const productNames: Record<string, string> = {};
      const productIds = Array.from(new Set(normalize.map(r => r.product_id).filter(Boolean)));
      if (productIds.length > 0) {
        const { data: products } = await supabase.from('inventory_items').select('id, name').in('id', productIds);
        (products || []).forEach((p: any) => { productNames[p.id] = p.name; });
      }

      const withNames = normalize.map(r => ({ ...r, product_name: productNames[r.product_id] || 'Product' }));
      const filtered = productFilter === 'all' ? withNames : withNames.filter(r => r.product_id === productFilter);
      setRows(filtered.sort((a, b) => a.date.localeCompare(b.date)));
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, productFilter, locationId]);

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
              {/* Dynamic product options could be loaded here */}
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
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Unit</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(entries as any[]).map((r) => (
                    <TableRow key={`${r.type}-${r.reference}-${r.date}-${r.product_id}`} className={r.type === 'Sold/Used' ? 'cursor-pointer hover:bg-slate-50' : ''} >
                      <TableCell>{new Date(r.date).toLocaleString()}</TableCell>
                      <TableCell>{r.product_name}</TableCell>
                      <TableCell className="text-right">{Number(r.qty || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">{Number(r.unit_cost || 0).toLocaleString()}</TableCell>
                      <TableCell>{r.type}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={3} className="font-semibold">Totals</TableCell>
                    <TableCell className="text-right font-semibold">{sum((entries as any[]).map(e => e.qty)).toLocaleString()}</TableCell>
                    <TableCell className="text-right font-semibold">{sum((entries as any[]).map(e => e.qty * e.unit_cost)).toLocaleString()}</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right font-semibold">{sum((entries as any[]).map(e => e.qty * e.unit_cost)).toLocaleString()}</TableCell>
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

function WarehouseReport() {
  const [rows, setRows] = React.useState<Array<{ warehouse_id: string; warehouse_name: string; item_id: string; item_name: string; sku: string | null; quantity: number }>>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('inventory_levels')
          .select(`
            item_id,
            quantity,
            warehouses:warehouse_id ( id, name ),
            inventory_items:item_id ( id, name, sku )
          `)
          .order('warehouse_id', { ascending: true })
          .order('item_id', { ascending: true });
        if (error) throw error;
        const mapped = (data || []).map((r: any) => ({
          warehouse_id: r.warehouses?.id || r.warehouse_id,
          warehouse_name: r.warehouses?.name || r.warehouse_id,
          item_id: r.inventory_items?.id || r.item_id,
          item_name: r.inventory_items?.name || r.item_id,
          sku: r.inventory_items?.sku || null,
          quantity: Number(r.quantity || 0),
        }));
        setRows(mapped);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const totalsByWarehouse = React.useMemo(() => {
    const map = new Map<string, { name: string; totalQty: number; lines: Array<{ item: string; sku: string | null; qty: number }> }>();
    for (const r of rows) {
      const cur = map.get(r.warehouse_id) || { name: r.warehouse_name, totalQty: 0, lines: [] };
      cur.totalQty += r.quantity;
      cur.lines.push({ item: r.item_name, sku: r.sku, qty: r.quantity });
      map.set(r.warehouse_id, cur);
    }
    return Array.from(map.entries()).map(([id, v]) => ({ id, ...v }));
  }, [rows]);

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (rows.length === 0) return <div className="text-sm text-muted-foreground">No inventory recorded.</div>;

  return (
    <div className="space-y-6">
      {totalsByWarehouse.map(w => (
        <Card key={w.id}>
          <CardHeader>
            <CardTitle className="text-base">{w.name} — Total Qty: {w.totalQty}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto rounded border">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="hidden sm:table-cell">SKU</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {w.lines.map((l, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{l.item}</TableCell>
                      <TableCell className="hidden sm:table-cell">{l.sku || ''}</TableCell>
                      <TableCell className="text-right">{l.qty}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
