import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

interface InventoryItem { id: string; name: string; }
interface Location { id: string; name: string; }
interface LevelRow { id: string; item_id: string; location_id: string; quantity: number; inventory_items?: { name: string }; storage_locations?: { name: string }; }

export default function StockTransfers() {
  const { toast } = useToast();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [form, setForm] = useState({ item_id: "", from_location_id: "", to_location_id: "", quantity: "" });
  const qty = Number(form.quantity || 0);

  const fetchRefs = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: itemsData }, { data: locsData }, { data: levelsData }] = await Promise.all([
        supabase.from("inventory_items").select("id, name").eq("type", "good").eq("is_active", true).order("name"),
        supabase.from("storage_locations").select("id, name").order("name"),
        supabase.from("inventory_levels").select(`id, item_id, location_id, quantity, inventory_items(name), storage_locations(name)`).order("location_id").order("item_id"),
      ]);
      setItems(itemsData || []);
      setLocations(locsData || []);
      setLevels((levelsData || []) as LevelRow[]);
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to load data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchRefs(); }, [fetchRefs]);

  const getAvailableQty = (itemId: string, locationId: string) => {
    const row = levels.find(l => l.item_id === itemId && l.location_id === locationId);
    return Number(row?.quantity || 0);
  };

  const submitTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.item_id || !form.from_location_id || !form.to_location_id || !qty) {
      toast({ title: "Missing data", description: "Select item, locations and quantity", variant: "destructive" });
      return;
    }
    if (form.from_location_id === form.to_location_id) {
      toast({ title: "Invalid selection", description: "From and To locations must differ", variant: "destructive" });
      return;
    }
    const available = getAvailableQty(form.item_id, form.from_location_id);
    if (qty > available) {
      toast({ title: "Insufficient stock", description: `Only ${available} available at source location`, variant: "destructive" });
      return;
    }

    try {
      // Decrease from source
      const { data: srcLevels } = await supabase
        .from("inventory_levels")
        .select("id, quantity")
        .eq("item_id", form.item_id)
        .eq("location_id", form.from_location_id)
        .limit(1);
      if (srcLevels && srcLevels.length > 0) {
        const src = srcLevels[0];
        await supabase.from("inventory_levels").update({ quantity: Number(src.quantity || 0) - qty }).eq("id", src.id);
      }

      // Increase at destination
      const { data: dstLevels } = await supabase
        .from("inventory_levels")
        .select("id, quantity")
        .eq("item_id", form.item_id)
        .eq("location_id", form.to_location_id)
        .limit(1);
      if (dstLevels && dstLevels.length > 0) {
        const dst = dstLevels[0];
        await supabase.from("inventory_levels").update({ quantity: Number(dst.quantity || 0) + qty }).eq("id", dst.id);
      } else {
        await supabase.from("inventory_levels").insert([{ item_id: form.item_id, location_id: form.to_location_id, quantity: qty }]);
      }

      toast({ title: "Transfer completed", description: "Stock moved between locations" });
      setForm({ item_id: "", from_location_id: "", to_location_id: "", quantity: "" });
      fetchRefs();
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to complete transfer", variant: "destructive" });
    }
  };

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Stock Transfers</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New Transfer</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitTransfer} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <Label>Item</Label>
              <Select value={form.item_id} onValueChange={(v) => setForm({ ...form, item_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select item" />
                </SelectTrigger>
                <SelectContent>
                  {items.map(it => <SelectItem key={it.id} value={it.id}>{it.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>From Location</Label>
              <Select value={form.from_location_id} onValueChange={(v) => setForm({ ...form, from_location_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {form.item_id && form.from_location_id && (
                <div className="text-xs text-muted-foreground">Available: {getAvailableQty(form.item_id, form.from_location_id)}</div>
              )}
            </div>
            <div className="space-y-2">
              <Label>To Location</Label>
              <Select value={form.to_location_id} onValueChange={(v) => setForm({ ...form, to_location_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select destination" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input type="number" min={0} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </div>
            <div>
              <Button type="submit">Transfer</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Levels</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table className="w-full">
              <TableHeader>
                <TableRow>
                  <TableHead>Location</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!loading && levels.map(row => (
                  <TableRow key={row.id}>
                    <TableCell>{row.storage_locations?.name || row.location_id}</TableCell>
                    <TableCell>{row.inventory_items?.name || row.item_id}</TableCell>
                    <TableCell className="text-right">{Number(row.quantity || 0)}</TableCell>
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