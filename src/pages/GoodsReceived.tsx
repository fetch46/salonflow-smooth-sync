import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, Plus, Truck } from "lucide-react";
import { useSaas } from "@/lib/saas";
import { useToast } from "@/hooks/use-toast";

interface GoodsReceivedRow { id: string; grn_number: string | null; received_date: string; warehouse_id?: string | null; location_id: string; purchase_id: string; purchase?: { purchase_number: string; vendor_name: string } | null; warehouse?: { name: string } | null }

export default function GoodsReceived() {
  const navigate = useNavigate();
  const { organization } = useSaas();
  const { toast } = useToast();
  const [rows, setRows] = useState<GoodsReceivedRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      // Base fetch without FK joins to avoid relationship issues. Fallback if grn_number column is missing.
      const buildQuery = (includeGrn: boolean) => {
        let q = supabase
          .from("goods_received")
          .select(includeGrn ? "id, grn_number, received_date, warehouse_id, location_id, purchase_id" : "id, received_date, warehouse_id, location_id, purchase_id")
          .order("received_date", { ascending: false });
        if (organization?.id) {
          q = q.eq("organization_id", organization.id);
        }
        return q;
      };

      let data: any[] | null = null;
      try {
        const res = await buildQuery(true);
        if (res.error) throw res.error;
        data = res.data as any[] | null;
      } catch (err: any) {
        const msg = String(err?.message || "").toLowerCase();
        if (msg.includes("column") && msg.includes("grn_number") && msg.includes("does not exist")) {
          const res2 = await buildQuery(false);
          if (res2.error) throw res2.error;
          data = res2.data as any[] | null;
        } else {
          throw err;
        }
      }

      const list = (data || []) as Array<GoodsReceivedRow>;

      // Hydrate related purchase and warehouse display fields in parallel
      const purchaseIds = Array.from(new Set(list.map(r => r.purchase_id).filter(Boolean)));
      const warehouseIds = Array.from(new Set(list.map(r => r.warehouse_id).filter(Boolean))) as string[];

      const [purchasesRes, warehousesRes] = await Promise.all([
        purchaseIds.length
          ? supabase.from("purchases").select("id, purchase_number, vendor_name").in("id", purchaseIds)
          : Promise.resolve({ data: [] as any[], error: null }),
        warehouseIds.length
          ? supabase.from("warehouses").select("id, name").in("id", warehouseIds)
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);

      const purchasesMap = new Map<string, { purchase_number: string; vendor_name: string }>();
      for (const p of ((purchasesRes.data || []) as any[])) {
        purchasesMap.set(p.id, { purchase_number: p.purchase_number, vendor_name: p.vendor_name });
      }
      const warehousesMap = new Map<string, { name: string }>();
      for (const w of ((warehousesRes.data || []) as any[])) {
        warehousesMap.set(w.id, { name: w.name });
      }

      const hydrated = list.map(r => ({
        ...r,
        purchase: purchasesMap.get(r.purchase_id) || null,
        warehouse: (r.warehouse_id ? warehousesMap.get(r.warehouse_id) : undefined) || null,
      }));

      setRows(hydrated);
    } catch (e) {
      console.error(e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id]);

  const handleDelete = async (goodsReceivedId: string) => {
    if (!confirm("Delete this goods received record? This will reverse received quantities and stock.")) return;
    try {
      // Load header for location/warehouse/purchase
      const { data: header, error: hErr } = await supabase
        .from("goods_received")
        .select("id, purchase_id, location_id, warehouse_id")
        .eq("id", goodsReceivedId)
        .single();
      if (hErr || !header) throw hErr || new Error("Receipt not found");

      // Load items on this receipt
      const { data: grItems, error: giErr } = await supabase
        .from("goods_received_items")
        .select("purchase_item_id, quantity")
        .eq("goods_received_id", goodsReceivedId);
      if (giErr) throw giErr;
      const lines = (grItems || []) as Array<{ purchase_item_id: string; quantity: number }>;

      if (lines.length === 0) {
        // No lines, just remove the header
        await supabase.from("goods_received").delete().eq("id", goodsReceivedId);
        toast({ title: "Deleted", description: "Receipt removed" });
        await load();
        return;
      }

      // Load the related purchase_items to get item_id and current received
      const purchaseItemIds = Array.from(new Set(lines.map(l => l.purchase_item_id)));
      const { data: pItems, error: piErr } = await supabase
        .from("purchase_items")
        .select("id, item_id, received_quantity")
        .in("id", purchaseItemIds);
      if (piErr) throw piErr;
      const mapById = new Map<string, { item_id: string; received_quantity: number }>();
      for (const it of (pItems || []) as Array<{ id: string; item_id: string; received_quantity: number }>) {
        mapById.set(it.id, { item_id: it.item_id, received_quantity: Number(it.received_quantity || 0) });
      }

      // 1) Reverse purchase_items.received_quantity
      await Promise.all(
        lines.map(async (l) => {
          const meta = mapById.get(l.purchase_item_id);
          if (!meta) return;
          const newReceived = Math.max(0, Number(meta.received_quantity || 0) - Number(l.quantity || 0));
          await supabase
            .from("purchase_items")
            .update({ received_quantity: newReceived })
            .eq("id", l.purchase_item_id);
        })
      );

      // 2) Reverse inventory levels at location and warehouse
      const locationId: string = (header as any).location_id;
      const warehouseId: string | null = (header as any).warehouse_id || null;
      for (const l of lines) {
        const meta = mapById.get(l.purchase_item_id);
        if (!meta) continue;
        const itemId = meta.item_id;
        const delta = Number(l.quantity || 0) * -1;
        // Location-based
        try {
          const { data: levelRows } = await supabase
            .from("inventory_levels")
            .select("id, quantity")
            .eq("item_id", itemId)
            .eq("location_id", locationId)
            .limit(1);
          const existing = (levelRows || [])[0] as { id: string; quantity: number } | undefined;
          if (existing) {
            await supabase
              .from("inventory_levels")
              .update({ quantity: Math.max(0, Number(existing.quantity || 0) + delta) })
              .eq("id", existing.id);
          }
        } catch {}
        // Warehouse-based
        if (warehouseId) {
          try {
            const { data: whRows } = await supabase
              .from("inventory_levels")
              .select("id, quantity")
              .eq("item_id", itemId)
              .eq("warehouse_id", warehouseId)
              .limit(1);
            const existingWh = (whRows || [])[0] as { id: string; quantity: number } | undefined;
            if (existingWh) {
              await supabase
                .from("inventory_levels")
                .update({ quantity: Math.max(0, Number(existingWh.quantity || 0) + delta) })
                .eq("id", existingWh.id);
            }
          } catch {}
        }
      }

      // 3) Remove goods_received items then header
      await supabase.from("goods_received_items").delete().eq("goods_received_id", goodsReceivedId);
      await supabase.from("goods_received").delete().eq("id", goodsReceivedId);

      // 4) Best-effort: delete any ledger entries linked to this receipt id
      try {
        await supabase.from("account_transactions").delete().eq("reference_id", goodsReceivedId);
      } catch {}

      // 5) Update purchase status based on remaining received quantities
      try {
        const { data: allItems } = await supabase
          .from("purchase_items")
          .select("quantity, received_quantity")
          .eq("purchase_id", header.purchase_id);
        const list = (allItems || []) as Array<{ quantity: number; received_quantity: number }>;
        const anyReceived = list.some(it => Number(it.received_quantity || 0) > 0);
        const allReceived = list.length > 0 && list.every(it => Number(it.received_quantity || 0) >= Number(it.quantity || 0));
        const newStatus = allReceived ? "received" : (anyReceived ? "partial" : "pending");
        await supabase.from("purchases").update({ status: newStatus }).eq("id", header.purchase_id);
      } catch {}

      toast({ title: "Deleted", description: "Goods received deleted" });
      await load();
    } catch (err: any) {
      console.error(err);
      toast({ title: "Error", description: err?.message || "Failed to delete goods received", variant: "destructive" });
    }
  };

  const filtered = rows.filter(r => {
    const t = search.toLowerCase();
    return (
      (r.grn_number || '').toLowerCase().includes(t) ||
      (r.purchase?.purchase_number || '').toLowerCase().includes(t) ||
      (r.purchase?.vendor_name || '').toLowerCase().includes(t) ||
      (r.warehouse?.name || '').toLowerCase().includes(t)
    );
  });

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 pb-24 sm:pb-6 bg-gradient-to-br from-slate-50 to-slate-100/50 min-h-screen overflow-x-hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2.5 bg-gradient-to-br from-emerald-600 to-green-600 rounded-xl shadow-lg">
            <Truck className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Goods Received</h1>
            <p className="text-slate-600">All purchase receipts</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => navigate("/goods-received/new")} className="bg-gradient-to-r from-emerald-600 to-green-600"> <Plus className="h-4 w-4 mr-2"/> New Receipt</Button>
          <Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4 mr-2"/>Refresh</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Receipts</CardTitle>
          <CardDescription>Search and manage receipts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <Input placeholder="Search GRN, purchase #, vendor or warehouse" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>GRN #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Purchase</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={6}>Loading...</TableCell>
                  </TableRow>
                )}
                {!loading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6}>No receipts found</TableCell>
                  </TableRow>
                )}
                {!loading && filtered.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>{r.grn_number || r.id.slice(0,8)}</TableCell>
                    <TableCell>{(r.received_date || '').slice(0,10)}</TableCell>
                    <TableCell>{r.purchase?.purchase_number}</TableCell>
                    <TableCell>{r.purchase?.vendor_name}</TableCell>
                    <TableCell>{r.warehouse?.name}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => navigate(`/goods-received/${r.id}/edit`)}>Edit</Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(r.id)}>Delete</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}