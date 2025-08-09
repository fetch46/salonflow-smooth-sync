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
import { Plus, Package, Trash2, Edit, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

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



type ServiceKit = {
  id: string;
  service_id: string;
  good_id: string;
  quantity: number;
  good: InventoryItem;
};

// --- Form Components ---

// A separate component for the Item Dialog Form
const ItemFormDialog = ({ isOpen, onClose, onSubmit, editingItem, goodsItems, serviceKits }) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "good" as 'good' | 'service',
    sku: "",
    unit: "",
    reorder_point: 0
  });
  const [kitItems, setKitItems] = useState<Array<{ good_id: string; quantity: number }>>([]);

  useEffect(() => {
    if (editingItem) {
      setFormData(editingItem);
      if (editingItem.type === 'service') {
        const kits = serviceKits.filter(kit => kit.service_id === editingItem.id);
        setKitItems(kits.map(kit => ({
          good_id: kit.good_id,
          quantity: kit.quantity
        })));
      }
    } else {
      setFormData({
        name: "",
        description: "",
        type: "good",
        sku: "",
        unit: "",
        reorder_point: 0
      });
      setKitItems([]);
    }
  }, [editingItem, serviceKits]);

  const handleFormSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData, kitItems);
  };

  const addKitItem = () => setKitItems(prev => [...prev, { good_id: "", quantity: 1 }]);
  const updateKitItem = (index, field, value) => {
    const newKitItems = [...kitItems];
    newKitItems[index] = { ...newKitItems[index], [field]: value };
    setKitItems(newKitItems);
  };
  const removeKitItem = (index) => setKitItems(kitItems.filter((_, i) => i !== index));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editingItem ? "Edit Item" : "Add New Item"}</DialogTitle>
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
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value: 'good' | 'service') => {
                  setFormData(prev => ({ ...prev, type: value, ...(value === 'service' && { unit: 'service', reorder_point: 0 }) }));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="good">Good</SelectItem>
                  <SelectItem value="service">Service</SelectItem>
                </SelectContent>
              </Select>
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

          {formData.type === 'good' && (
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
          )}

          {formData.type === 'service' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label className="text-lg font-semibold">Service Kit (Goods Required)</Label>
                <Button type="button" variant="outline" size="sm" onClick={addKitItem}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Good
                </Button>
              </div>
              <div className="space-y-2">
                {kitItems.map((kit, index) => (
                  <div key={index} className="flex gap-2 items-end">
                    <div className="flex-1 space-y-1">
                      <Label className="sr-only">Good</Label>
                      <Select
                        value={kit.good_id}
                        onValueChange={(value) => updateKitItem(index, 'good_id', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a good" />
                        </SelectTrigger>
                        <SelectContent>
                          {goodsItems.map((good) => (
                            <SelectItem key={good.id} value={good.id}>
                              {good.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-24 space-y-1">
                      <Label className="sr-only">Quantity</Label>
                      <Input
                        type="number"
                        value={kit.quantity}
                        onChange={(e) => updateKitItem(index, 'quantity', parseInt(e.target.value) || 1)}
                        min="1"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeKitItem(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              {editingItem ? "Update" : "Create"} Item
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
  const [serviceKits, setServiceKits] = useState<ServiceKit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [itemsRes, kitsRes] = await Promise.all([
        supabase.from("inventory_items").select("*").eq("is_active", true).order("name"),
        supabase.from("service_kits").select(`*, good:inventory_items!service_kits_good_id_fkey(*)`)
      ]);

      setItems((itemsRes.data || []) as InventoryItem[]);
      setServiceKits((kitsRes.data || []) as ServiceKit[]);
    } catch (error) {
      toast({ title: "Error", description: "Failed to fetch inventory data", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleItemSubmit = async (formData, kitItems) => {
    try {
      if (editingItem) {
        const { error } = await supabase.from("inventory_items").update(formData).eq("id", editingItem.id);
        if (error) throw error;
        if (formData.type === 'service') {
          await supabase.from("service_kits").delete().eq("service_id", editingItem.id);
          if (kitItems.length > 0) {
            const { error: kitError } = await supabase.from("service_kits").insert(kitItems.map(kit => ({ service_id: editingItem.id, good_id: kit.good_id, quantity: kit.quantity })));
            if (kitError) throw kitError;
          }
        }
        toast({ title: "Success", description: "Item updated successfully" });
      } else {
        const { data: newItem, error } = await supabase.from("inventory_items").insert(formData).select().single();
        if (error) throw error;
        if (formData.type === 'service' && kitItems.length > 0) {
          const { error: kitError } = await supabase.from("service_kits").insert(kitItems.map(kit => ({ service_id: newItem.id, good_id: kit.good_id, quantity: kit.quantity })));
          if (kitError) throw kitError;
        }
        toast({ title: "Success", description: "Item created successfully" });
      }
      setIsItemDialogOpen(false);
      setEditingItem(null);
      fetchData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to save item", variant: "destructive" });
    }
  };

  const handleEditItem = (item: InventoryItem) => {
    setEditingItem(item);
    setIsItemDialogOpen(true);
  };

  const isLowStock = (item: InventoryItem) => {
    // Since we removed stock levels, we'll return false for now
    // This can be updated when inventory adjustments are implemented
    return false;
  };

  const goodsItems = items.filter(item => item.type === 'good');
  const serviceItems = items.filter(item => item.type === 'service');

  const TableSkeleton = () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>SKU</TableHead>
          <TableHead>Total Stock</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 5 }).map((_, i) => (
          <TableRow key={i}>
            <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
            <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
            <TableCell><Skeleton className="h-4 w-[50px]" /></TableCell>
            <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold">Inventory Management</h1>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => { setEditingItem(null); setIsItemDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Add Item
          </Button>
        </div>
      </div>

      <ItemFormDialog
        isOpen={isItemDialogOpen}
        onClose={() => setIsItemDialogOpen(false)}
        onSubmit={handleItemSubmit}
        editingItem={editingItem}
        goodsItems={goodsItems}
        serviceKits={serviceKits}
      />

      <Tabs defaultValue="goods" className="space-y-6">
        <TabsList className="grid w-full grid-cols-1 md:w-fit">
          <TabsTrigger value="goods">Products</TabsTrigger>
        </TabsList>

        <TabsContent value="goods">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                Products Inventory
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <TableSkeleton /> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Reorder Point</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {goodsItems.map((item) => {
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell>{item.sku}</TableCell>
                          <TableCell>{item.unit}</TableCell>
                          <TableCell>{item.reorder_point}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">Active</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => handleEditItem(item)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>


      </Tabs>
    </div>
  );
}
