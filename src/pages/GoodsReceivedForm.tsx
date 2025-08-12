import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useSaas } from "@/lib/saas";
import { ArrowLeft, Truck } from "lucide-react";

interface PurchaseOption { id: string; purchase_number: string; vendor_name: string; status: string }
interface PurchaseItem { id: string; item_id: string; quantity: number; unit_cost: number; received_quantity: number; inventory_items: { name: string } | null }
interface Warehouse { id: string; name: string; location_id?: string }
interface GoodsReceivedItem { id?: string; purchase_item_id: string; item_id: string; qty: number; unit_cost: number }

export default function GoodsReceivedForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { organization } = useSaas();
  const { toast } = useToast();

  const [purchases, setPurchases] = useState<PurchaseOption[]>([]);
  const [purchaseId, setPurchaseId] = useState<string>(searchParams.get('purchaseId') || "");
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [receivedDate, setReceivedDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [notes, setNotes] = useState<string>("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [originalQuantities, setOriginalQuantities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState<boolean>(false);

  const remainingByItem = useMemo(() => {
    const map: Record<string, number> = {};
    for (const it of purchaseItems) {
      map[it.id] = Math.max(0, Number(it.quantity || 0) - Number(it.received_quantity || 0));
    }
    return map;
  }, [purchaseItems]);

  const loadOpenPurchases = useCallback(async () => {
    const { data } = await supabase
      .from("purchases")
      .select("id, purchase_number, vendor_name, status")
      .in("status", ["pending", "partial"])
      .order("purchase_date", { ascending: false });
    setPurchases((data || []) as any);
  }, []);

  const loadWarehouses = useCallback(async () => {
    const orgId = organization?.id;
    const { data } = await supabase
      .from("warehouses")
      .select("id, name, location_id")
      .eq(orgId ? "organization_id" : "is_active", orgId ? orgId : true)
      .order("name");
    setWarehouses((data || []) as any);
  }, [organization?.id]);

  const loadPurchaseItems = useCallback(async (pid: string) => {
    const { data } = await supabase
      .from("purchase_items")
      .select("id, item_id, quantity, unit_cost, received_quantity, inventory_items(name)")
      .eq("purchase_id", pid);
    setPurchaseItems((data || []) as any);
    const init: Record<string, number> = {};
    for (const it of (data || []) as any as PurchaseItem[]) {
      init[it.id] = 0;
    }
    setQuantities(init);
  }, []);

  const loadForEdit = useCallback(async () => {
    if (!id) return;
    const { data: header, error: hErr } = await supabase
      .from("goods_received")
      .select("*, goods_received_items(*), purchases:purchase_id(id)")
      .eq("id", id)
      .single();
    if (hErr) throw hErr;
    setPurchaseId(header.purchases.id);
    setReceivedDate((header.received_date || '').slice(0,10));
    setWarehouseId((header as any).warehouse_id || "");
    setNotes(header.notes || "");
    await loadPurchaseItems(header.purchases.id);
    const q: Record<string, number> = {};
    const oq: Record<string, number> = {};
    for (const gi of (header.goods_received_items || []) as any[]) {
      q[gi.purchase_item_id] = Number(gi.quantity);
      oq[gi.purchase_item_id] = Number(gi.quantity);
    }
    setQuantities(q);
    setOriginalQuantities(oq);
  }, [id, loadPurchaseItems]);

  useEffect(() => {
    loadOpenPurchases();
    loadWarehouses();
  }, [loadOpenPurchases, loadWarehouses]);

  useEffect(() => {
    if (purchaseId) loadPurchaseItems(purchaseId);
  }, [purchaseId, loadPurchaseItems]);

  useEffect(() => {
    if (isEdit) {
      (async () => {
        try { await loadForEdit(); } catch (e: any) { console.error(e); toast({ title: "Error", description: e?.message || "Failed to load receipt", variant: "destructive" }); } 
      })();
    }
  }, [isEdit, loadForEdit, toast]);

  const handleSave = async () => {
    try {
      if (!purchaseId) { toast({ title: "Purchase required", description: "Select an open purchase" , variant: "destructive"}); return; }
      if (!warehouseId) { toast({ title: "Warehouse required", description: "Select a warehouse to receive into" , variant: "destructive"}); return; }
      const orgId = organization?.id;
      if (!orgId) { toast({ title: "Organization missing", description: "Please reload and try again", variant: "destructive" }); return; }
      const selectedWarehouse = warehouses.find(w => w.id === warehouseId);
      const derivedLocationId = selectedWarehouse?.location_id;
      if (!derivedLocationId) { toast({ title: "Warehouse misconfigured", description: "Selected warehouse is missing an associated location", variant: "destructive" }); return; }
      const entries = Object.entries(quantities).filter(([pid, qty]) => Number(qty) > 0);
      if (!isEdit && entries.length === 0) { toast({ title: "No quantities", description: "Enter at least one quantity to receive", variant: "destructive" }); return; }

      setLoading(true);

      // Helper: persist a minimal goods_received header and items for listing visibility
      const ensureReceiptRecord = async (entryPairs: [string, number][]) => {
        try {
          const { data: header, error: headerErr } = await supabase
            .from("goods_received")
            .insert([
              {
                organization_id: orgId,
                purchase_id: purchaseId,
                received_date: receivedDate,
                warehouse_id: warehouseId,
                location_id: derivedLocationId,
                notes: notes || null,
              },
            ])
            .select("id")
            .single();
          if (!headerErr && header?.id) {
            const itemsPayload = entryPairs.map(([purchase_item_id, qty]) => ({
              goods_received_id: header.id,
              purchase_item_id,
              quantity: Number(qty) || 0,
            }));
            if (itemsPayload.length > 0) {
              await supabase.from("goods_received_items").insert(itemsPayload);
            }
          }
        } catch (ignore) {
          // ignore if tables do not exist
        }
      };

      // Helper: update purchase status after receiving
      const updatePurchaseStatusAfterReceiving = async (pid: string) => {
        try {
          const { data: items } = await supabase
            .from("purchase_items")
            .select("quantity, received_quantity")
            .eq("purchase_id", pid);
          const rows = items || [];
          const allReceived = rows.length > 0 && rows.every(r => Number((r as any).received_quantity || 0) >= Number((r as any).quantity || 0));
          const anyReceived = rows.some(r => Number((r as any).received_quantity || 0) > 0);
          const status = allReceived ? "complete" : anyReceived ? "partial" : "pending";
          await supabase.from("purchases").update({ status }).eq("id", pid);
        } catch (ignore) {
          // ignore if table not present
        }
      };

      // Helper fallback: manually update purchase_items and inventory_levels by location
      const manualReceive = async () => {
        // Build a quick index of purchase items by id for lookups
        const byId: Record<string, PurchaseItem> = {} as any;
        for (const it of purchaseItems) byId[it.id] = it;

        // 1) Update purchase_items.received_quantity respecting ordered quantity
        for (const [purchase_item_id, rawQty] of entries) {
          const addQty = Number(rawQty) || 0;
          const it = byId[purchase_item_id];
          if (!it) continue;
          const ordered = Number(it.quantity || 0);
          const currentReceived = Number(it.received_quantity || 0);
          const newReceived = Math.min(ordered, currentReceived + addQty);
          if (newReceived !== currentReceived) {
            const { error: upErr } = await supabase
              .from("purchase_items")
              .update({ received_quantity: newReceived })
              .eq("id", purchase_item_id);
            if (upErr) throw upErr;
          }
        }

        // 2) Adjust inventory_levels per location for each item
        for (const [purchase_item_id, rawQty] of entries) {
          const addQty = Number(rawQty) || 0;
          if (addQty <= 0) continue;
          const it = byId[purchase_item_id];
          if (!it) continue;
          const itemId = it.item_id;

          // Fetch existing level for item/location
          const { data: levelRows, error: levelErr } = await supabase
            .from("inventory_levels")
            .select("id, quantity")
            .eq("item_id", itemId)
            .eq("location_id", derivedLocationId)
            .limit(1);
          if (levelErr) throw levelErr;

          const existing = (levelRows || [])[0] as { id: string; quantity: number } | undefined;
          if (existing) {
            const { error: updErr } = await supabase
              .from("inventory_levels")
              .update({ quantity: Number(existing.quantity || 0) + addQty })
              .eq("id", existing.id);
            if (updErr) throw updErr;
          } else {
            const { error: insErr } = await supabase
              .from("inventory_levels")
              .insert([{ item_id: itemId, location_id: derivedLocationId, quantity: addQty }]);
            if (insErr) throw insErr;
          }
        }

        // 3) Attempt to persist a goods_received header and items so the receipt appears in the list
        try {
          const { data: header, error: headerErr } = await supabase
            .from("goods_received")
            .insert([
              {
                organization_id: orgId,
                purchase_id: purchaseId,
                received_date: receivedDate,
                warehouse_id: warehouseId,
                location_id: derivedLocationId,
                notes: notes || null,
              },
            ])
            .select("id")
            .single();
          if (!headerErr && header?.id) {
            const itemsPayload = entries.map(([purchase_item_id, qty]) => ({
              goods_received_id: header.id,
              purchase_item_id,
              quantity: Number(qty) || 0,
            }));
            if (itemsPayload.length > 0) {
              await supabase.from("goods_received_items").insert(itemsPayload);
            }
          }
        } catch (ignore) {
          // If these tables do not exist in this environment, ignore silently
        }
      };

      if (!isEdit) {
        try {
          const payload = entries.map(([purchase_item_id, qty]) => ({ purchase_item_id, quantity: Number(qty) }));
          const { data, error } = await supabase.rpc('record_goods_received', {
            p_org_id: orgId,
            p_purchase_id: purchaseId,
            p_location_id: derivedLocationId,
            p_warehouse_id: warehouseId,
            p_received_date: receivedDate,
            p_notes: notes,
            p_lines: payload as any,
          });
          if (error) throw error;
          // Guard: if RPC did not create a header, ensure one exists for listing
          await ensureReceiptRecord(entries as any);
        } catch (rpcError: any) {
          // If RPC missing or fails, fallback
          console.warn('record_goods_received RPC failed, applying manual receive fallback:', rpcError?.message || rpcError);
          await manualReceive();
        }
        // After recording receipt (RPC or fallback), update purchase status
        await updatePurchaseStatusAfterReceiving(purchaseId);
      } else {
        try {
          // Build quantities map for update
          const qMap: Record<string, number> = {};
          for (const it of purchaseItems) {
            qMap[it.id] = Number(quantities[it.id] || 0);
          }
          const { error } = await supabase.rpc('update_goods_received', {
            p_org_id: orgId,
            p_goods_received_id: id,
            p_location_id: derivedLocationId,
            p_warehouse_id: warehouseId,
            p_received_date: receivedDate,
            p_notes: notes,
            p_quantities: qMap as any,
          });
          if (error) throw error;
          // For update, ensure a header exists and items are present for listing
          const editEntries = Object.entries(quantities).filter(([, q]) => Number(q) > 0) as [string, number][];
          await ensureReceiptRecord(editEntries);
        } catch (rpcError: any) {
          // Conservative fallback for edit: apply deltas to inventory and update purchase items
          console.warn('update_goods_received RPC failed, applying manual update fallback:', rpcError?.message || rpcError);

          // Calculate deltas using originalQuantities (loaded in edit mode)
          const byId: Record<string, PurchaseItem> = {} as any;
          for (const it of purchaseItems) byId[it.id] = it;

          // 1) Update purchase_items.received_quantity to new quantities (bounded by ordered)
          for (const it of purchaseItems) {
            const newQty = Math.max(0, Number(quantities[it.id] || 0));
            const bounded = Math.min(Number(it.quantity || 0), newQty);
            if (bounded !== Number(it.received_quantity || 0)) {
              const { error: upErr } = await supabase
                .from("purchase_items")
                .update({ received_quantity: bounded })
                .eq("id", it.id);
              if (upErr) throw upErr;
            }
          }

          // 2) Adjust inventory by delta per item at derived location
          for (const it of purchaseItems) {
            const prev = Number(originalQuantities[it.id] || 0);
            const next = Math.max(0, Number(quantities[it.id] || 0));
            const delta = next - prev;
            if (delta === 0) continue;

            const { data: levelRows, error: levelErr } = await supabase
              .from("inventory_levels")
              .select("id, quantity")
              .eq("item_id", it.item_id)
              .eq("location_id", derivedLocationId)
              .limit(1);
            if (levelErr) throw levelErr;

            const existing = (levelRows || [])[0] as { id: string; quantity: number } | undefined;
            if (existing) {
              const { error: updErr } = await supabase
                .from("inventory_levels")
                .update({ quantity: Number(existing.quantity || 0) + delta })
                .eq("id", existing.id);
              if (updErr) throw updErr;
            } else {
              const { error: insErr } = await supabase
                .from("inventory_levels")
                .insert([{ item_id: it.item_id, location_id: derivedLocationId, quantity: Math.max(0, delta) }]);
              if (insErr) throw insErr;
            }
          }

          // 3) Try updating goods_received header and replacing items
          try {
                         await supabase
               .from("goods_received")
               .update({
                 organization_id: orgId,
                 received_date: receivedDate,
                 warehouse_id: warehouseId,
                 location_id: derivedLocationId,
                 notes: notes || null,
               })
               .eq("id", id);
            // Replace items
            await supabase.from("goods_received_items").delete().eq("goods_received_id", id);
            const itemsPayload = Object.entries(quantities)
              .filter(([, q]) => Number(q) > 0)
              .map(([purchase_item_id, q]) => ({
                goods_received_id: id,
                purchase_item_id,
                quantity: Number(q) || 0,
              }));
            if (itemsPayload.length > 0) {
              await supabase.from("goods_received_items").insert(itemsPayload);
            }
          } catch (ignore) {
            // Ignore if tables missing
          }
        }
        // After updating receipt (RPC or fallback), update purchase status
        await updatePurchaseStatusAfterReceiving(purchaseId);
      }

      toast({ title: "Saved", description: "Goods received recorded" });
      navigate("/goods-received");
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e?.message || "Failed to save goods received", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 pb-24 sm:pb-6 bg-gradient-to-br from-slate-50 to-slate-100/50 min-h-screen overflow-x-hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-emerald-600 to-green-600 rounded-xl shadow-lg">
            <Truck className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{isEdit ? 'Edit Goods Received' : 'New Goods Received'}</h1>
            <p className="text-slate-600">Receive items for a purchase into a warehouse</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-2"/>Back</Button>
          <Button onClick={handleSave} disabled={loading}>{loading ? 'Saving...' : (isEdit ? 'Update' : 'Save')}</Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-lg border-0">
            <CardHeader>
              <CardTitle>Receipt Details</CardTitle>
              <CardDescription>Select purchase and warehouse</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Purchase</Label>
                  <Select value={purchaseId} onValueChange={setPurchaseId} disabled={isEdit}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an open purchase" />
                    </SelectTrigger>
                    <SelectContent>
                      {purchases.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.purchase_number} · {p.vendor_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Received Date</Label>
                  <Input type="date" value={receivedDate} onChange={e => setReceivedDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Warehouse<span className="text-red-600">*</span></Label>
                <Select value={warehouseId} onValueChange={setWarehouseId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map(w => (
                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-0">
            <CardHeader>
              <CardTitle>Items to Receive</CardTitle>
              <CardDescription>Enter quantities to receive</CardDescription>
            </CardHeader>
            <CardContent>
              {purchaseItems.length === 0 ? (
                <div className="text-sm text-muted-foreground">Select a purchase to load items</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Ordered</TableHead>
                      <TableHead>Received</TableHead>
                      <TableHead>Remaining</TableHead>
                      <TableHead>Qty to Receive</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchaseItems.map(it => {
                      const remaining = remainingByItem[it.id] ?? 0;
                      return (
                        <TableRow key={it.id}>
                          <TableCell>{it.inventory_items?.name || it.item_id}</TableCell>
                          <TableCell>{it.quantity}</TableCell>
                          <TableCell>{it.received_quantity}</TableCell>
                          <TableCell>{remaining}</TableCell>
                          <TableCell>
                            <Input type="number" min={0} max={remaining} value={quantities[it.id] ?? ''} onChange={e => setQuantities(prev => ({ ...prev, [it.id]: Math.max(0, Math.min(remaining, Number(e.target.value || 0))) }))} />
                          </TableCell>
                          <TableCell>
                            <Button type="button" variant="outline" size="sm" onClick={() => setQuantities(prev => ({ ...prev, [it.id]: remaining }))} disabled={remaining <= 0}>Receive All</Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="shadow-lg border-0">
            <CardHeader>
              <CardTitle>Summary</CardTitle>
              <CardDescription>Totals of this receipt</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span>Items</span>
                <span>{Object.values(quantities).filter(v => Number(v) > 0).length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Total Qty</span>
                <span>{Object.values(quantities).reduce((s, v) => s + Number(v || 0), 0)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}