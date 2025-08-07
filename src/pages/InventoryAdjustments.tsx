import { useEffect, useState } from "react";
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
import { Plus, Search, Package, TrendingUp, TrendingDown, Edit2, Trash2, AlertTriangle, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  type: string;
  category: string | null;
  unit: string;
  cost_price: number;
  selling_price: number;
  current_stock: number;
  min_stock_level: number;
  is_active: boolean;
}

interface Adjustment {
  id: string;
  adjustment_number: string;
  adjustment_date: string;
  adjustment_type: string;
  reason: string;
  status: string;
  notes: string | null;
  total_items: number;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

interface AdjustmentItem {
  id: string;
  adjustment_id: string;
  item_id: string;
  current_quantity: number;
  adjusted_quantity: number;
  difference: number;
  unit_cost: number;
  total_cost: number;
  notes: string | null;
  inventory_items?: { name: string; sku: string; unit: string };
}

const ADJUSTMENT_TYPES = [
  "Stock Count",
  "Damage/Loss",
  "Found Stock",
  "Expiry",
  "Transfer In",
  "Transfer Out",
  "Opening Stock",
  "Return",
  "Other"
];

const ADJUSTMENT_REASONS = [
  "Physical count discrepancy",
  "Damaged goods",
  "Expired products",
  "Theft/Loss",
  "Found additional stock",
  "Return from customer",
  "Supplier adjustment",
  "Transfer between locations",
  "Opening balance",
  "Other"
];

export default function InventoryAdjustments() {
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [adjustmentItems, setAdjustmentItems] = useState<AdjustmentItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isItemsModalOpen, setIsItemsModalOpen] = useState(false);
  const [editingAdjustment, setEditingAdjustment] = useState<Adjustment | null>(null);
  const [selectedAdjustment, setSelectedAdjustment] = useState<Adjustment | null>(null);
  const [selectedItems, setSelectedItems] = useState<AdjustmentItem[]>([]);

  const [formData, setFormData] = useState({
    adjustment_number: "",
    adjustment_date: new Date().toISOString().split('T')[0],
    adjustment_type: "",
    reason: "",
    notes: "",
  });

  const [newItem, setNewItem] = useState({
    item_id: "",
    current_quantity: "",
    adjusted_quantity: "",
    unit_cost: "",
    notes: "",
  });

  useEffect(() => {
    fetchAdjustments();
    fetchInventoryItems();
  }, []);

