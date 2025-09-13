import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calculator, RefreshCw, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization, useOrganizationCurrency } from '@/lib/saas/hooks';

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
    amount: number;
    date: string;
    client_name?: string;
    job_card_number?: string;
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
  
  const { organization } = useOrganization();
  const { format: formatMoney } = useOrganizationCurrency();

  const loadCommissionPayableData = async () => {
    setLoading(true);
    try {
      if (!organization?.id) return;

      // Get staff list
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('id, full_name')
        .eq('organization_id', organization.id)
        .eq('is_active', true);

      if (staffError) throw staffError;

      const staff = staffData || [];
      const staffMap = new Map(staff.map(s => [s.id, s.full_name]));

      // Get job card services with commissions in date range
      let servicesQuery = supabase
        .from('job_card_services')
        .select(`
          id,
          staff_id,
          commission_amount,
          created_at,
          job_card_id,
          job_cards!inner(
            organization_id,
            location_id,
            client_id,
            job_card_number,
            clients(full_name)
          )
        `)
        .eq('job_cards.organization_id', organization.id)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .not('staff_id', 'is', null)
        .not('commission_amount', 'is', null)
        .gt('commission_amount', 0);

      // Apply location filter with workaround for joins
      if (locationFilter !== 'all') {
        const { data: locationJobCards } = await supabase
          .from('job_cards')
          .select('id')
          .eq('location_id', locationFilter)
          .eq('organization_id', organization.id);
        
        const locationJobCardIds = (locationJobCards || []).map(jc => jc.id);
        if (locationJobCardIds.length > 0) {
          servicesQuery = servicesQuery.in('job_card_id', locationJobCardIds);
        } else {
          // No job cards for this location, return empty
          setCommissionData([]);
          return;
        }
      }

      const { data: services, error: servicesError } = await servicesQuery;
      if (servicesError) throw servicesError;

      // Group by staff and calculate totals
      const staffCommissions = new Map<string, CommissionPayableData>();

      (services || []).forEach((service: any) => {
        const staffId = service.staff_id;
        const staffName = staffMap.get(staffId) || 'Unknown Staff';
        const amount = Number(service.commission_amount || 0);

        if (!staffCommissions.has(staffId)) {
          staffCommissions.set(staffId, {
            staff_id: staffId,
            staff_name: staffName,
            total_accrued: 0,
            total_paid: 0,
            balance_payable: 0,
            commissions: []
          });
        }

        const staffData = staffCommissions.get(staffId)!;
        staffData.total_accrued += amount;
        staffData.commissions.push({
          id: service.id,
          amount: amount,
          date: service.created_at,
          client_name: service.job_cards?.clients?.full_name,
          job_card_number: service.job_cards?.job_card_number
        });
      });

      // Get payment data for commissions
      const commissionIds = (services || []).map(s => s.id);
      let staffPaidTotals = new Map<string, number>();
      
      if (commissionIds.length > 0) {
        const { data: paymentTxns, error: paymentsError } = await supabase
          .from('account_transactions')
          .select('reference_id, debit_amount, reference_type')
          .eq('reference_type', 'commission_payment')
          .gt('debit_amount', 0)
          .in('reference_id', commissionIds);

        if (paymentsError) throw paymentsError;

        (paymentTxns || []).forEach((txn: any) => {
          const commissionId = txn.reference_id as string;
          const service = (services || []).find(s => s.id === commissionId);
          if (!service) return;
          
          const staffId = service.staff_id;
          const paid = Number(txn.debit_amount || 0);
          staffPaidTotals.set(staffId, (staffPaidTotals.get(staffId) || 0) + paid);
        });
      }

      // Apply paid totals and calculate balance payable
      const finalData = Array.from(staffCommissions.values()).map(staff => {
        const totalPaid = staffPaidTotals.get(staff.staff_id) || 0;
        return {
          ...staff,
          total_paid: totalPaid,
          balance_payable: staff.total_accrued - totalPaid
        };
      });

      setCommissionData(finalData);
    } catch (error) {
      console.error('Error loading commission payable data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCommissionPayableData();
  }, [startDate, endDate, locationFilter, organization?.id]);

  const exportToPDF = () => {
    window.print();
  };

  // Filter data based on selected filters
  const filteredData = commissionData.filter(staff => {
    if (selectedStaff !== 'all' && staff.staff_id !== selectedStaff) return false;
    
    if (statusFilter === 'pending' && staff.balance_payable <= 0) return false;
    if (statusFilter === 'paid' && staff.balance_payable > 0) return false;
    
    return true;
  });

  // Calculate totals
  const totals = filteredData.reduce((acc, staff) => ({
    total_accrued: acc.total_accrued + staff.total_accrued,
    total_paid: acc.total_paid + staff.total_paid,
    balance_payable: acc.balance_payable + staff.balance_payable
  }), { total_accrued: 0, total_paid: 0, balance_payable: 0 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-muted rounded-xl shadow-lg border">
            <Calculator className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Commission Payable Report</h2>
            <p className="text-slate-600 text-sm">Staff commission accruals and payments</p>
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
          <div className="flex flex-wrap items-end gap-4">
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
              <Label>Staff Member</Label>
              <Select value={selectedStaff} onValueChange={setSelectedStaff}>
                <SelectTrigger className="w-48">
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
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending Payment</SelectItem>
                  <SelectItem value="paid">Fully Paid</SelectItem>
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
                {formatMoney(totals.total_accrued, { decimals: 2 })}
              </div>
              <div className="text-sm text-slate-600">Total Accrued</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">
                {formatMoney(totals.total_paid, { decimals: 2 })}
              </div>
              <div className="text-sm text-slate-600">Total Paid</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {formatMoney(totals.balance_payable, { decimals: 2 })}
              </div>
              <div className="text-sm text-slate-600">Balance Payable</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Commission Payable Table */}
      <Card>
        <CardHeader>
          <CardTitle>Commission Payable by Staff</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff Member</TableHead>
                <TableHead className="text-right">Total Accrued</TableHead>
                <TableHead className="text-right">Total Paid</TableHead>
                <TableHead className="text-right">Balance Payable</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((staff) => (
                <TableRow key={staff.staff_id}>
                  <TableCell className="font-medium">{staff.staff_name}</TableCell>
                  <TableCell className="text-right">{formatMoney(staff.total_accrued, { decimals: 2 })}</TableCell>
                  <TableCell className="text-right">{formatMoney(staff.total_paid, { decimals: 2 })}</TableCell>
                  <TableCell className="text-right">{formatMoney(staff.balance_payable, { decimals: 2 })}</TableCell>
                  <TableCell className="text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      staff.balance_payable <= 0 
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-orange-100 text-orange-800'
                    }`}>
                      {staff.balance_payable <= 0 ? 'Paid' : 'Pending'}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};