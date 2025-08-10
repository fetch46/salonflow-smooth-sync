import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Package, Trash2, Edit, MapPin } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";

// --- Type Definitions ---
type InventoryItem = {
  id: string;
  name: string;
  description: string;
  type: 'good' | 'service';
  sku: string;
  unit: string;
  reorder_point: number;
  is_active: boolean;
};

// --- Form Components ---

// A separate component for the Item Dialog Form
const ItemFormDialog = ({ isOpen, onClose, onSubmit, editingItem }) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    sku: "",
    unit: "",
    reorder_point: 0
  });

  useEffect(() => {
    if (editingItem) {
      setFormData({
        name: editingItem.name || "",
        description: editingItem.description || "",
        sku: editingItem.sku || "",
        unit: editingItem.unit || "",
        reorder_point: editingItem.reorder_point || 0,
      });
    } else {
      setFormData({
        name: "",
        description: "",
        sku: "",
        unit: "",
        reorder_point: 0
      });
    }
  }, [editingItem]);

  const handleFormSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editingItem ? "Edit Product" : "Add New Product"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleFormSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">Unit</Label>
              <Input
                id="unit"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                placeholder="e.g., piece, bottle, kg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reorder-point">Reorder Point</Label>
              <Input
                id="reorder-point"
                type="number"
                value={formData.reorder_point}
                onChange={(e) => setFormData({ ...formData, reorder_point: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              {editingItem ? "Update" : "Create"} Product
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// --- Main Component ---
export default function Inventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [searchQuery, setSearchQuery] = useState("");
  const [levels, setLevels] = useState<any[]>([]);
  const [levelsLoading, setLevelsLoading] = useState<boolean>(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: itemsRes } = await supabase.from("inventory_items").select("*").order("name");
      setItems((itemsRes || []) as InventoryItem[]);
    } catch (error) {
      toast({ title: "Error", description: "Failed to fetch inventory data", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchLevels = useCallback(async () => {
    setLevelsLoading(true);
    try {
      const { data, error } = await supabase
        .from("inventory_levels")
        .select(`
          id,
          item_id,
          location_id,
          quantity,
          inventory_items ( name, sku ),
          storage_locations ( name )
        `)
        .order("location_id")
        .order("item_id");
      if (error) throw error;
      setLevels(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLevelsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchLevels();
  }, [fetchData, fetchLevels]);

  const handleItemSubmit = async (formData) => {
    try {
      if (editingItem) {
        const { error } = await supabase.from("inventory_items").update(formData).eq("id", editingItem.id);
        if (error) throw error;
        toast({ title: "Success", description: "Product updated successfully" });
      } else {
        const payload = { ...formData, type: "good" };
        const { error } = await supabase.from("inventory_items").insert(payload);
        if (error) throw error;
        toast({ title: "Success", description: "Product created successfully" });
      }
      setIsItemDialogOpen(false);
      setEditingItem(null);
      fetchData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to save product", variant: "destructive" });
    }
  };

  const handleEditItem = (item: InventoryItem) => {
    setEditingItem(item);
    setIsItemDialogOpen(true);
  };

  const handleDeactivateItem = async (item: InventoryItem) => {
    const confirm = window.confirm(`Mark product "${item.name}" as inactive? It will no longer be available in POS, Purchases, or Service Kits.`);
    if (!confirm) return;
    try {
      const { error } = await supabase
        .from("inventory_items")
        .update({ is_active: false })
        .eq("id", item.id);
      if (error) throw error;
      toast({ title: "Updated", description: "Product marked as inactive" });
      fetchData();
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to update product", variant: "destructive" });
    }
  };

  const handleActivateItem = async (item: InventoryItem) => {
    const confirm = window.confirm(`Mark product "${item.name}" as active? It will be available in POS, Purchases, and Service Kits.`);
    if (!confirm) return;
    try {
      const { error } = await supabase
        .from("inventory_items")
        .update({ is_active: true })
        .eq("id", item.id);
      if (error) throw error;
      toast({ title: "Updated", description: "Product marked as active" });
      fetchData();
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to update product", variant: "destructive" });
    }
  };

  const allGoodsItems = items.filter(item => item.type === 'good');
  const activeGoodsItems = allGoodsItems.filter(item => item.is_active);
  const displayedGoodsItems = statusFilter === 'all' ? allGoodsItems : statusFilter === 'active' ? activeGoodsItems : allGoodsItems.filter(item => !item.is_active);
  const filteredGoodsItems = displayedGoodsItems.filter(item => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return item.name.toLowerCase().includes(q) || (item.sku || '').toLowerCase().includes(q);
  });

  const TableSkeleton = () => (
    <div className="overflow-auto max-h-[65vh] rounded-lg border">
      <Table className="min-w-[720px]">
        <TableHeader className="sticky top-0 bg-background z-10">
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="hidden sm:table-cell">SKU</TableHead>
            <TableHead className="hidden md:table-cell">Unit</TableHead>
            <TableHead className="hidden lg:table-cell">Reorder Point</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i} className="hover:bg-muted/50">
              <TableCell><Skeleton className="h-4 w-[180px]" /></TableCell>
              <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-[120px]" /></TableCell>
              <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-[80px]" /></TableCell>
              <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-[60px]" /></TableCell>
              <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-6 space-y-6 lg:space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold">Inventory Management</h1>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => { setEditingItem(null); setIsItemDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Add Product
          </Button>
        </div>
      </div>

      <ItemFormDialog
        isOpen={isItemDialogOpen}
        onClose={() => setIsItemDialogOpen(false)}
        onSubmit={handleItemSubmit}
        editingItem={editingItem}
      />

      <Tabs defaultValue="goods" className="space-y-6">
        <TabsList className="grid w-full grid-cols-1 md:w-fit">
          <TabsTrigger value="goods">Products</TabsTrigger>
          <TabsTrigger value="stock">Stock by Location</TabsTrigger>
        </TabsList>

        <TabsContent value="goods">
          <Card>
            <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                Products Inventory
              </CardTitle>
              <div className="flex w-full lg:w-auto items-center gap-3">
                <Input
                  placeholder="Search products by name or SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full lg:w-64"
                />
                <div className="flex items-center gap-3">
                  <Label className="text-sm">Status</Label>
                  <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? <TableSkeleton /> : (
                <div className="overflow-auto max-h-[65vh] rounded-lg border">
                  <Table className="min-w-[720px]">
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="hidden sm:table-cell">SKU</TableHead>
                        <TableHead className="hidden md:table-cell">Unit</TableHead>
                        <TableHead className="hidden lg:table-cell">Reorder Point</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredGoodsItems.map((item) => {
                        return (
                          <TableRow key={item.id} className="hover:bg-muted/50">
                            <TableCell className="font-medium max-w-[320px] truncate">
                              <Link to={`/inventory/${item.id}`} className="hover:underline">
                                {item.name}
                              </Link>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">{item.sku}</TableCell>
                            <TableCell className="hidden md:table-cell">{item.unit}</TableCell>
                            <TableCell className="hidden lg:table-cell">{item.reorder_point}</TableCell>
                            <TableCell>
                              {item.is_active ? (
                                <Badge variant="secondary">Active</Badge>
                              ) : (
                                <Badge variant="outline">Inactive</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" onClick={() => handleEditItem(item)}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              {item.is_active ? (
                                <Button variant="ghost" size="sm" onClick={() => handleDeactivateItem(item)}>
                                  <Trash2 className="w-4 h-4 text-red-600" />
                                </Button>
                              ) : (
                                <Button variant="ghost" size="sm" onClick={() => handleActivateItem(item)}>
                                  Activate
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stock">
          <Card>
            <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                Stock by Location
              </CardTitle>
            </CardHeader>
            <CardContent>
              {levelsLoading ? (
                <div className="overflow-auto max-h-[65vh] rounded-lg border">
                  <Table className="min-w-[720px]">
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead>Location</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead className="hidden sm:table-cell">SKU</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.from({ length: 6 }).map((_, i) => (
                        <TableRow key={i} className="hover:bg-muted/50">
                          <TableCell><Skeleton className="h-4 w-[160px]" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-[220px]" /></TableCell>
                          <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-[120px]" /></TableCell>
                          <TableCell className="text-right"><Skeleton className="h-4 w-[60px] ml-auto" /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="overflow-auto max-h-[65vh] rounded-lg border">
                  <Table className="min-w-[720px]">
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead>Location</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead className="hidden sm:table-cell">SKU</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {levels.map((lvl) => (
                        <TableRow key={lvl.id} className="hover:bg-muted/50">
                          <TableCell className="font-medium">{lvl.storage_locations?.name || lvl.location_id}</TableCell>
                          <TableCell>{lvl.inventory_items?.name || lvl.item_id}</TableCell>
                          <TableCell className="hidden sm:table-cell">{lvl.inventory_items?.sku || ''}</TableCell>
                          <TableCell className="text-right">{Number(lvl.quantity || 0)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
