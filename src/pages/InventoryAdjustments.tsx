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
  sku: string | null;
  type: string;
  category: string | null;
  unit: string | null;
  cost_price: number;
  selling_price: number;
  reorder_point: number;
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
  inventory_items?: { name: string; sku: string; unit: string; selling_price?: number; cost_price?: number };
}

const ADJUSTMENT_TYPES = [
  "Stock Count",
  "Damage",
  "Theft",
  "Expiry",
  "Return",
  "Correction",
  "Transfer",
  "Other"
];

const ADJUSTMENT_REASONS = [
  "Physical count discrepancy",
  "Damaged goods",
  "Stolen items",
  "Expired products",
  "Customer return",
  "Data entry error",
  "Supplier return",
  "Location transfer",
  "System correction",
  "Other reason"
];

export default function InventoryAdjustments() {
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [adjustmentItems, setAdjustmentItems] = useState<AdjustmentItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [editingAdjustment, setEditingAdjustment] = useState<Adjustment | null>(null);
  const [viewingAdjustment, setViewingAdjustment] = useState<Adjustment | null>(null);
  const [formData, setFormData] = useState({
    adjustment_date: new Date().toISOString().split('T')[0],
    adjustment_type: "",
    reason: "",
    notes: "",
    adjustment_number: ""
  });
  const [selectedItems, setSelectedItems] = useState<{
    item_id: string;
    current_quantity: number;
    adjusted_quantity: number;
    difference: number;
    unit_cost: number;
    total_cost: number;
    notes: string;
  }[]>([]);

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
          inventory_items (name, sku, unit, selling_price, cost_price)
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
      setLoading(true);
      
      const adjustmentData = {
        adjustment_date: formData.adjustment_date,
        adjustment_type: formData.adjustment_type,
        reason: formData.reason,
        notes: formData.notes,
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
        difference: item.difference,
        unit_cost: item.unit_cost,
        total_cost: item.total_cost,
        notes: item.notes
      }));

      if (editingAdjustment) {
        // Delete existing items and insert new ones
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
      setIsCreateModalOpen(false);
      setEditingAdjustment(null);
      setFormData({
        adjustment_date: new Date().toISOString().split('T')[0],
        adjustment_type: "",
        reason: "",
        notes: "",
        adjustment_number: ""
      });
      setSelectedItems([]);
      fetchAdjustments();
    } catch (error) {
      console.error("Error saving adjustment:", error);
      toast.error("Failed to save adjustment");
    } finally {
      setLoading(false);
    }
  };

  const handleApproveAdjustment = async (adjustment: Adjustment) => {
    try {
      const { error } = await supabase
        .from("inventory_adjustments")
        .update({ 
          status: "approved",
          approved_at: new Date().toISOString(),
          approved_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq("id", adjustment.id);

      if (error) throw error;
      
      toast.success("Adjustment approved and stock updated");
      fetchAdjustments();
    } catch (error) {
      console.error("Error approving adjustment:", error);
      toast.error("Failed to approve adjustment");
    }
  };

  const handleEdit = (adjustment: Adjustment) => {
    setEditingAdjustment(adjustment);
    setFormData({
      adjustment_date: adjustment.adjustment_date,
      adjustment_type: adjustment.adjustment_type,
      reason: adjustment.reason,
      notes: adjustment.notes || "",
      adjustment_number: adjustment.adjustment_number
    });
    setIsCreateModalOpen(true);
  };

  const handleDelete = async (adjustmentId: string) => {
    if (!confirm("Delete this adjustment? If approved, stock will be reverted.")) return;
    
    try {
      setLoading(true);
      // Load the adjustment to check status
      const { data: adj, error: adjErr } = await supabase
        .from("inventory_adjustments")
        .select("id, status")
        .eq("id", adjustmentId)
        .single();
      if (adjErr) throw adjErr;

      // If approved, the DB BEFORE DELETE trigger will revert quantities. Nothing to do client-side.
      const { error } = await supabase
        .from("inventory_adjustments")
        .delete()
        .eq("id", adjustmentId);

      if (error) throw error;
      toast.success("Adjustment deleted" + (adj?.status === 'approved' ? " and stock reverted" : ""));
      fetchAdjustments();
    } catch (error) {
      console.error("Error deleting adjustment:", error);
      toast.error("Failed to delete adjustment");
    } finally {
      setLoading(false);
    }
  };

  const addItemToAdjustment = () => {
    setSelectedItems([...selectedItems, {
      item_id: "",
      current_quantity: 0,
      adjusted_quantity: 0,
      difference: 0,
      unit_cost: 0,
      total_cost: 0,
      notes: ""
    }]);
  };

  const removeItemFromAdjustment = (index: number) => {
    const updatedItems = selectedItems.filter((_, i) => i !== index);
    setSelectedItems(updatedItems);
  };

  const updateSelectedItem = (index: number, field: string, value: any) => {
    const updatedItems = [...selectedItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    // Calculate difference and total cost
    if (field === 'current_quantity' || field === 'adjusted_quantity') {
      const current = field === 'current_quantity' ? value : updatedItems[index].current_quantity;
      const adjusted = field === 'adjusted_quantity' ? value : updatedItems[index].adjusted_quantity;
      updatedItems[index].difference = adjusted - current;
      updatedItems[index].total_cost = Math.abs(updatedItems[index].difference) * updatedItems[index].unit_cost;
    }
    
    if (field === 'unit_cost') {
      updatedItems[index].total_cost = Math.abs(updatedItems[index].difference) * value;
    }
    
    setSelectedItems(updatedItems);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600">Pending</Badge>;
      case "approved":
        return <Badge variant="outline" className="text-green-600 border-green-600">Approved</Badge>;
      case "rejected":
        return <Badge variant="outline" className="text-red-600 border-red-600">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getAdjustmentTypeColor = (type: string) => {
    switch (type) {
      case "Stock Count":
        return "text-blue-600";
      case "Damage":
        return "text-red-600";
      case "Theft":
        return "text-purple-600";
      case "Return":
        return "text-green-600";
      default:
        return "text-gray-600";
    }
  };

  const filteredAdjustments = adjustments.filter(adjustment =>
    adjustment.adjustment_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    adjustment.adjustment_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    adjustment.reason.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingCount = adjustments.filter(adj => adj.status === "pending").length;
  const approvedCount = adjustments.filter(adj => adj.status === "approved").length;
  const positiveAdjustments = adjustmentItems.filter(item => item.difference > 0).length;
  const negativeAdjustments = adjustmentItems.filter(item => item.difference < 0).length;

  const totalQtyIncrease = adjustmentItems.reduce((sum, i) => sum + (i.difference > 0 ? i.difference : 0), 0);
  const totalQtyDecrease = adjustmentItems.reduce((sum, i) => sum + (i.difference < 0 ? Math.abs(i.difference) : 0), 0);
  const totalCostValue = adjustmentItems.reduce((sum, i) => sum + Math.abs(i.difference) * (i.unit_cost ?? 0), 0);
  const totalSalesValue = adjustmentItems.reduce((sum, i) => sum + Math.abs(i.difference) * (i.inventory_items?.selling_price ?? 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inventory Adjustments</h1>
          <p className="text-muted-foreground">
            Track and manage inventory adjustments and stock corrections
          </p>
        </div>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Adjustment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingAdjustment ? "Edit Adjustment" : "Create New Adjustment"}
              </DialogTitle>
              <DialogDescription>
                Add details about the inventory adjustment and the items involved.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="adjustment_number">Adjustment Number</Label>
                  <Input
                    id="adjustment_number"
                    value={formData.adjustment_number}
                    onChange={(e) => setFormData({...formData, adjustment_number: e.target.value})}
                    placeholder="Auto-generated if empty"
                  />
                </div>
                <div>
                  <Label htmlFor="adjustment_date">Adjustment Date</Label>
                  <Input
                    type="date"
                    id="adjustment_date"
                    value={formData.adjustment_date}
                    onChange={(e) => setFormData({...formData, adjustment_date: e.target.value})}
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="adjustment_type">Adjustment Type</Label>
                  <Select value={formData.adjustment_type} onValueChange={(value) => setFormData({...formData, adjustment_type: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {ADJUSTMENT_TYPES.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="reason">Reason</Label>
                  <Select value={formData.reason} onValueChange={(value) => setFormData({...formData, reason: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {ADJUSTMENT_REASONS.map(reason => (
                        <SelectItem key={reason} value={reason}>{reason}</SelectItem>
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
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Additional notes about the adjustment"
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Adjustment Items</Label>
                  <Button type="button" onClick={addItemToAdjustment} variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Item
                  </Button>
                </div>
                
                {selectedItems.map((item, index) => (
                  <div key={index} className="grid grid-cols-7 gap-2 items-end p-3 border rounded-lg">
                    <div>
                      <Label>Item</Label>
                      <Select 
                        value={item.item_id} 
                        onValueChange={(value) => updateSelectedItem(index, 'item_id', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select item" />
                        </SelectTrigger>
                        <SelectContent>
                          {inventoryItems.map(invItem => (
                            <SelectItem key={invItem.id} value={invItem.id}>
                              {invItem.name} ({invItem.sku})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Current Qty</Label>
                      <Input
                        type="number"
                        value={item.current_quantity}
                        onChange={(e) => updateSelectedItem(index, 'current_quantity', Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label>Adjusted Qty</Label>
                      <Input
                        type="number"
                        value={item.adjusted_quantity}
                        onChange={(e) => updateSelectedItem(index, 'adjusted_quantity', Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label>Difference</Label>
                      <Input
                        value={item.difference}
                        readOnly
                        className={item.difference > 0 ? "text-green-600" : item.difference < 0 ? "text-red-600" : ""}
                      />
                    </div>
                    <div>
                      <Label>Unit Cost</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.unit_cost}
                        onChange={(e) => updateSelectedItem(index, 'unit_cost', Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label>Total Cost</Label>
                      <Input
                        value={item.total_cost.toFixed(2)}
                        readOnly
                      />
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => removeItemFromAdjustment(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Saving..." : editingAdjustment ? "Update Adjustment" : "Create Adjustment"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Adjustments</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{adjustments.length}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
            <p className="text-xs text-muted-foreground">Awaiting review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Positive Adjustments</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{positiveAdjustments}</div>
            <p className="text-xs text-muted-foreground">Stock increases</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Negative Adjustments</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{negativeAdjustments}</div>
            <p className="text-xs text-muted-foreground">Stock decreases</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Inventory Adjustments</CardTitle>
              <CardDescription>
                Manage inventory adjustments and stock corrections
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search adjustments..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-64"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Adjustment #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAdjustments.map((adjustment) => (
                <TableRow key={adjustment.id}>
                  <TableCell className="font-medium">
                    {adjustment.adjustment_number}
                  </TableCell>
                  <TableCell>
                    {format(new Date(adjustment.adjustment_date), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell>
                    <span className={getAdjustmentTypeColor(adjustment.adjustment_type)}>
                      {adjustment.adjustment_type}
                    </span>
                  </TableCell>
                  <TableCell>{adjustment.reason}</TableCell>
                  <TableCell>{adjustment.total_items}</TableCell>
                  <TableCell>{getStatusBadge(adjustment.status)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setViewingAdjustment(adjustment);
                          fetchAdjustmentItems(adjustment.id);
                          setIsViewModalOpen(true);
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
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleApproveAdjustment(adjustment)}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(adjustment.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* View Adjustment Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span>Adjustment Details</span>
              {viewingAdjustment && (
                <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                  {viewingAdjustment.adjustment_number}
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              Review the full breakdown, including cost and sales valuation.
            </DialogDescription>
          </DialogHeader>
          {viewingAdjustment && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium">Date</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 text-base">
                    {format(new Date(viewingAdjustment.adjustment_date), 'MMM dd, yyyy')}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium">Type</CardTitle>
                  </CardHeader>
                  <CardContent className={`pt-0 text-base ${getAdjustmentTypeColor(viewingAdjustment.adjustment_type)}`}>
                    {viewingAdjustment.adjustment_type}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium">Status</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {getStatusBadge(viewingAdjustment.status)}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium">Total Items</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 text-base font-semibold">
                    {viewingAdjustment.total_items}
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Qty Increase</CardTitle>
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold text-green-600">{totalQtyIncrease}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Qty Decrease</CardTitle>
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold text-red-600">{totalQtyDecrease}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Cost Value</CardTitle>
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold">${totalCostValue.toFixed(2)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Sales Value</CardTitle>
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold">${totalSalesValue.toFixed(2)}</div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Reason</Label>
                  <p>{viewingAdjustment.reason}</p>
                </div>
                {viewingAdjustment.notes && (
                  <div>
                    <Label>Notes</Label>
                    <p>{viewingAdjustment.notes}</p>
                  </div>
                )}
              </div>

              <div>
                <Label>Adjustment Items</Label>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Current</TableHead>
                        <TableHead>Adjusted</TableHead>
                        <TableHead>Difference</TableHead>
                        <TableHead>Unit Cost</TableHead>
                        <TableHead>Cost Value</TableHead>
                        <TableHead>Unit Sales</TableHead>
                        <TableHead>Sales Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adjustmentItems.map((item) => {
                        const absDiff = Math.abs(item.difference);
                        const unitSales = item.inventory_items?.selling_price ?? 0;
                        const salesValue = absDiff * unitSales;
                        const costValue = absDiff * (item.unit_cost ?? 0);
                        return (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">{item.inventory_items?.name}</span>
                                <span className="text-xs text-muted-foreground">{item.inventory_items?.sku}</span>
                              </div>
                            </TableCell>
                            <TableCell>{item.current_quantity}</TableCell>
                            <TableCell>{item.adjusted_quantity}</TableCell>
                            <TableCell className={item.difference > 0 ? "text-green-600" : item.difference < 0 ? "text-red-600" : ""}>
                              {item.difference > 0 ? "+" : ""}{item.difference}
                            </TableCell>
                            <TableCell>${(item.unit_cost ?? 0).toFixed(2)}</TableCell>
                            <TableCell>${costValue.toFixed(2)}</TableCell>
                            <TableCell>${unitSales.toFixed(2)}</TableCell>
                            <TableCell>${salesValue.toFixed(2)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}