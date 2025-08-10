import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOrganizationCurrency } from "@/lib/saas/hooks";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Edit3, Truck } from "lucide-react";

interface PurchaseRecord { id: string; purchase_number: string; vendor_name: string; purchase_date: string; subtotal: number; tax_amount: number; total_amount: number; status: string; notes: string | null }
interface PurchaseItem { id: string; item_id: string; quantity: number; unit_cost: number; total_cost: number; received_quantity: number; inventory_items: { name: string } | null }

export default function PurchaseView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { format } = useOrganizationCurrency();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [purchase, setPurchase] = useState<PurchaseRecord | null>(null);
  const [items, setItems] = useState<PurchaseItem[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const { data: p, error: pErr } = await supabase.from("purchases").select("*").eq("id", id).single();
        if (pErr) throw pErr;
        setPurchase(p as any);
        const { data: it, error: iErr } = await supabase
          .from("purchase_items")
          .select("*, inventory_items(name)")
          .eq("purchase_id", id);
        if (iErr) throw iErr;
        setItems((it || []) as any);
      } catch (e: any) {
        console.error(e);
        toast({ title: "Error", description: e?.message || "Failed to load purchase", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    if (id) load();
  }, [id, toast]);

  if (loading) return <div className="p-6">Loading...</div>;
  if (!purchase) return <div className="p-6">Purchase not found</div>;

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 pb-24 sm:pb-6 bg-gradient-to-br from-slate-50 to-slate-100/50 min-h-screen overflow-x-hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-2"/>Back</Button>
          <h1 className="text-2xl font-bold">Purchase {purchase.purchase_number}</h1>
          <Badge>{purchase.status.toUpperCase()}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate(`/purchases/${purchase.id}/edit`)}><Edit3 className="h-4 w-4 mr-2"/>Edit</Button>
          {(purchase.status === 'pending' || purchase.status === 'partial') && (
            <Button onClick={() => navigate(`/goods-received/new?purchaseId=${purchase.id}`)}><Truck className="h-4 w-4 mr-2"/>Receive</Button>
          )}
        </div>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>Vendor and amounts</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div>
            <div className="text-sm text-muted-foreground">Vendor</div>
            <div className="font-medium">{purchase.vendor_name}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Date</div>
            <div className="font-medium">{(purchase.purchase_date || '').slice(0,10)}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Total</div>
            <div className="font-semibold">{format(purchase.total_amount)}</div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Ordered</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Unit Cost</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(it => (
                <TableRow key={it.id}>
                  <TableCell>{it.inventory_items?.name || it.item_id}</TableCell>
                  <TableCell>{it.quantity}</TableCell>
                  <TableCell>{it.received_quantity}</TableCell>
                  <TableCell>{format(it.unit_cost)}</TableCell>
                  <TableCell>{format(it.total_cost)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}