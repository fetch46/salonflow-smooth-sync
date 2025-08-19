import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  FileText,
  Wallet,
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

const { format: defaultFormatMoney } = { format: (n: number) => n.toLocaleString() } as any;

const Reports: React.FC = () => {
  const navigate = useNavigate();
  const { organizationRole } = useSaas();
  const { organization } = useOrganization();
  const { format: formatMoney } = useOrganizationCurrency() || { format: defaultFormatMoney } as any;
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'invoice_details');
  const [startDate, setStartDate] = useState<string>(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return start.toISOString().slice(0,10);
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().slice(0,10));
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [locationId, setLocationId] = useState<'all' | string>('all');

  useEffect(() => {
    const role = organizationRole || '';
    if (role !== 'accountant' && role !== 'owner') {
      navigate('/dashboard');
    }
  }, [organizationRole]);

  useEffect(() => {
    (async () => {
      if (!organization?.id) return;
      const { data } = await supabase
        .from('business_locations')
        .select('id, name')
        .eq('organization_id', organization.id)
        .eq('is_active', true)
        .order('name');
      setLocations(data || []);
    })();
  }, [organization?.id]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', activeTab);
    if (locationId && locationId !== 'all') next.set('location', locationId); else next.delete('location');
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [activeTab, locationId]);

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <Label>Start</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-[180px]" />
        </div>
        <div>
          <Label>End</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-[180px]" />
        </div>
        <div className="w-[220px]">
          <Label>Location</Label>
          <Select value={locationId} onValueChange={(v) => setLocationId(v)}>
            <SelectTrigger><SelectValue placeholder="All locations" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {locations.map(l => (<SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="invoice_details"><FileText className="w-4 h-4 mr-2" />Invoice Details</TabsTrigger>
          <TabsTrigger value="payment_details"><Wallet className="w-4 h-4 mr-2" />Payment Details</TabsTrigger>
        </TabsList>
        <TabsContent value="invoice_details">
          <InvoiceDetailsReport startDate={startDate} endDate={endDate} locationId={locationId} formatMoney={formatMoney} />
        </TabsContent>
        <TabsContent value="payment_details">
          <PaymentDetailsReport startDate={startDate} endDate={endDate} locationId={locationId} formatMoney={formatMoney} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reports;

const InvoiceDetailsReport: React.FC<{ startDate: string; endDate: string; locationId: string | 'all'; formatMoney: (n: number, opts?: any) => string }>
  = ({ startDate, endDate, locationId, formatMoney }) => {
  const [rows, setRows] = useState<Array<{
    id: string;
    date: string;
    invoice_number: string;
    customer_name: string;
    status: string;
    subtotal: number;
    tax_amount: number;
    discount_amount: number;
    total_amount: number;
    paid_amount: number;
    balance: number;
  }>>([]);
  const [totals, setTotals] = useState<{ invoiced: number; paid: number; balance: number }>({ invoiced: 0, paid: 0, balance: 0 });

  useEffect(() => {
    const load = async () => {
      let invQ = supabase
        .from('invoices')
        .select('id, created_at, invoice_number, customer_name, status, subtotal, tax_amount, discount_amount, total_amount, location_id')
        .gte('created_at', startDate)
        .lte('created_at', endDate);
      if (locationId !== 'all') invQ = invQ.eq('location_id', locationId as any);
      const { data: invoices, error: invErr } = await invQ as any;
      if (invErr) {
        setRows([]);
        setTotals({ invoiced: 0, paid: 0, balance: 0 });
        return;
      }
      const list = (invoices || []) as any[];
      const ids = list.map(i => i.id);
      let payQ = supabase
        .from('invoice_payments')
        .select('invoice_id, amount, payment_date, location_id')
        .gte('payment_date', startDate)
        .lte('payment_date', endDate);
      if (locationId !== 'all') payQ = payQ.eq('location_id', locationId as any);
      if (ids.length > 0) payQ = payQ.in('invoice_id', ids);
      const { data: pays } = await payQ as any;
      const paidMap = new Map<string, number>();
      for (const p of (pays || []) as any[]) paidMap.set(p.invoice_id, (paidMap.get(p.invoice_id) || 0) + Number(p.amount || 0));
      const mapped = list.map(i => {
        const paid = paidMap.get(i.id) || 0;
        const balance = Math.max(0, Number(i.total_amount || 0) - paid);
        return {
          id: i.id,
          date: String(i.created_at || '').slice(0,10),
          invoice_number: i.invoice_number,
          customer_name: i.customer_name,
          status: i.status,
          subtotal: Number(i.subtotal || 0),
          tax_amount: Number(i.tax_amount || 0),
          discount_amount: Number(i.discount_amount || 0),
          total_amount: Number(i.total_amount || 0),
          paid_amount: paid,
          balance,
        };
      }).sort((a, b) => a.date.localeCompare(b.date));
      setRows(mapped);
      const invoiced = mapped.reduce((s, r) => s + r.total_amount, 0);
      const paid = mapped.reduce((s, r) => s + r.paid_amount, 0);
      const balance = mapped.reduce((s, r) => s + r.balance, 0);
      setTotals({ invoiced, paid, balance });
    };
    load();
  }, [startDate, endDate, locationId]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="text-center p-4 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-700">{formatMoney(totals.invoiced, { decimals: 2 })}</div>
          <div className="text-sm text-blue-700">Total Invoiced</div>
        </div>
        <div className="text-center p-4 bg-emerald-50 rounded-lg">
          <div className="text-2xl font-bold text-emerald-700">{formatMoney(totals.paid, { decimals: 2 })}</div>
          <div className="text-sm text-emerald-700">Total Paid</div>
        </div>
        <div className="text-center p-4 bg-amber-50 rounded-lg">
          <div className="text-2xl font-bold text-amber-700">{formatMoney(totals.balance, { decimals: 2 })}</div>
          <div className="text-sm text-amber-700">Total Balance</div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table className="min-w-[980px]">
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Invoice #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
              <TableHead className="text-right">Tax</TableHead>
              <TableHead className="text-right">Discount</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id} className="cursor-pointer hover:bg-slate-50" onClick={() => window.location.assign(`/invoices/${r.id}/edit`)}>
                <TableCell>{r.date}</TableCell>
                <TableCell>{r.invoice_number}</TableCell>
                <TableCell>{r.customer_name}</TableCell>
                <TableCell>{r.status}</TableCell>
                <TableCell className="text-right">{formatMoney(r.subtotal, { decimals: 2 })}</TableCell>
                <TableCell className="text-right">{formatMoney(r.tax_amount, { decimals: 2 })}</TableCell>
                <TableCell className="text-right">{formatMoney(r.discount_amount, { decimals: 2 })}</TableCell>
                <TableCell className="text-right font-medium">{formatMoney(r.total_amount, { decimals: 2 })}</TableCell>
                <TableCell className="text-right text-emerald-700">{formatMoney(r.paid_amount, { decimals: 2 })}</TableCell>
                <TableCell className="text-right text-amber-700">{formatMoney(r.balance, { decimals: 2 })}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground">No invoices found</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

const PaymentDetailsReport: React.FC<{ startDate: string; endDate: string; locationId: string | 'all'; formatMoney: (n: number, opts?: any) => string }>
  = ({ startDate, endDate, locationId, formatMoney }) => {
  const [rows, setRows] = useState<Array<{
    id: string;
    date: string;
    invoice_number: string | null;
    customer_name: string | null;
    method: string | null;
    reference_number: string | null;
    amount: number;
  }>>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const load = async () => {
      let q = supabase
        .from('invoice_payments')
        .select('id, payment_date, amount, method, reference_number, location_id, invoices:invoice_id (invoice_number, customer_name)')
        .gte('payment_date', startDate)
        .lte('payment_date', endDate)
        .order('payment_date', { ascending: true });
      if (locationId !== 'all') q = q.eq('location_id', locationId as any);
      const { data, error } = await q as any;
      if (error) {
        setRows([]);
        setTotal(0);
        return;
      }
      const mapped = (data || []).map((r: any) => ({
        id: r.id,
        date: String(r.payment_date || '').slice(0,10),
        invoice_number: r.invoices?.invoice_number || null,
        customer_name: r.invoices?.customer_name || null,
        method: r.method || null,
        reference_number: r.reference_number || null,
        amount: Number(r.amount || 0),
      }));
      setRows(mapped);
      setTotal(mapped.reduce((s, r) => s + r.amount, 0));
    };
    load();
  }, [startDate, endDate, locationId]);

  return (
    <div className="space-y-4">
      <div className="text-center p-4 bg-emerald-50 rounded-lg">
        <div className="text-2xl font-bold text-emerald-700">{formatMoney(total, { decimals: 2 })}</div>
        <div className="text-sm text-emerald-700">Total Payments Received</div>
      </div>
      <div className="overflow-x-auto">
        <Table className="min-w-[880px]">
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Invoice #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell>{r.date}</TableCell>
                <TableCell>{r.invoice_number || '—'}</TableCell>
                <TableCell>{r.customer_name || '—'}</TableCell>
                <TableCell>{r.method || '—'}</TableCell>
                <TableCell>{r.reference_number || '—'}</TableCell>
                <TableCell className="text-right">{formatMoney(r.amount, { decimals: 2 })}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">No payments found</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};