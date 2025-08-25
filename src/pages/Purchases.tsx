import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";


import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Plus, Search, ShoppingCart, Package, TrendingUp, Truck, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { useOrganizationCurrency } from "@/lib/saas/hooks";
import { useToast } from "@/hooks/use-toast";
import { useSaas } from "@/lib/saas";
// removed modal tax toggle and org tax rate from list page
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit3, Truck as TruckIcon, Trash2, CreditCard, RefreshCw } from "lucide-react";
import { postDoubleEntry, findAccountIdByCode } from "@/utils/ledger";
import { postPurchaseInventoryCapitalization } from "@/utils/ledger";
import { deleteTransactionsByReference } from "@/utils/ledger";

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
  const navigate = useNavigate();
  const { organization } = useSaas();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  const { toast } = useToast();

  const { format: formatMoney } = useOrganizationCurrency();
  // removed totals calculation (moved to full page form)

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'partial' | 'received' | 'cancelled' | 'closed'>('all');
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

  // Receiving dialog state
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receivePurchaseId, setReceivePurchaseId] = useState<string | null>(null);
  const [receiveLocationId, setReceiveLocationId] = useState<string>("");
  const [receiveQuantities, setReceiveQuantities] = useState<Record<string, number>>({});
  const [selectedPurchaseItems, setSelectedPurchaseItems] = useState<PurchaseItem[]>([]);
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  // Fetch suppliers for the vendor filter (deduplicated)
  const fetchSuppliersAlt = useCallback(async () => {
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

  // Fetch purchases list
  const fetchPurchases = useCallback(async () => {
    try {
      setLoading(true);
      const buildBaseQuery = () =>
        supabase
          .from("purchases")
          .select(
            "id, purchase_number, vendor_name, purchase_date, subtotal, tax_amount, total_amount, status, notes, created_at, updated_at"
          )
          .order("created_at", { ascending: false });

      let data: any[] | null = null;
      let error: any = null;

      if (organization?.id) {
        const res = await buildBaseQuery().eq("organization_id", organization.id);
        data = res.data as any[] | null;
        error = res.error;
        if (error) {
          const message = String(error?.message || "").toLowerCase();
          if (message.includes("column") && message.includes("does not exist")) {
            const retry = await buildBaseQuery();
            if (retry.error) throw retry.error;
            data = retry.data as any[] | null;
            error = null;
          } else {
            throw error;
          }
        }
      } else {
        const res = await buildBaseQuery();
        data = res.data as any[] | null;
        error = res.error;
        if (error) throw error;
      }

      setPurchases((data || []) as Purchase[]);
    } catch (err) {
      console.error("Error fetching purchases:", err);
      setPurchases([]);
      toast({ title: "Error", description: "Failed to load purchases", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [organization?.id, toast]);

  // Open Receive dialog: load items, locations, and default location
  const openReceiveDialog = async (purchaseId: string) => {
    try {
      setReceivePurchaseId(purchaseId);
      // Load locations, items and purchase (for existing location)
      const [locsRes, itemsRes, purchaseRes] = await Promise.all([
        supabase.from("business_locations").select("id, name").eq('organization_id', organization?.id || '').order("name"),
        supabase
          .from("purchase_items")
          .select(`id, item_id, quantity, unit_cost, total_cost, received_quantity, inventory_items (name)`) 
          .eq("purchase_id", purchaseId),
        supabase.from("purchases").select("location_id").eq("id", purchaseId).single(),
      ]);

      if (locsRes.error) throw locsRes.error;
      if (itemsRes.error) throw itemsRes.error;

      const locs = (locsRes.data || []) as StorageLocation[];
      setLocations(locs);
      setSelectedPurchaseItems((itemsRes.data || []) as unknown as PurchaseItem[]);

      const existingLocationId = (purchaseRes.data as any)?.location_id || "";
      const defaultLocationId = existingLocationId || (locs.length > 0 ? locs[0].id : "");
      setReceiveLocationId(defaultLocationId);

      // Pre-fill quantities with remaining amounts (optional: keep empty to force user input)
      const prefill: Record<string, number> = {};
      (itemsRes.data || []).forEach((it: any) => {
        const remaining = Math.max(0, Number(it.quantity || 0) - Number(it.received_quantity || 0));
        if (remaining > 0) prefill[it.item_id] = remaining;
      });
      setReceiveQuantities(prefill);

      setReceiveOpen(true);
    } catch (err: any) {
      console.error("Error opening receive dialog:", err);
      toast({ title: "Error", description: err?.message || "Failed to open receive dialog", variant: "destructive" });
    }
  };

  // Submit receiving quantities
  const submitReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivePurchaseId) return;
    try {
      if (!receiveLocationId) {
        toast({ title: "Select location", description: "Please choose a location to receive into.", variant: "destructive" });
        return;
      }

      // Update purchase location
      const { error: upErr } = await supabase
        .from("purchases")
        .update({ location_id: receiveLocationId })
        .eq("id", receivePurchaseId);
      if (upErr) throw upErr;

      // Prepare and run item updates
      const updates = selectedPurchaseItems
        .map((it) => {
          const add = Number(receiveQuantities[it.item_id] || 0);
          if (!add || add <= 0) return null;
          const currentReceived = Number(it.received_quantity || 0);
          const maxQty = Number(it.quantity || 0);
          const newReceived = Math.min(maxQty, currentReceived + add);
          if (newReceived === currentReceived) return null;
          return { id: it.id, received_quantity: newReceived };
        })
        .filter(Boolean) as { id: string; received_quantity: number }[];

      if (updates.length === 0) {
        toast({ title: "No quantities", description: "Enter at least one quantity to receive.", variant: "destructive" });
        return;
      }

      // Supabase: update per item id in parallel
      await Promise.all(
        updates.map((u) =>
          supabase.from("purchase_items").update({ received_quantity: u.received_quantity }).eq("id", u.id)
        )
      );

      // Post inventory capitalization per received delta for each item
      try {
        if (organization?.id) {
          for (const it of selectedPurchaseItems) {
            const add = Number(receiveQuantities[it.item_id] || 0);
            if (add > 0) {
              await postPurchaseInventoryCapitalization({
                organizationId: organization.id,
                itemId: it.item_id,
                quantity: add,
                unitCost: Number(it.unit_cost || 0),
                date: new Date().toISOString().slice(0,10),
                locationId: receiveLocationId || null,
                referenceId: receivePurchaseId,
              });
            }
          }
        }
      } catch (ledgerErr) {
        console.warn("Inventory capitalization posting failed", ledgerErr);
      }

      // Ensure a Goods Received record is created so the receipt appears in the list
      try {
        const itemsPayload = selectedPurchaseItems
          .map((it) => {
            const qty = Number(receiveQuantities[it.item_id] || 0);
            if (!qty || qty <= 0) return null;
            return { 
              purchase_item_id: it.id, 
              quantity: qty,
              item_id: it.item_id,
              unit_cost: it.unit_cost || 0
            };
          })
          .filter(Boolean) as Array<{ purchase_item_id: string; quantity: number; item_id: string; unit_cost: number }>;

        if (itemsPayload.length > 0 && receivePurchaseId) {
          const headerRow: any = {
            purchase_id: receivePurchaseId,
            received_date: new Date().toISOString().slice(0, 10),
            location_id: receiveLocationId || null,
          };
          if (organization?.id) headerRow.organization_id = organization.id;

          const { data: header, error: headerErr } = await supabase
            .from("goods_received")
            .insert([headerRow])
            .select("id")
            .single();
          if (!headerErr && header?.id) {
            const lines = itemsPayload.map((it) => ({
              goods_received_id: header.id,
              item_id: it.item_id,
              purchase_item_id: it.purchase_item_id,
              quantity: it.quantity,
              unit_cost: it.unit_cost || 0,
            }));
            await supabase.from("goods_received_items").insert(lines);
          }
        }
      } catch (ignore) {
        // Non-blocking: environments may not have these tables
      }

      // After updating items, recompute and update purchase status
      try {
        const { data: allItems, error: allErr } = await supabase
          .from("purchase_items")
          .select("quantity, received_quantity")
          .eq("purchase_id", receivePurchaseId);
        if (allErr) throw allErr;
        const list = (allItems || []) as Array<{ quantity: number; received_quantity: number }>;
        const anyReceived = list.some(it => Number(it.received_quantity || 0) > 0);
        const allReceived = list.length > 0 && list.every(it => Number(it.received_quantity || 0) >= Number(it.quantity || 0));
        const newStatus = allReceived ? "received" : (anyReceived ? "partial" : "pending");
        await supabase.from("purchases").update({ status: newStatus }).eq("id", receivePurchaseId);
      } catch {}

      toast({ title: "Received", description: "Items received successfully" });
      setReceiveOpen(false);
      setReceivePurchaseId(null);
      setReceiveQuantities({});
      setSelectedPurchaseItems([]);
      await fetchPurchases();
      navigate("/goods-received");
    } catch (err: any) {
      console.error(err);
      toast({ title: "Error", description: err?.message || "Failed to receive items", variant: "destructive" });
    }
  };

  // Undo all receiving for a purchase
  const undoReceiving = async (purchaseId: string) => {
    try {
      const { data: items, error } = await supabase
        .from("purchase_items")
        .select("id, received_quantity")
        .eq("purchase_id", purchaseId);
      if (error) throw error;

      const toReset = (items || []).filter((it: any) => Number(it.received_quantity || 0) > 0);
      if (toReset.length === 0) {
        toast({ title: "Nothing to undo", description: "No items have been received for this purchase." });
        return;
      }

      await Promise.all(
        toReset.map((it: any) => supabase.from("purchase_items").update({ received_quantity: 0 }).eq("id", it.id))
      );

      // Reset purchase status to pending after undo
      try {
        await supabase.from("purchases").update({ status: "pending" }).eq("id", purchaseId);
      } catch {}

      toast({ title: "Receiving undone", description: "All received quantities reset" });
      await fetchPurchases();
    } catch (err: any) {
      console.error(err);
      toast({ title: "Error", description: err?.message || "Failed to undo receiving", variant: "destructive" });
    }
  };

  
  useEffect(() => {
    fetchPurchases();
    fetchSuppliersAlt();
  }, [fetchPurchases, fetchSuppliersAlt]);

  // removed handleSubmit (migrated to full page form)

  const handleEdit = (purchase: Purchase) => {
    navigate(`/purchases/${purchase.id}/edit`);
  };
  const handleView = (purchase: Purchase) => {
    navigate(`/purchases/${purchase.id}`);
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

        // Best-effort: remove any ledger entries related to this purchase payment
        try {
          await deleteTransactionsByReference("purchase_payment", id);
        } catch {}

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

  // removed resetForm (no longer needed here)

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
      closed: "bg-gray-200 text-gray-800",
    } as const;

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

      // After successful payment, mark purchase as closed
      try {
        await supabase.from("purchases").update({ status: "closed" }).eq("id", payPurchaseId);
      } catch {}

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
        <div className="flex items-center gap-2 self-start lg:self-auto">
          <Button onClick={() => navigate("/purchases/new")} className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 shadow-lg">
            <Plus className="mr-2 h-4 w-4" />
            Create Purchase
          </Button>
          <Button variant="outline" className="shadow" onClick={fetchPurchases}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
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
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="received">Received</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
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
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2">
                              <MoreHorizontal className="h-4 w-4" />
                              Actions
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => handleEdit(purchase)} className="gap-2">
                              <Edit3 className="h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleView(purchase)} className="gap-2">
                              <FileText className="h-4 w-4" /> View
                            </DropdownMenuItem>
                            {(purchase.status === 'pending' || purchase.status === 'partial') && (
                              <DropdownMenuItem onClick={() => navigate(`/goods-received/new?purchaseId=${purchase.id}`)} className="gap-2">
                                <TruckIcon className="h-4 w-4" /> Receive Items
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => openPayDialog(purchase.id, Number(purchase.total_amount || 0))}
                              className="gap-2"
                              disabled={purchase.status === 'closed'}
                            >
                              <CreditCard className="h-4 w-4" /> Pay
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="gap-2 text-red-600 focus:text-red-600"
                              disabled={purchase.status !== 'pending'}
                              onClick={() => handleDelete(purchase.id)}
                            >
                              <Trash2 className="h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>


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
                <Input type="number" step="0.01" min="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
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