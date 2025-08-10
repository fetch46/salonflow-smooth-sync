import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Package, ShoppingCart, ClipboardList, Pencil } from "lucide-react";

interface InventoryItem {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  unit: string | null;
  reorder_point: number | null;
  is_active: boolean;
}

interface PurchaseHistoryRow {
  id: string;
  purchase_id: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  created_at: string;
  purchases?: { purchase_number: string; purchase_date: string; vendor_name?: string | null } | null;
}

interface UsageHistoryRow {
  id: string;
  job_card_id: string;
  quantity_used: number;
  unit_cost: number;
  total_cost: number;
  created_at: string;
  job_cards?: { job_number: string; start_time: string | null; end_time: string | null } | null;
}

export default function ProductView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistoryRow[]>([]);
  const [usageHistory, setUsageHistory] = useState<UsageHistoryRow[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const { data: it } = await supabase
          .from("inventory_items")
          .select("id, name, description, sku, unit, reorder_point, is_active")
          .eq("id", id)
          .single();
        if (it) setItem(it as InventoryItem);

        const { data: purchases } = await supabase
          .from("purchase_items")
          .select(`id, purchase_id, quantity, unit_cost, total_cost, created_at,
                   purchases:purchase_id ( purchase_number, purchase_date, vendor_name )`)
          .eq("item_id", id)
          .order("created_at", { ascending: false });
        setPurchaseHistory((purchases || []) as any);

        const { data: usages } = await supabase
          .from("job_card_products")
          .select(`id, job_card_id, quantity_used, unit_cost, total_cost, created_at,
                   job_cards:job_card_id ( job_number, start_time, end_time )`)
          .eq("inventory_item_id", id)
          .order("created_at", { ascending: false });
        setUsageHistory((usages || []) as any);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const totalPurchased = useMemo(() => purchaseHistory.reduce((s, r) => s + (Number(r.quantity) || 0), 0), [purchaseHistory]);
  const totalUsed = useMemo(() => usageHistory.reduce((s, r) => s + (Number(r.quantity_used) || 0), 0), [usageHistory]);

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">Product not found.</p>
        <Button className="mt-4" variant="secondary" onClick={() => navigate(-1)}>
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          </div>
          <h1 className="text-2xl font-semibold mt-1 flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" /> {item.name}
            {item.is_active ? (
              <Badge variant="secondary">Active</Badge>
            ) : (
              <Badge variant="outline">Inactive</Badge>
            )}
          </h1>
          <div className="text-sm text-muted-foreground">SKU: {item.sku || '—'} • Unit: {item.unit || '—'} • Reorder point: {item.reorder_point ?? '—'}</div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => navigate(`/inventory`)} variant="outline">
            Inventory
          </Button>
          <Button onClick={() => navigate(`/inventory`)}>
            <Pencil className="w-4 h-4 mr-2" /> Edit
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border bg-gradient-to-b from-white to-slate-50">
              <div className="text-xs text-muted-foreground">Total Purchased</div>
              <div className="text-2xl font-semibold mt-1">{totalPurchased}</div>
            </div>
            <div className="p-4 rounded-lg border bg-gradient-to-b from-white to-slate-50">
              <div className="text-xs text-muted-foreground">Total Used</div>
              <div className="text-2xl font-semibold mt-1">{totalUsed}</div>
            </div>
            <div className="p-4 rounded-lg border bg-gradient-to-b from-white to-slate-50">
              <div className="text-xs text-muted-foreground">Status</div>
              <div className="text-2xl font-semibold mt-1">{item.is_active ? 'Active' : 'Inactive'}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="usage" className="space-y-4">
        <TabsList>
          <TabsTrigger value="usage" className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4" /> Usage History
          </TabsTrigger>
          <TabsTrigger value="purchases" className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" /> Purchase History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="usage">
          <Card>
            <CardHeader>
              <CardTitle>Item Usage History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto rounded-lg border">
                <Table className="min-w-[720px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Job Card</TableHead>
                      <TableHead className="text-right">Qty Used</TableHead>
                      <TableHead className="hidden sm:table-cell text-right">Unit Cost</TableHead>
                      <TableHead className="hidden sm:table-cell text-right">Total Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usageHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">No usage recorded.</TableCell>
                      </TableRow>
                    ) : (
                      usageHistory.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{new Date(row.created_at).toLocaleDateString()}</TableCell>
                          <TableCell className="font-medium">{row.job_cards?.job_number || '—'}</TableCell>
                          <TableCell className="text-right">{row.quantity_used}</TableCell>
                          <TableCell className="hidden sm:table-cell text-right">{row.unit_cost ?? '—'}</TableCell>
                          <TableCell className="hidden sm:table-cell text-right">{row.total_cost ?? '—'}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="purchases">
          <Card>
            <CardHeader>
              <CardTitle>Purchase History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto rounded-lg border">
                <Table className="min-w-[720px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Purchase #</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="hidden sm:table-cell text-right">Unit Cost</TableHead>
                      <TableHead className="hidden sm:table-cell text-right">Total Cost</TableHead>
                      <TableHead className="hidden md:table-cell">Vendor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchaseHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">No purchases recorded.</TableCell>
                      </TableRow>
                    ) : (
                      purchaseHistory.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{new Date(row.created_at).toLocaleDateString()}</TableCell>
                          <TableCell className="font-medium">{row.purchases?.purchase_number || '—'}</TableCell>
                          <TableCell className="text-right">{row.quantity}</TableCell>
                          <TableCell className="hidden sm:table-cell text-right">{row.unit_cost ?? '—'}</TableCell>
                          <TableCell className="hidden sm:table-cell text-right">{row.total_cost ?? '—'}</TableCell>
                          <TableCell className="hidden md:table-cell">{row.purchases?.vendor_name || '—'}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}