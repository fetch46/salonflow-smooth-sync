import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MoreHorizontal, Pencil, Trash2, Eye } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface InventoryItem { id: string; name: string; }
interface Location { id: string; name: string; }
interface LevelRow { id: string; item_id: string; location_id: string; quantity: number; inventory_items?: { name: string }; storage_locations?: { name: string }; }

interface TransferRow { id: string; item_id: string; from_location_id: string; to_location_id: string; quantity: number; created_at: string; updated_at: string; notes?: string; inventory_items?: { name: string }; from_location?: { name: string }; to_location?: { name: string }; }

export default function StockTransfers() {
  const { toast } = useToast();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [transfers, setTransfers] = useState<TransferRow[]>([]);
  const [viewOpen, setViewOpen] = useState<boolean>(false);
  const [editOpen, setEditOpen] = useState<boolean>(false);
  const [selectedTransfer, setSelectedTransfer] = useState<TransferRow | null>(null);
  const [editForm, setEditForm] = useState({ item_id: "", from_location_id: "", to_location_id: "", quantity: "", notes: "" });

  const [form, setForm] = useState({ item_id: "", from_location_id: "", to_location_id: "", quantity: "" });
  const qty = Number(form.quantity || 0);

  const fetchRefs = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsRes, locsRes, levelsRes, transfersRes] = await Promise.all([
        supabase.from("inventory_items").select("id, name").eq("type", "good").eq("is_active", true).order("name"),
        supabase.from("storage_locations").select("id, name").order("name"),
        supabase.from("inventory_levels").select(`id, item_id, location_id, quantity, inventory_items(name), storage_locations(name)`).order("location_id").order("item_id"),
        supabase.from("inventory_transfers").select(`id, item_id, from_location_id, to_location_id, quantity, notes, created_at, updated_at, inventory_items(name)`)
          .order("created_at", { ascending: false })
      ]);
      setItems(itemsRes.data || []);
      setLocations(locsRes.data || []);
      setLevels((levelsRes.data || []) as LevelRow[]);
      setTransfers((transfersRes.data || []) as TransferRow[]);
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
      // Record transfer
      await supabase.from("inventory_transfers").insert([{ 
        item_id: form.item_id, 
        from_location_id: form.from_location_id, 
        to_location_id: form.to_location_id, 
        quantity: qty,
        notes: null
      }]);

      toast({ title: "Transfer completed", description: "Stock moved between locations" });
      setForm({ item_id: "", from_location_id: "", to_location_id: "", quantity: "" });
      fetchRefs();
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to complete transfer", variant: "destructive" });
    }
  };

  const openView = (t: TransferRow) => {
    setSelectedTransfer(t);
    setViewOpen(true);
  };

  const openEdit = (t: TransferRow) => {
    setSelectedTransfer(t);
    setEditForm({
      item_id: t.item_id,
      from_location_id: t.from_location_id,
      to_location_id: t.to_location_id,
      quantity: String(t.quantity || 0),
      notes: t.notes || "",
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!selectedTransfer) return;
    const newQty = Number(editForm.quantity || 0);
    if (!editForm.item_id || !editForm.from_location_id || !editForm.to_location_id || newQty <= 0) {
      toast({ title: "Missing data", description: "Fill all required fields", variant: "destructive" });
      return;
    }

    try {
      // Revert original inventory move
      const orig = selectedTransfer;
      // Add back to source
      const { data: srcLevels } = await supabase
        .from("inventory_levels")
        .select("id, quantity")
        .eq("item_id", orig.item_id)
        .eq("location_id", orig.to_location_id)
        .limit(1);
      if (srcLevels && srcLevels.length > 0) {
        await supabase.from("inventory_levels").update({ quantity: Number(srcLevels[0].quantity || 0) - Number(orig.quantity || 0) }).eq("id", srcLevels[0].id);
      }
      const { data: dstLevels } = await supabase
        .from("inventory_levels")
        .select("id, quantity")
        .eq("item_id", orig.item_id)
        .eq("location_id", orig.from_location_id)
        .limit(1);
      if (dstLevels && dstLevels.length > 0) {
        await supabase.from("inventory_levels").update({ quantity: Number(dstLevels[0].quantity || 0) + Number(orig.quantity || 0) }).eq("id", dstLevels[0].id);
      } else {
        await supabase.from("inventory_levels").insert([{ item_id: orig.item_id, location_id: orig.from_location_id, quantity: Number(orig.quantity || 0) }]);
      }

      // Apply new inventory move
      // Decrease from new source
      const { data: newSrc } = await supabase
        .from("inventory_levels")
        .select("id, quantity")
        .eq("item_id", editForm.item_id)
        .eq("location_id", editForm.from_location_id)
        .limit(1);
      if (newSrc && newSrc.length > 0) {
        await supabase.from("inventory_levels").update({ quantity: Number(newSrc[0].quantity || 0) - newQty }).eq("id", newSrc[0].id);
      }
      // Increase at new destination
      const { data: newDst } = await supabase
        .from("inventory_levels")
        .select("id, quantity")
        .eq("item_id", editForm.item_id)
        .eq("location_id", editForm.to_location_id)
        .limit(1);
      if (newDst && newDst.length > 0) {
        await supabase.from("inventory_levels").update({ quantity: Number(newDst[0].quantity || 0) + newQty }).eq("id", newDst[0].id);
      } else {
        await supabase.from("inventory_levels").insert([{ item_id: editForm.item_id, location_id: editForm.to_location_id, quantity: newQty }]);
      }

      // Update transfer record
      await supabase.from("inventory_transfers").update({
        item_id: editForm.item_id,
        from_location_id: editForm.from_location_id,
        to_location_id: editForm.to_location_id,
        quantity: newQty,
        notes: editForm.notes || null,
      }).eq("id", selectedTransfer.id);

      toast({ title: "Transfer updated", description: "Changes saved" });
      setEditOpen(false);
      setSelectedTransfer(null);
      fetchRefs();
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to update transfer", variant: "destructive" });
    }
  };

  const deleteTransfer = async (t: TransferRow) => {
    try {
      // Revert the transfer in inventory
      const { data: dst } = await supabase
        .from("inventory_levels")
        .select("id, quantity")
        .eq("item_id", t.item_id)
        .eq("location_id", t.to_location_id)
        .limit(1);
      if (dst && dst.length > 0) {
        await supabase.from("inventory_levels").update({ quantity: Number(dst[0].quantity || 0) - Number(t.quantity || 0) }).eq("id", dst[0].id);
      }
      const { data: src } = await supabase
        .from("inventory_levels")
        .select("id, quantity")
        .eq("item_id", t.item_id)
        .eq("location_id", t.from_location_id)
        .limit(1);
      if (src && src.length > 0) {
        await supabase.from("inventory_levels").update({ quantity: Number(src[0].quantity || 0) + Number(t.quantity || 0) }).eq("id", src[0].id);
      } else {
        await supabase.from("inventory_levels").insert([{ item_id: t.item_id, location_id: t.from_location_id, quantity: Number(t.quantity || 0) }]);
      }

      await supabase.from("inventory_transfers").delete().eq("id", t.id);
      toast({ title: "Transfer deleted", description: "Inventory reverted" });
      fetchRefs();
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to delete transfer", variant: "destructive" });
    }
  };

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Stock Transfers</h2>
      </div>

      <Tabs defaultValue="new" className="space-y-6">
        <TabsList>
          <TabsTrigger value="new">New Transfer</TabsTrigger>
          <TabsTrigger value="levels">Levels</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="new">
          {/* New Transfer Card */}
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
        </TabsContent>

        <TabsContent value="levels">
          {/* Levels Card */}
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
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Transfer History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table className="w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!loading && transfers.map(t => (
                      <TableRow key={t.id}>
                        <TableCell>{new Date(t.created_at).toLocaleString()}</TableCell>
                        <TableCell>{t.inventory_items?.name || items.find(i => i.id === t.item_id)?.name || t.item_id}</TableCell>
                        <TableCell>{locations.find(l => l.id === t.from_location_id)?.name || t.from_location_id}</TableCell>
                        <TableCell>{locations.find(l => l.id === t.to_location_id)?.name || t.to_location_id}</TableCell>
                        <TableCell className="text-right">{Number(t.quantity || 0)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => openView(t)}><Eye className="h-4 w-4 mr-2" />View</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openEdit(t)}><Pencil className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-red-600" onClick={() => deleteTransfer(t)}><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* View Sheet */}
      <Sheet open={viewOpen} onOpenChange={setViewOpen}>
        <SheetContent side="right" className="sm:max-w-xl w-full">
          <SheetHeader>
            <SheetTitle>Transfer Details</SheetTitle>
          </SheetHeader>
          <div className="space-y-6 py-4">
            {selectedTransfer && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Item</div>
                    <div className="font-medium">{items.find(i => i.id === selectedTransfer.item_id)?.name || selectedTransfer.item_id}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Quantity</div>
                    <div className="font-medium">{Number(selectedTransfer.quantity || 0)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">From</div>
                    <div className="font-medium">{locations.find(l => l.id === selectedTransfer.from_location_id)?.name || selectedTransfer.from_location_id}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">To</div>
                    <div className="font-medium">{locations.find(l => l.id === selectedTransfer.to_location_id)?.name || selectedTransfer.to_location_id}</div>
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Created</div>
                    <div className="font-medium">{new Date(selectedTransfer.created_at).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Updated</div>
                    <div className="font-medium">{new Date(selectedTransfer.updated_at).toLocaleString()}</div>
                  </div>
                </div>
                {selectedTransfer.notes && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Notes</div>
                    <div className="text-sm whitespace-pre-wrap">{selectedTransfer.notes}</div>
                  </div>
                )}
              </div>
            )}
          </div>
          <SheetFooter>
            <div className="flex gap-2 ml-auto">
              <Button variant="secondary" onClick={() => { setViewOpen(false); openEdit(selectedTransfer as TransferRow); }}>Edit</Button>
              <Button variant="destructive" onClick={() => { if (selectedTransfer) deleteTransfer(selectedTransfer); setViewOpen(false); }}>Delete</Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Transfer</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-2">
              <Label>Item</Label>
              <Select value={editForm.item_id} onValueChange={(v) => setEditForm({ ...editForm, item_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select item" />
                </SelectTrigger>
                <SelectContent>
                  {items.map(it => <SelectItem key={it.id} value={it.id}>{it.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input type="number" min={0} value={editForm.quantity} onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>From Location</Label>
              <Select value={editForm.from_location_id} onValueChange={(v) => setEditForm({ ...editForm, from_location_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>To Location</Label>
              <Select value={editForm.to_location_id} onValueChange={(v) => setEditForm({ ...editForm, to_location_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select destination" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Notes</Label>
              <Input value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}