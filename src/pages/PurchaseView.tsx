import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOrganizationCurrency } from "@/lib/saas/hooks";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Edit3, Truck, ShoppingCart } from "lucide-react";

interface PurchaseRecord { 
  id: string; 
  purchase_number: string; 
  vendor_name: string; 
  purchase_date: string; 
  subtotal: number; 
  tax_amount: number; 
  total_amount: number; 
  status: string; 
  notes: string | null;
}

interface PurchaseItem { 
  id: string; 
  item_id: string; 
  quantity: number; 
  unit_cost: number; 
  total_cost: number; 
  received_quantity: number; 
  inventory_items: { name: string } | null;
}

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

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
        <p className="mt-2 text-muted-foreground">Loading purchase details...</p>
      </div>
    </div>
  );
  
  if (!purchase) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-muted-foreground">Purchase not found</h2>
        <p className="text-muted-foreground">The requested purchase could not be found.</p>
        <Button onClick={() => navigate("/purchases")} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Purchases
        </Button>
      </div>
    </div>
  );

  return (
    <div className="w-full mx-auto p-2 sm:p-4 md:p-6 space-y-6">
      {/* Purchase Header */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start md:items-center gap-4 md:gap-6 flex-1 min-w-0">
              <Button variant="ghost" onClick={() => navigate("/purchases")}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center">
                <ShoppingCart className="w-8 h-8 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent truncate">
                  {purchase.purchase_number}
                </h1>
                <p className="text-muted-foreground text-lg">
                  Vendor: {purchase.vendor_name}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-start md:items-end space-y-2">
              <div className="flex gap-2 w-full md:w-auto">
                <Button onClick={() => navigate(`/purchases/${purchase.id}/edit`)} className="bg-gradient-to-r from-orange-500 to-amber-600 text-white w-full md:w-auto">
                  <Edit3 className="w-4 h-4 mr-2" />
                  Edit Purchase
                </Button>
                {(purchase.status === 'pending' || purchase.status === 'partial') && (
                  <Button onClick={() => navigate(`/goods-received/new?purchaseId=${purchase.id}`)} variant="outline">
                    <Truck className="w-4 h-4 mr-2" />
                    Receive
                  </Button>
                )}
              </div>
              <div className="flex space-x-2">
                <Badge variant={purchase.status === 'received' ? "default" : "secondary"} className="text-xs">
                  {purchase.status.toUpperCase()}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Purchase Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-700">Vendor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-orange-700">{purchase.vendor_name}</div>
            <p className="text-xs text-orange-600">Purchase supplier</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-sky-50 border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700">Purchase Date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-blue-700">{(purchase.purchase_date || '').slice(0,10)}</div>
            <p className="text-xs text-blue-600">Order date</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700">Subtotal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-green-700">{format(purchase.subtotal)}</div>
            <p className="text-xs text-green-600">Before tax</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-700">Total Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-purple-700">{format(purchase.total_amount)}</div>
            <p className="text-xs text-purple-600">Final total</p>
          </CardContent>
        </Card>
      </div>

      {/* Purchase Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-orange-600" />
            Purchase Items
          </CardTitle>
          <CardDescription>Items included in this purchase order</CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingCart className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No Items Found</h3>
              <p className="mb-4">This purchase order doesn't have any items yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Item</TableHead>
                  <TableHead className="font-semibold text-right">Ordered</TableHead>
                  <TableHead className="font-semibold text-right">Received</TableHead>
                  <TableHead className="font-semibold text-right">Unit Cost</TableHead>
                  <TableHead className="font-semibold text-right">Total Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(item => (
                  <TableRow key={item.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium">
                      {item.inventory_items?.name || `Item ${item.item_id}`}
                    </TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={item.received_quantity >= item.quantity ? "default" : "secondary"}>
                        {item.received_quantity}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{format(item.unit_cost)}</TableCell>
                    <TableCell className="text-right font-semibold">{format(item.total_cost)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}