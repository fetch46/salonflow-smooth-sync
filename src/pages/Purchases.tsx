import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, ShoppingCart, Package, TrendingUp, Truck } from "lucide-react";
import { format } from "date-fns";
import { useOrganizationCurrency } from "@/lib/saas/hooks";
import { useToast } from "@/hooks/use-toast";
import { useSaas } from "@/lib/saas";
import { useOrganizationTaxRate } from "@/lib/saas/hooks";
import { Switch } from "@/components/ui/switch";

interface Purchase {
  id: string;
  purchase_number: string;
  vendor_name: string;
  purchase_date: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface InventoryItem {
  id: string;
  name: string;
  type: string;
}

interface PurchaseItem {
  id: string;
  item_id: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  received_quantity: number;
  inventory_items: { name: string } | null;
}

interface StorageLocation {
  id: string;
  name: string;
}

interface SupplierOption {
  id: string;
  name: string;
}

export default function Purchases() {
  const { organization } = useSaas();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [selectedPurchaseItems, setSelectedPurchaseItems] = useState<PurchaseItem[]>([]);
  const { toast } = useToast();

  const { format: formatMoney } = useOrganizationCurrency();
  const orgTaxRate = useOrganizationTaxRate();
  const [applyTax, setApplyTax] = useState<boolean>(true);

  const [formData, setFormData] = useState({
    purchase_number: "",
    vendor_name: "",
    purchase_date: "",
    subtotal: "",
    tax_amount: "",
    total_amount: "",
    status: "pending",
    notes: "",
  });

  // Receiving workflow state
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receivePurchaseId, setReceivePurchaseId] = useState<string | null>(null);
  const [receiveLocationId, setReceiveLocationId] = useState<string>("");
  const [receiveQuantities, setReceiveQuantities] = useState<Record<string, number>>({});

  const [newItem, setNewItem] = useState({
    item_id: "",
    quantity: "",
    unit_cost: "",
  });

