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
import { Plus, Package, Trash2, Edit, MapPin, RefreshCw, MoreHorizontal, Eye, CheckCircle2 } from "lucide-react";
import { useOrganizationCurrency } from "@/lib/saas/hooks";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Columns3 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useOrganization } from "@/lib/saas/hooks";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { useRegionalNumberFormatter } from "@/lib/saas";

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
  cost_price?: number | null;
  selling_price?: number | null;
};

// --- Form Components ---

// A separate component for the Item Dialog Form
const ItemFormDialog = ({ isOpen, onClose, onSubmit, editingItem, warehouses }: { isOpen: boolean; onClose: (open: boolean) => void; onSubmit: (data: any) => Promise<void> | void; editingItem: any; warehouses: { id: string; name: string }[]; }) => {
  const { organization } = useOrganization();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    sku: "",
    unit: "",
    reorder_point: 0,
    cost_price: 0,
    selling_price: 0,
    is_taxable: false,
    sales_account_id: "",
    purchase_account_id: "",
    inventory_account_id: "",
    opening_stock_quantity: 0,
    opening_stock_warehouse_id: "",
  });

  const [accountsLoading, setAccountsLoading] = useState<boolean>(false);
  const [incomeAccounts, setIncomeAccounts] = useState<any[]>([]);
  const [expenseAccounts, setExpenseAccounts] = useState<any[]>([]);
  const [assetAccounts, setAssetAccounts] = useState<any[]>([]);
  const [errors, setErrors] = useState<{ sales?: string; purchase?: string; inventory?: string }>({});

  useEffect(() => {
    if (editingItem) {
      setFormData({
        name: editingItem.name || "",
        description: editingItem.description || "",
        sku: editingItem.sku || "",
        unit: editingItem.unit || "",
        reorder_point: editingItem.reorder_point || 0,
        cost_price: Number(editingItem.cost_price || 0),
        selling_price: Number(editingItem.selling_price || 0),
        is_taxable: false,
        sales_account_id: "",
        purchase_account_id: "",
        inventory_account_id: "",
        opening_stock_quantity: 0,
        opening_stock_warehouse_id: "",
      });
      setErrors({});
    } else {
      setFormData({
        name: "",
        description: "",
        sku: "",
        unit: "",
        reorder_point: 0,
        cost_price: 0,
        selling_price: 0,
        is_taxable: false,
        sales_account_id: "",
        purchase_account_id: "",
        inventory_account_id: "",
        opening_stock_quantity: 0,
        opening_stock_warehouse_id: "",
      });
      setErrors({});
    }
  }, [editingItem]);

  // Load accounts and existing mapping if editing
  useEffect(() => {
    const loadAccounts = async () => {
      try {
        setAccountsLoading(true);
        let accs: any[] | null = null;
        let err: any = null;
        try {
          const res = await supabase
            .from("accounts")
            .select("id, account_code, account_name, account_type, account_subtype")
            .eq("organization_id", organization?.id || "");
          accs = res.data as any[] | null;
          err = res.error;
        } catch (innerErr: any) {
          err = innerErr;
        }
        if (err) {
          const message = String(err?.message || "");
          if (message.includes("account_subtype") || (message.toLowerCase().includes("column") && message.toLowerCase().includes("does not exist"))) {
            const { data, error } = await supabase
              .from("accounts")
              .select("id, account_code, account_name, account_type")
              .eq("organization_id", organization?.id || "");
            if (error) throw error;
            accs = data as any[] | null;
          } else {
            throw err;
          }
        }
        const accounts = accs || [];
        setIncomeAccounts(accounts.filter((a: any) => a.account_type === 'Income'));
        setExpenseAccounts(accounts.filter((a: any) => a.account_type === 'Expense'));
        setAssetAccounts(accounts.filter((a: any) => a.account_type === 'Asset' && (!('account_subtype' in a) || a.account_subtype === 'Stock')));

        if (editingItem?.id) {
          const { data: mapping, error: mapErr } = await supabase
            .from("inventory_item_accounts")
            .select("sales_account_id, purchase_account_id, inventory_account_id, is_taxable")
            .eq("item_id", editingItem.id)
            .maybeSingle();
          if (!mapErr && mapping) {
            setFormData((prev) => ({
              ...prev,
              sales_account_id: mapping.sales_account_id || "",
              purchase_account_id: mapping.purchase_account_id || "",
              inventory_account_id: mapping.inventory_account_id || "",
              is_taxable: !!mapping.is_taxable,
            }));
          }
        }
      } catch (e) {
        console.error('Failed to load accounts or item mapping', e);
      } finally {
        setAccountsLoading(false);
      }
    };
    loadAccounts();
  }, [organization?.id, editingItem?.id]);

  const handleFormSubmit = (e) => {
    e.preventDefault();
    const nextErrors: { sales?: string; purchase?: string; inventory?: string } = {};
    if (!formData.sales_account_id) nextErrors.sales = "Required";
    if (!formData.purchase_account_id) nextErrors.purchase = "Required";
    if (!formData.inventory_account_id) nextErrors.inventory = "Required";
    setErrors(nextErrors);
    if (nextErrors.sales || nextErrors.purchase || nextErrors.inventory) {
      toast({ title: "Missing accounts", description: "Please select Sales, Purchase, and Inventory accounts.", variant: "destructive" });
      return;
    }
    // Ensure numeric fields are numbers
    const payload = {
      ...formData,
      reorder_point: Number(formData.reorder_point || 0),
      cost_price: Number(formData.cost_price || 0),
      selling_price: Number(formData.selling_price || 0),
    };
    onSubmit(payload);
  };

  // Helper to set cost_price from last purchase price when editing existing item
  const fillCostFromLastPurchase = async () => {
    if (!editingItem?.id) return;
    try {
      const { data, error } = await supabase
        .from("purchase_items")
        .select("unit_cost, created_at")
        .eq("item_id", editingItem.id)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      const last = (data || [])[0];
      if (last?.unit_cost != null) {
        setFormData((prev) => ({ ...prev, cost_price: Number(last.unit_cost) }));
      }
    } catch (err) {
      console.error("Failed to fetch last purchase price", err);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
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
            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
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
            <div className="space-y-2">
              <Label>Taxable</Label>
              <div className="flex h-10 items-center px-3 rounded-md border">
                <Switch checked={formData.is_taxable} onCheckedChange={(v) => setFormData({ ...formData, is_taxable: v })} />
                <span className="ml-2 text-sm text-muted-foreground">Charge tax when selling this item</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cost_price">Purchase Price</Label>
              <div className="flex gap-2">
                <Input
                  id="cost_price"
                  type="number"
                  step="0.01"
                  value={formData.cost_price}
                  onChange={(e) => setFormData({ ...formData, cost_price: parseFloat(e.target.value || '0') })}
                />
                <Button type="button" variant="outline" onClick={fillCostFromLastPurchase} disabled={!editingItem?.id}>
                  Use last purchase
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="selling_price">Selling Price</Label>
              <Input
                id="selling_price"
                type="number"
                step="0.01"
                value={formData.selling_price}
                onChange={(e) => setFormData({ ...formData, selling_price: parseFloat(e.target.value || '0') })}
              />
            </div>
          </div>

          {/* Accounts selection */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Sales Account</Label>
              <Select
                value={formData.sales_account_id}
                onValueChange={(v) => setFormData({ ...formData, sales_account_id: v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={accountsLoading ? 'Loading...' : 'Select income account'} />
                </SelectTrigger>
                <SelectContent>
                  {incomeAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{`${a.account_code} - ${a.account_name}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.sales && (<p className="text-xs text-destructive">{errors.sales}</p>)}
            </div>
            <div className="space-y-2">
              <Label>Purchase Account</Label>
              <Select
                value={formData.purchase_account_id}
                onValueChange={(v) => setFormData({ ...formData, purchase_account_id: v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={accountsLoading ? 'Loading...' : 'Select expense account'} />
                </SelectTrigger>
                <SelectContent>
                  {expenseAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{`${a.account_code} - ${a.account_name}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.purchase && (<p className="text-xs text-destructive">{errors.purchase}</p>)}
            </div>
            <div className="space-y-2">
              <Label>Inventory Account</Label>
              <Select
                value={formData.inventory_account_id}
                onValueChange={(v) => setFormData({ ...formData, inventory_account_id: v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={accountsLoading ? 'Loading...' : 'Select asset account (Stock)'} />
                </SelectTrigger>
                <SelectContent>
                  {assetAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{`${a.account_code} - ${a.account_name}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.inventory && (<p className="text-xs text-destructive">{errors.inventory}</p>)}
            </div>
          </div>

          {/* Opening stock section (only when creating a new item) */}
          {!editingItem && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="opening_stock_quantity">Opening Stock Quantity</Label>
                <Input
                  id="opening_stock_quantity"
                  type="number"
                  value={formData.opening_stock_quantity}
                  onChange={(e) => setFormData({ ...formData, opening_stock_quantity: parseFloat(e.target.value || '0') })}
                />
              </div>
              {Number(formData.opening_stock_quantity || 0) > 0 && (
                <div className="space-y-2">
                  <Label>Opening Stock Warehouse</Label>
                  <Select
                    value={formData.opening_stock_warehouse_id}
                    onValueChange={(v) => setFormData({ ...formData, opening_stock_warehouse_id: v })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select warehouse" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map((wh) => (
                        <SelectItem key={wh.id} value={wh.id}>{wh.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onClose(false)}>
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
  const navigate = useNavigate();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [searchQuery, setSearchQuery] = useState("");
  const [levels, setLevels] = useState<any[]>([]);
  const [levelsLoading, setLevelsLoading] = useState<boolean>(false);
  // New: locations and filter
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([]);
  const [warehousesLoading, setWarehousesLoading] = useState<boolean>(false);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("all");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const pageSize = 10;
  const defaultVisibleColumns = {
    sku: true,
    unit: true,
    quantity: true,
    reorder_point: true,
    status: true,
    selling_price: false,
    purchase_price: false,
  } as const;
  const [visibleColumns, setVisibleColumns] = useState<{ sku: boolean; unit: boolean; quantity: boolean; reorder_point: boolean; status: boolean; selling_price: boolean; purchase_price: boolean }>(
    () => {
      try {
        const stored = localStorage.getItem('inventory_visible_columns');
        return stored ? { ...defaultVisibleColumns, ...JSON.parse(stored) } : { ...defaultVisibleColumns };
      } catch {
        return { ...defaultVisibleColumns };
      }
    }
  );

  // Currency formatter
  const { format: formatMoney } = useOrganizationCurrency();
  const formatRegionalNumber = useRegionalNumberFormatter();

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
          warehouse_id,
          quantity,
          inventory_items ( name, sku, cost_price, selling_price ),
          warehouses ( name )
        `)
        .order("warehouse_id")
        .order("item_id");
      if (error) throw error;
      setLevels(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLevelsLoading(false);
    }
  }, []);

  // New: fetch warehouses
  const fetchWarehouses = useCallback(async () => {
    setWarehousesLoading(true);
    try {
      const { data, error } = await supabase
        .from("warehouses")
        .select("id, name")
        .order("name");
      if (error) throw error;
      setWarehouses((data || []) as { id: string; name: string }[]);
    } catch (err) {
      console.error(err);
    } finally {
      setWarehousesLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([fetchData(), fetchLevels(), fetchWarehouses()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchData, fetchLevels, fetchWarehouses]);

  useEffect(() => {
    fetchData();
    fetchLevels();
    fetchWarehouses();
  }, [fetchData, fetchLevels, fetchWarehouses]);

  // Auto-open edit dialog when navigated with ?action=edit&itemId=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const itemId = params.get('itemId');
    if (action === 'edit' && itemId) {
      const it = items.find(i => String(i.id) === String(itemId));
      if (it) {
        setEditingItem(it);
        setIsItemDialogOpen(true);
        const url = new URL(window.location.href);
        url.searchParams.delete('action');
        url.searchParams.delete('itemId');
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, [items]);

  // Persist visible columns
  useEffect(() => {
    try {
      localStorage.setItem('inventory_visible_columns', JSON.stringify(visibleColumns));
    } catch { /* ignore */ }
  }, [visibleColumns]);

  const handleItemSubmit = async (formData) => {
    try {
      if (!formData.sales_account_id || !formData.purchase_account_id || !formData.inventory_account_id) {
        toast({ title: "Missing accounts", description: "Please select Sales, Purchase, and Inventory accounts.", variant: "destructive" });
        return;
      }
      if (editingItem) {
        const { error } = await supabase.from("inventory_items").update({
          name: (formData.name || '').trim(),
          description: formData.description,
          sku: (formData.sku || '').trim() ? (formData.sku || '').trim() : null,
          unit: (formData.unit || '').trim() || null,
          reorder_point: formData.reorder_point,
          cost_price: formData.cost_price,
          selling_price: formData.selling_price,
        }).eq("id", editingItem.id);
        if (error) throw error;
        // Upsert per-item account mapping and tax flag with fallback when unique constraint is missing
        {
          const payload = {
            item_id: editingItem.id,
            sales_account_id: formData.sales_account_id || null,
            purchase_account_id: formData.purchase_account_id || null,
            inventory_account_id: formData.inventory_account_id || null,
            is_taxable: !!formData.is_taxable,
          } as const;
          let upsertError: any = null;
          try {
            const res = await supabase.from('inventory_item_accounts').upsert(payload, { onConflict: 'item_id' });
            upsertError = res.error || null;
          } catch (err: any) {
            upsertError = err;
          }
          if (upsertError) {
            const { data: existing } = await supabase
              .from('inventory_item_accounts')
              .select('item_id')
              .eq('item_id', editingItem.id)
              .maybeSingle();
            if (existing) {
              const { error } = await supabase.from('inventory_item_accounts').update(payload).eq('item_id', editingItem.id);
              if (error) throw error;
            } else {
              const { error } = await supabase.from('inventory_item_accounts').insert(payload);
              if (error) throw error;
            }
          }
        }
        toast({ title: "Success", description: "Product updated successfully" });
      } else {
        const payload = { ...formData, type: "good" };
        const { data: inserted, error } = await supabase
          .from("inventory_items")
          .insert({
            name: (payload.name || '').trim(),
            description: payload.description,
            sku: (payload.sku || '').trim() ? (payload.sku || '').trim() : null,
            unit: (payload.unit || '').trim() || null,
            reorder_point: payload.reorder_point,
            cost_price: payload.cost_price,
            selling_price: payload.selling_price,
            type: 'good',
          })
          .select('id')
          .single();
        if (error) throw error;
        const newItemId = inserted?.id;
        if (newItemId) {
          // Save mapping with upsert-or-insert fallback
          {
            const payload = {
              item_id: newItemId,
              sales_account_id: formData.sales_account_id || null,
              purchase_account_id: formData.purchase_account_id || null,
              inventory_account_id: formData.inventory_account_id || null,
              is_taxable: !!formData.is_taxable,
            } as const;
            let upsertError: any = null;
            try {
              const res = await supabase.from('inventory_item_accounts').upsert(payload, { onConflict: 'item_id' });
              upsertError = res.error || null;
            } catch (err: any) {
              upsertError = err;
            }
            if (upsertError) {
              const { data: existing } = await supabase
                .from('inventory_item_accounts')
                .select('item_id')
                .eq('item_id', newItemId)
                .maybeSingle();
              if (existing) {
                const { error } = await supabase.from('inventory_item_accounts').update(payload).eq('item_id', newItemId);
                if (error) throw error;
              } else {
                const { error } = await supabase.from('inventory_item_accounts').insert(payload);
                if (error) throw error;
              }
            }
          }
          // Opening stock if provided
          const openingQty = Number(formData.opening_stock_quantity || 0);
          if (openingQty > 0 && formData.opening_stock_warehouse_id) {
            await supabase.from('inventory_levels').upsert({
              item_id: newItemId,
              warehouse_id: formData.opening_stock_warehouse_id,
              quantity: openingQty,
            }, { onConflict: 'item_id,warehouse_id' });
          }
        }
        toast({ title: "Success", description: "Product created successfully" });
      }
      setIsItemDialogOpen(false);
      setEditingItem(null);
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: String(error?.message || error || 'Failed to save product'), variant: "destructive" });
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

  const handleDeleteItem = async (item: InventoryItem) => {
    const confirm = window.confirm(`Are you sure you want to delete product "${item.name}"? This action cannot be undone.`);
    if (!confirm) return;

    try {
      const { count: serviceKitCount, error: serviceKitError } = await supabase
        .from("service_kits")
        .select("id", { count: "exact", head: true })
        .eq("good_id", item.id);

      if (serviceKitError) {
        throw new Error("Failed to check service kits usage.");
      }

      if (serviceKitCount && serviceKitCount > 0) {
        toast({
          title: "Cannot Delete",
          description: `This product is used in ${serviceKitCount} service kit(s). Please remove it from those kits first.`,
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase.from("inventory_items").delete().eq("id", item.id);
      if (error) throw error;
      toast({ title: "Deleted", description: "Product deleted successfully" });
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast({ title: "Error", description: String(err?.message || "Failed to delete product"), variant: "destructive" });
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
  const totalPages = Math.max(1, Math.ceil(filteredGoodsItems.length / pageSize));
  const paginatedGoodsItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredGoodsItems.slice(start, start + pageSize);
  }, [filteredGoodsItems, page]);

  useEffect(() => { setPage(1); }, [searchQuery, statusFilter]);

  // New: filter levels by selected location and compute metrics
  const filteredLevels = selectedWarehouseId === 'all' ? levels : levels.filter(l => l.warehouse_id === selectedWarehouseId);
  // Map item -> quantity across filtered levels (all locations or selected location)
  const itemIdToQty: Map<string, number> = useMemo(() => {
    const map = new Map<string, number>();
    for (const lvl of filteredLevels) {
      const id = String(lvl.item_id);
      const prev = map.get(id) || 0;
      map.set(id, prev + Number(lvl.quantity || 0));
    }
    return map;
  }, [filteredLevels]);

  const itemIdToItem: Map<string, InventoryItem> = useMemo(() => {
    const map = new Map<string, InventoryItem>();
    for (const it of items) {
      map.set(String(it.id), it);
    }
    return map;
  }, [items]);

  const totals = useMemo(() => {
    let totalQty = 0;
    let totalCost = 0;
    let totalSales = 0;
    for (const lvl of filteredLevels) {
      const qty = Number(lvl.quantity || 0);
      const item = itemIdToItem.get(String(lvl.item_id));
      const cost = Number(item?.cost_price ?? 0);
      const price = Number(item?.selling_price ?? 0);
      totalQty += qty;
      totalCost += qty * cost;
      totalSales += qty * price;
    }
    return { totalQty, totalCost, totalSales };
  }, [filteredLevels, itemIdToItem]);

  const TableSkeleton = () => (
    <div className="overflow-auto max-h-[65vh] rounded-lg border">
      <Table className="min-w-[720px]">
        <TableHeader className="sticky top-0 bg-background z-10">
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="hidden sm:table-cell">SKU</TableHead>
            <TableHead className="hidden md:table-cell">Unit</TableHead>
            <TableHead className="text-right hidden lg:table-cell">Quantity</TableHead>
            <TableHead className="hidden lg:table-cell">Reorder Point</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i} className="hover:bg-muted/50">
              <TableCell><Skeleton className="h-4 w-[180px]" /></TableCell>
              <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-[120px]" /></TableCell>
              <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-[80px]" /></TableCell>
              <TableCell className="text-right hidden lg:table-cell"><Skeleton className="h-4 w-[60px] ml-auto" /></TableCell>
              <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-[60px]" /></TableCell>
              <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
              <TableCell className="text-right"><Skeleton className="h-4 w-[80px] ml-auto" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6 lg:space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold">Inventory Management</h1>
        <div className="flex flex-wrap items-center gap-3">
          {/* Warehouse Filter */}
          <div className="flex items-center gap-2">
            <Label className="text-sm">Warehouse</Label>
            <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder={warehousesLoading ? 'Loading...' : 'All warehouses'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All warehouses</SelectItem>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button asChild>
            <Link to="/inventory/new">
              <Plus className="w-4 h-4 mr-2" /> Add Product
            </Link>
          </Button>
        </div>
      </div>

      {/* Metrics Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="relative overflow-hidden border-0 shadow-lg">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-emerald-600 opacity-95" />
          <CardHeader className="relative pb-2">
            <CardTitle className="text-sm font-medium text-white/90">Cost Value</CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-white">{formatMoney(totals.totalCost)}</div>
            <p className="text-xs text-white/80">Stock at cost</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-lg">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-indigo-600 opacity-95" />
          <CardHeader className="relative pb-2">
            <CardTitle className="text-sm font-medium text-white/90">Sales Value</CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-white">{formatMoney(totals.totalSales)}</div>
            <p className="text-xs text-white/80">Stock at selling price</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-lg">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500 to-amber-600 opacity-95" />
          <CardHeader className="relative pb-2">
            <CardTitle className="text-sm font-medium text-white/90">Quantities in Stock</CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-white">{formatRegionalNumber(totals.totalQty)}</div>
            <p className="text-xs text-white/80">All products</p>
          </CardContent>
        </Card>
      </div>



      <Tabs defaultValue="goods" className="space-y-6">
        <TabsList className="grid w-full grid-cols-1 md:w-fit">
          <TabsTrigger value="goods">Products</TabsTrigger>
          <TabsTrigger value="stock">Stock by Warehouse</TabsTrigger>
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="ml-auto">
                      <Columns3 className="w-4 h-4 mr-2" /> Columns
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuCheckboxItem
                      checked={visibleColumns.quantity}
                      onCheckedChange={(v) => setVisibleColumns((prev) => ({ ...prev, quantity: !!v }))}
                    >
                      Quantity
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={visibleColumns.sku}
                      onCheckedChange={(v) => setVisibleColumns((prev) => ({ ...prev, sku: !!v }))}
                    >
                      SKU
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={visibleColumns.unit}
                      onCheckedChange={(v) => setVisibleColumns((prev) => ({ ...prev, unit: !!v }))}
                    >
                      Unit
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={visibleColumns.reorder_point}
                      onCheckedChange={(v) => setVisibleColumns((prev) => ({ ...prev, reorder_point: !!v }))}
                    >
                      Reorder Point
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={visibleColumns.status}
                      onCheckedChange={(v) => setVisibleColumns((prev) => ({ ...prev, status: !!v }))}
                    >
                      Status
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={visibleColumns.selling_price}
                      onCheckedChange={(v) => setVisibleColumns((prev) => ({ ...prev, selling_price: !!v }))}
                    >
                      Selling Price
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={visibleColumns.purchase_price}
                      onCheckedChange={(v) => setVisibleColumns((prev) => ({ ...prev, purchase_price: !!v }))}
                    >
                      Purchase Price
                    </DropdownMenuCheckboxItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? <TableSkeleton /> : (
                <div className="space-y-4">
                  <div className="overflow-auto max-h-[65vh] rounded-lg border">
                    <Table className="min-w-[720px]">
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                          <TableHead>Name</TableHead>
                          {visibleColumns.sku && (
                            <TableHead className="hidden sm:table-cell">SKU</TableHead>
                          )}
                          {visibleColumns.unit && (
                            <TableHead className="hidden md:table-cell">Unit</TableHead>
                          )}
                          {visibleColumns.selling_price && (
                            <TableHead className="hidden lg:table-cell">Selling Price</TableHead>
                          )}
                          {visibleColumns.purchase_price && (
                            <TableHead className="hidden lg:table-cell">Purchase Price</TableHead>
                          )}
                          {visibleColumns.quantity && (
                            <TableHead className="text-right">Quantity</TableHead>
                          )}
                          {visibleColumns.reorder_point && (
                            <TableHead className="hidden lg:table-cell">Reorder Point</TableHead>
                          )}
                          {visibleColumns.status && (
                            <TableHead>Status</TableHead>
                          )}
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedGoodsItems.map((item) => {
                          return (
                            <TableRow key={item.id} className="hover:bg-muted/50">
                              <TableCell className="font-medium max-w-[320px] truncate">
                                <Link to={`/inventory/${item.id}`} className="hover:underline">
                                  {item.name}
                                </Link>
                              </TableCell>
                              {visibleColumns.sku && (
                                <TableCell className="hidden sm:table-cell">{item.sku}</TableCell>
                              )}
                              {visibleColumns.unit && (
                                <TableCell className="hidden md:table-cell">{item.unit}</TableCell>
                              )}
                              {visibleColumns.selling_price && (
                                <TableCell className="hidden lg:table-cell">{formatMoney(Number(item.selling_price || 0))}</TableCell>
                              )}
                              {visibleColumns.purchase_price && (
                                <TableCell className="hidden lg:table-cell">{formatMoney(Number(item.cost_price || 0))}</TableCell>
                              )}
                              {visibleColumns.quantity && (
                                <TableCell className="text-right">{formatRegionalNumber(itemIdToQty.get(item.id) || 0)}</TableCell>
                              )}
                              {visibleColumns.reorder_point && (
                                <TableCell className="hidden lg:table-cell">{item.reorder_point}</TableCell>
                              )}
                              {visibleColumns.status && (
                                <TableCell>
                                  {item.is_active ? (
                                    <Badge variant="secondary">Active</Badge>
                                  ) : (
                                    <Badge variant="outline">Inactive</Badge>
                                  )}
                                </TableCell>
                              )}
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm">
                                      Action
                                    </Button>
                                  </DropdownMenuTrigger>
                                                                     <DropdownMenuContent align="end">
                                     <DropdownMenuItem onSelect={() => navigate(`/inventory/${item.id}`)}>
                                       <Eye className="w-4 h-4 mr-2" /> View Product
                                     </DropdownMenuItem>
                                     <DropdownMenuItem onSelect={() => handleEditItem(item)}>
                                       <Edit className="w-4 h-4 mr-2" /> Edit
                                     </DropdownMenuItem>
                                     <DropdownMenuSeparator />
                                     <DropdownMenuItem onSelect={() => handleDeleteItem(item)} className="text-red-600">
                                       <Trash2 className="w-4 h-4 mr-2" /> Delete
                                     </DropdownMenuItem>
                                   </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="mt-4">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious onClick={() => setPage(p => Math.max(1, p - 1))} />
                        </PaginationItem>
                        <span className="px-2 text-sm text-muted-foreground">Page {page} of {totalPages}</span>
                        <PaginationItem>
                          <PaginationNext onClick={() => setPage(p => Math.min(totalPages, p + 1))} />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
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
                Stock by Warehouse
              </CardTitle>
            </CardHeader>
            <CardContent>
              {levelsLoading ? (
                <div className="overflow-auto max-h-[65vh] rounded-lg border">
                  <Table className="min-w-[720px]">
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead>Warehouse</TableHead>
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
                        <TableHead>Warehouse</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead className="hidden sm:table-cell">SKU</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLevels.map((lvl) => (
                        <TableRow key={lvl.id} className="hover:bg-muted/50">
                          <TableCell className="font-medium">{(lvl as any).warehouses?.name || lvl.warehouse_id}</TableCell>
                          <TableCell>{itemIdToItem.get(String(lvl.item_id))?.name || lvl.inventory_items?.name || lvl.item_id}</TableCell>
                          <TableCell className="hidden sm:table-cell">{itemIdToItem.get(String(lvl.item_id))?.sku || lvl.inventory_items?.sku || ''}</TableCell>
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
