import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
} from 'lucide-react';
import { useSaas } from '@/lib/saas/context';
import { supabase } from '@/integrations/supabase/client';

const Reports = () => {
  const { organization, subscriptionPlan } = useSaas();
  const [timeRange, setTimeRange] = useState('month');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [activeSubTab, setActiveSubTab] = useState<Record<string, string>>({ overview: 'summary', revenue: 'summary', services: 'top', clients: 'top', pnl: 'summary', balancesheet: 'summary', commissions: 'summary' });
  const [staffList, setStaffList] = useState<Array<{ id: string; full_name: string; commission_rate?: number | null }>>([]);
  const [commissionRows, setCommissionRows] = useState<Array<any>>([]);
  const [commissionSummary, setCommissionSummary] = useState<Record<string, { staffId: string; staffName: string; gross: number; commissionRate: number; commission: number }>>({});
  const [commissionStaffFilter, setCommissionStaffFilter] = useState<string>('all');
  const [pl, setPl] = useState<{ income: number; cogs: number; expenses: number; grossProfit: number; netProfit: number }>({ income: 0, cogs: 0, expenses: 0, grossProfit: 0, netProfit: 0 });
  const [bs, setBs] = useState<{ assets: number; liabilities: number; equity: number } >({ assets: 0, liabilities: 0, equity: 0 });
  const [startDate, setStartDate] = useState<string>(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return start.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [recalcLoading, setRecalcLoading] = useState(false);

  const recalcFinancials = async () => {
    setRecalcLoading(true);
    try {
      // Pull transactions in range with account types
      const { data: txns, error } = await supabase
        .from('account_transactions')
        .select('account_id, transaction_date, debit_amount, credit_amount, accounts:account_id (account_type, account_code)')
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate);
      if (error) throw error;
      const transactions = txns || [];

      const sumByType = (type: string) => transactions
        .filter((t: any) => t.accounts?.account_type === type)
        .reduce((sum: number, t: any) => sum + (Number(t.debit_amount) || 0) - (Number(t.credit_amount) || 0), 0);
      const sumByTypeCreditMinusDebit = (type: string) => transactions
        .filter((t: any) => t.accounts?.account_type === type)
        .reduce((sum: number, t: any) => sum + (Number(t.credit_amount) || 0) - (Number(t.debit_amount) || 0), 0);

      // Income: credits - debits for Income accounts
      const income = sumByTypeCreditMinusDebit('Income');
      // COGS specifically 5001: debit - credit
      const cogs = transactions
        .filter((t: any) => t.accounts?.account_code === '5001')
        .reduce((sum: number, t: any) => sum + (Number(t.debit_amount) || 0) - (Number(t.credit_amount) || 0), 0);
      // Expenses: debit - credit for Expense excluding 5001
      const expenses = transactions
        .filter((t: any) => t.accounts?.account_type === 'Expense' && t.accounts?.account_code !== '5001')
        .reduce((sum: number, t: any) => sum + (Number(t.debit_amount) || 0) - (Number(t.credit_amount) || 0), 0);
      const grossProfit = income - cogs;
      const netProfit = grossProfit - expenses;
      setPl({ income, cogs, expenses, grossProfit, netProfit });

      // Balance Sheet as of endDate: calculate balances using debits/credits to date
      // Assets: debit - credit, Liabilities/Equity: credit - debit
      const assets = sumByType('Asset');
      const liabilities = sumByTypeCreditMinusDebit('Liability');
      const equity = sumByTypeCreditMinusDebit('Equity');
      setBs({ assets, liabilities, equity });
    } catch (e) {
      console.error('Error calculating financials', e);
    } finally {
      setRecalcLoading(false);
    }
  };

  useEffect(() => {
    recalcFinancials();
  }, []);

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
      // Fetch receipt items within date range, join staff and services
      const { data, error } = await supabase
        .from('receipt_items')
        .select(`
          id, quantity, unit_price, created_at,
          receipt:receipt_id ( id, created_at ),
          service:service_id ( id, name, commission_percentage ),
          staff:staff_id ( id, full_name, commission_rate )
        `)
        .gte('created_at', startDate)
        .lte('created_at', endDate);
      if (error) throw error;

      const rows = (data || []).filter((r: any) => (commissionStaffFilter === 'all' ? true : r.staff?.id === commissionStaffFilter));
      setCommissionRows(rows);

      const summary: Record<string, { staffId: string; staffName: string; gross: number; commissionRate: number; commission: number }> = {};
      for (const r of rows) {
        const staffId = r.staff?.id || 'unassigned';
        const staffName = r.staff?.full_name || 'Unassigned';
        const gross = Number(r.unit_price || 0) * Number(r.quantity || 1);
        const rate = (r.service?.commission_percentage ?? r.staff?.commission_rate ?? 0) as number;
        const commission = gross * (Number(rate) || 0) / 100;
        if (!summary[staffId]) summary[staffId] = { staffId, staffName, gross: 0, commissionRate: Number(rate) || 0, commission: 0 };
        summary[staffId].gross += gross;
        summary[staffId].commission += commission;
      }
      setCommissionSummary(summary);
    } catch (e) {
      console.error('Error loading commissions', e);
    } finally {
      setLoading(false);
    }
  };

  // Mock data for reports
  const mockData = {
    revenue: {
      current: 15420,
      previous: 12850,
      change: 20.0,
    },
    appointments: {
      current: 156,
      previous: 142,
      change: 9.9,
    },
    clients: {
      current: 89,
      previous: 76,
      change: 17.1,
    },
    services: {
      current: 234,
      previous: 198,
      change: 18.2,
    },
  };

  const topServices = [
    { name: 'Haircut & Style', revenue: 4200, appointments: 45, growth: 12.5 },
    { name: 'Hair Coloring', revenue: 3800, appointments: 32, growth: 8.3 },
    { name: 'Manicure', revenue: 2100, appointments: 28, growth: 15.2 },
    { name: 'Facial Treatment', revenue: 1800, appointments: 22, growth: 5.7 },
    { name: 'Hair Treatment', revenue: 1520, appointments: 18, growth: 22.1 },
  ];

  const topClients = [
    { name: 'Sarah Johnson', visits: 12, totalSpent: 850, lastVisit: '2 days ago' },
    { name: 'Michael Chen', visits: 10, totalSpent: 720, lastVisit: '1 week ago' },
    { name: 'Emily Davis', visits: 9, totalSpent: 680, lastVisit: '3 days ago' },
    { name: 'David Wilson', visits: 8, totalSpent: 590, lastVisit: '5 days ago' },
    { name: 'Lisa Brown', visits: 7, totalSpent: 520, lastVisit: '1 week ago' },
  ];

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
    <div className="flex-1 space-y-6 p-6 bg-gradient-to-br from-slate-50 to-slate-100/50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
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
        
        <div className="flex items-center gap-3">
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <aside className="lg:col-span-3 xl:col-span-2">
            <TabsList className="flex flex-col w-full items-stretch">
              <TabsTrigger value="overview" className="justify-start flex items-center gap-2">
                <Activity className="w-4 h-4" /> Overview
              </TabsTrigger>
              {activeTab === 'overview' && (
                <div className="ml-6 mt-2 space-y-1 text-sm">
                  <button className={`text-left ${activeSubTab.overview === 'summary' ? 'font-semibold' : ''}`} onClick={() => setActiveSubTab(prev => ({ ...prev, overview: 'summary' }))}>Summary</button>
                </div>
              )}
              <TabsTrigger value="revenue" className="justify-start flex items-center gap-2">
                <DollarSign className="w-4 h-4" /> Revenue
              </TabsTrigger>
              {activeTab === 'revenue' && (
                <div className="ml-6 mt-2 space-y-1 text-sm">
                  <button className={`text-left ${activeSubTab.revenue === 'summary' ? 'font-semibold' : ''}`} onClick={() => setActiveSubTab(prev => ({ ...prev, revenue: 'summary' }))}>Summary</button>
                </div>
              )}
              <TabsTrigger value="services" className="justify-start flex items-center gap-2">
                <Target className="w-4 h-4" /> Services
              </TabsTrigger>
              {activeTab === 'services' && (
                <div className="ml-6 mt-2 space-y-1 text-sm">
                  <button className={`text-left ${activeSubTab.services === 'top' ? 'font-semibold' : ''}`} onClick={() => setActiveSubTab(prev => ({ ...prev, services: 'top' }))}>Top Services</button>
                </div>
              )}
              <TabsTrigger value="clients" className="justify-start flex items-center gap-2">
                <Users className="w-4 h-4" /> Clients
              </TabsTrigger>
              {activeTab === 'clients' && (
                <div className="ml-6 mt-2 space-y-1 text-sm">
                  <button className={`text-left ${activeSubTab.clients === 'top' ? 'font-semibold' : ''}`} onClick={() => setActiveSubTab(prev => ({ ...prev, clients: 'top' }))}>Top Clients</button>
                </div>
              )}
              <TabsTrigger value="pnl" className="justify-start flex items-center gap-2">
                <DollarSign className="w-4 h-4" /> P&L
              </TabsTrigger>
              <TabsTrigger value="balancesheet" className="justify-start flex items-center gap-2">
                <PieChart className="w-4 h-4" /> Balance Sheet
              </TabsTrigger>
              <TabsTrigger value="commissions" className="justify-start flex items-center gap-2">
                <DollarSign className="w-4 h-4" /> Commissions
              </TabsTrigger>
              {activeTab === 'commissions' && (
                <div className="ml-6 mt-2 space-y-1 text-sm">
                  <button className={`text-left ${activeSubTab.commissions === 'summary' ? 'font-semibold' : ''}`} onClick={() => setActiveSubTab(prev => ({ ...prev, commissions: 'summary' }))}>Summary</button>
                  <button className={`text-left ${activeSubTab.commissions === 'detailed' ? 'font-semibold' : ''}`} onClick={() => setActiveSubTab(prev => ({ ...prev, commissions: 'detailed' }))}>Detailed</button>
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
                    <div className="text-2xl font-bold">${mockData.revenue.current.toLocaleString()}</div>
                    <div className="flex items-center text-xs text-slate-600">
                      <TrendingUp className="h-3 w-3 mr-1 text-green-600" />
                      +{mockData.revenue.change}% from last period
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-slate-600">Appointments</CardTitle>
                    <Calendar className="h-4 w-4 text-blue-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{mockData.appointments.current}</div>
                    <div className="flex items-center text-xs text-slate-600">
                      <TrendingUp className="h-3 w-3 mr-1 text-green-600" />
                      +{mockData.appointments.change}% from last period
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-slate-600">Active Clients</CardTitle>
                    <Users className="h-4 w-4 text-purple-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{mockData.clients.current}</div>
                    <div className="flex items-center text-xs text-slate-600">
                      <TrendingUp className="h-3 w-3 mr-1 text-green-600" />
                      +{mockData.clients.change}% from last period
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-slate-600">Services Rendered</CardTitle>
                    <Target className="h-4 w-4 text-orange-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{mockData.services.current}</div>
                    <div className="flex items-center text-xs text-slate-600">
                      <TrendingUp className="h-3 w-3 mr-1 text-green-600" />
                      +{mockData.services.change}% from last period
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
                        <div className="text-2xl font-bold text-green-600">${mockData.revenue.current.toLocaleString()}</div>
                        <div className="text-sm text-green-700">Total Revenue</div>
                      </div>
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">${(mockData.revenue.current / mockData.appointments.current).toFixed(0)}</div>
                        <div className="text-sm text-blue-700">Average per Appointment</div>
                      </div>
                      <div className="text-center p-4 bg-purple-50 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">${(mockData.revenue.current / mockData.clients.current).toFixed(0)}</div>
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
                      <div className="text-sm text-green-700">Income</div>
                    </div>
                    <div className="text-center p-4 bg-amber-50 rounded-lg">
                      <div className="text-2xl font-bold text-amber-700">${pl.cogs.toFixed(2)}</div>
                      <div className="text-sm text-amber-700">Cost of Goods Sold</div>
                    </div>
                    <div className="text-center p-4 bg-red-50 rounded-lg">
                      <div className="text-2xl font-bold text-red-700">${pl.expenses.toFixed(2)}</div>
                      <div className="text-sm text-red-700">Expenses</div>
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
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Staff</TableHead>
                            <TableHead className="text-right">Gross</TableHead>
                            <TableHead className="text-right">Rate %</TableHead>
                            <TableHead className="text-right">Commission</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Object.values(commissionSummary).map(row => (
                            <TableRow key={row.staffId}>
                              <TableCell>{row.staffName}</TableCell>
                              <TableCell className="text-right">${row.gross.toFixed(2)}</TableCell>
                              <TableCell className="text-right">{row.commissionRate.toFixed(2)}</TableCell>
                              <TableCell className="text-right">${row.commission.toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {activeSubTab.commissions === 'detailed' && (
                    <div className="space-y-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Service</TableHead>
                            <TableHead>Staff</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                            <TableHead className="text-right">Unit Price</TableHead>
                            <TableHead className="text-right">Gross</TableHead>
                            <TableHead className="text-right">Rate %</TableHead>
                            <TableHead className="text-right">Commission</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {commissionRows.map((r: any) => {
                            const qty = Number(r.quantity || 1);
                            const unit = Number(r.unit_price || 0);
                            const gross = qty * unit;
                            const rate = (r.service?.commission_percentage ?? r.staff?.commission_rate ?? 0) as number;
                            const comm = gross * (Number(rate) || 0) / 100;
                            return (
                              <TableRow key={r.id}>
                                <TableCell>{(r.created_at || r.receipt?.created_at || '').split('T')[0]}</TableCell>
                                <TableCell>{r.service?.name || r.description}</TableCell>
                                <TableCell>{r.staff?.full_name || 'Unassigned'}</TableCell>
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
                  )}
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