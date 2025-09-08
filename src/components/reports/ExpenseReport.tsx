import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreditCard, RefreshCw, Download, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationCurrency } from '@/lib/saas/hooks';
import { Badge } from '@/components/ui/badge';

interface ExpenseReportProps {
  locationFilter: string;
  setLocationFilter: (value: string) => void;
  locations: Array<{ id: string; name: string }>;
  startDate: string;
  setStartDate: (value: string) => void;
  endDate: string;
  setEndDate: (value: string) => void;
}

export const ExpenseReport: React.FC<ExpenseReportProps> = ({
  locationFilter,
  setLocationFilter,
  locations,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
}) => {
  const [loading, setLoading] = useState(false);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expenseSummary, setExpenseSummary] = useState({
    total: 0,
    paid: 0,
    pending: 0,
    byCategory: {} as Record<string, number>
  });
  const [categories, setCategories] = useState<string[]>([]);

  const { format: formatMoney } = useOrganizationCurrency();

  const loadExpenses = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('expenses')
        .select(`
          id,
          amount,
          description,
          category,
          expense_date,
          status,
          location_id,
          business_locations(name)
        `)
        .gte('expense_date', startDate)
        .lte('expense_date', endDate)
        .order('expense_date', { ascending: false });

      if (locationFilter !== 'all') {
        query = query.eq('location_id', locationFilter);
      }

      if (categoryFilter !== 'all') {
        query = query.eq('category', categoryFilter);
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data } = await query;
      const expenseData = data || [];
      setExpenses(expenseData);

      // Calculate summary
      const total = expenseData.reduce((sum, e) => sum + Number(e.amount || 0), 0);
      const paid = expenseData
        .filter(e => e.status === 'paid')
        .reduce((sum, e) => sum + Number(e.amount || 0), 0);
      const pending = expenseData
        .filter(e => e.status !== 'paid')
        .reduce((sum, e) => sum + Number(e.amount || 0), 0);

      const byCategory: Record<string, number> = {};
      expenseData.forEach((e: any) => {
        const category = e.category || 'Uncategorized';
        byCategory[category] = (byCategory[category] || 0) + Number(e.amount || 0);
      });

      setExpenseSummary({ total, paid, pending, byCategory });

      // Get unique categories
      const uniqueCategories = [...new Set(expenseData.map((e: any) => e.category).filter(Boolean))];
      setCategories(uniqueCategories);

    } catch (error) {
      console.error('Error loading expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, [startDate, endDate, locationFilter, categoryFilter, statusFilter]);

  const exportToPDF = () => {
    window.print();
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'draft':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-red-600 to-pink-600 rounded-xl shadow-lg">
            <CreditCard className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Expense Report</h2>
            <p className="text-slate-600 text-sm">Detailed expense analysis and breakdown</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportToPDF}>
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
          <Button variant="outline" onClick={loadExpenses} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-end gap-4 flex-wrap">
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
            <div>
              <Label>Category</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="All status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {formatMoney(expenseSummary.total, { decimals: 2 })}
              </div>
              <div className="text-sm text-slate-600">Total Expenses</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">
                {formatMoney(expenseSummary.paid, { decimals: 2 })}
              </div>
              <div className="text-sm text-slate-600">Paid Expenses</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {formatMoney(expenseSummary.pending, { decimals: 2 })}
              </div>
              <div className="text-sm text-slate-600">Pending Expenses</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Expenses by Category</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Percentage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(expenseSummary.byCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([category, amount]) => {
                  const percentage = expenseSummary.total > 0 ? (amount / expenseSummary.total) * 100 : 0;
                  return (
                    <TableRow key={category}>
                      <TableCell className="font-medium">{category}</TableCell>
                      <TableCell className="text-right">{formatMoney(amount, { decimals: 2 })}</TableCell>
                      <TableCell className="text-right">{percentage.toFixed(1)}%</TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detailed Expense List */}
      <Card>
        <CardHeader>
          <CardTitle>Expense Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>{new Date(expense.expense_date).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium">{expense.description}</TableCell>
                    <TableCell>{expense.category || 'Uncategorized'}</TableCell>
                    <TableCell>{expense.business_locations?.name || 'No Location'}</TableCell>
                    <TableCell className="text-right">{formatMoney(expense.amount, { decimals: 2 })}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(expense.status)}>
                        {expense.status || 'Draft'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {expenses.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No expenses found for the selected criteria
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};