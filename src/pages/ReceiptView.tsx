import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export default function ReceiptView() {
  const { id } = useParams();
  const [receipt, setReceipt] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [{ data: r }, { data: it }, { data: pays }] = await Promise.all([
          supabase.from('receipts').select('*').eq('id', id).maybeSingle(),
          supabase.from('receipt_items').select('*').eq('receipt_id', id),
          supabase.from('receipt_payments').select('*').eq('receipt_id', id).order('payment_date', { ascending: false }),
        ] as any);
        setReceipt(r);
        setItems(it || []);
        setPayments(pays || []);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <div className="p-6">Loading...</div>;
  if (!receipt) return <div className="p-6">Receipt not found</div>;

  const outstanding = Math.max(0, (receipt.total_amount || 0) - (receipt.amount_paid || 0));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Receipt {receipt.receipt_number}</h2>
        <Badge variant={receipt.status === 'paid' ? 'default' : receipt.status === 'partial' ? 'outline' : 'secondary'}>
          {receipt.status.toUpperCase()}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="text-sm text-muted-foreground">No items</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell>{it.description}</TableCell>
                    <TableCell>{it.quantity}</TableCell>
                    <TableCell>${Number(it.unit_price).toFixed(2)}</TableCell>
                    <TableCell>${Number(it.total_price).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payments</CardTitle>
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
    </div>
  );
}