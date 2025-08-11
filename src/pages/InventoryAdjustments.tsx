import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Package, TrendingUp, TrendingDown, Edit2, Trash2, AlertTriangle, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { MapPin } from "lucide-react";

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

interface BusinessLocation {
  id: string;
  name: string;
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
  location_id?: string | null;
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
  const [locations, setLocations] = useState<BusinessLocation[]>([]);
  const [adjustmentItems, setAdjustmentItems] = useState<AdjustmentItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingAdjustment, setViewingAdjustment] = useState<Adjustment | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchAdjustments();
    fetchInventoryItems();
    fetchLocations();
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

  const fetchLocations = async () => {
    try {
      const { data, error } = await supabase
        .from("business_locations")
        .select("id, name")
        .order("name");
      if (error) throw error;
      setLocations(data || []);
    } catch (error) {
      console.error("Error fetching locations:", error);
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





  const handleApproveAdjustment = async (adjustment: Adjustment) => {
    try {
      setLoading(true);

      // Always re-fetch the latest adjustment to avoid acting on stale data
      const { data: latestAdj, error: latestAdjErr } = await supabase
        .from("inventory_adjustments")
        .select("id, location_id")
        .eq("id", adjustment.id)
        .single();
      if (latestAdjErr) throw latestAdjErr;

      const effectiveLocationId = latestAdj?.location_id;
      if (!effectiveLocationId) {
        toast.error("This adjustment has no location set. Please edit and select a location before approval.");
        return;
      }

      // Validate that the referenced location still exists to avoid FK violations on inventory_levels
      const { data: locationRow, error: locationErr } = await supabase
        .from("business_locations")
        .select("id")
        .eq("id", effectiveLocationId)
        .maybeSingle();
      if (locationErr || !locationRow) {
        throw new Error("Selected location no longer exists. Please edit this adjustment and choose a valid location.");
      }

      // Load items for this adjustment to apply quantity changes at the selected location
      const { data: items, error: itemsErr } = await supabase
        .from("inventory_adjustment_items")
        .select("item_id, difference, adjusted_quantity")
        .eq("adjustment_id", adjustment.id);
      if (itemsErr) throw itemsErr;

      // Apply item quantity changes per location
      for (const item of items || []) {
        // Fetch existing level for item/location
        const { data: levelRows, error: levelErr } = await supabase
          .from("inventory_levels")
          .select("id, quantity")
          .eq("item_id", item.item_id)
          .eq("location_id", effectiveLocationId)
          .limit(1);
        if (levelErr) throw levelErr;

        const existing = (levelRows || [])[0];
        if (existing) {
          const newQty = (existing.quantity ?? 0) + (item.difference ?? 0);
          const { error: updErr } = await supabase
            .from("inventory_levels")
            .update({ quantity: newQty })
            .eq("id", existing.id);
          if (updErr) throw updErr;
        } else {
          // No existing level row => assume current was 0 and set to adjusted quantity
          try {
            const insertQuantity = item.adjusted_quantity ?? (item.difference ?? 0);
            const { error: upsertErr } = await supabase
              .from("inventory_levels")
              .upsert(
                [{ item_id: item.item_id, location_id: effectiveLocationId, quantity: insertQuantity }],
                { onConflict: "item_id,location_id" }
              );
            if (upsertErr) throw upsertErr;
          } catch (e: any) {
            // Convert FK violation into a clearer message
            const pgCode = e?.code || e?.details || "";
            if (typeof pgCode === "string" && pgCode.includes("foreign key") || e?.code === "23503") {
              throw new Error("The selected location was removed. Please set a valid location on this adjustment and try again.");
            }
            throw e;
          }
        }
      }

      // Finally, mark the adjustment as approved
      const { error } = await supabase
        .from("inventory_adjustments")
        .update({ 
          status: "approved",
          approved_at: new Date().toISOString(),
          approved_by: (await supabase.auth.getUser()).data.user?.id,
          location_id: effectiveLocationId
        })
        .eq("id", adjustment.id);

      if (error) throw error;
      
      toast.success("Adjustment approved and stock updated");
      fetchAdjustments();
    } catch (error) {
      console.error("Error approving adjustment:", error);
      const message = (error as any)?.message || (typeof error === "string" ? error : "");
      toast.error(message ? `Failed to approve adjustment: ${message}` : "Failed to approve adjustment");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (adjustment: Adjustment) => {
    navigate(`/inventory-adjustments/${adjustment.id}/edit`);
  };

  const handleDelete = async (adjustmentId: string) => {
    if (!confirm("Delete this adjustment? If approved, stock will be reverted.")) return;
    
    try {
      setLoading(true);
      // Load the adjustment to check status and location
      const { data: adj, error: adjErr } = await supabase
        .from("inventory_adjustments")
        .select("id, status, location_id")
        .eq("id", adjustmentId)
        .single();
      if (adjErr) throw adjErr;

      // If approved, revert stock before deleting
      if (adj?.status === 'approved') {
        if (!adj.location_id) {
          throw new Error("Approved adjustment is missing location; cannot safely revert stock.");
        }

        // Validate that the referenced location still exists
        const { data: loc, error: locErr } = await supabase
          .from("business_locations")
          .select("id")
          .eq("id", adj.location_id)
          .single();
        if (locErr || !loc) {
          throw new Error("The adjustment's location no longer exists. Please restore the location or manually correct stock.");
        }

        const { data: items, error: itemsErr } = await supabase
          .from("inventory_adjustment_items")
          .select("item_id, difference, adjusted_quantity")
          .eq("adjustment_id", adjustmentId);
        if (itemsErr) throw itemsErr;

        for (const item of items || []) {
          const { data: levelRows, error: levelErr } = await supabase
            .from("inventory_levels")
            .select("id, quantity")
            .eq("item_id", item.item_id)
            .eq("location_id", adj.location_id)
            .limit(1);
          if (levelErr) throw levelErr;

          const existing = (levelRows || [])[0];
          // Revert by subtracting the difference
          if (existing) {
            const newQty = (existing.quantity ?? 0) - (item.difference ?? 0);
            const { error: updErr } = await supabase
              .from("inventory_levels")
              .update({ quantity: newQty })
              .eq("id", existing.id);
            if (updErr) throw updErr;
          } else {
            // No existing level row; create it back to the presumed pre-approval quantity (adjusted - difference = current)
            const presumedCurrent = (item.adjusted_quantity ?? 0) - (item.difference ?? 0);
            const { error: insErr } = await supabase
              .from("inventory_levels")
              .insert([{ item_id: item.item_id, location_id: adj.location_id, quantity: presumedCurrent }]);
            if (insErr) throw insErr;
          }
        }
      }

      // Proceed with delete
      const { error } = await supabase
        .from("inventory_adjustments")
        .delete()
        .eq("id", adjustmentId);

      if (error) throw error;
      toast.success("Adjustment deleted" + (adj?.status === 'approved' ? " and stock reverted" : ""));
      // If the deleted adjustment is open in the view modal, close it
      if (viewingAdjustment?.id === adjustmentId) {
        setIsViewModalOpen(false);
        setViewingAdjustment(null);
      }
      fetchAdjustments();
    } catch (error) {
      console.error("Error deleting adjustment:", error);
      toast.error("Failed to delete adjustment");
    } finally {
      setLoading(false);
    }
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
        <div>
          <Button asChild>
            <Link to="/inventory-adjustments/new">
              <Plus className="h-4 w-4 mr-2" />
              New Adjustment
            </Link>
          </Button>
        </div>

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
                <TableHead>Location</TableHead>
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
                  <TableCell>{locations.find(l => l.id === adjustment.location_id)?.name || '-'}</TableCell>
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
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(adjustment.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium flex items-center gap-1"><MapPin className="h-3 w-3"/> Location</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 text-base">
                    {locations.find(l => l.id === viewingAdjustment.location_id)?.name || '-'}
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
