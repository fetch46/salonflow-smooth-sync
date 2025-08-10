import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, ArrowLeft } from "lucide-react";
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

interface BusinessLocation {
  id: string;
  name: string;
}

interface AdjustmentItemForm {
  item_id: string;
  current_quantity: number;
  adjusted_quantity: number;
  difference: number;
  unit_cost: number;
  total_cost: number;
  notes: string;
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

export default function InventoryAdjustmentForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [locations, setLocations] = useState<BusinessLocation[]>([]);
  const [formData, setFormData] = useState({
    adjustment_date: new Date().toISOString().split("T")[0],
    adjustment_type: "",
    reason: "",
    notes: "",
    adjustment_number: "",
    location_id: ""
  });
  const [selectedItems, setSelectedItems] = useState<AdjustmentItemForm[]>([]);

  useEffect(() => {
    fetchInventoryItems();
    fetchLocations();
  }, []);

  useEffect(() => {
    if (isEdit && id) {
      // Load existing adjustment and items
      (async () => {
        try {
          setLoading(true);
          const { data: adj, error: adjErr } = await supabase
            .from("inventory_adjustments")
            .select("*")
            .eq("id", id)
            .single();
          if (adjErr) throw adjErr;

          setFormData({
            adjustment_date: adj.adjustment_date,
            adjustment_type: adj.adjustment_type,
            reason: adj.reason,
            notes: adj.notes || "",
            adjustment_number: adj.adjustment_number,
            location_id: adj.location_id || ""
          });

          const { data: items, error: itemsErr } = await supabase
            .from("inventory_adjustment_items")
            .select("id, item_id, current_quantity, adjusted_quantity, difference, unit_cost, total_cost, notes")
            .eq("adjustment_id", id);
          if (itemsErr) throw itemsErr;

          setSelectedItems(
            (items || []).map((i) => ({
              item_id: i.item_id,
              current_quantity: i.current_quantity,
              adjusted_quantity: i.adjusted_quantity,
              difference: i.difference,
              unit_cost: i.unit_cost,
              total_cost: i.total_cost,
              notes: i.notes || ""
            }))
          );
        } catch (error) {
          console.error("Error loading adjustment:", error);
          toast.error("Failed to load adjustment");
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [isEdit, id]);

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
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      setLocations(data || []);
    } catch (error) {
      console.error("Error fetching locations:", error);
    }
  };

  const generateAdjustmentNumber = () => {
    const timestamp = Date.now().toString().slice(-6);
    return `ADJ-${timestamp}`;
  };

  const addItemToAdjustment = () => {
    setSelectedItems((prev) => [
      ...prev,
      {
        item_id: "",
        current_quantity: 0,
        adjusted_quantity: 0,
        difference: 0,
        unit_cost: 0,
        total_cost: 0,
        notes: ""
      }
    ]);
  };

  const removeItemFromAdjustment = (index: number) => {
    setSelectedItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateSelectedItem = (index: number, field: keyof AdjustmentItemForm, value: any) => {
    setSelectedItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value } as AdjustmentItemForm;

      if (field === "current_quantity" || field === "adjusted_quantity") {
        const current = field === "current_quantity" ? value : updated[index].current_quantity;
        const adjusted = field === "adjusted_quantity" ? value : updated[index].adjusted_quantity;
        updated[index].difference = adjusted - current;
        updated[index].total_cost = Math.abs(updated[index].difference) * updated[index].unit_cost;
      }

      if (field === "unit_cost") {
        updated[index].total_cost = Math.abs(updated[index].difference) * value;
      }

      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedItems.length === 0) {
      toast.error("Please add at least one item to the adjustment");
      return;
    }

    // Basic validations
    if (!formData.adjustment_type || !formData.reason) {
      toast.error("Please select an adjustment type and reason");
      return;
    }

    if (locations.length > 0 && !formData.location_id) {
      toast.error("Please select a location");
      return;
    }

    const hasInvalidItemId = selectedItems.some((item) => !item.item_id || item.item_id.trim() === "");
    if (hasInvalidItemId) {
      toast.error("Please select an item for all adjustment rows");
      return;
    }

    const hasInvalidNumbers = selectedItems.some(
      (item) => !Number.isFinite(item.current_quantity) || !Number.isFinite(item.adjusted_quantity) || !Number.isFinite(item.unit_cost)
    );
    if (hasInvalidNumbers) {
      toast.error("Please enter valid numeric values for quantities and unit cost");
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
        location_id: formData.location_id || null
      };

      let adjustmentId: string;

      if (isEdit && id) {
        const { error } = await supabase
          .from("inventory_adjustments")
          .update(adjustmentData)
          .eq("id", id);
        if (error) throw error;
        adjustmentId = id;
        // Replace items
        const { error: deleteErr } = await supabase
          .from("inventory_adjustment_items")
          .delete()
          .eq("adjustment_id", id);
        if (deleteErr) throw deleteErr;
      } else {
        const { data, error } = await supabase
          .from("inventory_adjustments")
          .insert([adjustmentData])
          .select()
          .single();
        if (error) throw error;
        adjustmentId = data.id;
      }

      const itemsData = selectedItems.map((item) => ({
        adjustment_id: adjustmentId,
        item_id: item.item_id,
        current_quantity: item.current_quantity,
        adjusted_quantity: item.adjusted_quantity,
        difference: item.difference,
        unit_cost: item.unit_cost,
        total_cost: item.total_cost,
        notes: item.notes
      }));

      const { error: itemsError } = await supabase
        .from("inventory_adjustment_items")
        .insert(itemsData);
      if (itemsError) throw itemsError;

      toast.success(isEdit ? "Adjustment updated successfully" : "Adjustment created successfully");
      navigate("/inventory-adjustments");
    } catch (error) {
      console.error("Error saving adjustment:", error);
      const message = (error as any)?.message || (typeof error === "string" ? error : "");
      toast.error(message ? `Failed to save adjustment: ${message}` : "Failed to save adjustment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{isEdit ? "Edit Adjustment" : "Create Inventory Adjustment"}</h1>
          <p className="text-muted-foreground">{isEdit ? "Update details of the inventory adjustment" : "Add details about the inventory adjustment and the items involved."}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isEdit ? "Adjustment Details" : "New Adjustment"}</CardTitle>
          <CardDescription>Fill in the adjustment information and items.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <Label htmlFor="adjustment_date">Adjustment Date</Label>
                <Input
                  type="date"
                  id="adjustment_date"
                  value={formData.adjustment_date}
                  onChange={(e) => setFormData({ ...formData, adjustment_date: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="adjustment_type">Adjustment Type</Label>
                <Select value={formData.adjustment_type} onValueChange={(value) => setFormData({ ...formData, adjustment_type: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
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
                <Label htmlFor="reason">Reason</Label>
                <Select value={formData.reason} onValueChange={(value) => setFormData({ ...formData, reason: value })}>
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
              <Label htmlFor="location">Location</Label>
              <Select value={formData.location_id} onValueChange={(value) => setFormData({ ...formData, location_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes about the adjustment"
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Adjustment Items</Label>
                <Button type="button" onClick={addItemToAdjustment} variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-1" /> Add Item
                </Button>
              </div>

              {selectedItems.map((item, index) => (
                <div key={index} className="grid grid-cols-7 gap-2 items-end p-3 border rounded-lg">
                  <div>
                    <Label>Item</Label>
                    <Select value={item.item_id} onValueChange={(value) => updateSelectedItem(index, "item_id", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select item" />
                      </SelectTrigger>
                      <SelectContent>
                        {inventoryItems.map((invItem) => (
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
                      onChange={(e) => updateSelectedItem(index, "current_quantity", Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label>Adjusted Qty</Label>
                    <Input
                      type="number"
                      value={item.adjusted_quantity}
                      onChange={(e) => updateSelectedItem(index, "adjusted_quantity", Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label>Difference</Label>
                    <Input value={item.difference} readOnly className={item.difference > 0 ? "text-green-600" : item.difference < 0 ? "text-red-600" : ""} />
                  </div>
                  <div>
                    <Label>Unit Cost</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.unit_cost}
                      onChange={(e) => updateSelectedItem(index, "unit_cost", Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label>Total Cost</Label>
                    <Input value={item.total_cost.toFixed(2)} readOnly />
                  </div>
                  <Button type="button" variant="destructive" size="sm" onClick={() => removeItemFromAdjustment(index)}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => navigate("/inventory-adjustments")}>Cancel</Button>
              <Button type="submit" disabled={loading}>{loading ? (isEdit ? "Updating..." : "Saving...") : isEdit ? "Update Adjustment" : "Create Adjustment"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}