import { useEffect, useState } from "react";
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
  inventory_items?: { name: string; sku: string; unit: string };
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
    // Component disabled - tables don't exist in database
    toast.info("Inventory Adjustments feature is not yet configured for this database schema");
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inventory Adjustments</h1>
          <p className="text-muted-foreground">
            Track and manage inventory adjustments and stock corrections
          </p>
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
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Awaiting review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Positive Adjustments</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Stock increases</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Negative Adjustments</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
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
                Feature not available - database schema configuration required
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-3">
              <Package className="h-12 w-12 text-muted-foreground mx-auto" />
              <h3 className="text-lg font-medium">Inventory Adjustments Not Configured</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                The inventory adjustments feature requires additional database tables that haven't been created yet. 
                Contact your system administrator to set up the required schema.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}