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

interface BalanceSheetReportProps {
  locationFilter: string;
  setLocationFilter: (value: string) => void;
  locations: Array<{ id: string; name: string }>;
  endDate: string;
  setEndDate: (value: string) => void;
}

export const BalanceSheetReport: React.FC<BalanceSheetReportProps> = ({
  locationFilter,
  setLocationFilter,
  locations,
  endDate,
  setEndDate,
}) => {
  const [loading, setLoading] = useState(false);
  const [balanceSheet, setBalanceSheet] = useState({
    assets: 0,
    liabilities: 0,
    equity: 0,
    breakdown: {
      assets: {} as Record<string, number>,
      liabilities: {} as Record<string, number>,
      equity: {} as Record<string, number>,
    }
  });

  const { format: formatMoney } = useOrganizationCurrency();

  const calculateBalanceSheet = async () => {
    setLoading(true);
    try {
      // Get all account transactions up to the end date with proper location filtering
      let transactionsQuery = supabase
        .from('account_transactions')
        .select(`
          debit_amount, 
          credit_amount, 
          location_id,
          accounts!inner(account_type, account_name, account_code)
        `)
        .lte('transaction_date', endDate);
      
      if (locationFilter !== 'all') {
        transactionsQuery = transactionsQuery.eq('location_id', locationFilter);
      }

      const { data: transactions } = await transactionsQuery;

      const assets: Record<string, number> = {};
      const liabilities: Record<string, number> = {};
      const equity: Record<string, number> = {};

      (transactions || []).forEach((txn: any) => {
        const accountType = txn.accounts.account_type;
        const accountName = txn.accounts.account_name || `Account ${txn.accounts.account_code}`;
        const debit = Number(txn.debit_amount || 0);
        const credit = Number(txn.credit_amount || 0);

        switch (accountType) {
          case 'Asset':
            assets[accountName] = (assets[accountName] || 0) + debit - credit;
            break;
          case 'Liability':
            liabilities[accountName] = (liabilities[accountName] || 0) + credit - debit;
            break;
          case 'Equity':
            equity[accountName] = (equity[accountName] || 0) + credit - debit;
            break;
        }
      });

      const totalAssets = Object.values(assets).reduce((sum, value) => sum + value, 0);
      const totalLiabilities = Object.values(liabilities).reduce((sum, value) => sum + value, 0);
      const totalEquity = Object.values(equity).reduce((sum, value) => sum + value, 0);

      setBalanceSheet({
        assets: totalAssets,
        liabilities: totalLiabilities,
        equity: totalEquity,
        breakdown: { assets, liabilities, equity }
      });
    } catch (error) {
      console.error('Error calculating balance sheet:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    calculateBalanceSheet();
  }, [endDate, locationFilter]);

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
            <h2 className="text-xl font-bold text-slate-900">Balance Sheet</h2>
            <p className="text-slate-600 text-sm">Assets, liabilities, and equity snapshot</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportToPDF}>
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
          <Button variant="outline" onClick={calculateBalanceSheet} disabled={loading}>
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
              <Label>As of Date</Label>
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
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {formatMoney(balanceSheet.assets, { decimals: 2 })}
              </div>
              <div className="text-sm text-slate-600">Total Assets</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {formatMoney(balanceSheet.liabilities, { decimals: 2 })}
              </div>
              <div className="text-sm text-slate-600">Total Liabilities</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">
                {formatMoney(balanceSheet.equity, { decimals: 2 })}
              </div>
              <div className="text-sm text-slate-600">Total Equity</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Breakdown */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Assets</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(balanceSheet.breakdown.assets)
                  .filter(([, amount]) => amount !== 0)
                  .sort((a, b) => b[1] - a[1])
                  .map(([account, amount]) => (
                    <TableRow key={account}>
                      <TableCell className="font-medium">{account}</TableCell>
                      <TableCell className="text-right">{formatMoney(amount, { decimals: 2 })}</TableCell>
                    </TableRow>
                  ))}
                <TableRow className="font-semibold bg-blue-50">
                  <TableCell>Total Assets</TableCell>
                  <TableCell className="text-right">{formatMoney(balanceSheet.assets, { decimals: 2 })}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Liabilities</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(balanceSheet.breakdown.liabilities)
                  .filter(([, amount]) => amount !== 0)
                  .sort((a, b) => b[1] - a[1])
                  .map(([account, amount]) => (
                    <TableRow key={account}>
                      <TableCell className="font-medium">{account}</TableCell>
                      <TableCell className="text-right">{formatMoney(amount, { decimals: 2 })}</TableCell>
                    </TableRow>
                  ))}
                <TableRow className="font-semibold bg-red-50">
                  <TableCell>Total Liabilities</TableCell>
                  <TableCell className="text-right">{formatMoney(balanceSheet.liabilities, { decimals: 2 })}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Equity</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(balanceSheet.breakdown.equity)
                  .filter(([, amount]) => amount !== 0)
                  .sort((a, b) => b[1] - a[1])
                  .map(([account, amount]) => (
                    <TableRow key={account}>
                      <TableCell className="font-medium">{account}</TableCell>
                      <TableCell className="text-right">{formatMoney(amount, { decimals: 2 })}</TableCell>
                    </TableRow>
                  ))}
                <TableRow className="font-semibold bg-emerald-50">
                  <TableCell>Total Equity</TableCell>
                  <TableCell className="text-right">{formatMoney(balanceSheet.equity, { decimals: 2 })}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Balance Check */}
      <Card className={`border-2 ${Math.abs(balanceSheet.assets - (balanceSheet.liabilities + balanceSheet.equity)) < 0.01 ? 'border-emerald-500 bg-emerald-50' : 'border-red-500 bg-red-50'}`}>
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="text-lg font-semibold mb-2">Balance Check</div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>Assets: {formatMoney(balanceSheet.assets, { decimals: 2 })}</div>
              <div>=</div>
              <div>Liabilities + Equity: {formatMoney(balanceSheet.liabilities + balanceSheet.equity, { decimals: 2 })}</div>
            </div>
            <div className={`mt-2 font-medium ${Math.abs(balanceSheet.assets - (balanceSheet.liabilities + balanceSheet.equity)) < 0.01 ? 'text-emerald-600' : 'text-red-600'}`}>
              {Math.abs(balanceSheet.assets - (balanceSheet.liabilities + balanceSheet.equity)) < 0.01 ? '✓ Balanced' : '⚠ Out of Balance'}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};