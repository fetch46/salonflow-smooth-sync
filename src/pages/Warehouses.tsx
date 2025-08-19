import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit2, Trash2, Search } from "lucide-react";
import { useSaas } from "@/lib/saas";

interface WarehouseRow {
  id: string;
  name: string;
  is_active: boolean;
  location_id: string | null;
  created_at?: string;
  updated_at?: string;
  business_locations?: { name: string } | null;
}

interface LocationRow { id: string; name: string; }

export default function Warehouses() {
  const { organization } = useSaas();
  const { toast } = useToast();

  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  // Create/Edit dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WarehouseRow | null>(null);
  const [form, setForm] = useState({ name: "", location_id: "", is_active: true });

  const loadRefs = useCallback(async () => {
    const orgId = organization?.id;
    try {
      let query = supabase.from("business_locations").select("id, name").order("name");
      if (orgId) {
        query = query.eq("organization_id", orgId);
      } else {
        query = query.eq("is_active", true);
      }
      const locs = await query;
      setLocations((locs.data || []) as any);
    } catch (e) {
      setLocations([]);
    }
  }, [organization?.id]);

  const loadWarehouses = useCallback(async () => {
    setLoading(true);
    try {
      const orgId = organization?.id;
      let query = supabase
        .from("warehouses")
        .select("id, name, is_active, location_id, business_locations(name)")
        .order("name");
      if (orgId) {
        query = query.eq("organization_id", orgId);
      }
      const { data, error } = await query;
      if (error) throw error;
      setWarehouses((data || []) as any);
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to load warehouses", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [organization?.id, toast]);

  useEffect(() => { loadRefs(); loadWarehouses(); }, [loadRefs, loadWarehouses]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", location_id: "", is_active: true });
    setDialogOpen(true);
  };

  const openEdit = (row: WarehouseRow) => {
    setEditing(row);
    setForm({ name: row.name, location_id: row.location_id || "", is_active: !!row.is_active });
    setDialogOpen(true);
  };

  const save = async () => {
    try {
      if (!form.name) { toast({ title: "Name required", description: "Enter a name", variant: "destructive" }); return; }
      if (!form.location_id) { toast({ title: "Location required", description: "Select a business location", variant: "destructive" }); return; }
      if (!organization?.id) { toast({ title: "Organization required", description: "No organization selected", variant: "destructive" }); return; }
      const orgId = organization.id;
      if (editing) {
        const { error } = await supabase
          .from("warehouses")
          .update({ name: form.name, location_id: form.location_id || null, is_active: form.is_active })
          .eq("id", editing.id);
        if (error) throw error;
        toast({ title: "Saved", description: "Warehouse updated" });
      } else {
        const { error } = await supabase
          .from("warehouses")
          .insert([{ name: form.name, location_id: form.location_id || null, is_active: true, organization_id: orgId }]);
        if (error) throw error;
        toast({ title: "Created", description: "Warehouse created" });
      }
      setDialogOpen(false);
      setEditing(null);
      setForm({ name: "", location_id: "", is_active: true });
      loadWarehouses();
    } catch (e: any) {
      toast({ title: "Save failed", description: String(e?.message || e), variant: "destructive" });
    }
  };

  const remove = async (row: WarehouseRow) => {
    if (!confirm(`Delete warehouse "${row.name}"?`)) return;
    try {
      // Check for related transactions before allowing deletion
      const [levelsRes, grRes, adjRes] = await Promise.all([
        supabase.from("inventory_levels").select("id", { count: "exact", head: true }).eq("warehouse_id", row.id),
        supabase.from("goods_received").select("id", { count: "exact", head: true }).eq("warehouse_id", row.id),
        supabase.from("inventory_adjustments").select("id", { count: "exact", head: true }).eq("warehouse_id", row.id),
      ]);
      const levelsCount = levelsRes.count || 0;
      const goodsReceivedCount = grRes.count || 0;
      const adjustmentsCount = adjRes.count || 0;
      if (levelsCount > 0 || goodsReceivedCount > 0 || adjustmentsCount > 0) {
        toast({ title: "Cannot delete", description: "Warehouse has transactions and cannot be deleted", variant: "destructive" });
        return;
      }

      const { error } = await supabase.from("warehouses").delete().eq("id", row.id);
      if (error) throw error;
      toast({ title: "Deleted", description: "Warehouse removed" });
      loadWarehouses();
    } catch (e: any) {
      toast({ title: "Delete failed", description: String(e?.message || e), variant: "destructive" });
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return warehouses;
    return warehouses.filter((w) =>
      w.name.toLowerCase().includes(q) || (w.business_locations?.name || "").toLowerCase().includes(q)
    );
  }, [warehouses, search]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Warehouses</h1>
          <p className="text-muted-foreground">Manage stock storage locations per business location</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8 w-64" placeholder="Search warehouses" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2"/>New Warehouse</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Warehouses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Business Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-sm text-muted-foreground">Loading…</TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-sm text-muted-foreground">No warehouses</TableCell>
                  </TableRow>
                ) : filtered.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium">{w.name}</TableCell>
                    <TableCell>{w.business_locations?.name || '-'}</TableCell>
                    <TableCell>
                      {w.is_active ? (
                        <Badge variant="secondary">Active</Badge>
                      ) : (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(w)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => remove(w)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Warehouse' : 'New Warehouse'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Main Warehouse" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Business Location</Label>
              <Select value={form.location_id} onValueChange={(v) => setForm({ ...form, location_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a business location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? 'Save Changes' : 'Create Warehouse'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}