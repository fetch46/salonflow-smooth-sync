import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { useOrganizationCurrency } from '@/lib/saas/hooks';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  Users, Mail, Phone, Receipt as ReceiptIcon, FileText, Download, Printer, MessageSquare, Edit2, DollarSign
} from 'lucide-react';

export default function ReceiptView() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [receipt, setReceipt] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { symbol } = useOrganizationCurrency();
  const isPrintMode = useMemo(() => new URLSearchParams(location.search).get('print') === '1', [location.search]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [{ data: r }, { data: it }, pays, customer] = await Promise.all([
          supabase.from('receipts').select('*').eq('id', id).maybeSingle(),
          supabase.from('receipt_items').select('*').eq('receipt_id', id),
          (async () => {
            const { getReceiptPaymentsWithFallback } = await import('@/utils/mockDatabase');
            return await getReceiptPaymentsWithFallback(supabase, String(id));
          })(),
          (async () => {
            // fetch customer for display if available on receipt
            const rec = await supabase.from('receipts').select('customer_id').eq('id', id).maybeSingle();
            const cid = (rec as any)?.data?.customer_id;
            if (!cid) return null;
            const { data } = await supabase.from('clients').select('id, full_name, email, phone').eq('id', cid).maybeSingle();
            return data;
          })(),
        ] as any);
        setReceipt(r);
        setItems(it || []);
        setPayments(pays || []);
        setCustomerInfo(customer);
      } catch (e) {
        console.error(e);
        toast.error('Failed to load receipt');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    if (!loading && isPrintMode) {
      // Defer to allow render
      setTimeout(() => {
        window.print();
      }, 100);
    }
  }, [loading, isPrintMode]);

  const [customerInfo, setCustomerInfo] = useState<any | null>(null);

  if (loading) return <div className="p-6">Loading...</div>;
  if (!receipt) return <div className="p-6">Receipt not found</div>;

  const outstanding = Math.max(0, (receipt.total_amount || 0) - (receipt.amount_paid || 0));

  return (
    <div className={`p-6 space-y-6 ${isPrintMode ? 'bg-white' : ''}`}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Receipt {receipt.receipt_number}</h2>
          <div className="text-sm text-slate-500">Created {format(new Date(receipt.created_at), 'MMM dd, yyyy')}</div>
        </div>
        <Badge variant={receipt.status === 'paid' ? 'default' : receipt.status === 'partial' ? 'outline' : 'secondary'}>
          {receipt.status.toUpperCase()}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-blue-700 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Customer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="font-semibold">{customerInfo?.full_name || 'Walk-in'}</div>
            {customerInfo?.email && (
              <div className="text-sm text-slate-600 flex items-center gap-2">
                <Mail className="w-3 h-3" />
                {customerInfo.email}
              </div>
            )}
            {customerInfo?.phone && (
              <div className="text-sm text-slate-600 flex items-center gap-2">
                <Phone className="w-3 h-3" />
                {customerInfo.phone}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-violet-50 border-violet-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-violet-700 flex items-center gap-2">
              <ReceiptIcon className="w-4 h-4" />
              Receipt Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Date:</span>
              <span className="font-medium">{format(new Date(receipt.created_at), 'MMM dd, yyyy')}</span>
            </div>
            {receipt.payment_method && (
              <div className="flex justify-between">
                <span className="text-slate-600">Payment:</span>
                <span className="font-medium">{receipt.payment_method}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Items
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <FileText className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-slate-500">No items found for this receipt</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="font-medium">{it.description}</TableCell>
                    <TableCell>{it.quantity}</TableCell>
                    <TableCell>${Number(it.unit_price).toFixed(2)}</TableCell>
                    <TableCell className="font-semibold">{symbol}{Number(it.total_price).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payments</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="text-sm text-muted-foreground">No payments</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{format(new Date(p.payment_date), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>{p.method}</TableCell>
                    <TableCell>{p.reference_number || '—'}</TableCell>
                    <TableCell>${Number(p.amount).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="mt-4 text-sm">
            <div>Total: ${Number(receipt.total_amount).toFixed(2)}</div>
            <div>Paid: ${Number(receipt.amount_paid || 0).toFixed(2)}</div>
            <div>Outstanding: ${Number(outstanding).toFixed(2)}</div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-50">
        <CardContent className="p-4">
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span className="font-semibold">${Number(receipt.subtotal || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Tax:</span>
                <span className="font-semibold">${Number(receipt.tax_amount || 0).toFixed(2)}</span>
              </div>
              {Number(receipt.discount_amount || 0) > 0 && (
                <div className="flex justify-between text-sm text-red-600">
                  <span>Discount:</span>
                  <span className="font-semibold">-{symbol}{Number(receipt.discount_amount).toFixed(2)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span className="text-violet-600">${Number(receipt.total_amount || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {!isPrintMode && (
        <div className="flex justify-between items-center pt-2 print:hidden">
          <Button variant="outline" onClick={() => navigate(-1)}>Back</Button>
          <div className="flex gap-3">
            {outstanding > 0 && (
              <Button onClick={() => navigate('/receipts') }>
                <DollarSign className="w-4 h-4 mr-2" />
                Record Payment
              </Button>
            )}
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
            <Button variant="outline">
              <MessageSquare className="w-4 h-4 mr-2" />
              Send WhatsApp
            </Button>
            <Button className="bg-violet-600 hover:bg-violet-700">
              <Edit2 className="w-4 h-4 mr-2" />
              Edit Receipt
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}