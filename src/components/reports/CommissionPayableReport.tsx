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
  balance: number;
  status: 'pending' | 'paid';
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
    if (!startDate || !endDate) return;
    
    setLoading(true);
    try {
      let query = supabase
        .from('staff_commissions')
        .select(`
          staff_id,
          commission_amount,
          status,
          accrued_date,
          paid_date,
          commission_percentage,
          invoice_id,
          job_card_id,
          staff:staff_id (
            full_name
          )
        `);

      // Add date filter based on accrued_date
      query = query.gte('accrued_date', startDate);
      query = query.lte('accrued_date', endDate);

      // Add location filter if specified
      if (locationFilter && locationFilter !== 'all') {
        // Get job card IDs for the location
        const jobCardIds = await getJobCardIdsForLocation(locationFilter);
        const invoiceIds = await getInvoiceIdsForLocation(locationFilter);
        
        if (jobCardIds.length > 0 || invoiceIds.length > 0) {
          // Apply location filter
          query = query.or(`job_card_id.in.(${jobCardIds.join(',')}),invoice_id.in.(${invoiceIds.join(',')})`);
        } else {
          // No data for this location
          setCommissionData([]);
          setLoading(false);
          return;
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      // Group by staff and calculate totals
      const groupedData: { [staffId: string]: CommissionPayableData } = {};
      
      data?.forEach((commission) => {
        const staffId = commission.staff_id;
        const staffName = commission.staff?.full_name || 'Unknown Staff';
        
        if (!groupedData[staffId]) {
          groupedData[staffId] = {
            staff_id: staffId,
            staff_name: staffName,
            total_accrued: 0,
            total_paid: 0,
            balance: 0,
            status: 'pending'
          };
        }
        
        // Add to total accrued for all commissions
        groupedData[staffId].total_accrued += commission.commission_amount;
        
        // Add to total paid only for paid commissions
        if (commission.status === 'paid') {
          groupedData[staffId].total_paid += commission.commission_amount;
        }
      });

      // Calculate balances and determine status
      const processedData = Object.values(groupedData).map(item => {
        const balance = item.total_accrued - item.total_paid;
        return {
          ...item,
          balance,
          status: (balance <= 0 ? 'paid' : 'pending') as 'paid' | 'pending'
        };
      });

      setCommissionData(processedData);
    } catch (error) {
      console.error('Error loading commission payable data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getJobCardIdsForLocation = async (locationId: string): Promise<string[]> => {
    try {
      const { data } = await supabase
        .from('job_cards')
        .select('id')
        .eq('location_id', locationId);
      return (data || []).map(jc => jc.id);
    } catch {
      return [];
    }
  };

  const getInvoiceIdsForLocation = async (locationId: string): Promise<string[]> => {
    try {
      const { data } = await supabase
        .from('invoices')
        .select('id')
        .eq('location_id', locationId);
      return (data || []).map(inv => inv.id);
    } catch {
      return [];
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
    if (statusFilter === 'outstanding' && staff.balance <= 0) return false;
    if (statusFilter === 'paid' && staff.balance > 0) return false;
    return true;
  });

  // Calculate totals
  const totals = filteredData.reduce(
    (acc, staff) => ({
      totalAccrued: acc.totalAccrued + staff.total_accrued,
      totalPaid: acc.totalPaid + staff.total_paid,
      totalBalance: acc.totalBalance + staff.balance,
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
                      <span className={staff.balance > 0 ? 'font-semibold text-orange-600' : 'text-green-600'}>
                        {formatMoney(staff.balance, { decimals: 2 })}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={staff.balance > 0 ? 'destructive' : 'default'}>
                        {staff.balance > 0 ? 'Outstanding' : 'Paid in Full'}
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

    </div>
  );
};