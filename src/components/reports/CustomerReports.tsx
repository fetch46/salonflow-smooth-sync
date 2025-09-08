import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, RefreshCw, Download, Calendar, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationCurrency } from '@/lib/saas/hooks';
import { Badge } from '@/components/ui/badge';

interface CustomerReportsProps {
  locationFilter: string;
  setLocationFilter: (value: string) => void;
  locations: Array<{ id: string; name: string }>;
  startDate: string;
  setStartDate: (value: string) => void;
  endDate: string;
  setEndDate: (value: string) => void;
}

export const CustomerReports: React.FC<CustomerReportsProps> = ({
  locationFilter,
  setLocationFilter,
  locations,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
}) => {
  const [loading, setLoading] = useState(false);
  const [salesByCustomer, setSalesByCustomer] = useState<any[]>([]);
  const [appointmentsByCustomer, setAppointmentsByCustomer] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('sales');

  const { format: formatMoney } = useOrganizationCurrency();

  const loadSalesByCustomer = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          total_amount,
          status,
          invoice_date,
          location_id,
          clients!inner(id, name, email, phone),
          business_locations(name),
          invoice_payments(amount, payment_date)
        `)
        .gte('invoice_date', startDate)
        .lte('invoice_date', endDate)
        .order('invoice_date', { ascending: false });

      if (locationFilter !== 'all') {
        query = query.eq('location_id', locationFilter);
      }

      const { data } = await query;
      const invoiceData = data || [];

      // Group by customer
      const customerSales: Record<string, any> = {};
      invoiceData.forEach((invoice: any) => {
        const clientId = invoice.clients.id;
        if (!customerSales[clientId]) {
          customerSales[clientId] = {
            client: invoice.clients,
            totalInvoiced: 0,
            totalPaid: 0,
            invoiceCount: 0,
            invoices: []
          };
        }
        
        customerSales[clientId].totalInvoiced += Number(invoice.total_amount || 0);
        customerSales[clientId].invoiceCount += 1;
        customerSales[clientId].invoices.push(invoice);
        
        const paidAmount = (invoice.invoice_payments || [])
          .reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0);
        customerSales[clientId].totalPaid += paidAmount;
      });

      setSalesByCustomer(Object.values(customerSales));
    } catch (error) {
      console.error('Error loading sales by customer:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAppointmentsByCustomer = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          status,
          notes,
          location_id,
          clients!inner(id, name, email, phone),
          services(name, price),
          staff(full_name),
          business_locations(name)
        `)
        .gte('appointment_date', startDate)
        .lte('appointment_date', endDate)
        .order('appointment_date', { ascending: false });

      if (locationFilter !== 'all') {
        query = query.eq('location_id', locationFilter);
      }

      const { data } = await query;
      const appointmentData = data || [];

      // Group by customer
      const customerAppointments: Record<string, any> = {};
      appointmentData.forEach((appointment: any) => {
        const clientId = appointment.clients.id;
        if (!customerAppointments[clientId]) {
          customerAppointments[clientId] = {
            client: appointment.clients,
            totalAppointments: 0,
            completedAppointments: 0,
            cancelledAppointments: 0,
            totalValue: 0,
            appointments: []
          };
        }
        
        customerAppointments[clientId].totalAppointments += 1;
        customerAppointments[clientId].appointments.push(appointment);
        
        if (appointment.status === 'completed') {
          customerAppointments[clientId].completedAppointments += 1;
        } else if (appointment.status === 'cancelled') {
          customerAppointments[clientId].cancelledAppointments += 1;
        }
        
        if (appointment.services?.price) {
          customerAppointments[clientId].totalValue += Number(appointment.services.price);
        }
      });

      setAppointmentsByCustomer(Object.values(customerAppointments));
    } catch (error) {
      console.error('Error loading appointments by customer:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'sales') {
      loadSalesByCustomer();
    } else {
      loadAppointmentsByCustomer();
    }
  }, [startDate, endDate, locationFilter, activeTab]);

  const exportToPDF = () => {
    window.print();
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'paid':
        return 'default';
      case 'confirmed':
      case 'pending':
        return 'secondary';
      case 'cancelled':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl shadow-lg">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Customer Reports</h2>
            <p className="text-slate-600 text-sm">Sales and appointment analytics by customer</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportToPDF}>
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
          <Button variant="outline" onClick={activeTab === 'sales' ? loadSalesByCustomer : loadAppointmentsByCustomer} disabled={loading}>
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="sales" className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Sales by Customer
          </TabsTrigger>
          <TabsTrigger value="appointments" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Appointments by Customer
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Sales by Customer</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead className="text-right">Total Invoiced</TableHead>
                      <TableHead className="text-right">Total Paid</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                      <TableHead className="text-right">Invoice Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesByCustomer
                      .sort((a, b) => b.totalInvoiced - a.totalInvoiced)
                      .map((customer) => {
                        const outstanding = customer.totalInvoiced - customer.totalPaid;
                        return (
                          <TableRow key={customer.client.id}>
                            <TableCell className="font-medium">{customer.client.name}</TableCell>
                            <TableCell>{customer.client.email || '-'}</TableCell>
                            <TableCell>{customer.client.phone || '-'}</TableCell>
                            <TableCell className="text-right">{formatMoney(customer.totalInvoiced, { decimals: 2 })}</TableCell>
                            <TableCell className="text-right">{formatMoney(customer.totalPaid, { decimals: 2 })}</TableCell>
                            <TableCell className={`text-right ${outstanding > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                              {formatMoney(outstanding, { decimals: 2 })}
                            </TableCell>
                            <TableCell className="text-right">{customer.invoiceCount}</TableCell>
                          </TableRow>
                        );
                      })}
                    {salesByCustomer.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          No sales data found for the selected criteria
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Invoice Details */}
          {salesByCustomer.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Invoice Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salesByCustomer.flatMap(customer => 
                        customer.invoices.map((invoice: any) => (
                          <TableRow key={invoice.id}>
                            <TableCell className="font-medium">{customer.client.name}</TableCell>
                            <TableCell>{invoice.invoice_number}</TableCell>
                            <TableCell>{new Date(invoice.invoice_date).toLocaleDateString()}</TableCell>
                            <TableCell>{invoice.business_locations?.name || 'No Location'}</TableCell>
                            <TableCell className="text-right">{formatMoney(invoice.total_amount, { decimals: 2 })}</TableCell>
                            <TableCell>
                              <Badge variant={getStatusBadgeVariant(invoice.status)}>
                                {invoice.status || 'Draft'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="appointments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Appointments by Customer</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead className="text-right">Total Appointments</TableHead>
                      <TableHead className="text-right">Completed</TableHead>
                      <TableHead className="text-right">Cancelled</TableHead>
                      <TableHead className="text-right">Total Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {appointmentsByCustomer
                      .sort((a, b) => b.totalAppointments - a.totalAppointments)
                      .map((customer) => (
                        <TableRow key={customer.client.id}>
                          <TableCell className="font-medium">{customer.client.name}</TableCell>
                          <TableCell>{customer.client.email || '-'}</TableCell>
                          <TableCell>{customer.client.phone || '-'}</TableCell>
                          <TableCell className="text-right">{customer.totalAppointments}</TableCell>
                          <TableCell className="text-right text-emerald-600">{customer.completedAppointments}</TableCell>
                          <TableCell className="text-right text-red-600">{customer.cancelledAppointments}</TableCell>
                          <TableCell className="text-right">{formatMoney(customer.totalValue, { decimals: 2 })}</TableCell>
                        </TableRow>
                      ))}
                    {appointmentsByCustomer.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          No appointment data found for the selected criteria
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Appointment Details */}
          {appointmentsByCustomer.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Appointment Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Service</TableHead>
                        <TableHead>Staff</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {appointmentsByCustomer.flatMap(customer => 
                        customer.appointments.map((appointment: any) => (
                          <TableRow key={appointment.id}>
                            <TableCell className="font-medium">{customer.client.name}</TableCell>
                            <TableCell>{new Date(appointment.appointment_date).toLocaleDateString()}</TableCell>
                            <TableCell>{appointment.services?.name || 'No Service'}</TableCell>
                            <TableCell>{appointment.staff?.full_name || 'Unassigned'}</TableCell>
                            <TableCell>{appointment.business_locations?.name || 'No Location'}</TableCell>
                            <TableCell className="text-right">{formatMoney(appointment.services?.price || 0, { decimals: 2 })}</TableCell>
                            <TableCell>
                              <Badge variant={getStatusBadgeVariant(appointment.status)}>
                                {appointment.status || 'Scheduled'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};