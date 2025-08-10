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

interface AccountOption { id: string; account_code: string; account_name: string; account_type: string; account_subtype: string | null; balance?: number | null }

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

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'partial' | 'received' | 'cancelled'>('all');
  const [vendorFilter, setVendorFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Payments state
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [isPayDialogOpen, setIsPayDialogOpen] = useState(false);
  const [payPurchaseId, setPayPurchaseId] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [payAmount, setPayAmount] = useState<string>("");
  const [payDate, setPayDate] = useState<string>("");
  const [payReference, setPayReference] = useState<string>("");
  const [payLoading, setPayLoading] = useState<boolean>(false);


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
    calculateTotals();
  }, [calculateTotals]);

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
        .from("business_locations")
        .select("id, name")
        .order("name");
      if (error) throw error;
      setLocations(data || []);
    } catch (err) {
      console.warn("Failed to load business locations", err);
      setLocations([]);
    }
  }, []);

  const fetchInventoryItems = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, name, type")
        .eq("type", "good")
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

  const fetchItemsForEditing = async (purchaseId: string) => {
    try {
      const { data, error } = await supabase
        .from("purchase_items")
        .select(`
          *,
          inventory_items (name)
        `)
        .eq("purchase_id", purchaseId);

      if (error) throw error;
      setPurchaseItems(data || []);
    } catch (error) {
      console.error("Error fetching items for editing:", error);
    }
  };

  // Undo Receiving: reverse inventory levels and clear received quantities
  const undoReceiving = async (purchaseId: string) => {
    try {
      const { data: purchase, error: pErr } = await supabase
        .from("purchases")
        .select("id, location_id, status")
        .eq("id", purchaseId)
        .single();
      if (pErr) throw pErr;

      if (!purchase?.location_id) {
        toast({ title: "Nothing to undo", description: "This purchase has no receiving location set.", variant: "destructive" });
        return;
      }

      const { data: items, error: iErr } = await supabase
        .from("purchase_items")
        .select("id, item_id, received_quantity")
        .eq("purchase_id", purchaseId);
      if (iErr) throw iErr;

      let anyReceived = false;
      for (const it of items || []) {
        const receivedQty = Number(it.received_quantity || 0);
        if (receivedQty > 0) {
          anyReceived = true;
          await supabase
            .from("purchase_items")
            .update({ received_quantity: 0 })
            .eq("id", it.id);
        }
      }

      if (!anyReceived) {
        toast({ title: "No received items", description: "There are no received items to undo.", variant: "destructive" });
        return;
      }

      // DB triggers will update purchase status back to pending; keep location as-is
      toast({ title: "Receiving removed", description: "Inventory and received quantities have been reverted." });
      fetchPurchases();
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to undo receiving", variant: "destructive" });
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
      // Set receiving location before updating item receipts so DB trigger can post to correct location
      await supabase.from("purchases").update({ location_id: receiveLocationId }).eq("id", receivePurchaseId);

      // Update received quantities only; DB triggers will sync inventory and status
      for (const item of selectedPurchaseItems) {
        const qtyRequested = Number(receiveQuantities[item.item_id] || 0);
        if (qtyRequested <= 0) continue;
        const alreadyReceived = Number(item.received_quantity || 0);
        const expected = Number(item.quantity || 0);
        const remainingToReceive = Math.max(0, expected - alreadyReceived);
        const qty = Math.min(qtyRequested, remainingToReceive);
        if (qty <= 0) continue;
        const newReceived = Math.min(alreadyReceived + qty, expected);
        await supabase
          .from("purchase_items")
          .update({ received_quantity: newReceived })
          .eq("id", item.id);
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

  useEffect(() => {
    fetchPurchases();
    fetchInventoryItems();
    fetchSuppliers();
  }, [fetchPurchases, fetchInventoryItems, fetchSuppliers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Require supplier selection
      if (!formData.vendor_name) {
        toast({ title: "Supplier required", description: "Please select a supplier before saving.", variant: "destructive" });
        return;
      }

      // Compute totals from current items and tax settings to avoid state race conditions
      const subtotalNow = purchaseItems.reduce((sum, item) => sum + (Number(item.total_cost) || 0), 0);
      const taxNow = applyTax ? subtotalNow * ((orgTaxRate || 0) / 100) : 0;
      const totalNow = subtotalNow + taxNow;

      const purchaseData = {
        ...formData,
        purchase_number: formData.purchase_number || generatePurchaseNumber(),
        subtotal: Number(subtotalNow.toFixed(2)),
        tax_amount: Number(taxNow.toFixed(2)),
        total_amount: Number(totalNow.toFixed(2)),
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
        // Inventory levels are updated via the Receive workflow, not on purchase save
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
    
    await fetchItemsForEditing(purchase.id);
    calculateTotals();
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this purchase?")) {
      try {
        // Check if any items have been received; if so, block deletion until undone
        const { data: items, error: itemsErr } = await supabase
          .from("purchase_items")
          .select("received_quantity")
          .eq("purchase_id", id);
        if (itemsErr) throw itemsErr;

        const hasReceived = (items || []).some(it => Number(it.received_quantity || 0) > 0);
        if (hasReceived) {
          toast({ title: "Not allowed", description: "Undo receiving before deleting this purchase.", variant: "destructive" });
          return;
        }

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

  const filteredPurchases = purchases
    .filter((purchase) => (statusFilter === 'all' ? true : purchase.status === statusFilter))
    .filter((purchase) => (vendorFilter === 'all' ? true : purchase.vendor_name === vendorFilter))
    .filter((purchase) => {
      if (!dateFrom && !dateTo) return true;
      const d = (purchase.purchase_date || purchase.created_at || '').slice(0, 10);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    })
    .filter((purchase) =>
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

  const fetchAccountsForPayment = useCallback(async (): Promise<AccountOption[]> => {
    try {
      const orgId = organization?.id || null;
      let data: any[] | null = null;
      let error: any = null;
      try {
        const res = await supabase
          .from("accounts")
          .select("id, account_code, account_name, account_type, account_subtype, balance")
          .eq("account_type", "Asset")
          .in("account_subtype", ["Cash", "Bank"]) // Pay from cash or bank
          .order("account_code", { ascending: true })
          .maybeSingle === undefined // keep TS quiet in case of version differences
            ? await supabase
                .from("accounts")
                .select("id, account_code, account_name, account_type, account_subtype, balance")
                .eq("account_type", "Asset")
                .in("account_subtype", ["Cash", "Bank"]) // Pay from cash or bank
                .order("account_code", { ascending: true })
            : undefined;
        // If organization scoping exists, apply it
        if (orgId) {
          const scoped = await supabase
            .from("accounts")
            .select("id, account_code, account_name, account_type, account_subtype, balance")
            .eq("account_type", "Asset")
            .in("account_subtype", ["Cash", "Bank"]) // Pay from cash or bank
            .eq("organization_id", orgId)
            .order("account_code", { ascending: true });
          data = scoped.data as any[] | null;
          error = scoped.error;
        } else {
          data = (res as any)?.data as any[] | null;
          error = (res as any)?.error;
        }
      } catch (innerErr: any) {
        error = innerErr;
      }

      if (error) {
        const message = String(error?.message || "");
        if (message.includes("account_subtype") || (message.toLowerCase().includes("column") && message.toLowerCase().includes("does not exist"))) {
          // Fallback without subtype filter (will include all Asset accounts)
          const scoped = await supabase
            .from("accounts")
            .select("id, account_code, account_name, account_type, balance")
            .eq("account_type", "Asset")
            .order("account_code", { ascending: true });
          if (scoped.error) throw scoped.error;
          const allAsset = scoped.data as any[] | null;
          const filtered = (allAsset || []).filter((a: any) => {
            const name = String(a.account_name || "");
            return /cash/i.test(name) || /bank/i.test(name);
          });
          data = filtered;
        } else {
          throw error;
        }
      }

      const list = (data || []) as any as AccountOption[];
      setAccounts(list);
      return list;
    } catch (e: any) {
      console.warn("Failed to load accounts", e);
      setAccounts([]);
      return [];
    }
  }, [organization?.id]);

  const openPayDialog = async (purchaseId: string, totalAmount: number) => {
    setPayPurchaseId(purchaseId);
    const accs = await fetchAccountsForPayment();
    // Default to cash if present
    const cash = accs.find(a => a.account_code === '1001') || null;
    setSelectedAccountId(cash?.id || "");
    // Try compute remaining balance by summing existing payments if table exists; fallback to total
    try {
      const { data } = await supabase
        .from("purchase_payments")
        .select("amount")
        .eq("purchase_id", purchaseId);
      const paid = (data || []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
      const remaining = Math.max(0, Number(totalAmount || 0) - paid);
      setPayAmount(String(remaining.toFixed(2)));
    } catch {
      setPayAmount(String(Number(totalAmount || 0).toFixed(2)));
    }
    setPayReference("");
    setPayDate(new Date().toISOString().slice(0,10));
    setIsPayDialogOpen(true);
  };

  const submitPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payPurchaseId || !selectedAccountId) {
      toast({ title: "Error", description: "Select an account", variant: "destructive" });
      return;
    }
    const amt = parseFloat(payAmount || "0");
    if (isNaN(amt) || amt <= 0) {
      toast({ title: "Invalid amount", description: "Enter a positive amount", variant: "destructive" });
      return;
    }
    setPayLoading(true);
    try {
      const orgId = organization?.id;
      if (!orgId) throw new Error("No organization");
      const { error } = await supabase.rpc("pay_purchase", {
        p_org_id: orgId,
        p_purchase_id: payPurchaseId,
        p_account_id: selectedAccountId,
        p_amount: amt,
        p_payment_date: payDate,
        p_reference: payReference || null,
        p_notes: null,
      });
      if (error) throw error;


      toast({ title: "Paid", description: "Purchase payment recorded" });
      setIsPayDialogOpen(false);
      setPayPurchaseId(null);
      fetchPurchases();
    } catch (err: any) {
      console.error(err);
      toast({ title: "Error", description: err?.message || "Failed to pay purchase", variant: "destructive" });
    } finally {
      setPayLoading(false);
    }
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
    <div className="flex-1 space-y-6 p-4 sm:p-6 pb-24 sm:pb-6 bg-gradient-to-br from-slate-50 to-slate-100/50 min-h-screen overflow-x-hidden">
      {/* Modern Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-emerald-600 to-green-600 rounded-xl shadow-lg">
              <ShoppingCart className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Purchases</h1>
              <p className="text-slate-600">Manage vendor purchases and stock intake.</p>
            </div>
          </div>
        </div>

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingPurchase(null); resetForm(); }} className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 shadow-lg">
              <Plus className="mr-2 h-4 w-4" />
              Create Purchase
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-semibold tracking-tight">
                {editingPurchase ? "Edit Purchase" : "Create New Purchase"}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {editingPurchase ? "Update the purchase details and items. Totals recalculate automatically." : "Fill in purchase details, add items, and totals will auto-calculate."}
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
                  <Select value={formData.vendor_name} onValueChange={(value) => { const s = suppliers.find(x => x.name === value || x.id === value); setFormData({ ...formData, vendor_name: s?.name || '' }); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Populated from suppliers table */}
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.name || s.id}>{s.name || 'Unnamed Supplier'}</SelectItem>
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
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              value={item.quantity}
                              onChange={(e) => {
                                const qty = Number(e.target.value || 0);
                                setPurchaseItems(prev => prev.map((it, i) => i === index ? { ...it, quantity: qty, total_cost: qty * (it.unit_cost || 0) } : it));
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              min={0}
                              value={item.unit_cost}
                              onChange={(e) => {
                                const price = Number(e.target.value || 0);
                                setPurchaseItems(prev => prev.map((it, i) => i === index ? { ...it, unit_cost: price, total_cost: (it.quantity || 0) * price } : it));
                              }}
                            />
                          </TableCell>
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

      {/* Enhanced Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden border-0 shadow-lg">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-600 to-slate-700 opacity-95" />
          <CardHeader className="relative pb-2">
            <CardTitle className="text-sm font-medium text-white/90">Total Purchases</CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-white">{stats.total}</div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-lg">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500 to-amber-600 opacity-95" />
          <CardHeader className="relative pb-2">
            <CardTitle className="text-sm font-medium text-white/90">Pending</CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-white">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-lg">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-blue-600 opacity-95" />
          <CardHeader className="relative pb-2">
            <CardTitle className="text-sm font-medium text-white/90">Received</CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-white">{stats.received}</div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-lg">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-emerald-600 opacity-95" />
          <CardHeader className="relative pb-2">
            <CardTitle className="text-sm font-medium text-white/90">Total Value</CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-white">{formatMoney(stats.totalAmount)}</div>
            <p className="text-xs text-white/80">Received orders</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center gap-2 col-span-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search purchases..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="received">Received</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Vendor</Label>
          <Select value={vendorFilter} onValueChange={(value) => { const s = suppliers.find(x => x.name === value || x.id === value); setVendorFilter(s?.name || value); }} >
            <SelectTrigger>
              <SelectValue placeholder="All vendors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.name || s.id}>{s.name || 'Unnamed Supplier'}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2 col-span-2 lg:col-span-4">
          <div>
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Purchases Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Purchases</CardTitle>
          <CardDescription>Manage your product purchases and track stock replenishment.</CardDescription>
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
                    <TableCell>{format(new Date(purchase.purchase_date || purchase.created_at), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>{formatMoney(purchase.total_amount)}</TableCell>
                    <TableCell>
                      {getStatusBadge(purchase.status)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(purchase)}>Edit</Button>
                        {(purchase.status === 'pending' || purchase.status === 'partial') && (
                          <Button variant="outline" size="sm" onClick={() => openReceiveDialog(purchase.id)}>Receive Items</Button>
                        )}
                        {(purchase.status === 'partial' || purchase.status === 'received') && (
                          <Button variant="outline" size="sm" onClick={() => undoReceiving(purchase.id)}>Undo Receiving</Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openPayDialog(purchase.id, Number(purchase.total_amount || 0))}
                        >
                          Pay
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600"
                          disabled={purchase.status !== 'pending'}
                          onClick={() => handleDelete(purchase.id)}
                        >
                          Delete
                        </Button>
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
            <DialogTitle className="text-xl">Receive Purchase Items</DialogTitle>
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

      {/* Pay Dialog */}
      <Dialog open={isPayDialogOpen} onOpenChange={setIsPayDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Pay Purchase</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitPay} className="space-y-4">
            <div className="space-y-2">
              <Label>Account</Label>
              <select className="border rounded px-3 py-2 w-full" value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)}>
                <option value="">Select account</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.account_code} · {acc.account_name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input type="number" step="0.01" min="0" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reference</Label>
              <Input value={payReference} onChange={(e) => setPayReference(e.target.value)} placeholder="Optional" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsPayDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={payLoading}>{payLoading ? 'Paying...' : 'Pay'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}