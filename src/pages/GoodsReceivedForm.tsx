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

// Add types for transactions
interface AccountTransactionRow {
  id: string;
  account_id: string;
  transaction_date: string;
  description: string | null;
  debit_amount: number | null;
  credit_amount: number | null;
  reference_type?: string | null;
  reference_id?: string | null;
}

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

  // Transactions state
  const [transactions, setTransactions] = useState<AccountTransactionRow[]>([]);
  const [accountsById, setAccountsById] = useState<Record<string, { code?: string; name: string }>>({});
  const [transactionsLoading, setTransactionsLoading] = useState<boolean>(false);

  const updatePurchaseStatusAfterReceiving = async (purchaseId: string) => {
    try {
      await supabase.rpc('update_purchase_status', { p_purchase_id: purchaseId });
    } catch (e) {
      // If RPC is missing in this environment, ignore silently
      console.warn('update_purchase_status RPC unavailable, skipping');
    }
  };

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
      .select("id, purchase_number, vendor_name, status, purchase_items(quantity, received_quantity)")
      .in("status", ["pending", "partial"])
      .order("purchase_date", { ascending: false });

    // Exclude purchases where all items are fully received
    const filtered = ((data || []) as any[]).filter((p: any) => {
      const items: any[] = Array.isArray(p.purchase_items) ? p.purchase_items : [];
      if (items.length === 0) return true; // keep if no items to allow follow-up fixes
      return items.some(it => Number(it.quantity || 0) > Number(it.received_quantity || 0));
    });

    // Strip nested items before storing
    const mapped: PurchaseOption[] = filtered.map((p: any) => ({
      id: p.id,
      purchase_number: p.purchase_number,
      vendor_name: p.vendor_name,
      status: p.status,
    }));

    setPurchases(mapped as any);
  }, []);

  const loadWarehouses = useCallback(async () => {
    const orgId = organization?.id;
    if (!orgId) {
      console.warn('No organization ID available for warehouse loading');
      setWarehouses([]);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from("warehouses")
        .select("id, name, location_id")
        .eq("organization_id", orgId)
        .eq("is_active", true)
        .order("name");
      
      if (error) throw error;
      setWarehouses((data || []) as any);
    } catch (error) {
      console.error('Failed to load warehouses:', error);
      setWarehouses([]);
    }
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

  // Load account transactions for this Goods Received record (if editing)
  const loadTransactions = useCallback(async () => {
    if (!id) { setTransactions([]); setAccountsById({}); return; }
    try {
      setTransactionsLoading(true);
      const { data, error } = await supabase
        .from("account_transactions")
        .select("id, account_id, transaction_date, description, debit_amount, credit_amount, reference_type, reference_id")
        .eq("reference_id", id)
        .order("transaction_date", { ascending: true });
      if (error) throw error;

      const rows = (data || []) as any as AccountTransactionRow[];
      setTransactions(rows);

      const accountIds = Array.from(new Set(rows.map(r => r.account_id).filter(Boolean)));
      if (accountIds.length) {
        const { data: accs } = await supabase
          .from("accounts")
          .select("id, account_code, account_name")
          .in("id", accountIds);
        const map: Record<string, { code?: string; name: string }> = {};
        for (const a of (accs || []) as any[]) {
          map[a.id] = { code: a.account_code, name: a.account_name };
        }
        setAccountsById(map);
      } else {
        setAccountsById({});
      }
    } catch (e) {
      console.warn("Failed to load transactions for Goods Received", e);
      setTransactions([]);
      setAccountsById({});
    } finally {
      setTransactionsLoading(false);
    }
  }, [id]);

  const loadForEdit = useCallback(async () => {
    if (!id) return;
    try {
      const { data: header, error: hErr } = await supabase
        .from("goods_received")
        .select("*, goods_received_items(*), purchases:purchase_id(id)")
        .eq("id", id)
        .single();
      if (hErr) throw hErr;
      
      console.log('Loaded goods received header:', header); // Debug log
      
      setPurchaseId(header.purchases.id);
      setReceivedDate((header.received_date || '').slice(0,10));
      
      // Ensure warehouse_id is properly set
      const warehouseIdFromDB = header.warehouse_id;
      console.log('Setting warehouse ID from DB:', warehouseIdFromDB); // Debug log
      setWarehouseId(warehouseIdFromDB || "");
      
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

      // After header loads, also load related transactions
      await loadTransactions();
    } catch (error) {
      console.error('Error loading goods received for edit:', error);
      throw error;
    }
  }, [id, loadPurchaseItems, loadTransactions]);

  useEffect(() => {
    if (organization?.id) {
      loadOpenPurchases();
      loadWarehouses();
    }
  }, [loadOpenPurchases, loadWarehouses, organization?.id]);

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
      
      console.log('Saving with warehouse ID:', warehouseId); // Debug log
      
      const orgId = organization?.id;
      if (!orgId) { toast({ title: "Organization missing", description: "Please reload and try again", variant: "destructive" }); return; }
      const selectedWarehouse = warehouses.find(w => w.id === warehouseId);
      const derivedLocationId = selectedWarehouse?.location_id;
      if (!derivedLocationId) { toast({ title: "Warehouse misconfigured", description: "Selected warehouse is missing an associated location", variant: "destructive" }); return; }
      const entries = Object.entries(quantities).filter(([pid, qty]) => Number(qty) > 0);
      if (!isEdit && entries.length === 0) { toast({ title: "No quantities", description: "Enter at least one quantity to receive", variant: "destructive" }); return; }

      setLoading(true);

        // Build a quick index of purchase items by id for lookups (needed for both paths)
        const byId: Record<string, PurchaseItem> = {} as any;
        for (const it of purchaseItems) byId[it.id] = it;

        const ensureReceiptRecord = async (entriesParam: [string, number][]) => {
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
                  grn_number: 'GRN-' + Date.now(),
                },
              ])
              .select("id")
              .single();
            if (!headerErr && header?.id) {
              const itemsPayload = entriesParam.map(([purchase_item_id, qty]) => {
                const it = byId[purchase_item_id];
                return {
                  goods_received_id: header.id,
                  purchase_item_id,
                  item_id: it?.item_id || purchase_item_id,
                  quantity: Number(qty) || 0,
                  unit_cost: it?.unit_cost || 0
                };
              });
              if (itemsPayload.length > 0) {
                await supabase.from("goods_received_items").insert(itemsPayload);
              }
              
              // Update inventory levels for both location and warehouse
              for (const [purchase_item_id, qty] of entriesParam) {
                const it = byId[purchase_item_id];
                if (!it) continue;
                
                // Update by location
                if (derivedLocationId) {
                  const { data: existingLevel } = await supabase
                    .from('inventory_levels')
                    .select('id, quantity')
                    .eq('item_id', it.item_id)
                    .eq('location_id', derivedLocationId)
                    .maybeSingle();
                    
                  if (existingLevel) {
                    await supabase
                      .from('inventory_levels')
                      .update({ quantity: (existingLevel.quantity || 0) + Number(qty) })
                      .eq('id', existingLevel.id);
                  } else {
                    await supabase
                      .from('inventory_levels')
                      .insert({ item_id: it.item_id, location_id: derivedLocationId, quantity: Number(qty) });
                  }
                }
                
                // Update by warehouse
                if (warehouseId) {
                  const { data: existingWh } = await supabase
                    .from('inventory_levels')
                    .select('id, quantity')
                    .eq('item_id', it.item_id)
                    .eq('warehouse_id', warehouseId)
                    .maybeSingle();
                    
                  if (existingWh) {
                    await supabase
                      .from('inventory_levels')
                      .update({ quantity: (existingWh.quantity || 0) + Number(qty) })
                      .eq('id', existingWh.id);
                  } else {
                    await supabase
                      .from('inventory_levels')
                      .insert({ item_id: it.item_id, warehouse_id: warehouseId, location_id: derivedLocationId, quantity: Number(qty) });
                  }
                }
              }
            }
          } catch (ignore) {
            // Ignore if tables do not exist in this environment
          }
        };

      // Helper fallback: manually update purchase_items and inventory_levels by location
      const manualReceive = async () => {

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

        // 2) Adjust inventory_levels per location AND per warehouse for each item
        for (const [purchase_item_id, rawQty] of entries) {
          const addQty = Number(rawQty) || 0;
          if (addQty <= 0) continue;
          const it = byId[purchase_item_id];
          if (!it) continue;
          const itemId = it.item_id;

          // 2a) By location (backward compatibility for location-based stock views)
          {
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

      // 2b) By warehouse (required so it appears in warehouse stock views)
      if (warehouseId) {
        const { data: whRows, error: whErr } = await supabase
          .from("inventory_levels")
          .select("id, quantity")
          .eq("item_id", itemId)
          .eq("warehouse_id", warehouseId)
          .limit(1);
        if (whErr) throw whErr;
        const existingWh = (whRows || [])[0] as { id: string; quantity: number } | undefined;
        if (existingWh) {
          const { error: updWhErr } = await supabase
            .from("inventory_levels")
            .update({ quantity: Number(existingWh.quantity || 0) + addQty })
            .eq("id", existingWh.id);
          if (updWhErr) throw updWhErr;
        } else {
          const { error: insWhErr } = await supabase
            .from("inventory_levels")
            .insert([{ item_id: itemId, warehouse_id: warehouseId, location_id: derivedLocationId, quantity: addQty }]);
          if (insWhErr) throw insWhErr;
        }
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
            const itemsPayload = entries.map(([purchase_item_id, qty]) => {
              const it = byId[purchase_item_id];
              return {
                goods_received_id: header.id,
                purchase_item_id,
                item_id: it?.item_id || purchase_item_id, // fallback
                quantity: Number(qty) || 0,
                unit_cost: it?.unit_cost || 0
              };
            });
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

          // 2) Adjust inventory by moving from old header's warehouse/location to the newly selected one
          // Load previous header to identify old warehouse/location
          let oldHeader: { location_id: string | null; warehouse_id: string | null } | null = null;
          try {
            const { data: h } = await supabase
              .from("goods_received")
              .select("location_id, warehouse_id")
              .eq("id", id)
              .single();
            oldHeader = (h as any) || null;
          } catch {}

          for (const it of purchaseItems) {
            const prev = Number(originalQuantities[it.id] || 0);
            const next = Math.max(0, Number(quantities[it.id] || 0));
            const delta = next - prev;
            const movedHeader = (oldHeader?.location_id !== derivedLocationId) || (oldHeader?.warehouse_id !== warehouseId);

            // Reverse entire previous qty if header changed (remove from old loc/wh)
            if (movedHeader && prev > 0) {
              const oldLoc = oldHeader?.location_id || null;
              const oldWh = oldHeader?.warehouse_id || null;
              if (oldLoc) {
                const { data: levelRows } = await supabase
                  .from("inventory_levels")
                  .select("id, quantity")
                  .eq("item_id", it.item_id)
                  .eq("location_id", oldLoc)
                  .limit(1);
                const existing = (levelRows || [])[0] as { id: string; quantity: number } | undefined;
                if (existing) {
                  await supabase
                    .from("inventory_levels")
                    .update({ quantity: Math.max(0, Number(existing.quantity || 0) - prev) })
                    .eq("id", existing.id);
                }
              }
              if (oldWh) {
                const { data: whRows } = await supabase
                  .from("inventory_levels")
                  .select("id, quantity")
                  .eq("item_id", it.item_id)
                  .eq("warehouse_id", oldWh)
                  .limit(1);
                const existingWh = (whRows || [])[0] as { id: string; quantity: number } | undefined;
                if (existingWh) {
                  await supabase
                    .from("inventory_levels")
                    .update({ quantity: Math.max(0, Number(existingWh.quantity || 0) - prev) })
                    .eq("id", existingWh.id);
                }
              }
            }

            // Apply to new location
            {
              const addQty = movedHeader ? next : delta;
              if (addQty !== 0) {
                const { data: levelRows } = await supabase
                  .from("inventory_levels")
                  .select("id, quantity")
                  .eq("item_id", it.item_id)
                  .eq("location_id", derivedLocationId)
                  .limit(1);
                const existing = (levelRows || [])[0] as { id: string; quantity: number } | undefined;
                if (existing) {
                  await supabase
                    .from("inventory_levels")
                    .update({ quantity: Math.max(0, Number(existing.quantity || 0) + addQty) })
                    .eq("id", existing.id);
                } else if (addQty > 0) {
                  await supabase
                    .from("inventory_levels")
                    .insert([{ item_id: it.item_id, location_id: derivedLocationId, quantity: addQty }]);
                }
              }
            }

            // Apply to new warehouse
            {
              const addQty = movedHeader ? next : delta;
              if (addQty !== 0) {
                const { data: whRows } = await supabase
                  .from("inventory_levels")
                  .select("id, quantity")
                  .eq("item_id", it.item_id)
                  .eq("warehouse_id", warehouseId)
                  .limit(1);
                const existingWh = (whRows || [])[0] as { id: string; quantity: number } | undefined;
                if (existingWh) {
                  await supabase
                    .from("inventory_levels")
                    .update({ quantity: Math.max(0, Number(existingWh.quantity || 0) + addQty) })
                    .eq("id", existingWh.id);
                } else if (addQty > 0) {
                  await supabase
                    .from("inventory_levels")
                    .insert([{ item_id: it.item_id, warehouse_id: warehouseId, location_id: derivedLocationId, quantity: addQty }]);
                }
              }
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
              .map(([purchase_item_id, q]) => {
                const it = byId[purchase_item_id];
                return {
                  goods_received_id: id,
                  purchase_item_id,
                  item_id: it?.item_id || purchase_item_id, // fallback
                  quantity: Number(q) || 0,
                  unit_cost: it?.unit_cost || 0
                };
              });
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
                <Select value={warehouseId} onValueChange={(value) => {
                  console.log('Warehouse changed to:', value); // Debug log
                  setWarehouseId(value);
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map(w => (
                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {warehouses.length === 0 && (
                  <p className="text-sm text-muted-foreground">No warehouses found. Check if warehouses are configured for this organization.</p>
                )}
                {warehouseId && (
                  <p className="text-xs text-muted-foreground">Selected: {warehouses.find(w => w.id === warehouseId)?.name || warehouseId}</p>
                )}
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

          {isEdit && (
            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle>Transactions</CardTitle>
                <CardDescription>Ledger entries linked to this receipt</CardDescription>
              </CardHeader>
              <CardContent>
                {transactionsLoading ? (
                  <div className="text-sm text-muted-foreground">Loading transactions...</div>
                ) : transactions.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No transactions</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Account</TableHead>
                          <TableHead className="text-right">Debit</TableHead>
                          <TableHead className="text-right">Credit</TableHead>
                          <TableHead>Description</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.map(t => {
                          const acc = accountsById[t.account_id];
                          const accLabel = acc ? `${acc.code ? acc.code + ' - ' : ''}${acc.name}` : t.account_id;
                          return (
                            <TableRow key={t.id}>
                              <TableCell>{(t.transaction_date || '').slice(0,10)}</TableCell>
                              <TableCell>{accLabel}</TableCell>
                              <TableCell className="text-right">{Number(t.debit_amount || 0).toLocaleString()}</TableCell>
                              <TableCell className="text-right">{Number(t.credit_amount || 0).toLocaleString()}</TableCell>
                              <TableCell>{t.description || ''}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
