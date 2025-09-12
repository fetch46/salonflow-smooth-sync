import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Download, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationCurrency } from '@/lib/saas/hooks';

interface CommissionPayableReportProps {
  locationFilter: string;
  setLocationFilter: (value: string) => void;
  locations: Array<{ id: string; name: string }>;
  startDate: string;
  setStartDate: (value: string) => void;
  endDate: string;
  setEndDate: (value: string) => void;
}

interface CommissionPayableData {
  staff_id: string;
  staff_name: string;
  total_accrued: number;
  total_paid: number;
  balance_payable: number;
  commissions: Array<{
    id: string;
    commission_amount: number;
    status: string;
    accrued_date: string;
    paid_date?: string;
  }>;
}

export const CommissionPayableReport: React.FC<CommissionPayableReportProps> = ({
  locationFilter,
  setLocationFilter,
  locations,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
}) => {
  const [loading, setLoading] = useState(false);
  const [commissionData, setCommissionData] = useState<CommissionPayableData[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { format: formatMoney } = useOrganizationCurrency();

  const loadCommissionPayableData = async () => {
    setLoading(true);
    try {
      // Get all staff commissions within date range
      let commissionsQuery = supabase
        .from('staff_commissions')
        .select(`
          id,
          staff_id,
          commission_amount,
          status,
          accrued_date,
          paid_date,
          staff!inner(full_name, organization_id)
        `)
        .gte('accrued_date', startDate)
        .lte('accrued_date', endDate);

      // Apply location filter if selected
      if (locationFilter !== 'all') {
        commissionsQuery = commissionsQuery.or(`
          job_card_id.in.(${await getJobCardIdsForLocation(locationFilter)}),
          invoice_id.in.(${await getInvoiceIdsForLocation(locationFilter)})
        `);
      }

      const { data: commissions, error } = await commissionsQuery;
      if (error) throw error;

      // Group by staff and calculate totals
      const staffMap = new Map<string, CommissionPayableData>();

      (commissions || []).forEach((commission: any) => {
        const staffId = commission.staff_id;
        const staffName = commission.staff?.full_name || 'Unknown Staff';
        
        if (!staffMap.has(staffId)) {
          staffMap.set(staffId, {
            staff_id: staffId,
            staff_name: staffName,
            total_accrued: 0,
            total_paid: 0,
            balance_payable: 0,
            commissions: []
          });
        }

        const staffData = staffMap.get(staffId)!;
        const amount = Number(commission.commission_amount || 0);
        
        staffData.commissions.push({
          id: commission.id,
          commission_amount: amount,
          status: commission.status,
          accrued_date: commission.accrued_date,
          paid_date: commission.paid_date
        });

        staffData.total_accrued += amount;
        if (commission.status === 'paid') {
          staffData.total_paid += amount;
        }
      });

      // Calculate balance payable
      const finalData = Array.from(staffMap.values()).map(staff => ({
        ...staff,
        balance_payable: staff.total_accrued - staff.total_paid
      }));

      setCommissionData(finalData);
    } catch (error) {
      console.error('Error loading commission payable data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getJobCardIdsForLocation = async (locationId: string): Promise<string> => {
    try {
      const { data } = await supabase
        .from('job_cards')
        .select('id')
        .eq('location_id', locationId);
      return (data || []).map(jc => jc.id).join(',') || '';
    } catch {
      return '';
    }
  };

  const getInvoiceIdsForLocation = async (locationId: string): Promise<string> => {
    try {
      const { data } = await supabase
        .from('invoices')
        .select('id')
        .eq('location_id', locationId);
      return (data || []).map(inv => inv.id).join(',') || '';
    } catch {
      return '';
    }
  };

  useEffect(() => {
    loadCommissionPayableData();
  }, [startDate, endDate, locationFilter]);

  const exportToPDF = () => {
    window.print();
  };

  // Filter data based on selected filters
  const filteredData = commissionData.filter(staff => {
    if (selectedStaff !== 'all' && staff.staff_id !== selectedStaff) return false;
    if (statusFilter === 'outstanding' && staff.balance_payable <= 0) return false;
    if (statusFilter === 'paid' && staff.balance_payable > 0) return false;
    return true;
  });

  // Calculate totals
  const totals = filteredData.reduce(
    (acc, staff) => ({
      totalAccrued: acc.totalAccrued + staff.total_accrued,
      totalPaid: acc.totalPaid + staff.total_paid,
      totalBalance: acc.totalBalance + staff.balance_payable,
    }),
    { totalAccrued: 0, totalPaid: 0, totalBalance: 0 }
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-muted rounded-xl shadow-lg border">
            <DollarSign className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Commission Payable Report</h2>
            <p className="text-slate-600 text-sm">Outstanding and paid staff commissions</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportToPDF}>
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
          <Button variant="outline" onClick={loadCommissionPayableData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
                <SelectTrigger>
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
              <Label>Staff Member</Label>
              <Select value={selectedStaff} onValueChange={setSelectedStaff}>
                <SelectTrigger>
                  <SelectValue placeholder="All staff" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Staff</SelectItem>
                  {commissionData.map((staff) => (
                    <SelectItem key={staff.staff_id} value={staff.staff_id}>
                      {staff.staff_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="outstanding">Outstanding Only</SelectItem>
                  <SelectItem value="paid">Paid Only</SelectItem>
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
                {formatMoney(totals.totalAccrued, { decimals: 2 })}
              </div>
              <div className="text-sm text-slate-600">Total Accrued</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {formatMoney(totals.totalPaid, { decimals: 2 })}
              </div>
              <div className="text-sm text-slate-600">Total Paid</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {formatMoney(totals.totalBalance, { decimals: 2 })}
              </div>
              <div className="text-sm text-slate-600">Outstanding Balance</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Commission Payable Table */}
      <Card>
        <CardHeader>
          <CardTitle>Commission Payable Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff Member</TableHead>
                  <TableHead className="text-right">Total Accrued</TableHead>
                  <TableHead className="text-right">Total Paid</TableHead>
                  <TableHead className="text-right">Balance Payable</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No commission data found for the selected criteria
                    </TableCell>
                  </TableRow>
                )}
                {filteredData.map((staff) => (
                  <TableRow key={staff.staff_id}>
                    <TableCell className="font-medium">{staff.staff_name}</TableCell>
                    <TableCell className="text-right">
                      {formatMoney(staff.total_accrued, { decimals: 2 })}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatMoney(staff.total_paid, { decimals: 2 })}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={staff.balance_payable > 0 ? 'font-semibold text-orange-600' : 'text-green-600'}>
                        {formatMoney(staff.balance_payable, { decimals: 2 })}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={staff.balance_payable > 0 ? 'destructive' : 'default'}>
                        {staff.balance_payable > 0 ? 'Outstanding' : 'Paid in Full'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                
                {/* Totals Row */}
                {filteredData.length > 0 && (
                  <TableRow className="font-semibold bg-muted/50">
                    <TableCell>TOTALS</TableCell>
                    <TableCell className="text-right">
                      {formatMoney(totals.totalAccrued, { decimals: 2 })}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatMoney(totals.totalPaid, { decimals: 2 })}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={totals.totalBalance > 0 ? 'text-orange-600' : 'text-green-600'}>
                        {formatMoney(totals.totalBalance, { decimals: 2 })}
                      </span>
                    </TableCell>
                    <TableCell>—</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Example Section */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-800">Example: Commission Accounting</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-blue-700 space-y-2">
            <p><strong>When commission is earned:</strong></p>
            <p>Dr. Commission Expense: {formatMoney(5000, { decimals: 2 })}</p>
            <p>Cr. Commission Payable: {formatMoney(5000, { decimals: 2 })}</p>
            
            <p className="pt-2"><strong>When commission is paid:</strong></p>
            <p>Dr. Commission Payable: {formatMoney(3000, { decimals: 2 })}</p>
            <p>Cr. Bank Account: {formatMoney(3000, { decimals: 2 })}</p>
            
            <p className="pt-2"><strong>Result:</strong> Balance of {formatMoney(2000, { decimals: 2 })} remains in Commission Payable (liability on balance sheet)</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};