import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calculator, RefreshCw, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationCurrency } from '@/lib/saas/hooks';

interface ProfitLossReportProps {
  locationFilter: string;
  setLocationFilter: (value: string) => void;
  locations: Array<{ id: string; name: string }>;
  startDate: string;
  setStartDate: (value: string) => void;
  endDate: string;
  setEndDate: (value: string) => void;
}

export const ProfitLossReport: React.FC<ProfitLossReportProps> = ({
  locationFilter,
  setLocationFilter,
  locations,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
}) => {
  const [loading, setLoading] = useState(false);
  const [profitLoss, setProfitLoss] = useState({
    revenue: 0,
    cogs: 0,
    grossProfit: 0,
    expenses: 0,
    netProfit: 0,
    breakdown: {
      revenue: {} as Record<string, number>,
      expenses: {} as Record<string, number>,
    }
  });

  const { format: formatMoney } = useOrganizationCurrency();

  const calculateProfitLoss = async () => {
    setLoading(true);
    try {
      // Revenue from invoice payments with location filtering
        let revenueQuery = supabase
          .from('invoice_payments')
          .select(`
            amount, 
            payment_date,
            invoices!inner(location_id)
          `)
          .gte('payment_date', startDate)
          .lte('payment_date', endDate);

        if (locationFilter !== 'all') {
          revenueQuery = revenueQuery.eq('invoices.location_id', locationFilter);
        }

      const { data: payments } = await revenueQuery;
      const invoiceRevenue = (payments || []).reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

      // Add completed job cards as revenue (where no invoice was created)
      let jobCardRevenue = 0;
      try {
        const jobCardsQueryBuilder = supabase
          .from('job_cards')
          .select('total_amount, updated_at')
          .eq('status', 'completed')
          .gte('updated_at', startDate)
          .lte('updated_at', endDate);

        const { data: jobCards } = await jobCardsQueryBuilder;
        jobCardRevenue = (jobCards || []).reduce((sum: number, jc: any) => sum + Number(jc.total_amount || 0), 0);
      } catch (error) {
        console.warn('Error loading job card revenue:', error);
        jobCardRevenue = 0;
      }

      const revenue = invoiceRevenue + jobCardRevenue;

      // COGS derived from invoice items and job cards
      // 1) Fetch invoices within period (filtered by location when selected)
      let invoicesQuery = supabase
        .from('invoices')
        .select('id, jobcard_id, location_id, created_at, status')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (locationFilter !== 'all') {
        invoicesQuery = invoicesQuery.eq('location_id', locationFilter);
      }

      const { data: invoices } = await invoicesQuery;
      const invoiceList = (invoices || []) as Array<any>;
      const invoiceIds: string[] = invoiceList.map((inv: any) => inv.id);
      const jobcardIds: string[] = Array.from(
        new Set(
          invoiceList
            .map((inv: any) => inv.jobcard_id)
            .filter((id: any) => !!id)
        )
      ) as string[];

      let jobCardCogs = 0;
      let posProductsCogs = 0;

      // 2) Sum cost of products used on job cards that were invoiced in the period
      if (jobcardIds.length > 0) {
        try {
          const { data: jobProducts } = await supabase
            .from('job_card_products')
            .select('total_cost, job_card_id')
            .in('job_card_id', jobcardIds);
          jobCardCogs = (jobProducts || []).reduce(
            (sum: number, row: any) => sum + Number(row.total_cost || 0),
            0
          );
        } catch (e) {
          console.warn('Failed to load job card product costs for COGS', e);
          jobCardCogs = 0;
        }
      }

      // 3) Sum cost of products sold on POS-like invoices (invoices without a linked job card)
      const posLikeInvoiceIds: string[] = invoiceList
        .filter((inv: any) => !inv.jobcard_id)
        .map((inv: any) => inv.id);

      if (posLikeInvoiceIds.length > 0) {
        try {
          // Fetch invoice_items for those invoices where product_id is present
          const { data: posItems } = await supabase
            .from('invoice_items')
            .select('invoice_id, product_id, quantity')
            .in('invoice_id', posLikeInvoiceIds)
            .not('product_id', 'is', null);

          const items = (posItems || []) as Array<any>;
          const productIds = Array.from(
            new Set(items.map((it: any) => it.product_id).filter((id: any) => !!id))
          ) as string[];

          let costMap = new Map<string, number>();
          if (productIds.length > 0) {
            const { data: products } = await supabase
              .from('inventory_items')
              .select('id, cost_price')
              .in('id', productIds);
            costMap = new Map(
              (products || []).map((p: any) => [p.id, Number(p.cost_price || 0)])
            );
          }

          posProductsCogs = items.reduce((sum: number, it: any) => {
            const qty = Number(it.quantity || 0);
            const unitCost = costMap.get(it.product_id) || 0;
            return sum + qty * unitCost;
          }, 0);
        } catch (e) {
          console.warn('Failed to load POS product costs for COGS', e);
          posProductsCogs = 0;
        }
      }

      const cogs = jobCardCogs + posProductsCogs;

      // Expenses
      let expensesQuery = supabase
        .from('expenses')
        .select('amount, category')
        .eq('status', 'paid')
        .gte('expense_date', startDate)
        .lte('expense_date', endDate);
      
      if (locationFilter !== 'all') {
        expensesQuery = expensesQuery.eq('location_id', locationFilter);
      }

      const { data: expensesData } = await expensesQuery;
      const expenses = (expensesData || []).reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);

      // Breakdown by category
      const expenseBreakdown: Record<string, number> = {};
      (expensesData || []).forEach((e: any) => {
        const category = e.category || 'Uncategorized';
        expenseBreakdown[category] = (expenseBreakdown[category] || 0) + Number(e.amount || 0);
      });

      const grossProfit = revenue - cogs;
      const netProfit = grossProfit - expenses;

      setProfitLoss({
        revenue,
        cogs,
        grossProfit,
        expenses,
        netProfit,
        breakdown: {
          revenue: { 
            'Invoice Payments': invoiceRevenue,
            'Completed Job Cards': jobCardRevenue 
          },
          expenses: expenseBreakdown,
        }
      });
    } catch (error) {
      console.error('Error calculating profit and loss:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    calculateProfitLoss();
  }, [startDate, endDate, locationFilter]);

  const exportToPDF = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-muted rounded-xl shadow-lg border">
            <Calculator className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Profit & Loss Statement</h2>
            <p className="text-slate-600 text-sm">Revenue, expenses, and profitability analysis</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportToPDF}>
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
          <Button variant="outline" onClick={calculateProfitLoss} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-end gap-4">
            <div>
              <Label>Start Date</Label>
              <Input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)} 
              />
            </div>
            <div>
              <Label>End Date</Label>
              <Input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)} 
              />
            </div>
            <div>
              <Label>Location</Label>
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">
                {formatMoney(profitLoss.revenue, { decimals: 2 })}
              </div>
              <div className="text-sm text-slate-600">Total Revenue</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {formatMoney(profitLoss.cogs, { decimals: 2 })}
              </div>
              <div className="text-sm text-slate-600">COGS</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {formatMoney(profitLoss.grossProfit, { decimals: 2 })}
              </div>
              <div className="text-sm text-slate-600">Gross Profit</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {formatMoney(profitLoss.expenses, { decimals: 2 })}
              </div>
              <div className="text-sm text-slate-600">Total Expenses</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className={`text-2xl font-bold ${profitLoss.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatMoney(profitLoss.netProfit, { decimals: 2 })}
              </div>
              <div className="text-sm text-slate-600">Net Profit</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Breakdown */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(profitLoss.breakdown.revenue).map(([category, amount]) => (
                  <TableRow key={category}>
                    <TableCell className="font-medium">{category}</TableCell>
                    <TableCell className="text-right">{formatMoney(amount, { decimals: 2 })}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold bg-emerald-50">
                  <TableCell>Total Revenue</TableCell>
                  <TableCell className="text-right">{formatMoney(profitLoss.revenue, { decimals: 2 })}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expense Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(profitLoss.breakdown.expenses)
                  .sort((a, b) => (b[1] as number) - (a[1] as number))
                  .map(([category, amount]) => (
                    <TableRow key={category}>
                      <TableCell className="font-medium">{category}</TableCell>
                      <TableCell className="text-right">{formatMoney(amount, { decimals: 2 })}</TableCell>
                    </TableRow>
                  ))}
                <TableRow className="font-semibold bg-red-50">
                  <TableCell>Total Expenses</TableCell>
                  <TableCell className="text-right">{formatMoney(profitLoss.expenses, { decimals: 2 })}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};