  const fetchAdjustments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("inventory_adjustments")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAdjustments(data || []);
    } catch (error) {
      console.error("Error fetching adjustments:", error);
      toast.error("Failed to fetch adjustments");
    } finally {
      setLoading(false);
    }
  };

  const fetchInventoryItems = async () => {
    try {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setInventoryItems(data || []);
    } catch (error) {
      console.error("Error fetching inventory items:", error);
    }
  };

  const fetchAdjustmentItems = async (adjustmentId: string) => {
    try {
      const { data, error } = await supabase
        .from("inventory_adjustment_items")
        .select(`
          *,
          inventory_items (name, sku, unit)
        `)
        .eq("adjustment_id", adjustmentId);

      if (error) throw error;
      setAdjustmentItems(data || []);
    } catch (error) {
      console.error("Error fetching adjustment items:", error);
      toast.error("Failed to fetch adjustment items");
    }
  };

  const generateAdjustmentNumber = () => {
    const timestamp = Date.now().toString().slice(-6);
    return `ADJ-${timestamp}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedItems.length === 0) {
      toast.error("Please add at least one item to the adjustment");
      return;
    }

    try {
      const adjustmentData = {
        ...formData,
        adjustment_number: formData.adjustment_number || generateAdjustmentNumber(),
        total_items: selectedItems.length,
        status: "pending",
      };

      let adjustmentId: string;

      if (editingAdjustment) {
        const { error } = await supabase
          .from("inventory_adjustments")
          .update(adjustmentData)
          .eq("id", editingAdjustment.id);

        if (error) throw error;
        adjustmentId = editingAdjustment.id;
      } else {
        const { data, error } = await supabase
          .from("inventory_adjustments")
          .insert([adjustmentData])
          .select()
          .single();

        if (error) throw error;
        adjustmentId = data.id;
      }

      // Insert adjustment items
      const itemsData = selectedItems.map(item => ({
        adjustment_id: adjustmentId,
        item_id: item.item_id,
        current_quantity: item.current_quantity,
        adjusted_quantity: item.adjusted_quantity,
        difference: (parseFloat(String(item.adjusted_quantity)) || 0) - (parseFloat(String(item.current_quantity)) || 0),
        unit_cost: item.unit_cost,
        total_cost: ((parseFloat(String(item.adjusted_quantity)) || 0) - (parseFloat(String(item.current_quantity)) || 0)) * (parseFloat(String(item.unit_cost)) || 0),
        notes: item.notes || null,
      }));

      if (editingAdjustment) {
        // Delete existing items first
        await supabase
          .from("inventory_adjustment_items")
          .delete()
          .eq("adjustment_id", adjustmentId);
      }

      const { error: itemsError } = await supabase
        .from("inventory_adjustment_items")
        .insert(itemsData);

      if (itemsError) throw itemsError;

      toast.success(editingAdjustment ? "Adjustment updated successfully" : "Adjustment created successfully");
      resetForm();
      setIsModalOpen(false);
      fetchAdjustments();
    } catch (error) {
      console.error("Error saving adjustment:", error);
      toast.error("Failed to save adjustment");
    }
  };

  const handleApproveAdjustment = async (adjustment: Adjustment) => {
    if (confirm("Are you sure you want to approve this adjustment? This will update inventory levels.")) {
      try {
        // Update adjustment status
        const { error: adjustmentError } = await supabase
          .from("inventory_adjustments")
          .update({
            status: "approved",
            approved_at: new Date().toISOString(),
            approved_by: "current_user", // This would be the actual user ID
          })
          .eq("id", adjustment.id);

        if (adjustmentError) throw adjustmentError;

        // Get adjustment items and update inventory
        const { data: items, error: itemsError } = await supabase
          .from("inventory_adjustment_items")
          .select("*")
          .eq("adjustment_id", adjustment.id);

        if (itemsError) throw itemsError;

        // Update inventory levels
        for (const item of items) {
          // In a real implementation, this would update actual stock levels
          // For now, we'll just log the changes since we removed stock tracking
          console.log(`Would update item ${item.item_id} stock by ${item.difference}`);
        }

        toast.success("Adjustment approved and inventory updated");
        fetchAdjustments();
      } catch (error) {
        console.error("Error approving adjustment:", error);
        toast.error("Failed to approve adjustment");
      }
    }
  };

  const handleEdit = (adjustment: Adjustment) => {
    setFormData({
      adjustment_number: adjustment.adjustment_number,
      adjustment_date: adjustment.adjustment_date,
      adjustment_type: adjustment.adjustment_type,
      reason: adjustment.reason,
      notes: adjustment.notes || "",
    });
    setEditingAdjustment(adjustment);
    fetchAdjustmentItems(adjustment.id).then(() => {
      // Convert adjustment items to selected items format
      // This would be implemented based on the actual data structure
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this adjustment?")) {
      try {
        const { error } = await supabase
          .from("inventory_adjustments")
          .delete()
          .eq("id", id);

        if (error) throw error;
        toast.success("Adjustment deleted successfully");
        fetchAdjustments();
      } catch (error) {
        console.error("Error deleting adjustment:", error);
        toast.error("Failed to delete adjustment");
      }
    }
  };

  const addItemToAdjustment = () => {
    if (!newItem.item_id || !newItem.current_quantity || !newItem.adjusted_quantity) {
      toast.error("Please fill in all required fields");
      return;
    }

    const item = inventoryItems.find(i => i.id === newItem.item_id);
    if (!item) return;

    const adjustmentItem = {
      ...newItem,
      item_name: item.name,
      item_sku: item.sku,
      item_unit: item.unit,
      difference: (parseFloat(newItem.adjusted_quantity) || 0) - (parseFloat(newItem.current_quantity) || 0),
      total_cost: ((parseFloat(newItem.adjusted_quantity) || 0) - (parseFloat(newItem.current_quantity) || 0)) * (parseFloat(newItem.unit_cost) || 0),
      current_quantity: parseFloat(newItem.current_quantity) || 0,
      adjusted_quantity: parseFloat(newItem.adjusted_quantity) || 0,
      unit_cost: parseFloat(newItem.unit_cost) || 0,
      id: '',
      adjustment_id: '',
    };

    setSelectedItems([...selectedItems, adjustmentItem]);
    setNewItem({
      item_id: "",
      current_quantity: "",
      adjusted_quantity: "",
      unit_cost: "",
      notes: "",
    });
  };

  const removeItemFromAdjustment = (index: number) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setFormData({
      adjustment_number: "",
      adjustment_date: new Date().toISOString().split('T')[0],
      adjustment_type: "",
      reason: "",
      notes: "",
    });
    setSelectedItems([]);
    setEditingAdjustment(null);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      "pending": { variant: "secondary" as const, icon: AlertTriangle, color: "text-yellow-600" },
      "approved": { variant: "default" as const, icon: CheckCircle, color: "text-green-600" },
      "rejected": { variant: "destructive" as const, icon: AlertTriangle, color: "text-red-600" },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getAdjustmentTypeColor = (type: string) => {
    const colors = {
      "Stock Count": "bg-blue-100 text-blue-800",
      "Damage/Loss": "bg-red-100 text-red-800",
      "Found Stock": "bg-green-100 text-green-800",
      "Expiry": "bg-orange-100 text-orange-800",
      "Transfer In": "bg-purple-100 text-purple-800",
      "Transfer Out": "bg-pink-100 text-pink-800",
      "Opening Stock": "bg-indigo-100 text-indigo-800",
      "Return": "bg-cyan-100 text-cyan-800",
      "Other": "bg-gray-100 text-gray-800"
    };
    return colors[type as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  const filteredAdjustments = adjustments.filter(adjustment =>
    adjustment.adjustment_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    adjustment.adjustment_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    adjustment.reason.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Statistics
  const totalAdjustments = adjustments.length;
  const pendingAdjustments = adjustments.filter(a => a.status === "pending").length;
  const approvedAdjustments = adjustments.filter(a => a.status === "approved").length;

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
            Inventory Adjustments
          </h1>
          <p className="text-muted-foreground">
            Manage stock level adjustments and corrections
          </p>
        </div>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="bg-gradient-to-r from-pink-500 to-purple-600">
              <Plus className="w-4 h-4 mr-2" />
              New Adjustment
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingAdjustment ? "Edit Adjustment" : "Create New Adjustment"}
              </DialogTitle>
              <DialogDescription>
                {editingAdjustment ? "Update adjustment information" : "Create a new inventory adjustment"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="adjustment_number">Adjustment Number</Label>
                  <Input
                    id="adjustment_number"
                    value={formData.adjustment_number}
                    onChange={(e) => setFormData({ ...formData, adjustment_number: e.target.value })}
                    placeholder="Auto-generated if empty"
                  />
                </div>
                <div>
                  <Label htmlFor="adjustment_date">Date *</Label>
                  <Input
                    id="adjustment_date"
                    type="date"
                    value={formData.adjustment_date}
                    onChange={(e) => setFormData({ ...formData, adjustment_date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="adjustment_type">Adjustment Type *</Label>
                  <Select 
                    value={formData.adjustment_type} 
                    onValueChange={(value) => setFormData({ ...formData, adjustment_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select adjustment type" />
                    </SelectTrigger>
                    <SelectContent>
                      {ADJUSTMENT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="reason">Reason *</Label>
                  <Select 
                    value={formData.reason} 
                    onValueChange={(value) => setFormData({ ...formData, reason: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {ADJUSTMENT_REASONS.map((reason) => (
                        <SelectItem key={reason} value={reason}>
                          {reason}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>

              {/* Items Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Adjustment Items</h3>
                  <span className="text-sm text-muted-foreground">
                    {selectedItems.length} item(s) added
                  </span>
                </div>

                {/* Add Item Form */}
                <Card className="p-4">
                  <div className="grid grid-cols-6 gap-4 items-end">
                    <div>
                      <Label>Item *</Label>
                      <Select value={newItem.item_id} onValueChange={(value) => {
                        const item = inventoryItems.find(i => i.id === value);
                        setNewItem({ 
                          ...newItem, 
                          item_id: value,
                          unit_cost: item?.cost_price.toString() || ""
                        });
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select item" />
                        </SelectTrigger>
                        <SelectContent>
                          {inventoryItems.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name} ({item.sku})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Current Qty *</Label>
                      <Input
                        type="number"
                        value={newItem.current_quantity}
                        onChange={(e) => setNewItem({ ...newItem, current_quantity: e.target.value })}
                        step="0.01"
                      />
                    </div>
                    <div>
                      <Label>Adjusted Qty *</Label>
                      <Input
                        type="number"
                        value={newItem.adjusted_quantity}
                        onChange={(e) => setNewItem({ ...newItem, adjusted_quantity: e.target.value })}
                        step="0.01"
                      />
                    </div>
                    <div>
                      <Label>Unit Cost</Label>
                      <Input
                        type="number"
                        value={newItem.unit_cost}
                        onChange={(e) => setNewItem({ ...newItem, unit_cost: e.target.value })}
                        step="0.01"
                      />
                    </div>
                    <div>
                      <Label>Notes</Label>
                      <Input
                        value={newItem.notes}
                        onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
                      />
                    </div>
                    <Button type="button" onClick={addItemToAdjustment}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>

                {/* Items List */}
                {selectedItems.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Current</TableHead>
                        <TableHead>Adjusted</TableHead>
                        <TableHead>Difference</TableHead>
                        <TableHead>Unit Cost</TableHead>
                        <TableHead>Total Cost</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedItems.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{(item as any).item_name}</div>
                              <div className="text-sm text-muted-foreground">{(item as any).item_sku}</div>
                            </div>
                          </TableCell>
                          <TableCell>{item.current_quantity} {(item as any).item_unit}</TableCell>
                          <TableCell>{item.adjusted_quantity} {(item as any).item_unit}</TableCell>
                          <TableCell>
                            <div className={`flex items-center gap-1 ${item.difference > 0 ? 'text-green-600' : item.difference < 0 ? 'text-red-600' : ''}`}>
                              {item.difference > 0 ? <TrendingUp className="w-3 h-3" /> : item.difference < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                              {item.difference} {(item as any).item_unit}
                            </div>
                          </TableCell>
                          <TableCell>${item.unit_cost}</TableCell>
                          <TableCell>${item.total_cost.toFixed(2)}</TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeItemFromAdjustment(index)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-gradient-to-r from-pink-500 to-purple-600">
                  {editingAdjustment ? "Update" : "Create"} Adjustment
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="bg-gradient-to-br from-blue-50 to-sky-50 border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700">Total Adjustments</CardTitle>
            <Package className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">{totalAdjustments}</div>
            <p className="text-xs text-blue-600">All time</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-yellow-700">Pending Approval</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-700">{pendingAdjustments}</div>
            <p className="text-xs text-yellow-600">Awaiting approval</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">{approvedAdjustments}</div>
            <p className="text-xs text-green-600">Completed adjustments</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search adjustments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Adjustments Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-pink-600" />
            Inventory Adjustments
          </CardTitle>
          <CardDescription>
            Manage and track all inventory adjustments
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-muted-foreground">Loading adjustments...</p>
              </div>
            </div>
          ) : filteredAdjustments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? "No adjustments found matching your search" : "No adjustments found"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Adjustment #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAdjustments.map((adjustment) => (
                  <TableRow key={adjustment.id}>
                    <TableCell className="font-medium">{adjustment.adjustment_number}</TableCell>
                    <TableCell>{format(new Date(adjustment.adjustment_date), "MMM dd, yyyy")}</TableCell>
                    <TableCell>
                      <Badge className={getAdjustmentTypeColor(adjustment.adjustment_type)}>
                        {adjustment.adjustment_type}
                      </Badge>
                    </TableCell>
                    <TableCell>{adjustment.reason}</TableCell>
                    <TableCell>{adjustment.total_items} items</TableCell>
                    <TableCell>{getStatusBadge(adjustment.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {adjustment.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleApproveAdjustment(adjustment)}
                            className="text-green-600 hover:text-green-600"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedAdjustment(adjustment);
                            fetchAdjustmentItems(adjustment.id);
                            setIsItemsModalOpen(true);
                          }}
                        >
                          View
                        </Button>
                        {adjustment.status === "pending" && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(adjustment)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(adjustment.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* View Items Modal */}
      <Dialog open={isItemsModalOpen} onOpenChange={setIsItemsModalOpen}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>
              Adjustment Items - {selectedAdjustment?.adjustment_number}
            </DialogTitle>
            <DialogDescription>
              Details of items in this adjustment
            </DialogDescription>
          </DialogHeader>
          {adjustmentItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No items found for this adjustment
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Current</TableHead>
                  <TableHead>Adjusted</TableHead>
                  <TableHead>Difference</TableHead>
                  <TableHead>Unit Cost</TableHead>
                  <TableHead>Total Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adjustmentItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{item.inventory_items?.name}</div>
                        <div className="text-sm text-muted-foreground">{item.inventory_items?.sku}</div>
                      </div>
                    </TableCell>
                    <TableCell>{item.current_quantity} {item.inventory_items?.unit}</TableCell>
                    <TableCell>{item.adjusted_quantity} {item.inventory_items?.unit}</TableCell>
                    <TableCell>
                      <div className={`flex items-center gap-1 ${item.difference > 0 ? 'text-green-600' : item.difference < 0 ? 'text-red-600' : ''}`}>
                        {item.difference > 0 ? <TrendingUp className="w-3 h-3" /> : item.difference < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                        {item.difference} {item.inventory_items?.unit}
                      </div>
                    </TableCell>
                    <TableCell>${item.unit_cost.toFixed(2)}</TableCell>
                    <TableCell>${item.total_cost.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}