import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, RefreshCw, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationCurrency } from '@/lib/saas/hooks';

interface SalesReportProps {
  locationFilter: string;
  setLocationFilter: (value: string) => void;
  locations: Array<{ id: string; name: string }>;
  startDate: string;
  setStartDate: (value: string) => void;
  endDate: string;
  setEndDate: (value: string) => void;
}

export const SalesReport: React.FC<SalesReportProps> = ({
  locationFilter,
  setLocationFilter,
  locations,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
}) => {
  const [loading, setLoading] = useState(false);
  const [salesData, setSalesData] = useState({
    totalSales: 0,
    totalInvoices: 0,
    averageOrderValue: 0,
    topServices: [] as Array<{ service_name: string; quantity: number; revenue: number }>,
    topProducts: [] as Array<{ product_name: string; quantity: number; revenue: number }>,
    salesByLocation: [] as Array<{ location_name: string; sales: number; invoices: number }>,
    salesByStaff: [] as Array<{ staff_name: string; sales: number; invoices: number }>,
  });

  const { format: formatMoney } = useOrganizationCurrency();

  const calculateSalesReport = async () => {
    setLoading(true);
    try {
      // Get invoices within date range with location filtering
      let invoicesQuery = supabase
        .from('invoices')
        .select(`
          id, 
          total_amount, 
          location_id,
          business_locations!inner(name),
          invoice_items(
            id,
            quantity,
            total_price,
            description,
            service_id,
            product_id,
            staff_id,
            services!left(name),
            staff!left(full_name)
          )
        `)
        .eq('status', 'sent')
        .gte('issue_date', startDate)
        .lte('issue_date', endDate);

      if (locationFilter !== 'all') {
        invoicesQuery = invoicesQuery.eq('location_id', locationFilter);
      }

      const { data: invoices } = await invoicesQuery;
      const invoiceList = invoices || [];

      // Calculate totals
      const totalSales = invoiceList.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);
      const totalInvoices = invoiceList.length;
      const averageOrderValue = totalInvoices > 0 ? totalSales / totalInvoices : 0;

      // Process invoice items for detailed analysis
      const serviceMap = new Map<string, { quantity: number; revenue: number }>();
      const productMap = new Map<string, { quantity: number; revenue: number }>();
      const locationMap = new Map<string, { sales: number; invoices: number }>();
      const staffMap = new Map<string, { sales: number; invoices: number }>();

      invoiceList.forEach((invoice) => {
        // Track by location
        const locationName = (invoice.business_locations as any)?.name || 'Unknown Location';
        if (!locationMap.has(locationName)) {
          locationMap.set(locationName, { sales: 0, invoices: 0 });
        }
        const locationData = locationMap.get(locationName)!;
        locationData.sales += Number(invoice.total_amount || 0);
        locationData.invoices += 1;

        // Process invoice items
        (invoice.invoice_items || []).forEach((item: any) => {
          const quantity = Number(item.quantity || 0);
          const revenue = Number(item.total_price || 0);

          // Track services
          if (item.service_id && item.services?.name) {
            const serviceName = item.services.name;
            if (!serviceMap.has(serviceName)) {
              serviceMap.set(serviceName, { quantity: 0, revenue: 0 });
            }
            const serviceData = serviceMap.get(serviceName)!;
            serviceData.quantity += quantity;
            serviceData.revenue += revenue;
          }

          // Track products - simplified approach without direct join
          if (item.product_id && item.description) {
            const productName = item.description;
            if (!productMap.has(productName)) {
              productMap.set(productName, { quantity: 0, revenue: 0 });
            }
            const productData = productMap.get(productName)!;
            productData.quantity += quantity;
            productData.revenue += revenue;
          }

          // Track staff
          if (item.staff_id && item.staff?.full_name) {
            const staffName = item.staff.full_name;
            if (!staffMap.has(staffName)) {
              staffMap.set(staffName, { sales: 0, invoices: 0 });
            }
            const staffData = staffMap.get(staffName)!;
            staffData.sales += revenue;
            staffData.invoices += 1;
          }
        });
      });

      // Convert maps to sorted arrays
      const topServices = Array.from(serviceMap.entries())
        .map(([name, data]) => ({ service_name: name, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      const topProducts = Array.from(productMap.entries())
        .map(([name, data]) => ({ product_name: name, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      const salesByLocation = Array.from(locationMap.entries())
        .map(([name, data]) => ({ location_name: name, ...data }))
        .sort((a, b) => b.sales - a.sales);

      const salesByStaff = Array.from(staffMap.entries())
        .map(([name, data]) => ({ staff_name: name, ...data }))
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 10);

      setSalesData({
        totalSales,
        totalInvoices,
        averageOrderValue,
        topServices,
        topProducts,
        salesByLocation,
        salesByStaff,
      });
    } catch (error) {
      console.error('Error calculating sales report:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    calculateSalesReport();
  }, [startDate, endDate, locationFilter]);

  const exportToPDF = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-muted rounded-xl shadow-lg border">
            <TrendingUp className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Sales Report</h2>
            <p className="text-slate-600 text-sm">Comprehensive sales performance analysis</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportToPDF}>
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
          <Button variant="outline" onClick={calculateSalesReport} disabled={loading}>
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
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">
                {formatMoney(salesData.totalSales, { decimals: 2 })}
              </div>
              <div className="text-sm text-slate-600">Total Sales</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {salesData.totalInvoices}
              </div>
              <div className="text-sm text-slate-600">Total Invoices</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {formatMoney(salesData.averageOrderValue, { decimals: 2 })}
              </div>
              <div className="text-sm text-slate-600">Average Order Value</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analysis */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Services</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salesData.topServices.map((service, index) => (
                  <TableRow key={`service-${index}`}>
                    <TableCell className="font-medium">{service.service_name}</TableCell>
                    <TableCell className="text-right">{service.quantity}</TableCell>
                    <TableCell className="text-right">{formatMoney(service.revenue, { decimals: 2 })}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Products</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salesData.topProducts.map((product, index) => (
                  <TableRow key={`product-${index}`}>
                    <TableCell className="font-medium">{product.product_name}</TableCell>
                    <TableCell className="text-right">{product.quantity}</TableCell>
                    <TableCell className="text-right">{formatMoney(product.revenue, { decimals: 2 })}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sales by Location</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Invoices</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salesData.salesByLocation.map((location, index) => (
                  <TableRow key={`location-${index}`}>
                    <TableCell className="font-medium">{location.location_name}</TableCell>
                    <TableCell className="text-right">{location.invoices}</TableCell>
                    <TableCell className="text-right">{formatMoney(location.sales, { decimals: 2 })}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sales by Staff</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff Member</TableHead>
                  <TableHead className="text-right">Items Sold</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salesData.salesByStaff.map((staff, index) => (
                  <TableRow key={`staff-${index}`}>
                    <TableCell className="font-medium">{staff.staff_name}</TableCell>
                    <TableCell className="text-right">{staff.invoices}</TableCell>
                    <TableCell className="text-right">{formatMoney(staff.sales, { decimals: 2 })}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};