import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Package, MapPin, AlertTriangle, Trash2, Edit } from "lucide-react";
import { toast } from "@/hooks/use-toast";

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

type StorageLocation = {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
};

type InventoryLevel = {
  id: string;
  item_id: string;
  location_id: string;
  quantity: number;
  inventory_items: InventoryItem;
  storage_locations: StorageLocation;
};

type ServiceKit = {
  id: string;
  service_id: string;
  good_id: string;
  quantity: number;
  good: InventoryItem;
};

export default function Inventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [levels, setLevels] = useState<InventoryLevel[]>([]);
  const [serviceKits, setServiceKits] = useState<ServiceKit[]>([]);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editingLocation, setEditingLocation] = useState<StorageLocation | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "good" as 'good' | 'service',
    sku: "",
    unit: "",
    reorder_point: 0
  });

  const [locationFormData, setLocationFormData] = useState({
    name: "",
    description: ""
  });

  const [kitItems, setKitItems] = useState<Array<{ good_id: string; quantity: number }>>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch items
      const { data: itemsData } = await supabase
        .from("inventory_items")
        .select("*")
        .eq("is_active", true)
        .order("name");

      // Fetch locations
      const { data: locationsData } = await supabase
        .from("storage_locations")
        .select("*")
        .eq("is_active", true)
        .order("name");

      // Fetch inventory levels with joins
      const { data: levelsData } = await supabase
        .from("inventory_levels")
        .select(`
          *,
          inventory_items!inner(*),
          storage_locations!inner(*)
        `)
        .eq("inventory_items.is_active", true)
        .eq("storage_locations.is_active", true);

      // Fetch service kits
      const { data: kitsData } = await supabase
        .from("service_kits")
        .select(`
          *,
          good:inventory_items!service_kits_good_id_fkey(*)
        `);

      setItems((itemsData || []) as InventoryItem[]);
      setLocations((locationsData || []) as StorageLocation[]);
      setLevels((levelsData || []) as InventoryLevel[]);
      setServiceKits((kitsData || []) as ServiceKit[]);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch inventory data",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingItem) {
        const { error } = await supabase
          .from("inventory_items")
          .update(formData)
          .eq("id", editingItem.id);

        if (error) throw error;

        // Update service kit if it's a service
        if (formData.type === 'service' && kitItems.length > 0) {
          // Delete existing kit items
          await supabase
            .from("service_kits")
            .delete()
            .eq("service_id", editingItem.id);

          // Insert new kit items
          const { error: kitError } = await supabase
            .from("service_kits")
            .insert(
              kitItems.map(kit => ({
                service_id: editingItem.id,
                good_id: kit.good_id,
                quantity: kit.quantity
              }))
            );

          if (kitError) throw kitError;
        }

        toast({
          title: "Success",
          description: "Item updated successfully"
        });
      } else {
        const { data: newItem, error } = await supabase
          .from("inventory_items")
          .insert(formData)
          .select()
          .single();

        if (error) throw error;

        // Insert service kit if it's a service
        if (formData.type === 'service' && kitItems.length > 0) {
          const { error: kitError } = await supabase
            .from("service_kits")
            .insert(
              kitItems.map(kit => ({
                service_id: newItem.id,
                good_id: kit.good_id,
                quantity: kit.quantity
              }))
            );

          if (kitError) throw kitError;
        }

        toast({
          title: "Success",
          description: "Item created successfully"
        });
      }

      resetForm();
      setIsDialogOpen(false);
      fetchData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save item",
        variant: "destructive"
      });
    }
  };

  const handleLocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingLocation) {
        const { error } = await supabase
          .from("storage_locations")
          .update(locationFormData)
          .eq("id", editingLocation.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Location updated successfully"
        });
      } else {
        const { error } = await supabase
          .from("storage_locations")
          .insert(locationFormData);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Location created successfully"
        });
      }

      resetLocationForm();
      setIsLocationDialogOpen(false);
      fetchData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save location",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      type: "good",
      sku: "",
      unit: "",
      reorder_point: 0
    });
    setKitItems([]);
    setEditingItem(null);
  };

  const resetLocationForm = () => {
    setLocationFormData({
      name: "",
      description: ""
    });
    setEditingLocation(null);
  };

  const handleEdit = (item: InventoryItem) => {
    setFormData(item);
    setEditingItem(item);
    
    // Load kit items if it's a service
    if (item.type === 'service') {
      const kits = serviceKits.filter(kit => kit.service_id === item.id);
      setKitItems(kits.map(kit => ({
        good_id: kit.good_id,
        quantity: kit.quantity
      })));
    }
    
    setIsDialogOpen(true);
  };

  const handleEditLocation = (location: StorageLocation) => {
    setLocationFormData({
      name: location.name,
      description: location.description || ""
    });
    setEditingLocation(location);
    setIsLocationDialogOpen(true);
  };

  const addKitItem = () => {
    setKitItems([...kitItems, { good_id: "", quantity: 1 }]);
  };

  const updateKitItem = (index: number, field: 'good_id' | 'quantity', value: string | number) => {
    const newKitItems = [...kitItems];
    newKitItems[index] = { ...newKitItems[index], [field]: value };
    setKitItems(newKitItems);
  };

  const removeKitItem = (index: number) => {
    setKitItems(kitItems.filter((_, i) => i !== index));
  };

  const getTotalQuantity = (itemId: string) => {
    return levels
      .filter(level => level.item_id === itemId)
      .reduce((total, level) => total + level.quantity, 0);
  };

  const isLowStock = (item: InventoryItem) => {
    if (item.type === 'service') return false;
    const total = getTotalQuantity(item.id);
    return total <= item.reorder_point;
  };

  const goodsItems = items.filter(item => item.type === 'good');
  const serviceItems = items.filter(item => item.type === 'service');

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Inventory Management</h1>
        <div className="flex gap-2">
          <Dialog open={isLocationDialogOpen} onOpenChange={setIsLocationDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" onClick={resetLocationForm}>
                <MapPin className="w-4 h-4 mr-2" />
                Add Location
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingLocation ? "Edit Location" : "Add New Location"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleLocationSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="location-name">Name</Label>
                  <Input
                    id="location-name"
                    value={locationFormData.name}
                    onChange={(e) => setLocationFormData({...locationFormData, name: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="location-description">Description</Label>
                  <Textarea
                    id="location-description"
                    value={locationFormData.description}
                    onChange={(e) => setLocationFormData({...locationFormData, description: e.target.value})}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsLocationDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingLocation ? "Update" : "Create"} Location
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingItem ? "Edit Item" : "Add New Item"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="type">Type</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value: 'good' | 'service') => {
                        setFormData({...formData, type: value});
                        if (value === 'service') {
                          setFormData(prev => ({...prev, unit: 'service', reorder_point: 0}));
                        }
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

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="sku">SKU</Label>
                    <Input
                      id="sku"
                      value={formData.sku}
                      onChange={(e) => setFormData({...formData, sku: e.target.value})}
                    />
                  </div>
                  {formData.type === 'good' && (
                    <>
                      <div>
                        <Label htmlFor="unit">Unit</Label>
                        <Input
                          id="unit"
                          value={formData.unit}
                          onChange={(e) => setFormData({...formData, unit: e.target.value})}
                          placeholder="e.g., piece, bottle, kg"
                        />
                      </div>
                      <div>
                        <Label htmlFor="reorder-point">Reorder Point</Label>
                        <Input
                          id="reorder-point"
                          type="number"
                          value={formData.reorder_point}
                          onChange={(e) => setFormData({...formData, reorder_point: parseInt(e.target.value) || 0})}
                        />
                      </div>
                    </>
                  )}
                </div>

                {formData.type === 'service' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <Label>Service Kit (Goods Required)</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addKitItem}>
                        <Plus className="w-4 h-4 mr-1" />
                        Add Good
                      </Button>
                    </div>
                    {kitItems.map((kit, index) => (
                      <div key={index} className="flex gap-2 items-end">
                        <div className="flex-1">
                          <Label>Good</Label>
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
                        <div className="w-24">
                          <Label>Quantity</Label>
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
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingItem ? "Update" : "Create"} Item
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="goods" className="space-y-4">
        <TabsList>
          <TabsTrigger value="goods">Goods</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="locations">Locations</TabsTrigger>
          <TabsTrigger value="levels">Stock Levels</TabsTrigger>
        </TabsList>

        <TabsContent value="goods">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Goods Inventory
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Total Stock</TableHead>
                    <TableHead>Reorder Point</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {goodsItems.map((item) => {
                    const totalQty = getTotalQuantity(item.id);
                    const lowStock = isLowStock(item);
                    
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.sku}</TableCell>
                        <TableCell>{item.unit}</TableCell>
                        <TableCell>{totalQty}</TableCell>
                        <TableCell>{item.reorder_point}</TableCell>
                        <TableCell>
                          {lowStock ? (
                            <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                              <AlertTriangle className="w-3 h-3" />
                              Low Stock
                            </Badge>
                          ) : (
                            <Badge variant="secondary">In Stock</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(item)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services">
          <Card>
            <CardHeader>
              <CardTitle>Services</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Kit Items</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {serviceItems.map((item) => {
                    const kits = serviceKits.filter(kit => kit.service_id === item.id);
                    
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.sku}</TableCell>
                        <TableCell>{item.description}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {kits.map((kit) => (
                              <Badge key={kit.id} variant="outline" className="mr-1">
                                {kit.good.name} × {kit.quantity}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(item)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="locations">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Storage Locations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locations.map((location) => (
                    <TableRow key={location.id}>
                      <TableCell className="font-medium">{location.name}</TableCell>
                      <TableCell>{location.description}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditLocation(location)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="levels">
          <Card>
            <CardHeader>
              <CardTitle>Stock Levels by Location</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {levels.map((level) => {
                    const lowStock = level.quantity <= level.inventory_items.reorder_point;
                    
                    return (
                      <TableRow key={level.id}>
                        <TableCell className="font-medium">
                          {level.inventory_items.name}
                        </TableCell>
                        <TableCell>{level.storage_locations.name}</TableCell>
                        <TableCell>{level.quantity}</TableCell>
                        <TableCell>{level.inventory_items.unit}</TableCell>
                        <TableCell>
                          {lowStock ? (
                            <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                              <AlertTriangle className="w-3 h-3" />
                              Low Stock
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Normal</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}