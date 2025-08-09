import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { getReceiptsWithFallback } from "@/utils/mockDatabase";

interface Receipt {
  id: string;
  receipt_number: string;
  customer_id: string | null;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  amount_paid: number;
  status: string;
  notes: string | null;
  created_at: string;
}

export default function Receipts() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [selected, setSelected] = useState<Receipt | null>(null);
  const [payment, setPayment] = useState({ amount: "", method: "cash", reference: "" });

  const fetchReceipts = async () => {
    try {
      setLoading(true);
      const data = await getReceiptsWithFallback(supabase);
      setReceipts((data as any[]).map(r => ({ amount_paid: 0, ...r })) as Receipt[]);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load receipts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    await fetchReceipts();
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return receipts.filter(r => r.receipt_number.toLowerCase().includes(s) || (r.notes || '').toLowerCase().includes(s));
  }, [receipts, search]);

  const outstanding = (r: Receipt) => Math.max(0, (r.total_amount || 0) - (r.amount_paid || 0));

  const exportCsv = () => {
    const headers = [
      'Receipt Number',
      'Date',
      'Status',
      'Subtotal',
      'Tax',
      'Discount',
      'Total',
      'Amount Paid',
      'Outstanding',
    ];
    const rows = filtered.map(r => [
      r.receipt_number,
      new Date(r.created_at).toISOString(),
      r.status,
      (r.subtotal || 0).toFixed(2),
      (r.tax_amount || 0).toFixed(2),
      (r.discount_amount || 0).toFixed(2),
      (r.total_amount || 0).toFixed(2),
      (r.amount_paid || 0).toFixed(2),
      outstanding(r).toFixed(2),
    ]);
    const csv = [headers, ...rows].map(cols => cols.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipts_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const openPayment = (r: Receipt) => {
    setSelected(r);
    setPayment({ amount: String(outstanding(r)), method: 'cash', reference: '' });
    setIsPayOpen(true);
  };

  const recordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    const amt = parseFloat(payment.amount) || 0;
    if (amt <= 0 || amt > outstanding(selected)) {
      toast.error('Invalid amount');
      return;
    }
    try {
      const { error } = await supabase
        .from('receipt_payments')
        .insert([
          { receipt_id: selected.id, amount: amt, method: payment.method, reference_number: payment.reference || null },
        ]);
      if (error) throw error;
      toast.success('Payment recorded');
      setIsPayOpen(false);
      setSelected(null);
      fetchReceipts();
    } catch (e) {
      console.error(e);
      toast.error('Failed to record payment');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="mt-2 text-muted-foreground">Loading receipts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Receipts</h2>
        <div className="flex items-center gap-2">
          <Input placeholder="Search receipts..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
          <Button variant="outline" onClick={exportCsv}>
            Export CSV
          </Button>
          <Button variant="outline" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Receipts</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Outstanding</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.receipt_number}</TableCell>
                  <TableCell>{format(new Date(r.created_at), 'MMM dd, yyyy')}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === 'paid' ? 'default' : r.status === 'partial' ? 'outline' : 'secondary'}>
                      {r.status.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>${(r.total_amount || 0).toFixed(2)}</TableCell>
                  <TableCell>${(r.amount_paid || 0).toFixed(2)}</TableCell>
                  <TableCell>${outstanding(r).toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    {outstanding(r) > 0 && (
                      <Button size="sm" onClick={() => openPayment(r)}>
                        <DollarSign className="w-4 h-4 mr-1" /> Pay
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isPayOpen} onOpenChange={setIsPayOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <form onSubmit={recordPayment} className="space-y-4">
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input type="number" step="0.01" value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Method</Label>
              <select className="border rounded px-3 py-2 w-full" value={payment.method} onChange={(e) => setPayment({ ...payment, method: e.target.value })}>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="mpesa">M-Pesa</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Reference (optional)</Label>
              <Input value={payment.reference} onChange={(e) => setPayment({ ...payment, reference: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsPayOpen(false)}>Cancel</Button>
              <Button type="submit">Record</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}