  const fetchPurchases = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("purchases")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPurchases(data || []);
    } catch (error) {
      console.error("Error fetching purchases:", error);
      toast({
        title: "Error",
        description: "Failed to fetch purchases",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchLocations = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("storage_locations")
        .select("id, name")
        .order("name");
      if (error) throw error;
      setLocations(data || []);
    } catch (err) {
      console.warn("Failed to load storage locations", err);
      setLocations([]);
    }
  }, []);

  const fetchInventoryItems = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, name, type")
        .eq("type", "goods")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setInventoryItems(data || []);
    } catch (error) {
      console.error("Error fetching inventory items:", error);
    }
  }, []);

  const fetchSuppliers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      setSuppliers((data || []) as SupplierOption[]);
    } catch (err) {
      console.warn("Failed to load suppliers", err);
      setSuppliers([]);
    }
  }, []);

  const fetchPurchaseItems = async (purchaseId: string) => {
    try {
      const { data, error } = await supabase
        .from("purchase_items")
        .select(`
          *,
          inventory_items (name)
        `)
        .eq("purchase_id", purchaseId);

      if (error) throw error;
      setSelectedPurchaseItems(data || []);
    } catch (error) {
      console.error("Error fetching purchase items:", error);
    }
  };

  const generatePurchaseNumber = () => {
    const timestamp = Date.now().toString().slice(-6);
    return `PUR-${timestamp}`;
  };

  const openReceiveDialog = async (purchaseId: string) => {
    setReceivePurchaseId(purchaseId);
    await fetchPurchaseItems(purchaseId);
    await fetchLocations();
    setReceiveQuantities({});
    setReceiveLocationId("");
    setReceiveOpen(true);
  };

  const submitReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivePurchaseId || !receiveLocationId) {
      toast({ title: "Error", description: "Select a location to receive into", variant: "destructive" });
      return;
    }
    try {
      for (const item of selectedPurchaseItems) {
        const qty = Number(receiveQuantities[item.item_id] || 0);
        if (qty <= 0) continue;
        const { data: levels } = await supabase
          .from("inventory_levels")
          .select("id, quantity")
          .eq("item_id", item.item_id)
          .eq("location_id", receiveLocationId)
          .limit(1);
        if (levels && levels.length > 0) {
          const level = levels[0];
          await supabase
            .from("inventory_levels")
            .update({ quantity: (level.quantity || 0) + qty })
            .eq("id", level.id);
        } else {
          await supabase
            .from("inventory_levels")
            .insert([{ item_id: item.item_id, location_id: receiveLocationId, quantity: qty, organization_id: organization?.id || null } as any]);
        }
      }
      toast({ title: "Received", description: "Items received into stock" });
      setReceiveOpen(false);
      fetchPurchases();
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to receive items", variant: "destructive" });
    }
  };

  const addPurchaseItem = () => {
    if (!newItem.item_id || !newItem.quantity || !newItem.unit_cost) {
      toast({
        title: "Error",
        description: "Please fill in all item fields",
        variant: "destructive",
      });
      return;
    }

    const item = inventoryItems.find(i => i.id === newItem.item_id);
    if (!item) return;

    const totalCost = parseFloat(newItem.quantity) * parseFloat(newItem.unit_cost);
    
    setPurchaseItems([
      ...purchaseItems,
      {
        id: `temp-${Date.now()}`,
        item_id: newItem.item_id,
        quantity: parseInt(newItem.quantity),
        unit_cost: parseFloat(newItem.unit_cost),
        total_cost: totalCost,
        received_quantity: 0,
        inventory_items: { name: item.name }
      }
    ]);

    setNewItem({ item_id: "", quantity: "", unit_cost: "" });
  };

  const removePurchaseItem = (index: number) => {
    setPurchaseItems(purchaseItems.filter((_, i) => i !== index));
  };

    const calculateTotals = useCallback(() => {
    const subtotal = purchaseItems.reduce((sum, item) => sum + item.total_cost, 0);
    const computedTax = applyTax ? (subtotal * ((orgTaxRate || 0) / 100)) : 0;
    const total = subtotal + computedTax;
    
    setFormData(prev => ({
      ...prev,
      subtotal: subtotal.toString(),
      tax_amount: computedTax.toString(),
      total_amount: total.toString(),
    }));
  }, [purchaseItems, orgTaxRate, applyTax]);

  useEffect(() => {
    fetchPurchases();
    fetchInventoryItems();
    fetchSuppliers();
  }, [fetchPurchases, fetchInventoryItems, fetchSuppliers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const purchaseData = {
        ...formData,
        purchase_number: formData.purchase_number || generatePurchaseNumber(),
        subtotal: parseFloat(formData.subtotal) || 0,
        tax_amount: parseFloat(formData.tax_amount) || 0,
        total_amount: parseFloat(formData.total_amount) || 0,
        organization_id: organization?.id || null,
      };

      let purchaseId: string;

      if (editingPurchase) {
        const { error } = await supabase
          .from("purchases")
          .update(purchaseData)
          .eq("id", editingPurchase.id);

        if (error) throw error;
        purchaseId = editingPurchase.id;

        // Delete existing purchase items
        await supabase
          .from("purchase_items")
          .delete()
          .eq("purchase_id", purchaseId);

        toast({
          title: "Success",
          description: "Purchase updated successfully",
        });
      } else {
        const { data, error } = await supabase
          .from("purchases")
          .insert([purchaseData])
          .select()
          .single();

        if (error) throw error;
        purchaseId = data.id;

        toast({
          title: "Success",
          description: "Purchase created successfully",
        });
      }

      // Insert purchase items
      if (purchaseItems.length > 0) {
        const itemsToInsert = purchaseItems.map(item => ({
          purchase_id: purchaseId,
          item_id: item.item_id,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
          total_cost: item.total_cost,
          received_quantity: item.received_quantity,
        }));

        const { error: itemsError } = await supabase
          .from("purchase_items")
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;

        // Update inventory levels for received goods (increase stock)
        for (const item of purchaseItems) {
          try {
            // Find existing inventory levels across locations
            const { data: levels } = await supabase
              .from("inventory_levels")
              .select("id, quantity")
              .eq("item_id", item.item_id)
              .limit(1);
            if (levels && levels.length > 0) {
              const level = levels[0];
              await supabase
                .from("inventory_levels")
                .update({ quantity: (level.quantity || 0) + (item.received_quantity || item.quantity || 0) })
                .eq("id", level.id);
            }
          } catch (err) {
            console.warn("Failed to update inventory level for", item.item_id, err);
          }
        }
      }

      setIsModalOpen(false);
      setEditingPurchase(null);
      resetForm();
      fetchPurchases();
    } catch (error) {
      console.error("Error saving purchase:", error);
      toast({
        title: "Error",
        description: "Failed to save purchase",
        variant: "destructive",
      });
    }
  };

  const handleEdit = async (purchase: Purchase) => {
    setEditingPurchase(purchase);
    setFormData({
      purchase_number: purchase.purchase_number,
      vendor_name: purchase.vendor_name,
      purchase_date: purchase.purchase_date,
      subtotal: purchase.subtotal.toString(),
      tax_amount: purchase.tax_amount.toString(),
      total_amount: purchase.total_amount.toString(),
      status: purchase.status,
      notes: purchase.notes || "",
    });
    
    await fetchPurchaseItems(purchase.id);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this purchase?")) {
      try {
        const { error } = await supabase
          .from("purchases")
          .delete()
          .eq("id", id);

        if (error) throw error;
        toast({
          title: "Success",
          description: "Purchase deleted successfully",
        });
        fetchPurchases();
      } catch (error) {
        console.error("Error deleting purchase:", error);
        toast({
          title: "Error",
          description: "Failed to delete purchase",
          variant: "destructive",
        });
      }
    }
  };

  const resetForm = () => {
    setFormData({
      purchase_number: "",
      vendor_name: "",
      purchase_date: "",
      subtotal: "",
      tax_amount: "",
      total_amount: "",
      status: "pending",
      notes: "",
    });
    setPurchaseItems([]);
    setSelectedPurchaseItems([]);
    setNewItem({ item_id: "", quantity: "", unit_cost: "" });
  };

  const filteredPurchases = purchases.filter((purchase) =>
    purchase.purchase_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    purchase.vendor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    purchase.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const statusColors = {
      pending: "bg-yellow-100 text-yellow-800",
      received: "bg-green-100 text-green-800",
      partial: "bg-blue-100 text-blue-800",
      cancelled: "bg-red-100 text-red-800",
    };

    return (
      <Badge className={statusColors[status as keyof typeof statusColors] || "bg-gray-100 text-gray-800"}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  const stats = {
    total: purchases.length,
    pending: purchases.filter(p => p.status === 'pending').length,
    received: purchases.filter(p => p.status === 'received').length,
    partial: purchases.filter(p => p.status === 'partial').length,
    totalAmount: purchases.filter(p => p.status === 'received').reduce((sum, p) => sum + p.total_amount, 0),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading purchases...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Purchases</h2>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingPurchase(null); resetForm(); }}>
              <Plus className="mr-2 h-4 w-4" />
              Create Purchase
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingPurchase ? "Edit Purchase" : "Create New Purchase"}</DialogTitle>
              <DialogDescription>
                {editingPurchase ? "Update the purchase details." : "Fill in the purchase information and add products."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="purchase_number">Purchase Number</Label>
                  <Input
                    id="purchase_number"
                    placeholder="Auto-generated if empty"
                    value={formData.purchase_number}
                    onChange={(e) => setFormData({ ...formData, purchase_number: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vendor_name">Vendor</Label>
                  <Select value={formData.vendor_name} onValueChange={(value) => setFormData({ ...formData, vendor_name: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Populated from suppliers table */}
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="purchase_date">Purchase Date</Label>
                  <Input
                    id="purchase_date"
                    type="date"
                    value={formData.purchase_date}
                    onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="received">Received</SelectItem>
                      <SelectItem value="partial">Partial</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Purchase Items Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Purchase Items</h3>
                
                {/* Add Item Form */}
                <div className="grid grid-cols-4 gap-2 items-end">
                  <div className="space-y-2">
                    <Label>Product</Label>
                    <Select value={newItem.item_id} onValueChange={(value) => setNewItem({ ...newItem, item_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        {inventoryItems.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      placeholder="Qty"
                      value={newItem.quantity}
                      onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit Cost</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={newItem.unit_cost}
                      onChange={(e) => setNewItem({ ...newItem, unit_cost: e.target.value })}
                    />
                  </div>
                  <Button type="button" onClick={addPurchaseItem}>
                    Add Item
                  </Button>
                </div>

                {/* Items List */}
                {purchaseItems.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Unit Cost</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchaseItems.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.inventory_items?.name || 'Unknown Item'}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>{formatMoney(item.unit_cost)}</TableCell>
                          <TableCell>{formatMoney(item.total_cost)}</TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removePurchaseItem(index)}
                            >
                              Remove
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="subtotal">Subtotal</Label>
                  <Input
                    id="subtotal"
                    type="number"
                    step="0.01"
                    value={formData.subtotal}
                    readOnly
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tax_amount">Tax Amount</Label>
                  <Input
                    id="tax_amount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.tax_amount}
                    readOnly
                  />
                  <div className="flex items-center gap-2">
                    <Switch checked={applyTax} onCheckedChange={setApplyTax} />
                    <span className="text-sm">Apply Tax ({(orgTaxRate || 0)}%)</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Auto-calculated when enabled.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="total_amount">Total Amount</Label>
                  <Input
                    id="total_amount"
                    type="number"
                    step="0.01"
                    value={formData.total_amount}
                    readOnly
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Additional notes..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingPurchase ? "Update Purchase" : "Create Purchase"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Purchases</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Received</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.received}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(stats.totalAmount)}</div>
            <p className="text-xs text-muted-foreground">Received orders</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center space-x-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search purchases..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full md:max-w-md lg:max-w-lg"
        />
      </div>

      {/* Purchases Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Purchases</CardTitle>
          <CardDescription>
            Manage your product purchases and track stock replenishment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table className="w-full">
              <TableHeader>
                <TableRow>
                  <TableHead>Purchase #</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Total Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPurchases.map((purchase) => (
                  <TableRow key={purchase.id}>
                    <TableCell className="font-medium">{purchase.purchase_number}</TableCell>
                    <TableCell>{purchase.vendor_name}</TableCell>
                    <TableCell>{format(new Date(purchase.created_at), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>{formatMoney(purchase.total_amount)}</TableCell>
                    <TableCell>
                      <Badge className={getStatusBadge(purchase.status).props.className}>{purchase.status.toUpperCase()}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(purchase)}>Edit</Button>
                        <Button variant="outline" size="sm" onClick={() => openReceiveDialog(purchase.id)}>Receive</Button>
                        <Button variant="outline" size="sm" className="text-red-600" onClick={() => handleDelete(purchase.id)}>Delete</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Receive Dialog */}
      <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Receive Items</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitReceive} className="space-y-4">
            <div className="space-y-2">
              <Label>Location</Label>
              <select className="border rounded px-3 py-2 w-full" value={receiveLocationId} onChange={(e) => setReceiveLocationId(e.target.value)}>
                <option value="">Select a location</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Quantities</Label>
              <div className="space-y-2">
                {selectedPurchaseItems.map(it => (
                  <div key={it.item_id} className="flex items-center gap-2">
                    <div className="w-64 truncate">{it.inventory_items?.name || it.item_id}</div>
                    <Input type="number" min={0} placeholder={`0 / ${it.quantity}`} value={receiveQuantities[it.item_id] ?? ''} onChange={(e) => setReceiveQuantities(prev => ({ ...prev, [it.item_id]: Number(e.target.value) }))} />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setReceiveOpen(false)}>Cancel</Button>
              <Button type="submit">Receive</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}